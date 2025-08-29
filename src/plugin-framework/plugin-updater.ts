/**
 * Hot-swappable plugin update system
 * Handles plugin updates without requiring system reboots
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PluginManager } from './plugin-manager';
import { PluginRegistry } from './plugin-registry';
import { PluginCompatibilityChecker } from './plugin-compatibility';
import { PluginMetadata, PluginContext } from './types';

export class PluginUpdater extends EventEmitter {
  private pluginManager: PluginManager;
  private registry: PluginRegistry;
  private compatibilityChecker: PluginCompatibilityChecker;
  private updateQueue = new Map<string, UpdateTask>();
  private isProcessing = false;

  constructor(
    pluginManager: PluginManager,
    registry: PluginRegistry,
    compatibilityChecker: PluginCompatibilityChecker
  ) {
    super();
    this.pluginManager = pluginManager;
    this.registry = registry;
    this.compatibilityChecker = compatibilityChecker;
  }

  /**
   * Queue a plugin update
   */
  async queueUpdate(pluginId: string, updateSource: UpdateSource, options: UpdateOptions = {}): Promise<void> {
    const existingPlugin = this.registry.getPlugin(pluginId);
    if (!existingPlugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Read new plugin metadata
    const newMetadata = await this.readUpdateMetadata(updateSource);
    
    // Validate update compatibility
    const compatibility = this.compatibilityChecker.checkUpdateCompatibility(
      existingPlugin.metadata,
      newMetadata
    );

    if (!compatibility.compatible && !options.force) {
      throw new Error(`Update incompatible: ${compatibility.issues.map(i => i.message).join(', ')}`);
    }

    const updateTask: UpdateTask = {
      pluginId,
      currentMetadata: existingPlugin.metadata,
      newMetadata,
      updateSource,
      options,
      compatibility,
      status: 'queued',
      queuedAt: new Date()
    };

    this.updateQueue.set(pluginId, updateTask);
    this.emit('updateQueued', { pluginId, task: updateTask });

    // Start processing if not already running
    if (!this.isProcessing) {
      await this.processUpdateQueue();
    }
  }

  /**
   * Cancel a queued update
   */
  cancelUpdate(pluginId: string): boolean {
    const task = this.updateQueue.get(pluginId);
    if (task && task.status === 'queued') {
      this.updateQueue.delete(pluginId);
      this.emit('updateCancelled', { pluginId });
      return true;
    }
    return false;
  }

  /**
   * Get update status for a plugin
   */
  getUpdateStatus(pluginId: string): UpdateTask | undefined {
    return this.updateQueue.get(pluginId);
  }

  /**
   * Get all queued updates
   */
  getQueuedUpdates(): UpdateTask[] {
    return Array.from(this.updateQueue.values());
  }

  /**
   * Process the update queue
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.emit('updateProcessingStarted');

    try {
      while (this.updateQueue.size > 0) {
        // Get next task to process
        const task = Array.from(this.updateQueue.values())
          .find(t => t.status === 'queued');

        if (!task) break;

        await this.processUpdate(task);
      }
    } finally {
      this.isProcessing = false;
      this.emit('updateProcessingStopped');
    }
  }

  /**
   * Process a single update task
   */
  private async processUpdate(task: UpdateTask): Promise<void> {
    const { pluginId } = task;
    
    try {
      task.status = 'processing';
      task.startedAt = new Date();
      this.emit('updateStarted', { pluginId, task });

      // Step 1: Prepare update
      await this.prepareUpdate(task);

      // Step 2: Create backup
      const backupPath = await this.createBackup(task);
      task.backupPath = backupPath;

      // Step 3: Perform hot swap
      await this.performHotSwap(task);

      // Step 4: Verify update
      await this.verifyUpdate(task);

      // Step 5: Cleanup
      await this.cleanupUpdate(task);

      task.status = 'completed';
      task.completedAt = new Date();
      this.updateQueue.delete(pluginId);

      this.emit('updateCompleted', { pluginId, task });

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.failedAt = new Date();

      // Attempt rollback
      try {
        await this.rollbackUpdate(task);
        this.emit('updateRolledBack', { pluginId, task, error: error.message });
      } catch (rollbackError) {
        this.emit('updateRollbackFailed', { 
          pluginId, 
          task, 
          error: error.message, 
          rollbackError: rollbackError.message 
        });
      }

      this.updateQueue.delete(pluginId);
      this.emit('updateFailed', { pluginId, task, error: error.message });
    }
  }

  /**
   * Prepare for update
   */
  private async prepareUpdate(task: UpdateTask): Promise<void> {
    const { pluginId, newMetadata, options } = task;

    // Check if plugin is currently enabled
    const wasEnabled = this.pluginManager.isPluginEnabled(pluginId);
    task.wasEnabled = wasEnabled;

    // Validate update source
    await this.validateUpdateSource(task.updateSource);

    // Check system resources
    if (!options.skipResourceCheck) {
      await this.checkSystemResources(newMetadata);
    }

    // Notify dependent plugins
    await this.notifyDependentPlugins(pluginId, 'update_starting');
  }

  /**
   * Create backup of current plugin
   */
  private async createBackup(task: UpdateTask): Promise<string> {
    const { pluginId } = task;
    const plugin = this.registry.getPlugin(pluginId);
    
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found for backup`);
    }

    const backupDir = path.join(process.cwd(), '.plugin-backups', pluginId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    await fs.mkdir(backupPath, { recursive: true });

    // Copy current plugin files
    await this.copyDirectory(plugin.installPath, backupPath);

    // Save current metadata
    await fs.writeFile(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(plugin.metadata, null, 2),
      'utf-8'
    );

    return backupPath;
  }

  /**
   * Perform hot swap of plugin
   */
  private async performHotSwap(task: UpdateTask): Promise<void> {
    const { pluginId, newMetadata, updateSource, wasEnabled } = task;

    // Step 1: Disable current plugin if enabled
    if (wasEnabled) {
      await this.pluginManager.disablePlugin(pluginId);
    }

    // Step 2: Update plugin files
    await this.updatePluginFiles(pluginId, updateSource);

    // Step 3: Update registry
    await this.registry.updatePlugin(pluginId, newMetadata);

    // Step 4: Re-enable plugin if it was enabled
    if (wasEnabled && !task.compatibility.requiresRestart) {
      // Create new context for updated plugin
      const context = this.createUpdateContext(pluginId);
      await this.pluginManager.enablePlugin(pluginId, context.userId);
    }
  }

  /**
   * Verify update was successful
   */
  private async verifyUpdate(task: UpdateTask): Promise<void> {
    const { pluginId, newMetadata } = task;

    // Verify plugin is registered with new metadata
    const updatedPlugin = this.registry.getPlugin(pluginId);
    if (!updatedPlugin || updatedPlugin.metadata.version !== newMetadata.version) {
      throw new Error('Plugin update verification failed: metadata mismatch');
    }

    // Verify plugin files exist
    const manifestPath = path.join(updatedPlugin.installPath, 'plugin.json');
    try {
      await fs.access(manifestPath);
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      if (manifest.version !== newMetadata.version) {
        throw new Error('Plugin update verification failed: manifest version mismatch');
      }
    } catch (error) {
      throw new Error(`Plugin update verification failed: ${error.message}`);
    }

    // Test plugin functionality if enabled
    if (task.wasEnabled && !task.compatibility.requiresRestart) {
      await this.testPluginFunctionality(pluginId);
    }
  }

  /**
   * Cleanup after successful update
   */
  private async cleanupUpdate(task: UpdateTask): Promise<void> {
    const { pluginId } = task;

    // Notify dependent plugins
    await this.notifyDependentPlugins(pluginId, 'update_completed');

    // Clean up temporary files (keep backup for now)
    // Backups can be cleaned up by a separate maintenance process
  }

  /**
   * Rollback failed update
   */
  private async rollbackUpdate(task: UpdateTask): Promise<void> {
    const { pluginId, backupPath, wasEnabled } = task;

    if (!backupPath) {
      throw new Error('No backup available for rollback');
    }

    try {
      // Disable current (failed) plugin
      if (this.pluginManager.isPluginEnabled(pluginId)) {
        await this.pluginManager.disablePlugin(pluginId);
      }

      // Restore from backup
      const plugin = this.registry.getPlugin(pluginId);
      if (plugin) {
        await this.copyDirectory(backupPath, plugin.installPath);
        
        // Restore metadata
        const backupMetadataPath = path.join(backupPath, 'metadata.json');
        const backupMetadata = JSON.parse(await fs.readFile(backupMetadataPath, 'utf-8'));
        await this.registry.updatePlugin(pluginId, backupMetadata);
      }

      // Re-enable if it was enabled before
      if (wasEnabled) {
        const context = this.createUpdateContext(pluginId);
        await this.pluginManager.enablePlugin(pluginId, context.userId);
      }

      // Notify dependent plugins
      await this.notifyDependentPlugins(pluginId, 'update_rolled_back');

    } catch (error) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Read metadata from update source
   */
  private async readUpdateMetadata(updateSource: UpdateSource): Promise<PluginMetadata> {
    switch (updateSource.type) {
      case 'local_path':
        const manifestPath = path.join(updateSource.path, 'plugin.json');
        const content = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(content);

      case 'archive':
        // Extract and read from archive
        throw new Error('Archive updates not yet implemented');

      case 'registry':
        // Download from registry
        throw new Error('Registry updates not yet implemented');

      default:
        throw new Error(`Unsupported update source type: ${(updateSource as any).type}`);
    }
  }

  /**
   * Validate update source
   */
  private async validateUpdateSource(updateSource: UpdateSource): Promise<void> {
    switch (updateSource.type) {
      case 'local_path':
        try {
          await fs.access(updateSource.path);
          await fs.access(path.join(updateSource.path, 'plugin.json'));
        } catch (error) {
          throw new Error(`Invalid update source: ${error.message}`);
        }
        break;

      case 'archive':
        // Validate archive file
        break;

      case 'registry':
        // Validate registry URL and credentials
        break;
    }
  }

  /**
   * Check system resources for update
   */
  private async checkSystemResources(newMetadata: PluginMetadata): Promise<void> {
    // Check available disk space
    // Check memory usage
    // Check CPU load
    // This is a simplified implementation
    
    const stats = await fs.stat(process.cwd());
    // In a real implementation, would check actual system resources
  }

  /**
   * Update plugin files
   */
  private async updatePluginFiles(pluginId: string, updateSource: UpdateSource): Promise<void> {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    switch (updateSource.type) {
      case 'local_path':
        await this.copyDirectory(updateSource.path, plugin.installPath);
        break;

      case 'archive':
        // Extract archive to plugin directory
        break;

      case 'registry':
        // Download and extract from registry
        break;
    }
  }

  /**
   * Test plugin functionality after update
   */
  private async testPluginFunctionality(pluginId: string): Promise<void> {
    // Basic functionality test
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Updated plugin ${pluginId} not found`);
    }

    // Test intent handling if plugin has intents
    const intents = plugin.metadata.intents;
    if (intents.length > 0) {
      const testIntent = intents[0];
      const context = this.createUpdateContext(pluginId);
      
      try {
        const result = await this.pluginManager.handleIntent(
          testIntent.intentId,
          {},
          context.userId
        );
        
        if (!result) {
          throw new Error('Plugin failed to handle test intent');
        }
      } catch (error) {
        throw new Error(`Plugin functionality test failed: ${error.message}`);
      }
    }
  }

  /**
   * Notify dependent plugins about update
   */
  private async notifyDependentPlugins(pluginId: string, event: string): Promise<void> {
    // Find plugins that depend on this plugin
    const dependentPlugins = Array.from(this.registry.getAllPlugins().values())
      .filter(plugin => 
        plugin.metadata.dependencies && 
        Object.keys(plugin.metadata.dependencies).includes(pluginId)
      );

    // Notify each dependent plugin
    for (const dependentPlugin of dependentPlugins) {
      try {
        // In a real implementation, would send notification to plugin
        this.emit('dependentPluginNotified', {
          pluginId: dependentPlugin.metadata.id,
          dependencyId: pluginId,
          event
        });
      } catch (error) {
        console.warn(`Failed to notify dependent plugin ${dependentPlugin.metadata.id}:`, error.message);
      }
    }
  }

  /**
   * Create context for update operations
   */
  private createUpdateContext(pluginId: string): PluginContext {
    return {
      pluginId,
      userId: 'system',
      sessionId: `update-${Date.now()}`,
      permissions: new Set(['system:update']),
      dataAccess: {} as any, // Simplified for update context
      systemAccess: {} as any, // Simplified for update context
      logger: {
        debug: (msg, ...args) => console.debug(`[${pluginId}] ${msg}`, ...args),
        info: (msg, ...args) => console.info(`[${pluginId}] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[${pluginId}] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[${pluginId}] ${msg}`, ...args)
      }
    };
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

// Supporting interfaces

export interface UpdateTask {
  pluginId: string;
  currentMetadata: PluginMetadata;
  newMetadata: PluginMetadata;
  updateSource: UpdateSource;
  options: UpdateOptions;
  compatibility: any; // CompatibilityResult from compatibility checker
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  backupPath?: string;
  wasEnabled?: boolean;
}

export interface UpdateSource {
  type: 'local_path' | 'archive' | 'registry';
  path?: string;
  url?: string;
  credentials?: any;
}

export interface UpdateOptions {
  force?: boolean;
  skipResourceCheck?: boolean;
  skipBackup?: boolean;
  skipVerification?: boolean;
}