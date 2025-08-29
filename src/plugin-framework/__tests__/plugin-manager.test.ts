/**
 * Tests for the main plugin manager
 */

import { PluginManager } from '../plugin-manager';
import { PluginFrameworkConfig } from '../index';
import { PluginMetadata, IntentResult } from '../types';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock the file system
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let config: PluginFrameworkConfig;
  let mockPluginMetadata: PluginMetadata;

  beforeEach(() => {
    config = {
      registryPath: '/test/registry.json',
      pluginPaths: ['/test/plugins'],
      sandboxEnabled: true,
      performanceMonitoring: true,
      maxPlugins: 100
    };

    mockPluginMetadata = {
      id: 'test.plugin',
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
          intentId: 'test.hello',
          name: 'Test Hello',
          description: 'Test greeting',
          examples: ['hello'],
          parameters: [],
          requiredPermissions: [],
          handler: 'handleHello'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    pluginManager = new PluginManager(config);

    // Mock file system operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockImplementation((filePath: string) => {
      if (filePath.includes('plugin.json')) {
        return Promise.resolve(JSON.stringify(mockPluginMetadata));
      }
      if (filePath.includes('registry.json')) {
        return Promise.resolve(JSON.stringify({
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          plugins: {}
        }));
      }
      return Promise.reject(new Error('File not found'));
    });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await pluginManager.initialize();
      
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    test('should emit initialized event', async () => {
      const initSpy = jest.fn();
      pluginManager.on('initialized', initSpy);
      
      await pluginManager.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });

    test('should not initialize twice', async () => {
      await pluginManager.initialize();
      await pluginManager.initialize(); // Second call should be no-op
      
      // Should only create directories once
      expect(mockFs.mkdir).toHaveBeenCalledTimes(1);
    });
  });

  describe('Plugin Installation', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    test('should install valid plugin', async () => {
      const pluginPath = '/test/plugins/test-plugin';
      
      await pluginManager.installPlugin(pluginPath, 'test-user');
      
      const plugin = pluginManager.getPlugin('test.plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.metadata.id).toBe('test.plugin');
    });

    test('should emit pluginInstalled event', async () => {
      const installSpy = jest.fn();
      pluginManager.on('pluginInstalled', installSpy);
      
      const pluginPath = '/test/plugins/test-plugin';
      await pluginManager.installPlugin(pluginPath, 'test-user');
      
      expect(installSpy).toHaveBeenCalledWith({
        pluginId: 'test.plugin',
        metadata: expect.objectContaining({ id: 'test.plugin' })
      });
    });

    test('should reject invalid plugin', async () => {
      // Mock validation failure
      mockFs.readFile.mockImplementation(() => {
        throw new Error('Invalid plugin manifest');
      });
      
      const pluginPath = '/test/plugins/invalid-plugin';
      
      await expect(pluginManager.installPlugin(pluginPath, 'test-user'))
        .rejects.toThrow('Invalid plugin manifest');
    });
  });

  describe('Plugin Management', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
      await pluginManager.installPlugin('/test/plugins/test-plugin', 'test-user');
    });

    test('should enable plugin', async () => {
      await pluginManager.enablePlugin('test.plugin', 'test-user');
      
      expect(pluginManager.isPluginEnabled('test.plugin')).toBe(true);
    });

    test('should disable plugin', async () => {
      await pluginManager.enablePlugin('test.plugin', 'test-user');
      await pluginManager.disablePlugin('test.plugin');
      
      expect(pluginManager.isPluginEnabled('test.plugin')).toBe(false);
    });

    test('should uninstall plugin', async () => {
      await pluginManager.uninstallPlugin('test.plugin');
      
      const plugin = pluginManager.getPlugin('test.plugin');
      expect(plugin).toBeUndefined();
    });

    test('should emit plugin events', async () => {
      const enabledSpy = jest.fn();
      const disabledSpy = jest.fn();
      const uninstalledSpy = jest.fn();
      
      pluginManager.on('pluginEnabled', enabledSpy);
      pluginManager.on('pluginDisabled', disabledSpy);
      pluginManager.on('pluginUninstalled', uninstalledSpy);
      
      await pluginManager.enablePlugin('test.plugin', 'test-user');
      await pluginManager.disablePlugin('test.plugin');
      await pluginManager.uninstallPlugin('test.plugin');
      
      expect(enabledSpy).toHaveBeenCalledWith({ pluginId: 'test.plugin' });
      expect(disabledSpy).toHaveBeenCalledWith({ pluginId: 'test.plugin' });
      expect(uninstalledSpy).toHaveBeenCalledWith({ pluginId: 'test.plugin' });
    });
  });

  describe('Intent Handling', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
      await pluginManager.installPlugin('/test/plugins/test-plugin', 'test-user');
      await pluginManager.enablePlugin('test.plugin', 'test-user');
    });

    test('should handle known intent', async () => {
      const result = await pluginManager.handleIntent('test.hello', {}, 'test-user');
      
      expect(result.success).toBe(true);
    });

    test('should handle unknown intent', async () => {
      const result = await pluginManager.handleIntent('unknown.intent', {}, 'test-user');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler found');
    });

    test('should return available intents', () => {
      const intents = pluginManager.getAvailableIntents();
      
      expect(intents).toHaveLength(1);
      expect(intents[0].intentId).toBe('test.hello');
    });
  });

  describe('Plugin Discovery', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    test('should discover plugins in configured paths', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'plugin1', isDirectory: () => true },
        { name: 'plugin2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ] as any);

      const discovered = await pluginManager.discoverPlugins();
      
      expect(discovered).toHaveLength(2);
    });
  });

  describe('Plugin Search', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
      await pluginManager.installPlugin('/test/plugins/test-plugin', 'test-user');
    });

    test('should search plugins by name', () => {
      const results = pluginManager.searchPlugins({ name: 'Test' });
      
      expect(results).toHaveLength(1);
      expect(results[0].metadata.name).toBe('Test Plugin');
    });

    test('should search plugins by author', () => {
      const results = pluginManager.searchPlugins({ author: 'Test Author' });
      
      expect(results).toHaveLength(1);
      expect(results[0].metadata.author).toBe('Test Author');
    });

    test('should search plugins by keywords', () => {
      const results = pluginManager.searchPlugins({ keywords: ['test'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].metadata.keywords).toContain('test');
    });

    test('should search plugins by status', () => {
      const results = pluginManager.searchPlugins({ status: 'installed' });
      
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('installed');
    });
  });

  describe('Plugin Statistics', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
      await pluginManager.installPlugin('/test/plugins/test-plugin', 'test-user');
    });

    test('should return plugin statistics', () => {
      const stats = pluginManager.getStatistics();
      
      expect(stats.totalPlugins).toBe(1);
      expect(stats.enabledPlugins).toBe(0);
      expect(stats.disabledPlugins).toBe(0);
      expect(stats.totalIntents).toBe(1);
    });
  });

  describe('Plugin Updates', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
      await pluginManager.installPlugin('/test/plugins/test-plugin', 'test-user');
    });

    test('should check for updates', async () => {
      // Mock newer version available
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('plugin.json')) {
          const updatedMetadata = { ...mockPluginMetadata, version: '1.1.0' };
          return Promise.resolve(JSON.stringify(updatedMetadata));
        }
        return Promise.resolve('{}');
      });

      const updates = await pluginManager.checkForUpdates();
      
      expect(updates).toHaveLength(1);
      expect(updates[0].availableVersion).toBe('1.1.0');
    });

    test('should update plugin', async () => {
      // Mock newer version available
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('plugin.json')) {
          const updatedMetadata = { ...mockPluginMetadata, version: '1.1.0' };
          return Promise.resolve(JSON.stringify(updatedMetadata));
        }
        return Promise.resolve('{}');
      });

      await pluginManager.updatePlugin('test.plugin', 'test-user');
      
      const plugin = pluginManager.getPlugin('test.plugin');
      expect(plugin?.metadata.version).toBe('1.1.0');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    test('should handle plugin installation errors', async () => {
      const errorSpy = jest.fn();
      pluginManager.on('pluginError', errorSpy);
      
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(pluginManager.installPlugin('/invalid/path', 'test-user'))
        .rejects.toThrow();
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle intent processing errors', async () => {
      await pluginManager.installPlugin('/test/plugins/test-plugin', 'test-user');
      
      // Mock plugin that throws error
      const plugin = pluginManager['loader'].getPlugin('test.plugin');
      if (plugin) {
        jest.spyOn(plugin, 'handle').mockRejectedValue(new Error('Intent failed'));
      }
      
      await pluginManager.enablePlugin('test.plugin', 'test-user');
      const result = await pluginManager.handleIntent('test.hello', {}, 'test-user');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Intent handling failed');
    });
  });
});