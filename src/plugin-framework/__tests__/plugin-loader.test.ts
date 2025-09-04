/**
 * Plugin Loader Tests
 * Tests for the plugin loading, sandboxing, and lifecycle management
 */

import { PluginLoader } from '../plugin-loader';
import { PluginSandboxManager } from '../plugin-sandbox';
import { PluginValidator } from '../plugin-validator';
import { AgentOSPlugin } from '../plugin-interface';
import { PluginContext } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock the plugin interface
class MockPlugin extends AgentOSPlugin {
  getMetadata() {
    return {
      id: 'mock-plugin',
      name: 'Mock Plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      license: 'MIT',
      keywords: ['test'],
      agentOSVersion: '1.0.0',
      permissions: [],
      intents: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  getIntents() {
    return [];
  }

  async handle(intent: string, parameters: object, context: any) {
    return { success: true, response: 'Mock response' };
  }
}

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let mockContext: PluginContext;
  let pluginPaths: string[];

  beforeEach(() => {
    pluginPaths = ['./test-plugins'];
    loader = new PluginLoader(pluginPaths);
    mockContext = {
      pluginId: 'test-plugin',
      userId: 'user123',
      sessionId: 'session456',
      permissions: new Set(['read']),
      dataAccess: {
        read: jest.fn(),
        write: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        subscribe: jest.fn()
      },
      systemAccess: {
        sendNotification: jest.fn(),
        requestPermission: jest.fn(),
        executeWorkflow: jest.fn(),
        registerIntent: jest.fn(),
        unregisterIntent: jest.fn()
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });

  afterEach(async () => {
    // Clean up any loaded plugins
    const loadedPlugins = loader.getLoadedPlugins();
    for (const [pluginId] of loadedPlugins) {
      try {
        await loader.unloadPlugin(pluginId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Plugin Loading', () => {
    test('should initialize with plugin paths', () => {
      expect(loader).toBeInstanceOf(PluginLoader);
    });

    test('should discover plugins in configured paths', async () => {
      // Mock fs.readdir
      const mockReaddir = jest.spyOn(fs.promises, 'readdir');
      mockReaddir.mockResolvedValue([]);

      const plugins = await loader.discoverPlugins();
      expect(Array.isArray(plugins)).toBe(true);
    });

    test('should handle plugin discovery errors gracefully', async () => {
      const mockReaddir = jest.spyOn(fs.promises, 'readdir');
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      const plugins = await loader.discoverPlugins();
      expect(plugins).toEqual([]);
    });
  });

  describe('Plugin Lifecycle', () => {
    test('should load and unload plugin successfully', async () => {
      // Create a temporary plugin for testing
      const tempPluginPath = path.join(__dirname, 'temp-plugin');
      const pluginCode = `
        const { AgentOSPlugin } = require('../plugin-interface');

        class TempPlugin extends AgentOSPlugin {
          getMetadata() {
            return {
              id: 'temp-plugin',
              name: 'Temporary Plugin',
              version: '1.0.0',
              description: 'Test plugin',
              author: 'Test Author',
              license: 'MIT',
              keywords: ['test'],
              agentOSVersion: '1.0.0',
              permissions: [],
              intents: [],
              createdAt: new Date(),
              updatedAt: new Date()
            };
          }

          getIntents() {
            return [];
          }

          async handle(intent, parameters, context) {
            return { success: true, response: 'Temp response' };
          }
        }

        module.exports = { default: { createPlugin: () => new TempPlugin() } };
      `;

      try {
        // Create temp plugin directory and files
        await fs.promises.mkdir(tempPluginPath, { recursive: true });
        await fs.promises.writeFile(path.join(tempPluginPath, 'index.js'), pluginCode);
        await fs.promises.writeFile(path.join(tempPluginPath, 'plugin.json'), JSON.stringify({
          id: 'temp-plugin',
          name: 'Temporary Plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author',
          agentOSVersion: '1.0.0',
          permissions: [],
          intents: []
        }));

        // Test loading
        const plugin = await loader.loadPlugin(tempPluginPath, mockContext);
        expect(plugin).toBeDefined();
        expect(loader.isPluginLoaded('temp-plugin')).toBe(true);

        // Test unloading
        await loader.unloadPlugin('temp-plugin');
        expect(loader.isPluginLoaded('temp-plugin')).toBe(false);

      } finally {
        // Clean up
        try {
          await fs.promises.rm(tempPluginPath, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should prevent loading duplicate plugins', async () => {
      const tempPluginPath = path.join(__dirname, 'duplicate-plugin');

      try {
        await fs.promises.mkdir(tempPluginPath, { recursive: true });
        await fs.promises.writeFile(path.join(tempPluginPath, 'index.js'), `
          module.exports = {
            default: {
              createPlugin: () => ({
                getMetadata: () => ({
                  id: 'duplicate-plugin',
                  name: 'Duplicate Plugin',
                  version: '1.0.0',
                  description: 'Test plugin',
                  author: 'Test Author',
                  agentOSVersion: '1.0.0',
                  permissions: [],
                  intents: []
                }),
                getIntents: () => [],
                handle: async () => ({ success: true })
              })
            }
          };
        `);
        await fs.promises.writeFile(path.join(tempPluginPath, 'plugin.json'), JSON.stringify({
          id: 'duplicate-plugin',
          name: 'Duplicate Plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author',
          agentOSVersion: '1.0.0',
          permissions: [],
          intents: []
        }));

        await loader.loadPlugin(tempPluginPath, mockContext);
        await expect(loader.loadPlugin(tempPluginPath, mockContext)).rejects.toThrow('already loaded');

      } finally {
        try {
          await fs.promises.rm(tempPluginPath, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should reload plugin successfully', async () => {
      const tempPluginPath = path.join(__dirname, 'reload-plugin');

      try {
        await fs.promises.mkdir(tempPluginPath, { recursive: true });
        await fs.promises.writeFile(path.join(tempPluginPath, 'index.js'), `
          module.exports = {
            default: {
              createPlugin: () => ({
                getMetadata: () => ({
                  id: 'reload-plugin',
                  name: 'Reload Plugin',
                  version: '1.0.0',
                  description: 'Test plugin',
                  author: 'Test Author',
                  agentOSVersion: '1.0.0',
                  permissions: [],
                  intents: []
                }),
                getIntents: () => [],
                handle: async () => ({ success: true }),
                cleanup: async () => Promise.resolve()
              })
            }
          };
        `);
        await fs.promises.writeFile(path.join(tempPluginPath, 'plugin.json'), JSON.stringify({
          id: 'reload-plugin',
          name: 'Reload Plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author',
          agentOSVersion: '1.0.0',
          permissions: [],
          intents: []
        }));

        await loader.loadPlugin(tempPluginPath, mockContext);
        expect(loader.isPluginLoaded('reload-plugin')).toBe(true);

        const reloadedPlugin = await loader.reloadPlugin('reload-plugin', mockContext);
        expect(reloadedPlugin).toBeDefined();
        expect(loader.isPluginLoaded('reload-plugin')).toBe(true);

      } finally {
        try {
          await fs.promises.rm(tempPluginPath, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Plugin Management', () => {
    test('should get loaded plugin instance', async () => {
      const tempPluginPath = path.join(__dirname, 'get-plugin');

      try {
        await fs.promises.mkdir(tempPluginPath, { recursive: true });
        await fs.promises.writeFile(path.join(tempPluginPath, 'index.js'), `
          module.exports = {
            default: {
              createPlugin: () => ({
                getMetadata: () => ({
                  id: 'get-plugin',
                  name: 'Get Plugin',
                  version: '1.0.0',
                  description: 'Test plugin',
                  author: 'Test Author',
                  agentOSVersion: '1.0.0',
                  permissions: [],
                  intents: []
                }),
                getIntents: () => [],
                handle: async () => ({ success: true })
              })
            }
          };
        `);
        await fs.promises.writeFile(path.join(tempPluginPath, 'plugin.json'), JSON.stringify({
          id: 'get-plugin',
          name: 'Get Plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author',
          agentOSVersion: '1.0.0',
          permissions: [],
          intents: []
        }));

        await loader.loadPlugin(tempPluginPath, mockContext);
        const plugin = loader.getPlugin('get-plugin');
        expect(plugin).toBeDefined();

        const nonExistentPlugin = loader.getPlugin('non-existent');
        expect(nonExistentPlugin).toBeUndefined();

      } finally {
        try {
          await fs.promises.rm(tempPluginPath, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should return all loaded plugins', async () => {
      const plugin1Path = path.join(__dirname, 'plugin1');
      const plugin2Path = path.join(__dirname, 'plugin2');

      try {
        // Create first plugin
        await fs.promises.mkdir(plugin1Path, { recursive: true });
        await fs.promises.writeFile(path.join(plugin1Path, 'index.js'), `
          module.exports = {
            default: {
              createPlugin: () => ({
                getMetadata: () => ({
                  id: 'plugin1',
                  name: 'Plugin 1',
                  version: '1.0.0',
                  description: 'Test plugin 1',
                  author: 'Test Author',
                  agentOSVersion: '1.0.0',
                  permissions: [],
                  intents: []
                }),
                getIntents: () => [],
                handle: async () => ({ success: true })
              })
            }
          };
        `);
        await fs.promises.writeFile(path.join(plugin1Path, 'plugin.json'), JSON.stringify({
          id: 'plugin1',
          name: 'Plugin 1',
          version: '1.0.0',
          description: 'Test plugin 1',
          author: 'Test Author',
          agentOSVersion: '1.0.0',
          permissions: [],
          intents: []
        }));

        // Create second plugin
        await fs.promises.mkdir(plugin2Path, { recursive: true });
        await fs.promises.writeFile(path.join(plugin2Path, 'index.js'), `
          module.exports = {
            default: {
              createPlugin: () => ({
                getMetadata: () => ({
                  id: 'plugin2',
                  name: 'Plugin 2',
                  version: '1.0.0',
                  description: 'Test plugin 2',
                  author: 'Test Author',
                  agentOSVersion: '1.0.0',
                  permissions: [],
                  intents: []
                }),
                getIntents: () => [],
                handle: async () => ({ success: true })
              })
            }
          };
        `);
        await fs.promises.writeFile(path.join(plugin2Path, 'plugin.json'), JSON.stringify({
          id: 'plugin2',
          name: 'Plugin 2',
          version: '1.0.0',
          description: 'Test plugin 2',
          author: 'Test Author',
          agentOSVersion: '1.0.0',
          permissions: [],
          intents: []
        }));

        await loader.loadPlugin(plugin1Path, mockContext);
        await loader.loadPlugin(plugin2Path, mockContext);

        const loadedPlugins = loader.getLoadedPlugins();
        expect(loadedPlugins.size).toBe(2);
        expect(loadedPlugins.has('plugin1')).toBe(true);
        expect(loadedPlugins.has('plugin2')).toBe(true);

      } finally {
        try {
          await fs.promises.rm(plugin1Path, { recursive: true, force: true });
          await fs.promises.rm(plugin2Path, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle loading non-existent plugin', async () => {
      await expect(loader.loadPlugin('/non-existent/plugin', mockContext))
        .rejects.toThrow();
    });

    test('should handle unloading non-existent plugin', async () => {
      await expect(loader.unloadPlugin('non-existent'))
        .rejects.toThrow('not loaded');
    });

    test('should handle reloading non-existent plugin', async () => {
      await expect(loader.reloadPlugin('non-existent', mockContext))
        .rejects.toThrow('not loaded');
    });
  });
});
