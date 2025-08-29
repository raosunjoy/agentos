/**
 * Plugin discovery and auto-registration system
 * Automatically finds and registers plugins in configured directories
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { PluginMetadata, PluginValidationResult } from './types';
import { PluginValidator } from './plugin-validator';
import { PluginRegistry } from './plugin-registry';

export class PluginDiscovery extends EventEmitter {
  private validator: PluginValidator;
  private registry: PluginRegistry;
  private watchedPaths: string[];
  private watchers = new Map<string, any>();
  private discoveryInterval?: NodeJS.Timeout;

  constructor(registry: PluginRegistry, watchedPaths: string[] = []) {
    super();
    this.validator = new PluginValidator();
    this.registry = registry;
    this.watchedPaths = watchedPaths;
  }

  /**
   * Start automatic plugin discovery
   */
  async startDiscovery(options: DiscoveryOptions = {}): Promise<void> {
    const {
      watchForChanges = true,
      scanInterval = 30000, // 30 seconds
      autoRegister = true
    } = options;

    // Initial scan
    await this.scanAllPaths(autoRegister);

    // Set up file system watchers
    if (watchForChanges) {
      await this.setupFileWatchers(autoRegister);
    }

    // Set up periodic scanning
    if (scanInterval > 0) {
      this.discoveryInterval = setInterval(async () => {
        await this.scanAllPaths(autoRegister);
      }, scanInterval);
    }

    this.emit('discoveryStarted', { watchedPaths: this.watchedPaths });
  }

  /**
   * Stop automatic plugin discovery
   */
  async stopDiscovery(): Promise<void> {
    // Clear interval
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = undefined;
    }

    // Stop file watchers
    for (const [path, watcher] of this.watchers) {
      try {
        await watcher.close();
      } catch (error) {
        console.warn(`Failed to close watcher for ${path}:`, error.message);
      }
    }
    this.watchers.clear();

    this.emit('discoveryStopped');
  }

  /**
   * Manually scan for plugins in all configured paths
   */
  async scanAllPaths(autoRegister: boolean = true): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];

    for (const pluginPath of this.watchedPaths) {
      try {
        const pathResults = await this.scanPath(pluginPath, autoRegister);
        results.push(...pathResults);
      } catch (error) {
        console.warn(`Failed to scan plugin path ${pluginPath}:`, error.message);
        results.push({
          path: pluginPath,
          success: false,
          error: error.message
        });
      }
    }

    this.emit('scanCompleted', { results, totalFound: results.filter(r => r.success).length });
    return results;
  }

  /**
   * Scan a specific path for plugins
   */
  async scanPath(pluginPath: string, autoRegister: boolean = true): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];

    try {
      const entries = await fs.readdir(pluginPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(pluginPath, entry.name);
          const result = await this.scanPluginDirectory(fullPath, autoRegister);
          if (result) {
            results.push(result);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Directory doesn't exist, skip
    }

    return results;
  }

  /**
   * Scan a specific plugin directory
   */
  async scanPluginDirectory(pluginDir: string, autoRegister: boolean = true): Promise<DiscoveryResult | null> {
    try {
      // Check if this looks like a plugin directory
      const manifestPath = path.join(pluginDir, 'plugin.json');
      
      try {
        await fs.access(manifestPath);
      } catch {
        // No manifest file, not a plugin
        return null;
      }

      // Read and validate plugin metadata
      const metadata = await this.readPluginMetadata(pluginDir);
      
      // Check if plugin is already registered
      const existingPlugin = this.registry.getPlugin(metadata.id);
      if (existingPlugin) {
        // Check if this is a newer version
        if (this.isNewerVersion(metadata.version, existingPlugin.metadata.version)) {
          this.emit('pluginUpdateFound', {
            pluginId: metadata.id,
            currentVersion: existingPlugin.metadata.version,
            newVersion: metadata.version,
            path: pluginDir
          });
        }
        return {
          path: pluginDir,
          success: true,
          metadata,
          action: 'existing',
          message: 'Plugin already registered'
        };
      }

      // Validate plugin
      const validation = await this.validator.validatePlugin(pluginDir);
      if (!validation.valid) {
        return {
          path: pluginDir,
          success: false,
          metadata,
          error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Auto-register if enabled
      if (autoRegister) {
        try {
          await this.registry.registerPlugin(metadata, pluginDir);
          
          this.emit('pluginDiscovered', {
            pluginId: metadata.id,
            metadata,
            path: pluginDir
          });

          return {
            path: pluginDir,
            success: true,
            metadata,
            action: 'registered',
            message: 'Plugin discovered and registered'
          };
        } catch (error) {
          return {
            path: pluginDir,
            success: false,
            metadata,
            error: `Registration failed: ${error.message}`
          };
        }
      } else {
        return {
          path: pluginDir,
          success: true,
          metadata,
          action: 'found',
          message: 'Plugin found but not registered (auto-register disabled)'
        };
      }

    } catch (error) {
      return {
        path: pluginDir,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add a new path to watch for plugins
   */
  async addWatchPath(pluginPath: string): Promise<void> {
    if (!this.watchedPaths.includes(pluginPath)) {
      this.watchedPaths.push(pluginPath);
      
      // If discovery is running, set up watcher for new path
      if (this.watchers.size > 0) {
        await this.setupFileWatcher(pluginPath, true);
      }
      
      // Scan the new path immediately
      await this.scanPath(pluginPath, true);
    }
  }

  /**
   * Remove a path from watching
   */
  async removeWatchPath(pluginPath: string): Promise<void> {
    const index = this.watchedPaths.indexOf(pluginPath);
    if (index !== -1) {
      this.watchedPaths.splice(index, 1);
      
      // Stop watcher for this path
      const watcher = this.watchers.get(pluginPath);
      if (watcher) {
        await watcher.close();
        this.watchers.delete(pluginPath);
      }
    }
  }

  /**
   * Get discovery statistics
   */
  getStatistics(): DiscoveryStatistics {
    return {
      watchedPaths: this.watchedPaths.length,
      activeWatchers: this.watchers.size,
      isRunning: this.discoveryInterval !== undefined || this.watchers.size > 0
    };
  }

  // Private methods

  private async setupFileWatchers(autoRegister: boolean): Promise<void> {
    for (const pluginPath of this.watchedPaths) {
      await this.setupFileWatcher(pluginPath, autoRegister);
    }
  }

  private async setupFileWatcher(pluginPath: string, autoRegister: boolean): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(pluginPath, { recursive: true });

      // Use fs.watch for directory monitoring
      const watcher = fs.watch(pluginPath, { recursive: true }, async (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(pluginPath, filename);
        
        // Only react to plugin.json changes
        if (path.basename(filename) === 'plugin.json') {
          try {
            const pluginDir = path.dirname(fullPath);
            
            if (eventType === 'rename') {
              // File was added or removed
              try {
                await fs.access(fullPath);
                // File exists, treat as addition
                await this.handlePluginAdded(pluginDir, autoRegister);
              } catch {
                // File doesn't exist, treat as removal
                await this.handlePluginRemoved(pluginDir);
              }
            } else if (eventType === 'change') {
              // File was modified
              await this.handlePluginModified(pluginDir, autoRegister);
            }
          } catch (error) {
            console.warn(`Error handling file system event for ${fullPath}:`, error.message);
          }
        }
      });

      this.watchers.set(pluginPath, watcher);
    } catch (error) {
      console.warn(`Failed to set up file watcher for ${pluginPath}:`, error.message);
    }
  }

  private async handlePluginAdded(pluginDir: string, autoRegister: boolean): Promise<void> {
    const result = await this.scanPluginDirectory(pluginDir, autoRegister);
    if (result && result.success) {
      this.emit('pluginAdded', {
        pluginId: result.metadata?.id,
        path: pluginDir,
        metadata: result.metadata
      });
    }
  }

  private async handlePluginRemoved(pluginDir: string): Promise<void> {
    // Try to determine which plugin was removed by checking registry
    for (const [pluginId, entry] of this.registry.getAllPlugins()) {
      if (entry.installPath === pluginDir) {
        this.emit('pluginRemoved', {
          pluginId,
          path: pluginDir
        });
        break;
      }
    }
  }

  private async handlePluginModified(pluginDir: string, autoRegister: boolean): Promise<void> {
    try {
      const metadata = await this.readPluginMetadata(pluginDir);
      const existingPlugin = this.registry.getPlugin(metadata.id);
      
      if (existingPlugin && metadata.version !== existingPlugin.metadata.version) {
        this.emit('pluginUpdated', {
          pluginId: metadata.id,
          oldVersion: existingPlugin.metadata.version,
          newVersion: metadata.version,
          path: pluginDir,
          metadata
        });
        
        if (autoRegister) {
          await this.registry.updatePlugin(metadata.id, metadata);
        }
      }
    } catch (error) {
      console.warn(`Failed to handle plugin modification for ${pluginDir}:`, error.message);
    }
  }

  private async readPluginMetadata(pluginDir: string): Promise<PluginMetadata> {
    const manifestPath = path.join(pluginDir, 'plugin.json');
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
}

// Supporting interfaces

export interface DiscoveryOptions {
  watchForChanges?: boolean;
  scanInterval?: number;
  autoRegister?: boolean;
}

export interface DiscoveryResult {
  path: string;
  success: boolean;
  metadata?: PluginMetadata;
  action?: 'registered' | 'existing' | 'found';
  message?: string;
  error?: string;
}

export interface DiscoveryStatistics {
  watchedPaths: number;
  activeWatchers: number;
  isRunning: boolean;
}

export interface PluginDiscoveryEvent {
  pluginId: string;
  metadata: PluginMetadata;
  path: string;
}

export interface PluginUpdateEvent {
  pluginId: string;
  currentVersion: string;
  newVersion: string;
  path: string;
  metadata?: PluginMetadata;
}