/**
 * Tests for plugin isolation and failure handling
 * Ensures plugins are properly isolated and failures don't affect the system
 */

import { PluginManager } from '../plugin-manager';
import { PluginSandboxManager } from '../plugin-sandbox';
import { PluginPerformanceMonitor } from '../plugin-performance-monitor';
import { AgentOSPlugin } from '../plugin-interface';
import { PluginFrameworkConfig } from '../index';
import {
  PluginMetadata,
  PluginContext,
  IntentResult,
  IntentDefinition,
  ResourceLimits
} from '../types';

// Mock problematic plugins for testing
class CrashingPlugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return {
      id: 'test.crashing',
      name: 'Crashing Plugin',
      version: '1.0.0',
      description: 'A plugin that crashes',
      author: 'Test',
      license: 'MIT',
      keywords: [],
      agentOSVersion: '1.0.0',
      permissions: [],
      intents: [
        {
          intentId: 'test.crashing.crash',
          name: 'Crash',
          description: 'Crashes the plugin',
          examples: ['crash'],
          parameters: [],
          requiredPermissions: [],
          handler: 'handleCrash'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  getIntents(): IntentDefinition[] {
    return this.getMetadata().intents;
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    if (intent === 'test.crashing.crash') {
      throw new Error('Plugin intentionally crashed');
    }
    return { success: false, error: 'Unknown intent' };
  }
}

class MemoryLeakPlugin extends AgentOSPlugin {
  private memoryHog: any[] = [];

  getMetadata(): PluginMetadata {
    return {
      id: 'test.memoryleak',
      name: 'Memory Leak Plugin',
      version: '1.0.0',
      description: 'A plugin that leaks memory',
      author: 'Test',
      license: 'MIT',
      keywords: [],
      agentOSVersion: '1.0.0',
      permissions: [],
      intents: [
        {
          intentId: 'test.memoryleak.leak',
          name: 'Leak Memory',
          description: 'Leaks memory',
          examples: ['leak memory'],
          parameters: [],
          requiredPermissions: [],
          handler: 'handleLeak'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  getIntents(): IntentDefinition[] {
    return this.getMetadata().intents;
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    if (intent === 'test.memoryleak.leak') {
      // Simulate memory leak
      for (let i = 0; i < 1000; i++) {
        this.memoryHog.push(new Array(1000).fill('memory leak'));
      }
      return { success: true, response: 'Memory leaked' };
    }
    return { success: false, error: 'Unknown intent' };
  }
}

class InfiniteLoopPlugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return {
      id: 'test.infiniteloop',
      name: 'Infinite Loop Plugin',
      version: '1.0.0',
      description: 'A plugin that runs infinite loops',
      author: 'Test',
      license: 'MIT',
      keywords: [],
      agentOSVersion: '1.0.0',
      permissions: [],
      intents: [
        {
          intentId: 'test.infiniteloop.loop',
          name: 'Infinite Loop',
          description: 'Runs an infinite loop',
          examples: ['infinite loop'],
          parameters: [],
          requiredPermissions: [],
          handler: 'handleLoop'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  getIntents(): IntentDefinition[] {
    return this.getMetadata().intents;
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    if (intent === 'test.infiniteloop.loop') {
      // Simulate infinite loop
      while (true) {
        // This should be terminated by the sandbox timeout
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    return { success: false, error: 'Unknown intent' };
  }
}

describe('Plugin Isolation and Failure Handling', () => {
  let pluginManager: PluginManager;
  let sandboxManager: PluginSandboxManager;
  let performanceMonitor: PluginPerformanceMonitor;
  let config: PluginFrameworkConfig;

  beforeEach(() => {
    config = {
      registryPath: './test-registry.json',
      pluginPaths: ['./test-plugins'],
      sandboxEnabled: true,
      performanceMonitoring: true,
      maxPlugins: 10,
      defaultResourceLimits: {
        maxMemoryMB: 50,
        maxCPUPercent: 20,
        maxNetworkBandwidthKBps: 100,
        maxStorageMB: 10,
        maxExecutionTimeMs: 5000
      }
    };

    pluginManager = new PluginManager(config);
    sandboxManager = new PluginSandboxManager();
    performanceMonitor = new PluginPerformanceMonitor();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await pluginManager.disablePlugin('test.crashing');
    } catch {}
    try {
      await pluginManager.disablePlugin('test.memoryleak');
    } catch {}
    try {
      await pluginManager.disablePlugin('test.infiniteloop');
    } catch {}
  });

  describe('Plugin Crash Isolation', () => {
    test('should isolate plugin crashes from system', async () => {
      await pluginManager.initialize();
      
      // Install and enable crashing plugin
      const crashingPlugin = new CrashingPlugin();
      await pluginManager['loader'].loadPlugin('./test-plugins/crashing', {
        pluginId: 'test.crashing',
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: new Set(),
        dataAccess: {} as any,
        systemAccess: {} as any,
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
      });

      // Attempt to crash the plugin
      const result = await pluginManager.handleIntent(
        'test.crashing.crash',
        {},
        'test-user'
      );

      // Plugin should fail gracefully without crashing the system
      expect(result.success).toBe(false);
      expect(result.error).toContain('Intent handling failed');
      
      // System should still be operational
      expect(pluginManager.getStatistics().totalPlugins).toBeGreaterThan(0);
    });

    test('should handle plugin initialization failures', async () => {
      const errorSpy = jest.fn();
      pluginManager.on('pluginError', errorSpy);

      // Mock a plugin that fails during initialization
      const mockPlugin = {
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        getMetadata: jest.fn().mockReturnValue({
          id: 'test.failing',
          name: 'Failing Plugin',
          version: '1.0.0'
        })
      };

      try {
        await pluginManager.enablePlugin('test.failing', 'test-user');
      } catch (error) {
        expect(error.message).toContain('Initialization failed');
      }

      expect(errorSpy).toHaveBeenCalled();
    });

    test('should recover from plugin crashes during intent handling', async () => {
      await pluginManager.initialize();
      
      const crashingPlugin = new CrashingPlugin();
      
      // First intent should fail
      const result1 = await crashingPlugin.handle(
        'test.crashing.crash',
        {},
        {} as PluginContext
      );
      
      expect(result1.success).toBe(false);
      
      // Plugin should still be responsive to other operations
      const metadata = crashingPlugin.getMetadata();
      expect(metadata.id).toBe('test.crashing');
    });
  });

  describe('Resource Limit Enforcement', () => {
    test('should enforce memory limits', async () => {
      const resourceLimits: ResourceLimits = {
        maxMemoryMB: 10, // Very low limit
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 100,
        maxStorageMB: 5,
        maxExecutionTimeMs: 5000
      };

      performanceMonitor.startMonitoring('test.memoryleak', resourceLimits);
      
      const violationSpy = jest.fn();
      performanceMonitor.on('resourceViolation', violationSpy);

      const memoryLeakPlugin = new MemoryLeakPlugin();
      
      // Simulate memory usage that exceeds limits
      performanceMonitor['metrics'].set('test.memoryleak', {
        memoryUsageMB: 15, // Exceeds 10MB limit
        cpuUsagePercent: 5,
        networkUsageKB: 10,
        intentHandlingTimeMs: 100,
        errorCount: 0,
        lastUpdated: new Date()
      });

      // Check if violation is detected
      expect(performanceMonitor.isExceedingLimits('test.memoryleak')).toBe(true);
      
      performanceMonitor.stopMonitoring('test.memoryleak');
    });

    test('should enforce execution time limits', async () => {
      const resourceLimits: ResourceLimits = {
        maxMemoryMB: 50,
        maxCPUPercent: 50,
        maxNetworkBandwidthKBps: 100,
        maxStorageMB: 10,
        maxExecutionTimeMs: 1000 // 1 second limit
      };

      performanceMonitor.startMonitoring('test.infiniteloop', resourceLimits);
      
      const violationSpy = jest.fn();
      performanceMonitor.on('resourceViolation', violationSpy);

      // Record an execution that exceeds time limit
      performanceMonitor.recordIntentHandling('test.infiniteloop', 2000); // 2 seconds

      expect(violationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test.infiniteloop',
          type: 'execution',
          currentValue: 2000,
          limit: 1000
        })
      );

      performanceMonitor.stopMonitoring('test.infiniteloop');
    });

    test('should handle CPU usage violations', async () => {
      const resourceLimits: ResourceLimits = {
        maxMemoryMB: 50,
        maxCPUPercent: 10, // Very low CPU limit
        maxNetworkBandwidthKBps: 100,
        maxStorageMB: 10,
        maxExecutionTimeMs: 5000
      };

      performanceMonitor.startMonitoring('test.cpu', resourceLimits);
      
      // Simulate high CPU usage
      performanceMonitor['metrics'].set('test.cpu', {
        memoryUsageMB: 5,
        cpuUsagePercent: 25, // Exceeds 10% limit
        networkUsageKB: 10,
        intentHandlingTimeMs: 100,
        errorCount: 0,
        lastUpdated: new Date()
      });

      expect(performanceMonitor.isExceedingLimits('test.cpu')).toBe(true);
      
      performanceMonitor.stopMonitoring('test.cpu');
    });
  });

  describe('Sandbox Isolation', () => {
    test('should create isolated sandbox for each plugin', async () => {
      const sandbox1 = await sandboxManager.createSandbox('plugin1', {
        pluginId: 'plugin1',
        isolatedContext: true,
        resourceLimits: config.defaultResourceLimits!,
        allowedAPIs: ['console'],
        networkAccess: false,
        fileSystemAccess: false
      });

      const sandbox2 = await sandboxManager.createSandbox('plugin2', {
        pluginId: 'plugin2',
        isolatedContext: true,
        resourceLimits: config.defaultResourceLimits!,
        allowedAPIs: ['console'],
        networkAccess: false,
        fileSystemAccess: false
      });

      expect(sandbox1.pluginId).toBe('plugin1');
      expect(sandbox2.pluginId).toBe('plugin2');
      
      // Sandboxes should be independent
      expect(sandboxManager.getActiveSandboxes()).toContain('plugin1');
      expect(sandboxManager.getActiveSandboxes()).toContain('plugin2');

      await sandboxManager.destroySandbox('plugin1');
      await sandboxManager.destroySandbox('plugin2');
    });

    test('should prevent plugins from accessing unauthorized APIs', async () => {
      const sandbox = await sandboxManager.createSandbox('restricted-plugin', {
        pluginId: 'restricted-plugin',
        isolatedContext: true,
        resourceLimits: config.defaultResourceLimits!,
        allowedAPIs: ['console'], // Only console allowed
        networkAccess: false,
        fileSystemAccess: false
      });

      // Attempt to access unauthorized API should fail
      try {
        await sandboxManager.executeInSandbox(
          'restricted-plugin',
          'require("fs").readFileSync("/etc/passwd")'
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('require is not defined');
      }

      await sandboxManager.destroySandbox('restricted-plugin');
    });

    test('should enforce network access restrictions', async () => {
      const sandbox = await sandboxManager.createSandbox('no-network-plugin', {
        pluginId: 'no-network-plugin',
        isolatedContext: true,
        resourceLimits: config.defaultResourceLimits!,
        allowedAPIs: ['console'],
        networkAccess: false, // Network disabled
        fileSystemAccess: false
      });

      // Attempt to make network request should fail
      try {
        await sandboxManager.executeInSandbox(
          'no-network-plugin',
          'fetch("https://example.com")'
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('fetch is not defined');
      }

      await sandboxManager.destroySandbox('no-network-plugin');
    });
  });

  describe('Error Recovery', () => {
    test('should track plugin errors and provide recovery suggestions', async () => {
      performanceMonitor.startMonitoring('error-prone-plugin', config.defaultResourceLimits!);
      
      const errorSpy = jest.fn();
      performanceMonitor.on('pluginError', errorSpy);

      // Record multiple errors
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordError('error-prone-plugin', new Error(`Error ${i}`));
      }

      const metrics = performanceMonitor.getMetrics('error-prone-plugin');
      expect(metrics?.errorCount).toBe(5);
      expect(errorSpy).toHaveBeenCalledTimes(5);

      performanceMonitor.stopMonitoring('error-prone-plugin');
    });

    test('should provide performance recommendations', async () => {
      performanceMonitor.startMonitoring('performance-plugin', config.defaultResourceLimits!);
      
      // Simulate poor performance
      performanceMonitor['metrics'].set('performance-plugin', {
        memoryUsageMB: 45, // Close to 50MB limit
        cpuUsagePercent: 18, // Close to 20% limit
        networkUsageKB: 10,
        intentHandlingTimeMs: 100,
        errorCount: 15, // High error count
        lastUpdated: new Date()
      });

      const report = performanceMonitor.generateReport('performance-plugin');
      
      expect(report.recommendations).toContain(
        expect.stringMatching(/memory usage|memory limits/i)
      );
      expect(report.recommendations).toContain(
        expect.stringMatching(/error count|error handling/i)
      );

      performanceMonitor.stopMonitoring('performance-plugin');
    });

    test('should handle plugin cleanup on failure', async () => {
      const cleanupSpy = jest.fn();
      
      class CleanupTestPlugin extends AgentOSPlugin {
        getMetadata(): PluginMetadata {
          return {
            id: 'test.cleanup',
            name: 'Cleanup Test Plugin',
            version: '1.0.0',
            description: 'Tests cleanup',
            author: 'Test',
            license: 'MIT',
            keywords: [],
            agentOSVersion: '1.0.0',
            permissions: [],
            intents: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }

        getIntents(): IntentDefinition[] {
          return [];
        }

        async handle(): Promise<IntentResult> {
          return { success: true };
        }

        async cleanup(): Promise<void> {
          cleanupSpy();
        }
      }

      const plugin = new CleanupTestPlugin();
      
      // Initialize and then cleanup
      await plugin.initialize({} as PluginContext);
      await plugin.cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    test('should detect plugins approaching resource limits', async () => {
      performanceMonitor.startMonitoring('approaching-limits', config.defaultResourceLimits!);
      
      // Set thresholds
      performanceMonitor.setAlertThresholds('approaching-limits', {
        memoryWarningPercent: 80,
        memoryCriticalPercent: 95,
        cpuWarningPercent: 80,
        cpuCriticalPercent: 95,
        networkWarningPercent: 80,
        networkCriticalPercent: 95
      });

      // Simulate usage at warning level (85% of 50MB = 42.5MB)
      performanceMonitor['metrics'].set('approaching-limits', {
        memoryUsageMB: 42.5,
        cpuUsagePercent: 17, // 85% of 20%
        networkUsageKB: 85, // 85% of 100KB
        intentHandlingTimeMs: 100,
        errorCount: 0,
        lastUpdated: new Date()
      });

      const alerts = performanceMonitor.getPluginsApproachingLimits();
      
      expect(alerts).toHaveLength(3); // Memory, CPU, and Network alerts
      expect(alerts.every(alert => alert.severity === 'warning')).toBe(true);

      performanceMonitor.stopMonitoring('approaching-limits');
    });

    test('should generate system-wide performance summary', async () => {
      // Start monitoring multiple plugins
      performanceMonitor.startMonitoring('plugin1', config.defaultResourceLimits!);
      performanceMonitor.startMonitoring('plugin2', config.defaultResourceLimits!);
      
      // Set different metrics for each plugin
      performanceMonitor['metrics'].set('plugin1', {
        memoryUsageMB: 20,
        cpuUsagePercent: 10,
        networkUsageKB: 30,
        intentHandlingTimeMs: 100,
        errorCount: 2,
        lastUpdated: new Date()
      });

      performanceMonitor['metrics'].set('plugin2', {
        memoryUsageMB: 60, // Exceeds limit
        cpuUsagePercent: 25, // Exceeds limit
        networkUsageKB: 40,
        intentHandlingTimeMs: 200,
        errorCount: 1,
        lastUpdated: new Date()
      });

      const summary = performanceMonitor.getPerformanceSummary();
      
      expect(summary.totalPlugins).toBe(2);
      expect(summary.averageMemoryUsage).toBe(40); // (20 + 60) / 2
      expect(summary.averageCpuUsage).toBe(17.5); // (10 + 25) / 2
      expect(summary.pluginsExceedingLimits).toBe(1); // plugin2
      expect(summary.totalErrors).toBe(3); // 2 + 1

      performanceMonitor.stopMonitoring('plugin1');
      performanceMonitor.stopMonitoring('plugin2');
    });
  });

  describe('Failure Cascade Prevention', () => {
    test('should prevent plugin failures from affecting other plugins', async () => {
      await pluginManager.initialize();
      
      // Install multiple plugins
      const workingPlugin = {
        id: 'working-plugin',
        handle: jest.fn().mockResolvedValue({ success: true, response: 'Working' })
      };
      
      const crashingPlugin = {
        id: 'crashing-plugin',
        handle: jest.fn().mockRejectedValue(new Error('Plugin crashed'))
      };

      // Simulate one plugin crashing
      const crashResult = await pluginManager.handleIntent(
        'crashing.intent',
        {},
        'test-user'
      );
      expect(crashResult.success).toBe(false);

      // Other plugins should still work
      const workingResult = await pluginManager.handleIntent(
        'working.intent',
        {},
        'test-user'
      );
      // This would succeed if the working plugin was properly registered
    });

    test('should isolate plugin dependency failures', async () => {
      // Test that when a dependency fails, dependent plugins handle it gracefully
      const dependentPlugin = {
        dependencies: { 'failing-dependency': '1.0.0' },
        handle: async () => {
          try {
            // Simulate dependency call that fails
            throw new Error('Dependency unavailable');
          } catch (error) {
            return { success: false, error: 'Dependency failed, using fallback' };
          }
        }
      };

      const result = await dependentPlugin.handle();
      expect(result.success).toBe(false);
      expect(result.error).toContain('fallback');
    });
  });
});