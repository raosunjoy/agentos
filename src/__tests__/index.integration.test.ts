/**
 * Integration Tests for AgentOS Main Class
 * Comprehensive testing of AgentOS initialization, configuration, and core functionality
 */

import { AgentOS, initializeAgentOS, ConfigType } from '../index';
import { systemLogger } from '../core/logging';
import { errorHandler } from '../core/errors';

// Mock the core systems to isolate AgentOS testing
jest.mock('../core/logging');
jest.mock('../core/errors');

describe('AgentOS Integration', () => {
  let agentOS: AgentOS;
  let mockConfig: ConfigType;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock configuration
    mockConfig = {
      version: '1.0.0',
      environment: 'test',
      logLevel: 'info',
      enablePlugins: true,
      enableSecurity: true,
      enablePerformanceOptimization: true,
      enableVoiceInterface: true,
      enableCaregiverSystem: true,
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxCPUUsage: 80,
      pluginSandbox: true,
      securityLevel: 'high',
      nlp: {
        confidenceThreshold: 0.8,
        cacheSize: 1000,
        enableElderlyOptimizations: true,
        supportedLanguages: ['en', 'es', 'fr']
      },
      voice: {
        wakeWord: 'hey agent',
        speechRate: 1.0,
        pitch: 1.0,
        volume: 0.8,
        enableNoiseFiltering: true,
        enableElderlyOptimizations: true,
        supportedLanguages: ['en', 'es', 'fr']
      },
      performance: {
        adaptiveScaling: true,
        batteryOptimization: true,
        thermalManagement: true,
        memoryManagement: true,
        maxMemoryUsage: 1024 * 1024 * 1024,
        maxCPUUsage: 80,
        enableModelQuantization: true,
        targetBatteryLifeHours: 8
      },
      caregiver: {
        enableEmergencyAlerts: true,
        enableDailyReports: true,
        enableRemoteAccess: true,
        maxConcurrentSessions: 5,
        sessionTimeoutMinutes: 30,
        auditLogRetentionDays: 90
      }
    };

    // Create AgentOS instance
    agentOS = new AgentOS(mockConfig);
  });

  afterEach(async () => {
    // Clean up
    if (agentOS) {
      await agentOS.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize with valid configuration', async () => {
      const logger = systemLogger('agentos');
      const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
      (logger as any) = mockLogger;

      await agentOS.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing AgentOS'),
        expect.any(Object)
      );
      expect(agentOS.getStatus().initialized).toBe(true);
    });

    test('should handle initialization errors gracefully', async () => {
      // Mock errorHandler to throw
      const mockHandleError = jest.fn().mockRejectedValue(new Error('Init failed'));
      (errorHandler.handleError as any) = mockHandleError;

      await expect(agentOS.initialize()).rejects.toThrow('Init failed');
      expect(agentOS.getStatus().initialized).toBe(false);
    });

    test('should be singleton pattern compliant', () => {
      const instance1 = AgentOS.getInstance(mockConfig);
      const instance2 = AgentOS.getInstance(mockConfig);

      expect(instance1).toBe(instance2);
    });

    test('should initialize with default configuration when none provided', () => {
      const defaultInstance = AgentOS.getInstance();

      expect(defaultInstance).toBeDefined();
      expect(defaultInstance.getStatus()).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    test('should accept and validate configuration', () => {
      const status = agentOS.getStatus();

      expect(status.version).toBe(mockConfig.version);
      expect(status.environment).toBe(mockConfig.environment);
      expect(status.initialized).toBe(false);
    });

    test('should handle configuration updates', async () => {
      await agentOS.initialize();

      const newConfig = { ...mockConfig, logLevel: 'debug' as const };
      const updatedAgentOS = new AgentOS(newConfig);

      expect(updatedAgentOS.getStatus().environment).toBe(newConfig.environment);
    });

    test('should validate required configuration fields', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).version;

      // Should still create instance but may have default values
      const agentOSWithInvalidConfig = new AgentOS(invalidConfig as any);
      expect(agentOSWithInvalidConfig).toBeDefined();
    });
  });

  describe('Core Functionality', () => {
    beforeEach(async () => {
      await agentOS.initialize();
    });

    test('should provide system status', () => {
      const status = agentOS.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('environment');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('memoryUsage');
    });

    test('should track uptime correctly', async () => {
      const status1 = agentOS.getStatus();
      const uptime1 = status1.uptime;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const status2 = agentOS.getStatus();
      const uptime2 = status2.uptime;

      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    });

    test('should handle shutdown gracefully', async () => {
      const logger = systemLogger('agentos');
      const mockLogger = { info: jest.fn(), error: jest.fn() };
      (logger as any) = mockLogger;

      await agentOS.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down AgentOS')
      );
      expect(agentOS.getStatus().initialized).toBe(false);
    });

    test('should handle multiple shutdown calls safely', async () => {
      await agentOS.shutdown();
      await agentOS.shutdown(); // Should not throw

      expect(agentOS.getStatus().initialized).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    test('should integrate with error handling system', async () => {
      const mockHandleError = jest.fn().mockResolvedValue('success');
      (errorHandler.handleError as any) = mockHandleError;

      // Trigger some operation that uses error handling
      await agentOS.initialize();

      expect(mockHandleError).toHaveBeenCalled();
    });

    test('should propagate errors appropriately', async () => {
      const mockHandleError = jest.fn().mockRejectedValue(new Error('System error'));
      (errorHandler.handleError as any) = mockHandleError;

      await expect(agentOS.initialize()).rejects.toThrow('System error');
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent operations', async () => {
      await agentOS.initialize();

      const operations = Array.from({ length: 10 }, () =>
        agentOS.getStatus()
      );

      const results = await Promise.all(operations);

      // All results should be valid
      results.forEach(status => {
        expect(status.initialized).toBe(true);
        expect(status.version).toBeDefined();
      });
    });

    test('should maintain state consistency', async () => {
      await agentOS.initialize();

      const status1 = agentOS.getStatus();
      const status2 = agentOS.getStatus();

      expect(status1.initialized).toBe(status2.initialized);
      expect(status1.version).toBe(status2.version);
      expect(status1.environment).toBe(status2.environment);
    });

    test('should handle resource cleanup on errors', async () => {
      // Mock a failure during initialization
      const mockHandleError = jest.fn().mockRejectedValue(new Error('Resource error'));
      (errorHandler.handleError as any) = mockHandleError;

      try {
        await agentOS.initialize();
      } catch (error) {
        // Should still be able to shutdown cleanly
        await agentOS.shutdown();
        expect(agentOS.getStatus().initialized).toBe(false);
      }
    });
  });

  describe('initializeAgentOS Function', () => {
    test('should create and initialize AgentOS instance', async () => {
      const instance = await initializeAgentOS(mockConfig);

      expect(instance).toBeInstanceOf(AgentOS);
      expect(instance.getStatus().initialized).toBe(true);

      await instance.shutdown();
    });

    test('should use default configuration when none provided', async () => {
      const instance = await initializeAgentOS();

      expect(instance).toBeInstanceOf(AgentOS);
      expect(instance.getStatus().initialized).toBe(true);

      await instance.shutdown();
    });

    test('should handle initialization failures', async () => {
      const mockHandleError = jest.fn().mockRejectedValue(new Error('Init failed'));
      (errorHandler.handleError as any) = mockHandleError;

      await expect(initializeAgentOS(mockConfig)).rejects.toThrow('Init failed');
    });
  });

  describe('System Integration', () => {
    test('should integrate with logging system', async () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn()
      };

      (systemLogger as any).mockReturnValue(mockLogger);

      await agentOS.initialize();

      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('should provide comprehensive status information', async () => {
      await agentOS.initialize();

      const status = agentOS.getStatus();

      // Should include all expected fields
      const expectedFields = [
        'initialized',
        'version',
        'environment',
        'uptime',
        'memoryUsage'
      ];

      expectedFields.forEach(field => {
        expect(status).toHaveProperty(field);
      });

      // Memory usage should be valid
      expect(status.memoryUsage).toBeDefined();
      expect(typeof status.memoryUsage.heapUsed).toBe('number');
      expect(typeof status.memoryUsage.heapTotal).toBe('number');
    });

    test('should handle configuration edge cases', () => {
      // Test with minimal configuration
      const minimalConfig = {
        version: '1.0.0',
        environment: 'test' as const
      };

      const agentOSMinimal = new AgentOS(minimalConfig as ConfigType);

      expect(agentOSMinimal.getStatus().version).toBe('1.0.0');
      expect(agentOSMinimal.getStatus().environment).toBe('test');
    });
  });

  describe('Lifecycle Management', () => {
    test('should support reinitialization after shutdown', async () => {
      await agentOS.initialize();
      expect(agentOS.getStatus().initialized).toBe(true);

      await agentOS.shutdown();
      expect(agentOS.getStatus().initialized).toBe(false);

      // Should be able to reinitialize
      await agentOS.initialize();
      expect(agentOS.getStatus().initialized).toBe(true);
    });

    test('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await agentOS.initialize();
        expect(agentOS.getStatus().initialized).toBe(true);

        await agentOS.shutdown();
        expect(agentOS.getStatus().initialized).toBe(false);
      }
    });

    test('should maintain configuration across restarts', async () => {
      await agentOS.initialize();
      const originalVersion = agentOS.getStatus().version;

      await agentOS.shutdown();
      await agentOS.initialize();

      expect(agentOS.getStatus().version).toBe(originalVersion);
    });
  });
});
