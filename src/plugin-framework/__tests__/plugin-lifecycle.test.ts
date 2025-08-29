/**
 * Tests for plugin lifecycle management
 * Tests discovery, compatibility checking, hot updates, and performance monitoring
 */

import { PluginDiscovery } from '../plugin-discovery';
import { PluginCompatibilityChecker } from '../plugin-compatibility';
import { PluginUpdater } from '../plugin-updater';
import { PluginPerformanceMonitor } from '../plugin-performance-monitor';
import { PluginRegistry } from '../plugin-registry';
import { PluginManager } from '../plugin-manager';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PluginMetadata } from '../types';

// Mock file system
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    copyFile: jest.fn(),
    watch: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Plugin Lifecycle Management', () => {
  let registry: PluginRegistry;
  let discovery: PluginDiscovery;
  let compatibilityChecker: PluginCompatibilityChecker;
  let updater: PluginUpdater;
  let performanceMonitor: PluginPerformanceMonitor;
  let pluginManager: PluginManager;

  const mockPluginMetadata: PluginMetadata = {
    id: 'com.test.plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    license: 'MIT',
    keywords: ['test'],
    agentOSVersion: '1.0.0',
    permissions: [
      {
        type: 'data',
        resource: 'test_data',
        access: 'read',
        description: 'Read test data',
        required: true
      }
    ],
    intents: [
      {
        intentId: 'com.test.plugin.hello',
        name: 'Say Hello',
        description: 'Greet the user',
        examples: ['hello'],
        parameters: [],
        requiredPermissions: [],
        handler: 'handleHello'
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    registry = new PluginRegistry('./test-registry.json', ['./test-plugins']);
    discovery = new PluginDiscovery(registry, ['./test-plugins']);
    compatibilityChecker = new PluginCompatibilityChecker(registry, '1.0.0');
    performanceMonitor = new PluginPerformanceMonitor();
    
    pluginManager = new PluginManager({
      registryPath: './test-registry.json',
      pluginPaths: ['./test-plugins'],
      sandboxEnabled: true,
      performanceMonitoring: true
    });
    
    updater = new PluginUpdater(pluginManager, registry, compatibilityChecker);

    // Setup default mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockImplementation((filePath: string) => {
      if (filePath.includes('plugin.json')) {
        return Promise.resolve(JSON.stringify(mockPluginMetadata));
      }
      return Promise.resolve('{}');
    });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.copyFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Plugin Discovery', () => {
    test('should discover plugins in configured paths', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'plugin1', isDirectory: () => true },
        { name: 'plugin2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ] as any);

      const results = await discovery.scanAllPaths(false);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should auto-register discovered plugins', async () => {
      const registerSpy = jest.spyOn(registry, 'registerPlugin');
      
      mockFs.readdir.mockResolvedValue([
        { name: 'new-plugin', isDirectory: () => true }
      ] as any);

      await discovery.scanAllPaths(true);
      
      expect(registerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'com.test.plugin' }),
        expect.stringContaining('new-plugin')
      );
    });

    test('should detect plugin updates', async () => {
      // Register initial plugin
      await registry.registerPlugin(mockPluginMetadata, './test-plugins/plugin1');
      
      const updateSpy = jest.fn();
      discovery.on('pluginUpdateFound', updateSpy);

      // Mock newer version
      const newerMetadata = { ...mockPluginMetadata, version: '1.1.0' };
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('plugin.json')) {
          return Promise.resolve(JSON.stringify(newerMetadata));
        }
        return Promise.resolve('{}');
      });

      mockFs.readdir.mockResolvedValue([
        { name: 'plugin1', isDirectory: () => true }
      ] as any);

      await discovery.scanAllPaths(false);
      
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'com.test.plugin',
          currentVersion: '1.0.0',
          newVersion: '1.1.0'
        })
      );
    });

    test('should handle file system watching', async () => {
      const mockWatcher = {
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      mockFs.watch.mockReturnValue(mockWatcher as any);

      await discovery.startDiscovery({ watchForChanges: true });
      
      expect(mockFs.watch).toHaveBeenCalled();
      
      await discovery.stopDiscovery();
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    test('should add and remove watch paths dynamically', async () => {
      const newPath = './new-plugins';
      
      await discovery.addWatchPath(newPath);
      
      const stats = discovery.getStatistics();
      expect(stats.watchedPaths).toBe(2); // Original + new path
      
      await discovery.removeWatchPath(newPath);
      
      const updatedStats = discovery.getStatistics();
      expect(updatedStats.watchedPaths).toBe(1); // Back to original
    });
  });

  describe('Compatibility Checking', () => {
    test('should validate plugin compatibility', () => {
      const result = compatibilityChecker.checkCompatibility(mockPluginMetadata);
      
      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBeGreaterThan(90);
    });

    test('should detect version incompatibility', () => {
      const incompatiblePlugin = {
        ...mockPluginMetadata,
        agentOSVersion: '2.0.0' // Incompatible version
      };

      const result = compatibilityChecker.checkCompatibility(incompatiblePlugin);
      
      expect(result.compatible).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'version_incompatible',
          severity: 'error'
        })
      );
    });

    test('should detect intent conflicts', async () => {
      // Register first plugin
      await registry.registerPlugin(mockPluginMetadata, './plugin1');
      
      // Try to register plugin with conflicting intent
      const conflictingPlugin = {
        ...mockPluginMetadata,
        id: 'com.test.conflicting',
        intents: [mockPluginMetadata.intents[0]] // Same intent ID
      };

      const result = compatibilityChecker.checkCompatibility(conflictingPlugin);
      
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'intent_conflict',
          severity: 'error'
        })
      );
    });

    test('should validate update compatibility', () => {
      const newMetadata = {
        ...mockPluginMetadata,
        version: '1.1.0',
        // Add new required permission
        permissions: [
          ...mockPluginMetadata.permissions,
          {
            type: 'system' as const,
            resource: 'notifications',
            access: 'write' as const,
            description: 'Send notifications',
            required: true
          }
        ]
      };

      const result = compatibilityChecker.checkUpdateCompatibility(
        mockPluginMetadata,
        newMetadata
      );
      
      expect(result.compatible).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'new_permissions'
        })
      );
    });

    test('should detect breaking changes', () => {
      const breakingMetadata = {
        ...mockPluginMetadata,
        version: '2.0.0',
        intents: [] // Removed all intents - breaking change
      };

      const result = compatibilityChecker.checkUpdateCompatibility(
        mockPluginMetadata,
        breakingMetadata
      );
      
      expect(result.breakingChanges).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'breaking_change'
        })
      );
    });

    test('should generate system compatibility report', async () => {
      // Register multiple plugins
      await registry.registerPlugin(mockPluginMetadata, './plugin1');
      
      const incompatiblePlugin = {
        ...mockPluginMetadata,
        id: 'com.test.incompatible',
        agentOSVersion: '2.0.0'
      };
      await registry.registerPlugin(incompatiblePlugin, './plugin2');

      const report = compatibilityChecker.getSystemCompatibilityReport();
      
      expect(report.totalPlugins).toBe(2);
      expect(report.compatiblePlugins).toBe(1);
      expect(report.incompatiblePlugins).toBe(1);
      expect(report.results).toHaveLength(2);
    });

    test('should suggest compatibility fixes', () => {
      const incompatiblePlugin = {
        ...mockPluginMetadata,
        agentOSVersion: '2.0.0'
      };

      const fixes = compatibilityChecker.suggestFixes(incompatiblePlugin);
      
      expect(fixes).toContainEqual(
        expect.objectContaining({
          type: 'update_system',
          priority: 'high'
        })
      );
    });
  });

  describe('Hot Updates', () => {
    beforeEach(async () => {
      await registry.initialize();
      await registry.registerPlugin(mockPluginMetadata, './test-plugins/plugin1');
    });

    test('should queue plugin update', async () => {
      const newMetadata = { ...mockPluginMetadata, version: '1.1.0' };
      
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('plugin.json')) {
          return Promise.resolve(JSON.stringify(newMetadata));
        }
        return Promise.resolve('{}');
      });

      await updater.queueUpdate('com.test.plugin', {
        type: 'local_path',
        path: './updated-plugin'
      });

      const status = updater.getUpdateStatus('com.test.plugin');
      expect(status?.status).toBe('queued');
      expect(status?.newMetadata.version).toBe('1.1.0');
    });

    test('should cancel queued update', async () => {
      await updater.queueUpdate('com.test.plugin', {
        type: 'local_path',
        path: './updated-plugin'
      });

      const cancelled = updater.cancelUpdate('com.test.plugin');
      expect(cancelled).toBe(true);
      
      const status = updater.getUpdateStatus('com.test.plugin');
      expect(status).toBeUndefined();
    });

    test('should reject incompatible updates', async () => {
      const incompatibleMetadata = {
        ...mockPluginMetadata,
        version: '2.0.0',
        intents: [] // Breaking change
      };
      
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('plugin.json')) {
          return Promise.resolve(JSON.stringify(incompatibleMetadata));
        }
        return Promise.resolve('{}');
      });

      await expect(updater.queueUpdate('com.test.plugin', {
        type: 'local_path',
        path: './incompatible-plugin'
      })).rejects.toThrow('Update incompatible');
    });

    test('should handle update events', async () => {
      const queuedSpy = jest.fn();
      const startedSpy = jest.fn();
      
      updater.on('updateQueued', queuedSpy);
      updater.on('updateStarted', startedSpy);

      await updater.queueUpdate('com.test.plugin', {
        type: 'local_path',
        path: './updated-plugin'
      });

      expect(queuedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'com.test.plugin'
        })
      );
    });
  });

  describe('Performance Monitoring', () => {
    test('should start and stop monitoring', () => {
      const resourceLimits = {
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 1000,
        maxStorageMB: 50,
        maxExecutionTimeMs: 10000
      };

      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      performanceMonitor.on('monitoringStarted', startSpy);
      performanceMonitor.on('monitoringStopped', stopSpy);

      performanceMonitor.startMonitoring('test-plugin', resourceLimits);
      expect(startSpy).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        limits: resourceLimits
      });

      performanceMonitor.stopMonitoring('test-plugin');
      expect(stopSpy).toHaveBeenCalledWith({
        pluginId: 'test-plugin'
      });
    });

    test('should collect and report metrics', () => {
      const resourceLimits = {
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 1000,
        maxStorageMB: 50,
        maxExecutionTimeMs: 10000
      };

      performanceMonitor.startMonitoring('test-plugin', resourceLimits);
      
      const metrics = performanceMonitor.getMetrics('test-plugin');
      expect(metrics).toBeDefined();
      expect(metrics?.memoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(metrics?.cpuUsagePercent).toBeGreaterThanOrEqual(0);

      performanceMonitor.stopMonitoring('test-plugin');
    });

    test('should detect resource violations', () => {
      const resourceLimits = {
        maxMemoryMB: 50,
        maxCPUPercent: 20,
        maxNetworkBandwidthKBps: 100,
        maxStorageMB: 10,
        maxExecutionTimeMs: 5000
      };

      const violationSpy = jest.fn();
      performanceMonitor.on('resourceViolation', violationSpy);

      performanceMonitor.startMonitoring('test-plugin', resourceLimits);
      
      // Simulate violation by setting high usage
      performanceMonitor['metrics'].set('test-plugin', {
        memoryUsageMB: 60, // Exceeds 50MB limit
        cpuUsagePercent: 10,
        networkUsageKB: 50,
        intentHandlingTimeMs: 100,
        errorCount: 0,
        lastUpdated: new Date()
      });

      // Trigger violation check
      performanceMonitor['checkViolations'](
        'test-plugin',
        performanceMonitor.getMetrics('test-plugin')!,
        resourceLimits
      );

      expect(violationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test-plugin',
          type: 'memory',
          currentValue: 60,
          limit: 50
        })
      );

      performanceMonitor.stopMonitoring('test-plugin');
    });

    test('should record intent handling performance', () => {
      const resourceLimits = {
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 1000,
        maxStorageMB: 50,
        maxExecutionTimeMs: 1000
      };

      performanceMonitor.startMonitoring('test-plugin', resourceLimits);
      
      performanceMonitor.recordIntentHandling('test-plugin', 500);
      
      const metrics = performanceMonitor.getMetrics('test-plugin');
      expect(metrics?.intentHandlingTimeMs).toBe(500);

      performanceMonitor.stopMonitoring('test-plugin');
    });

    test('should generate performance reports', () => {
      const resourceLimits = {
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 1000,
        maxStorageMB: 50,
        maxExecutionTimeMs: 10000
      };

      performanceMonitor.startMonitoring('test-plugin', resourceLimits);
      
      const report = performanceMonitor.generateReport('test-plugin');
      
      expect(report.type).toBe('single_plugin');
      expect(report.pluginId).toBe('test-plugin');
      expect(report.metrics).toBeDefined();
      expect(report.limits).toBeDefined();
      expect(report.recommendations).toBeDefined();

      performanceMonitor.stopMonitoring('test-plugin');
    });

    test('should generate system-wide performance summary', () => {
      const resourceLimits = {
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 1000,
        maxStorageMB: 50,
        maxExecutionTimeMs: 10000
      };

      // Monitor multiple plugins
      performanceMonitor.startMonitoring('plugin1', resourceLimits);
      performanceMonitor.startMonitoring('plugin2', resourceLimits);
      
      const summary = performanceMonitor.getPerformanceSummary();
      
      expect(summary.totalPlugins).toBe(2);
      expect(summary.averageMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(summary.averageCpuUsage).toBeGreaterThanOrEqual(0);

      performanceMonitor.stopMonitoring('plugin1');
      performanceMonitor.stopMonitoring('plugin2');
    });

    test('should detect plugins approaching limits', () => {
      const resourceLimits = {
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 1000,
        maxStorageMB: 50,
        maxExecutionTimeMs: 10000
      };

      performanceMonitor.startMonitoring('test-plugin', resourceLimits);
      
      // Set usage at warning level (85% of limits)
      performanceMonitor['metrics'].set('test-plugin', {
        memoryUsageMB: 85, // 85% of 100MB
        cpuUsagePercent: 42.5, // 85% of 50%
        networkUsageKB: 850, // 85% of 1000KB
        intentHandlingTimeMs: 100,
        errorCount: 0,
        lastUpdated: new Date()
      });

      const alerts = performanceMonitor.getPluginsApproachingLimits();
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.every(alert => alert.severity === 'warning')).toBe(true);

      performanceMonitor.stopMonitoring('test-plugin');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete plugin lifecycle', async () => {
      // 1. Discovery
      mockFs.readdir.mockResolvedValue([
        { name: 'new-plugin', isDirectory: () => true }
      ] as any);

      const discoveryResults = await discovery.scanAllPaths(true);
      expect(discoveryResults[0].success).toBe(true);

      // 2. Compatibility check
      const compatibility = compatibilityChecker.checkCompatibility(mockPluginMetadata);
      expect(compatibility.compatible).toBe(true);

      // 3. Performance monitoring
      performanceMonitor.startMonitoring('com.test.plugin', {
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 1000,
        maxStorageMB: 50,
        maxExecutionTimeMs: 10000
      });

      const metrics = performanceMonitor.getMetrics('com.test.plugin');
      expect(metrics).toBeDefined();

      // 4. Update
      const newMetadata = { ...mockPluginMetadata, version: '1.1.0' };
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('plugin.json')) {
          return Promise.resolve(JSON.stringify(newMetadata));
        }
        return Promise.resolve('{}');
      });

      await updater.queueUpdate('com.test.plugin', {
        type: 'local_path',
        path: './updated-plugin'
      });

      const updateStatus = updater.getUpdateStatus('com.test.plugin');
      expect(updateStatus?.status).toBe('queued');

      // Cleanup
      performanceMonitor.stopMonitoring('com.test.plugin');
    });

    test('should handle plugin failure gracefully', async () => {
      // Register a plugin
      await registry.registerPlugin(mockPluginMetadata, './test-plugins/plugin1');
      
      // Start monitoring
      performanceMonitor.startMonitoring('com.test.plugin', {
        maxMemoryMB: 10, // Very low limit to trigger violations
        maxCPUPercent: 5,
        maxNetworkBandwidthKBps: 10,
        maxStorageMB: 1,
        maxExecutionTimeMs: 100
      });

      const violationSpy = jest.fn();
      performanceMonitor.on('resourceViolation', violationSpy);

      // Simulate resource violations
      performanceMonitor['metrics'].set('com.test.plugin', {
        memoryUsageMB: 15, // Exceeds limit
        cpuUsagePercent: 10, // Exceeds limit
        networkUsageKB: 15, // Exceeds limit
        intentHandlingTimeMs: 50,
        errorCount: 0,
        lastUpdated: new Date()
      });

      // Check violations
      expect(performanceMonitor.isExceedingLimits('com.test.plugin')).toBe(true);

      // System should still be operational
      const allMetrics = performanceMonitor.getAllMetrics();
      expect(allMetrics.size).toBe(1);

      performanceMonitor.stopMonitoring('com.test.plugin');
    });
  });
});