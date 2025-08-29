/**
 * Main plugin manager that orchestrates all plugin operations
 * Provides the primary interface for plugin lifecycle management
 */

import { EventEmitter } from 'events';
import { PluginLoader } from './plugin-loader';
import { PluginRegistry } from './plugin-registry';
import { PluginValidator } from './plugin-validator';
import { PluginSandboxManager } from './plugin-sandbox';
import { AgentOSPlugin } from './plugin-interface';
import {
  PluginMetadata,
  PluginContext,
  PluginRegistryEntry,
  PluginEvent,
  PluginEventData,
  IntentDefinition,
  IntentResult,
  DataAccessInterface,
  SystemAccessInterface,
  PluginLogger,
  ResourceLimits
} from './types';
import { PluginFrameworkConfig } from './index';

export class PluginManager extends EventEmitter {
  private loader: PluginLoader;
  private registry: PluginRegistry;
  private validator: PluginValidator;
  private sandboxManager: PluginSandboxManager;
  private intentHandlers = new Map<string, { pluginId: string; handler: AgentOSPlugin }>();
  private config: PluginFrameworkConfig;
  private initialized = false;

  constructor(config: PluginFrameworkConfig) {
    super();
    this.config = config;
    
    this.loader = new PluginLoader(config.pluginPaths);
    this.registry = new PluginRegistry(config.registryPath, config.pluginPaths);
    this.validator = new PluginValidator();
    this.sandboxManager = new PluginSandboxManager();

    this.setupEventHandlers();
  }

  /**
   * Initialize the plugin manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.registry.initialize();
    
    // Auto-load enabled plugins
    await this.loadEnabledPlugins();
    
    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Install a plugin from a path
   */
  async installPlugin(pluginPath: string, userId: string): Promise<void> {
    try {
      // Validate plugin first
      const validationResult = await this.validator.validatePlugin(pluginPath);
      if (!validationResult.valid) {
        throw new Error(`Plugin validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Read plugin metadata
      const metadata = await this.readPluginMetadata(pluginPath);
      
      // Check compatibility
      const compatibility = this.registry.validateCompatibility(metadata);
      if (!compatibility.compatible) {
        throw new Error(`Plugin incompatible: ${compatibility.issues.join(', ')}`);
      }

      // Register plugin
      await this.registry.registerPlugin(metadata, pluginPath);
      
      // Load plugin if auto-enable is configured
      if (this.shouldAutoEnable(metadata)) {
        await this.enablePlugin(metadata.id, userId);
      }

      this.emit('pluginInstalled', { pluginId: metadata.id, metadata });
    } catch (error) {
      this.emit('pluginError', { error: error.message, pluginPath });
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    try {
      // Disable plugin first if enabled
      if (this.isPluginEnabled(pluginId)) {
        await this.disablePlugin(pluginId);
      }

      // Unregister from registry
      await this.registry.unregisterPlugin(pluginId);
      
      this.emit('pluginUninstalled', { pluginId });
    } catch (error) {
      this.emit('pluginError', { error: error.message, pluginId });
      throw error;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string, userId: string): Promise<void> {
    try {
      const registryEntry = this.registry.getPlugin(pluginId);
      if (!registryEntry) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      if (registryEntry.status === 'enabled') {
        return; // Already enabled
      }

      // Create plugin context
      const context = this.createPluginContext(pluginId, userId);
      
      // Load plugin
      const plugin = await this.loader.loadPlugin(registryEntry.installPath, context);
      
      // Register intent handlers
      await this.registerPluginIntents(pluginId, plugin);
      
      // Update registry status
      await this.registry.updatePluginStatus(pluginId, 'enabled');
      
      this.emit('pluginEnabled', { pluginId });
    } catch (error) {
      await this.registry.updatePluginStatus(pluginId, 'error', error.message);
      this.emit('pluginError', { error: error.message, pluginId });
      throw error;
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    try {
      // Unregister intent handlers
      await this.unregisterPluginIntents(pluginId);
      
      // Unload plugin
      await this.loader.unloadPlugin(pluginId);
      
      // Update registry status
      await this.registry.updatePluginStatus(pluginId, 'disabled');
      
      this.emit('pluginDisabled', { pluginId });
    } catch (error) {
      this.emit('pluginError', { error: error.message, pluginId });
      throw error;
    }
  }

  /**
   * Handle an intent request
   */
  async handleIntent(intent: string, parameters: object, userId: string): Promise<IntentResult> {
    const handler = this.intentHandlers.get(intent);
    if (!handler) {
      return {
        success: false,
        error: `No handler found for intent: ${intent}`
      };
    }

    try {
      const context = this.createPluginContext(handler.pluginId, userId);
      const result = await handler.handler.handle(intent, parameters, context);
      
      // Update performance metrics
      await this.updatePluginMetrics(handler.pluginId);
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: `Intent handling failed: ${error.message}`
      };
    }
  }

  /**
   * Get all available intents
   */
  getAvailableIntents(): IntentDefinition[] {
    const intents: IntentDefinition[] = [];
    
    for (const [pluginId, entry] of this.registry.getAllPlugins()) {
      if (entry.status === 'enabled') {
        intents.push(...entry.metadata.intents);
      }
    }
    
    return intents;
  }

  /**
   * Get plugin information
   */
  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.registry.getPlugin(pluginId);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): Map<string, PluginRegistryEntry> {
    return this.registry.getAllPlugins();
  }

  /**
   * Search plugins
   */
  searchPlugins(criteria: {
    name?: string;
    author?: string;
    keywords?: string[];
    status?: PluginRegistryEntry['status'];
  }): PluginRegistryEntry[] {
    let results = this.registry.searchPlugins(criteria);
    
    if (criteria.status) {
      results = results.filter(entry => entry.status === criteria.status);
    }
    
    return results;
  }

  /**
   * Check if plugin is enabled
   */
  isPluginEnabled(pluginId: string): boolean {
    const entry = this.registry.getPlugin(pluginId);
    return entry?.status === 'enabled';
  }

  /**
   * Get plugin statistics
   */
  getStatistics() {
    return this.registry.getStatistics();
  }

  /**
   * Check for plugin updates
   */
  async checkForUpdates(pluginId?: string) {
    return this.registry.checkForUpdates(pluginId);
  }

  /**
   * Update a plugin
   */
  async updatePlugin(pluginId: string, userId: string): Promise<void> {
    const updates = await this.checkForUpdates(pluginId);
    const update = updates.find(u => u.pluginId === pluginId);
    
    if (!update) {
      throw new Error(`No updates available for plugin ${pluginId}`);
    }

    // Disable current version
    if (this.isPluginEnabled(pluginId)) {
      await this.disablePlugin(pluginId);
    }

    // Update metadata
    await this.registry.updatePlugin(pluginId, update.metadata);
    
    // Re-enable if it was enabled before
    const entry = this.registry.getPlugin(pluginId);
    if (entry && entry.status !== 'error') {
      await this.enablePlugin(pluginId, userId);
    }
  }

  /**
   * Discover new plugins in configured paths
   */
  async discoverPlugins(): Promise<string[]> {
    return this.loader.discoverPlugins();
  }

  // Private methods

  private async loadEnabledPlugins(): Promise<void> {
    const enabledPlugins = this.registry.getPluginsByStatus('enabled');
    
    for (const entry of enabledPlugins) {
      try {
        // Create a system context for auto-loading
        const context = this.createPluginContext(entry.metadata.id, 'system');
        await this.loader.loadPlugin(entry.installPath, context);
        await this.registerPluginIntents(entry.metadata.id, this.loader.getPlugin(entry.metadata.id)!);
      } catch (error) {
        console.warn(`Failed to auto-load plugin ${entry.metadata.id}:`, error.message);
        await this.registry.updatePluginStatus(entry.metadata.id, 'error', error.message);
      }
    }
  }

  private createPluginContext(pluginId: string, userId: string): PluginContext {
    const entry = this.registry.getPlugin(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const permissions = new Set(entry.metadata.permissions.map(p => `${p.type}:${p.resource}:${p.access}`));
    
    return {
      pluginId,
      userId,
      sessionId: this.generateSessionId(),
      permissions,
      dataAccess: this.createDataAccessInterface(pluginId, permissions),
      systemAccess: this.createSystemAccessInterface(pluginId, permissions),
      logger: this.createPluginLogger(pluginId)
    };
  }

  private createDataAccessInterface(pluginId: string, permissions: Set<string>): DataAccessInterface {
    return {
      async read(schema: string, query: object): Promise<any[]> {
        if (!permissions.has(`data:${schema}:read`)) {
          throw new Error(`Plugin ${pluginId} lacks permission to read ${schema}`);
        }
        // Implementation would integrate with the semantic data layer
        return [];
      },
      
      async write(schema: string, data: object): Promise<string> {
        if (!permissions.has(`data:${schema}:write`)) {
          throw new Error(`Plugin ${pluginId} lacks permission to write ${schema}`);
        }
        // Implementation would integrate with the semantic data layer
        return 'generated-id';
      },
      
      async update(schema: string, id: string, data: object): Promise<boolean> {
        if (!permissions.has(`data:${schema}:write`)) {
          throw new Error(`Plugin ${pluginId} lacks permission to update ${schema}`);
        }
        // Implementation would integrate with the semantic data layer
        return true;
      },
      
      async delete(schema: string, id: string): Promise<boolean> {
        if (!permissions.has(`data:${schema}:write`)) {
          throw new Error(`Plugin ${pluginId} lacks permission to delete ${schema}`);
        }
        // Implementation would integrate with the semantic data layer
        return true;
      },
      
      subscribe(schema: string, callback: (data: any) => void): () => void {
        if (!permissions.has(`data:${schema}:read`)) {
          throw new Error(`Plugin ${pluginId} lacks permission to subscribe to ${schema}`);
        }
        // Implementation would integrate with the semantic data layer
        return () => {}; // Unsubscribe function
      }
    };
  }

  private createSystemAccessInterface(pluginId: string, permissions: Set<string>): SystemAccessInterface {
    return {
      async sendNotification(title: string, message: string, options?): Promise<void> {
        if (!permissions.has('system:notifications:write')) {
          throw new Error(`Plugin ${pluginId} lacks permission to send notifications`);
        }
        // Implementation would integrate with the system notification service
      },
      
      async requestPermission(permission: string): Promise<boolean> {
        // Implementation would show user consent dialog
        return false;
      },
      
      async executeWorkflow(workflowId: string, parameters: object) {
        if (!permissions.has('system:workflows:execute')) {
          throw new Error(`Plugin ${pluginId} lacks permission to execute workflows`);
        }
        // Implementation would integrate with the workflow orchestrator
        return { success: true, result: null, executionId: 'workflow-id' };
      },
      
      async registerIntent(intent: IntentDefinition): Promise<boolean> {
        // Implementation would register the intent with the NLP engine
        return true;
      },
      
      async unregisterIntent(intentId: string): Promise<boolean> {
        // Implementation would unregister the intent from the NLP engine
        return true;
      }
    };
  }

  private createPluginLogger(pluginId: string): PluginLogger {
    return {
      debug: (message: string, ...args: any[]) => console.debug(`[${pluginId}] ${message}`, ...args),
      info: (message: string, ...args: any[]) => console.info(`[${pluginId}] ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[${pluginId}] ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[${pluginId}] ${message}`, ...args)
    };
  }

  private async registerPluginIntents(pluginId: string, plugin: AgentOSPlugin): Promise<void> {
    const intents = plugin.getIntents();
    
    for (const intent of intents) {
      if (this.intentHandlers.has(intent.intentId)) {
        throw new Error(`Intent ${intent.intentId} is already registered`);
      }
      
      this.intentHandlers.set(intent.intentId, { pluginId, handler: plugin });
    }
  }

  private async unregisterPluginIntents(pluginId: string): Promise<void> {
    const toRemove: string[] = [];
    
    for (const [intentId, handler] of this.intentHandlers) {
      if (handler.pluginId === pluginId) {
        toRemove.push(intentId);
      }
    }
    
    for (const intentId of toRemove) {
      this.intentHandlers.delete(intentId);
    }
  }

  private async updatePluginMetrics(pluginId: string): Promise<void> {
    const metrics = this.sandboxManager.getPerformanceMetrics(pluginId);
    if (metrics) {
      await this.registry.updatePerformanceMetrics(pluginId, metrics);
    }
  }

  private async readPluginMetadata(pluginPath: string): Promise<PluginMetadata> {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  private shouldAutoEnable(metadata: PluginMetadata): boolean {
    // Auto-enable plugins that don't require sensitive permissions
    const sensitivePermissions = ['system:execute', 'network:*', 'data:*:write'];
    
    return !metadata.permissions.some(p => 
      sensitivePermissions.some(sp => 
        sp === '*' || sp === `${p.type}:${p.resource}:${p.access}` || sp === `${p.type}:*`
      )
    );
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventHandlers(): void {
    // Forward events from sub-components
    this.loader.on('pluginEvent', (event: PluginEventData) => {
      this.emit('pluginEvent', event);
      this.emit(event.event, event);
    });

    this.registry.on('pluginEvent', (event: PluginEventData) => {
      this.emit('pluginEvent', event);
      this.emit(event.event, event);
    });
  }
}