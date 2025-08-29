/**
 * Plugin registry with version management and discovery
 * Manages plugin installation, updates, and metadata storage
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  PluginMetadata,
  PluginRegistryEntry,
  PluginEvent,
  PluginEventData,
  PluginPerformanceMetrics
} from './types';

export class PluginRegistry extends EventEmitter {
  private registry = new Map<string, PluginRegistryEntry>();
  private registryPath: string;
  private pluginPaths: string[];

  constructor(registryPath: string, pluginPaths: string[] = []) {
    super();
    this.registryPath = registryPath;
    this.pluginPaths = pluginPaths;
  }

  /**
   * Initialize the registry and load existing plugins
   */
  async initialize(): Promise<void> {
    await this.ensureRegistryDirectory();
    await this.loadRegistry();
    await this.scanPluginDirectories();
  }

  /**
   * Register a new plugin
   */
  async registerPlugin(metadata: PluginMetadata, installPath: string): Promise<void> {
    if (this.registry.has(metadata.id)) {
      throw new Error(`Plugin ${metadata.id} is already registered`);
    }

    const entry: PluginRegistryEntry = {
      metadata,
      status: 'installed',
      installPath,
      lastLoaded: undefined,
      errorMessage: undefined,
      performanceMetrics: undefined
    };

    this.registry.set(metadata.id, entry);
    await this.saveRegistry();

    this.emitPluginEvent('plugin:installed', metadata.id, { metadata });
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    this.registry.delete(pluginId);
    await this.saveRegistry();

    this.emitPluginEvent('plugin:uninstalled', pluginId);
  }

  /**
   * Update plugin metadata
   */
  async updatePlugin(pluginId: string, newMetadata: PluginMetadata): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    const oldVersion = entry.metadata.version;
    entry.metadata = { ...newMetadata, updatedAt: new Date() };
    
    await this.saveRegistry();

    this.emitPluginEvent('plugin:installed', pluginId, { 
      metadata: newMetadata, 
      oldVersion 
    });
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Map<string, PluginRegistryEntry> {
    return new Map(this.registry);
  }

  /**
   * Get plugins by status
   */
  getPluginsByStatus(status: PluginRegistryEntry['status']): PluginRegistryEntry[] {
    return Array.from(this.registry.values()).filter(entry => entry.status === status);
  }

  /**
   * Search plugins by criteria
   */
  searchPlugins(criteria: {
    name?: string;
    author?: string;
    keywords?: string[];
    version?: string;
  }): PluginRegistryEntry[] {
    return Array.from(this.registry.values()).filter(entry => {
      const metadata = entry.metadata;
      
      if (criteria.name && !metadata.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      
      if (criteria.author && !metadata.author.toLowerCase().includes(criteria.author.toLowerCase())) {
        return false;
      }
      
      if (criteria.keywords && criteria.keywords.length > 0) {
        const hasKeyword = criteria.keywords.some(keyword => 
          metadata.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
        );
        if (!hasKeyword) return false;
      }
      
      if (criteria.version && metadata.version !== criteria.version) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Update plugin status
   */
  async updatePluginStatus(
    pluginId: string, 
    status: PluginRegistryEntry['status'], 
    errorMessage?: string
  ): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    const oldStatus = entry.status;
    entry.status = status;
    entry.errorMessage = errorMessage;
    
    if (status === 'enabled') {
      entry.lastLoaded = new Date();
    }

    await this.saveRegistry();

    // Emit appropriate event based on status change
    if (oldStatus !== status) {
      switch (status) {
        case 'enabled':
          this.emitPluginEvent('plugin:enabled', pluginId);
          break;
        case 'disabled':
          this.emitPluginEvent('plugin:disabled', pluginId);
          break;
        case 'error':
          this.emitPluginEvent('plugin:error', pluginId, { error: errorMessage });
          break;
      }
    }
  }

  /**
   * Update plugin performance metrics
   */
  async updatePerformanceMetrics(
    pluginId: string, 
    metrics: PluginPerformanceMetrics
  ): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    entry.performanceMetrics = metrics;
    await this.saveRegistry();
  }

  /**
   * Check for plugin updates
   */
  async checkForUpdates(pluginId?: string): Promise<UpdateInfo[]> {
    const updates: UpdateInfo[] = [];
    const pluginsToCheck = pluginId 
      ? [this.registry.get(pluginId)].filter(Boolean) as PluginRegistryEntry[]
      : Array.from(this.registry.values());

    for (const entry of pluginsToCheck) {
      try {
        // Re-read plugin metadata from disk to check for updates
        const currentMetadata = await this.readPluginMetadata(entry.installPath);
        
        if (this.isNewerVersion(currentMetadata.version, entry.metadata.version)) {
          updates.push({
            pluginId: entry.metadata.id,
            currentVersion: entry.metadata.version,
            availableVersion: currentMetadata.version,
            metadata: currentMetadata
          });
        }
      } catch (error) {
        console.warn(`Failed to check updates for plugin ${entry.metadata.id}:`, error.message);
      }
    }

    return updates;
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): PluginStatistics {
    const entries = Array.from(this.registry.values());
    
    return {
      totalPlugins: entries.length,
      enabledPlugins: entries.filter(e => e.status === 'enabled').length,
      disabledPlugins: entries.filter(e => e.status === 'disabled').length,
      errorPlugins: entries.filter(e => e.status === 'error').length,
      averageMemoryUsage: this.calculateAverageMemoryUsage(entries),
      totalIntents: entries.reduce((sum, e) => sum + e.metadata.intents.length, 0)
    };
  }

  /**
   * Validate plugin compatibility
   */
  validateCompatibility(metadata: PluginMetadata): CompatibilityResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check AgentOS version compatibility
    if (!this.isVersionCompatible(metadata.agentOSVersion, '1.0.0')) {
      issues.push(`Incompatible AgentOS version: ${metadata.agentOSVersion}`);
    }

    // Check for conflicting plugins
    const conflicts = this.findConflictingPlugins(metadata);
    if (conflicts.length > 0) {
      warnings.push(`Potential conflicts with: ${conflicts.join(', ')}`);
    }

    // Check for duplicate intents
    const duplicateIntents = this.findDuplicateIntents(metadata);
    if (duplicateIntents.length > 0) {
      warnings.push(`Duplicate intents: ${duplicateIntents.join(', ')}`);
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Export registry data
   */
  async exportRegistry(): Promise<RegistryExport> {
    return {
      version: '1.0.0',
      exportedAt: new Date(),
      plugins: Array.from(this.registry.entries()).map(([id, entry]) => ({
        id,
        ...entry
      }))
    };
  }

  /**
   * Import registry data
   */
  async importRegistry(data: RegistryExport, merge: boolean = false): Promise<void> {
    if (!merge) {
      this.registry.clear();
    }

    for (const pluginData of data.plugins) {
      const { id, ...entry } = pluginData;
      this.registry.set(id, entry);
    }

    await this.saveRegistry();
  }

  // Private methods

  private async ensureRegistryDirectory(): Promise<void> {
    const registryDir = path.dirname(this.registryPath);
    try {
      await fs.mkdir(registryDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async loadRegistry(): Promise<void> {
    try {
      const registryContent = await fs.readFile(this.registryPath, 'utf-8');
      const registryData = JSON.parse(registryContent);
      
      this.registry.clear();
      for (const [id, entry] of Object.entries(registryData.plugins || {})) {
        this.registry.set(id, entry as PluginRegistryEntry);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to load plugin registry:', error.message);
      }
      // Registry file doesn't exist or is invalid, start with empty registry
    }
  }

  private async saveRegistry(): Promise<void> {
    const registryData = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      plugins: Object.fromEntries(this.registry)
    };

    await fs.writeFile(this.registryPath, JSON.stringify(registryData, null, 2), 'utf-8');
  }

  private async scanPluginDirectories(): Promise<void> {
    for (const pluginPath of this.pluginPaths) {
      try {
        const entries = await fs.readdir(pluginPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginDir = path.join(pluginPath, entry.name);
            await this.scanPluginDirectory(pluginDir);
          }
        }
      } catch (error) {
        console.warn(`Failed to scan plugin directory ${pluginPath}:`, error.message);
      }
    }
  }

  private async scanPluginDirectory(pluginDir: string): Promise<void> {
    try {
      const metadata = await this.readPluginMetadata(pluginDir);
      
      if (!this.registry.has(metadata.id)) {
        await this.registerPlugin(metadata, pluginDir);
      }
    } catch (error) {
      // Plugin directory doesn't contain valid plugin
    }
  }

  private async readPluginMetadata(pluginPath: string): Promise<PluginMetadata> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  private isNewerVersion(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return true;
      if (v1Part < v2Part) return false;
    }
    
    return false;
  }

  private isVersionCompatible(pluginVersion: string, systemVersion: string): boolean {
    // Simplified version compatibility check
    const pluginMajor = parseInt(pluginVersion.split('.')[0]);
    const systemMajor = parseInt(systemVersion.split('.')[0]);
    
    return pluginMajor === systemMajor;
  }

  private findConflictingPlugins(metadata: PluginMetadata): string[] {
    const conflicts: string[] = [];
    
    for (const [id, entry] of this.registry) {
      if (id === metadata.id) continue;
      
      // Check for intent conflicts
      const intentConflicts = metadata.intents.some(intent =>
        entry.metadata.intents.some(existingIntent => 
          existingIntent.intentId === intent.intentId
        )
      );
      
      if (intentConflicts) {
        conflicts.push(entry.metadata.name);
      }
    }
    
    return conflicts;
  }

  private findDuplicateIntents(metadata: PluginMetadata): string[] {
    const duplicates: string[] = [];
    
    for (const intent of metadata.intents) {
      for (const [id, entry] of this.registry) {
        if (id === metadata.id) continue;
        
        const hasDuplicate = entry.metadata.intents.some(
          existingIntent => existingIntent.intentId === intent.intentId
        );
        
        if (hasDuplicate) {
          duplicates.push(intent.intentId);
        }
      }
    }
    
    return [...new Set(duplicates)];
  }

  private calculateAverageMemoryUsage(entries: PluginRegistryEntry[]): number {
    const entriesWithMetrics = entries.filter(e => e.performanceMetrics);
    if (entriesWithMetrics.length === 0) return 0;
    
    const totalMemory = entriesWithMetrics.reduce(
      (sum, e) => sum + (e.performanceMetrics?.memoryUsageMB || 0), 
      0
    );
    
    return totalMemory / entriesWithMetrics.length;
  }

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

// Supporting interfaces

export interface UpdateInfo {
  pluginId: string;
  currentVersion: string;
  availableVersion: string;
  metadata: PluginMetadata;
}

export interface PluginStatistics {
  totalPlugins: number;
  enabledPlugins: number;
  disabledPlugins: number;
  errorPlugins: number;
  averageMemoryUsage: number;
  totalIntents: number;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  warnings: string[];
}

export interface RegistryExport {
  version: string;
  exportedAt: Date;
  plugins: Array<{ id: string } & PluginRegistryEntry>;
}