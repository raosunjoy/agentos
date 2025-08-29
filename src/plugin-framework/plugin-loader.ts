/**
 * Dynamic plugin loading and unloading system
 * Handles secure plugin instantiation and lifecycle management
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  AgentOSPlugin,
  PluginFactory,
  PluginModule
} from './plugin-interface';
import {
  PluginMetadata,
  PluginContext,
  PluginSandbox,
  PluginValidationResult,
  PluginEvent,
  PluginEventData,
  ResourceLimits
} from './types';
import { PluginValidator } from './plugin-validator';
import { PluginSandboxManager } from './plugin-sandbox';

export class PluginLoader extends EventEmitter {
  private loadedPlugins = new Map<string, LoadedPlugin>();
  private pluginValidator: PluginValidator;
  private sandboxManager: PluginSandboxManager;
  private pluginPaths: string[];

  constructor(pluginPaths: string[] = []) {
    super();
    this.pluginPaths = pluginPaths;
    this.pluginValidator = new PluginValidator();
    this.sandboxManager = new PluginSandboxManager();
  }

  /**
   * Load a plugin from a file path or package
   */
  async loadPlugin(pluginPath: string, context: PluginContext): Promise<AgentOSPlugin> {
    try {
      // Validate plugin before loading
      const validationResult = await this.validatePlugin(pluginPath);
      if (!validationResult.valid) {
        throw new Error(`Plugin validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Read plugin metadata
      const metadata = await this.readPluginMetadata(pluginPath);
      
      // Check if plugin is already loaded
      if (this.loadedPlugins.has(metadata.id)) {
        throw new Error(`Plugin ${metadata.id} is already loaded`);
      }

      // Create sandbox for the plugin
      const sandbox = await this.sandboxManager.createSandbox(metadata.id, {
        pluginId: metadata.id,
        isolatedContext: true,
        resourceLimits: this.getDefaultResourceLimits(),
        allowedAPIs: this.getAllowedAPIs(metadata),
        networkAccess: this.hasNetworkPermission(metadata),
        fileSystemAccess: this.hasFileSystemPermission(metadata)
      });

      // Load plugin module in sandbox
      const pluginModule = await this.loadPluginModule(pluginPath, sandbox);
      
      // Create plugin instance
      const pluginFactory = pluginModule.default;
      const plugin = pluginFactory.createPlugin();

      // Initialize plugin with context
      await plugin.initialize(context);

      // Store loaded plugin
      const loadedPlugin: LoadedPlugin = {
        plugin,
        metadata,
        sandbox,
        loadedAt: new Date(),
        pluginPath
      };
      
      this.loadedPlugins.set(metadata.id, loadedPlugin);

      // Emit plugin loaded event
      this.emitPluginEvent('plugin:installed', metadata.id, { metadata });

      return plugin;
    } catch (error) {
      this.emitPluginEvent('plugin:error', pluginPath, { error: error.message });
      throw error;
    }
  }

  /**
   * Unload a plugin and cleanup resources
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.loadedPlugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    try {
      // Cleanup plugin resources
      await loadedPlugin.plugin.cleanup();

      // Destroy sandbox
      await this.sandboxManager.destroySandbox(pluginId);

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginId);

      // Emit plugin unloaded event
      this.emitPluginEvent('plugin:uninstalled', pluginId);
    } catch (error) {
      this.emitPluginEvent('plugin:error', pluginId, { error: error.message });
      throw error;
    }
  }

  /**
   * Reload a plugin (unload and load again)
   */
  async reloadPlugin(pluginId: string, context: PluginContext): Promise<AgentOSPlugin> {
    const loadedPlugin = this.loadedPlugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    const pluginPath = loadedPlugin.pluginPath;
    await this.unloadPlugin(pluginId);
    return this.loadPlugin(pluginPath, context);
  }

  /**
   * Get a loaded plugin instance
   */
  getPlugin(pluginId: string): AgentOSPlugin | undefined {
    return this.loadedPlugins.get(pluginId)?.plugin;
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): Map<string, AgentOSPlugin> {
    const plugins = new Map<string, AgentOSPlugin>();
    for (const [id, loadedPlugin] of this.loadedPlugins) {
      plugins.set(id, loadedPlugin.plugin);
    }
    return plugins;
  }

  /**
   * Check if a plugin is loaded
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Discover plugins in configured paths
   */
  async discoverPlugins(): Promise<string[]> {
    const discoveredPlugins: string[] = [];

    for (const pluginPath of this.pluginPaths) {
      try {
        const entries = await fs.readdir(pluginPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginDir = path.join(pluginPath, entry.name);
            const manifestPath = path.join(pluginDir, 'plugin.json');
            
            try {
              await fs.access(manifestPath);
              discoveredPlugins.push(pluginDir);
            } catch {
              // No manifest file, skip
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to scan plugin path ${pluginPath}:`, error.message);
      }
    }

    return discoveredPlugins;
  }

  /**
   * Load plugin module with sandbox isolation
   */
  private async loadPluginModule(pluginPath: string, sandbox: PluginSandbox): Promise<PluginModule> {
    const mainFile = await this.findMainFile(pluginPath);
    const modulePath = path.join(pluginPath, mainFile);

    // Use dynamic import with sandbox context
    const module = await this.sandboxManager.loadModule(modulePath, sandbox);
    
    if (!module.default || typeof module.default.createPlugin !== 'function') {
      throw new Error('Plugin must export a default factory with createPlugin method');
    }

    return module as PluginModule;
  }

  /**
   * Find the main entry file for a plugin
   */
  private async findMainFile(pluginPath: string): Promise<string> {
    const packageJsonPath = path.join(pluginPath, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.main || 'index.js';
    } catch {
      // Try common entry files
      const commonFiles = ['index.js', 'index.ts', 'main.js', 'main.ts', 'plugin.js', 'plugin.ts'];
      
      for (const file of commonFiles) {
        try {
          await fs.access(path.join(pluginPath, file));
          return file;
        } catch {
          // Continue to next file
        }
      }
      
      throw new Error('Could not find plugin entry file');
    }
  }

  /**
   * Read plugin metadata from manifest
   */
  private async readPluginMetadata(pluginPath: string): Promise<PluginMetadata> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const metadata = JSON.parse(manifestContent) as PluginMetadata;
      
      // Validate required fields
      if (!metadata.id || !metadata.name || !metadata.version) {
        throw new Error('Plugin manifest missing required fields (id, name, version)');
      }
      
      return metadata;
    } catch (error) {
      throw new Error(`Failed to read plugin manifest: ${error.message}`);
    }
  }

  /**
   * Validate plugin before loading
   */
  private async validatePlugin(pluginPath: string): Promise<PluginValidationResult> {
    return this.pluginValidator.validatePlugin(pluginPath);
  }

  /**
   * Get default resource limits for plugins
   */
  private getDefaultResourceLimits(): ResourceLimits {
    return {
      maxMemoryMB: 128,
      maxCPUPercent: 10,
      maxNetworkBandwidthKBps: 1024,
      maxStorageMB: 50,
      maxExecutionTimeMs: 30000
    };
  }

  /**
   * Get allowed APIs based on plugin permissions
   */
  private getAllowedAPIs(metadata: PluginMetadata): string[] {
    const allowedAPIs: string[] = ['console', 'setTimeout', 'clearTimeout'];
    
    for (const permission of metadata.permissions) {
      switch (permission.type) {
        case 'data':
          allowedAPIs.push('dataAccess');
          break;
        case 'system':
          allowedAPIs.push('systemAccess');
          break;
        case 'network':
          allowedAPIs.push('fetch', 'XMLHttpRequest');
          break;
        case 'hardware':
          allowedAPIs.push('navigator');
          break;
      }
    }
    
    return allowedAPIs;
  }

  /**
   * Check if plugin has network permission
   */
  private hasNetworkPermission(metadata: PluginMetadata): boolean {
    return metadata.permissions.some(p => p.type === 'network');
  }

  /**
   * Check if plugin has file system permission
   */
  private hasFileSystemPermission(metadata: PluginMetadata): boolean {
    return metadata.permissions.some(p => p.type === 'system' && p.resource === 'filesystem');
  }

  /**
   * Emit plugin event
   */
  private emitPluginEvent(event: PluginEvent, pluginId: string, data?: any): void {
    const eventData: PluginEventData = {
      pluginId,
      event,
      timestamp: new Date(),
      data,
      error: data?.error
    };
    
    this.emit('pluginEvent', eventData);
    this.emit(event, eventData);
  }
}

interface LoadedPlugin {
  plugin: AgentOSPlugin;
  metadata: PluginMetadata;
  sandbox: PluginSandbox;
  loadedAt: Date;
  pluginPath: string;
}