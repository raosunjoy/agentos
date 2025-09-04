/**
 * AgentOS Core Tests
 * Tests for the main AgentOS class and core functionality
 */

import { AgentOS, initializeAgentOS, shutdownAgentOS, AGENTOS_VERSION } from '../index';
import { AgentOSConfig } from '../types/config';

describe('AgentOS Core', () => {
  let config: AgentOSConfig;

  beforeEach(() => {
    config = {
      version: '0.1.0',
      environment: 'test',
      logLevel: 'info',
      enablePlugins: true,
      enableSecurity: true,
      enablePerformanceOptimization: true,
      enableVoiceInterface: true,
      enableCaregiverSystem: true,
      maxMemoryUsage: 512 * 1024 * 1024,
      maxCPUUsage: 80,
      pluginSandbox: true,
      securityLevel: 'high',
      nlp: {
        confidenceThreshold: 0.7,
        cacheSize: 100,
        enableElderlyOptimizations: true,
        supportedLanguages: ['en', 'es']
      },
      voice: {
        wakeWord: 'agent',
        speechRate: 0.8,
        pitch: 1.0,
        volume: 0.7
      },
      performance: {
        adaptiveScaling: true,
        batteryOptimization: true,
        thermalManagement: true,
        memoryManagement: true
      }
    };
  });

  afterEach(async () => {
    // Clean up any initialized instances
    try {
      await shutdownAgentOS();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('AgentOS Class', () => {
    test('should create singleton instance', () => {
      const instance1 = AgentOS.getInstance(config);
      const instance2 = AgentOS.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AgentOS);
    });

    test('should initialize successfully', async () => {
      const agentOS = AgentOS.getInstance(config);

      await expect(agentOS.initialize()).resolves.toBeUndefined();

      const status = agentOS.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.version).toBe(config.version);
      expect(status.environment).toBe(config.environment);
    });

    test('should handle multiple initialization calls', async () => {
      const agentOS = AgentOS.getInstance(config);

      await agentOS.initialize();
      await expect(agentOS.initialize()).resolves.toBeUndefined();

      const status = agentOS.getStatus();
      expect(status.initialized).toBe(true);
    });

    test('should shutdown successfully', async () => {
      const agentOS = AgentOS.getInstance(config);
      await agentOS.initialize();

      await expect(agentOS.shutdown()).resolves.toBeUndefined();

      const status = agentOS.getStatus();
      expect(status.initialized).toBe(false);
    });

    test('should return correct status information', () => {
      const agentOS = AgentOS.getInstance(config);
      const status = agentOS.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('environment');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('memoryUsage');
      expect(status.version).toBe(config.version);
      expect(status.environment).toBe(config.environment);
    });
  });

  describe('Convenience Functions', () => {
    test('should initialize AgentOS with convenience function', async () => {
      const agentOS = await initializeAgentOS(config);

      expect(agentOS).toBeInstanceOf(AgentOS);
      expect(agentOS.getStatus().initialized).toBe(true);
    });

    test('should shutdown AgentOS with convenience function', async () => {
      await initializeAgentOS(config);
      await expect(shutdownAgentOS()).resolves.toBeUndefined();
    });
  });

  describe('Version Information', () => {
    test('should export version constants', () => {
      expect(AGENTOS_VERSION).toBe('0.1.0');
      expect(typeof AGENTOS_VERSION).toBe('string');
    });
  });

  describe('Default Configuration', () => {
    test('should use default config when none provided', () => {
      const agentOS = AgentOS.getInstance();
      const status = agentOS.getStatus();

      expect(status.version).toBe('0.1.0');
      expect(status.environment).toBe('development');
    });
  });
});
