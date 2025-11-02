/**
 * Integration Tests for Plugin Framework
 * Comprehensive testing of plugin loading, sandboxing, lifecycle management, and inter-plugin communication
 */

import {
  PluginManager,
  PluginLoader,
  PluginSandbox,
  PluginRegistry,
  PluginValidator,
  PluginEventEmitter
} from '../index';
import { EventEmitter } from 'events';

// Mock plugin for testing
class MockPlugin {
  id = 'test-plugin';
  name = 'Test Plugin';
  version = '1.0.0';
  description = 'A test plugin for integration testing';

  private initialized = false;
  private started = false;

  async initialize(context: any): Promise<void> {
    this.initialized = true;
    context.logger.info('Mock plugin initialized');
  }

  async start(context: any): Promise<void> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }
    this.started = true;
    context.logger.info('Mock plugin started');
  }

  async stop(context: any): Promise<void> {
    this.started = false;
    context.logger.info('Mock plugin stopped');
  }

  async destroy(context: any): Promise<void> {
    this.initialized = false;
    context.logger.info('Mock plugin destroyed');
  }

  // Plugin methods
  async handleIntent(intent: any, context: any): Promise<any> {
    if (!this.started) {
      throw new Error('Plugin not started');
    }

    context.logger.info(`Handling intent: ${intent.type}`);

    switch (intent.type) {
      case 'weather':
        return { temperature: 72, condition: 'sunny' };
      case 'reminder':
        return { created: true, time: intent.time };
      default:
        return { error: 'Unknown intent type' };
    }
  }

  getStatus(): any {
    return {
      id: this.id,
      initialized: this.initialized,
      started: this.started,
      version: this.version
    };
  }
}

// Mock plugin manifest
const mockPluginManifest = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  author: 'Test Author',
  license: 'MIT',
  agentOSVersion: '^1.0.0',
  keywords: ['test', 'integration'],
  permissions: [
    {
      type: 'network',
      resource: 'api.weather',
      access: 'read',
      description: 'Access weather API',
      required: true
    }
  ],
  intents: [
    {
      intentId: 'get_weather',
      name: 'Get Weather',
      description: 'Retrieves current weather',
      examples: ['What is the weather?', 'How is the weather today?'],
      parameters: [
        {
          name: 'location',
          type: 'string',
          required: false,
          description: 'Location for weather'
        }
      ],
      requiredPermissions: ['network'],
      handler: 'handleIntent'
    }
  ]
};

describe('Plugin Framework Integration', () => {
  let pluginManager: PluginManager;
  let pluginLoader: PluginLoader;
  let pluginSandbox: PluginSandbox;
  let pluginRegistry: PluginRegistry;
  let pluginValidator: PluginValidator;
  let eventEmitter: PluginEventEmitter;

  beforeEach(async () => {
    // Initialize components
    eventEmitter = new EventEmitter();
    pluginRegistry = new PluginRegistry();
    pluginValidator = new PluginValidator();
    pluginSandbox = new PluginSandbox();
    pluginLoader = new PluginLoader(pluginSandbox, eventEmitter);
    pluginManager = new PluginManager(
      pluginLoader,
      pluginRegistry,
      pluginValidator,
      eventEmitter
    );

    // Initialize plugin manager
    await pluginManager.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (pluginManager) {
      await pluginManager.shutdown();
    }
  });

  describe('Plugin Lifecycle Management', () => {
    test('should load, initialize, and start a plugin successfully', async () => {
      // Register plugin
      pluginRegistry.register(mockPluginManifest);

      // Load plugin
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);

      // Initialize plugin
      await pluginManager.initializePlugin(mockPluginManifest.id);

      // Start plugin
      await pluginManager.startPlugin(mockPluginManifest.id);

      // Check status
      const status = pluginManager.getPluginStatus(mockPluginManifest.id);
      expect(status.initialized).toBe(true);
      expect(status.started).toBe(true);
    });

    test('should handle plugin lifecycle transitions correctly', async () => {
      // Register and load plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);

      // Test state transitions
      expect(pluginManager.getPluginStatus(mockPluginManifest.id).initialized).toBe(false);

      await pluginManager.initializePlugin(mockPluginManifest.id);
      expect(pluginManager.getPluginStatus(mockPluginManifest.id).initialized).toBe(true);
      expect(pluginManager.getPluginStatus(mockPluginManifest.id).started).toBe(false);

      await pluginManager.startPlugin(mockPluginManifest.id);
      expect(pluginManager.getPluginStatus(mockPluginManifest.id).started).toBe(true);

      await pluginManager.stopPlugin(mockPluginManifest.id);
      expect(pluginManager.getPluginStatus(mockPluginManifest.id).started).toBe(false);
      expect(pluginManager.getPluginStatus(mockPluginManifest.id).initialized).toBe(true);

      await pluginManager.destroyPlugin(mockPluginManifest.id);
      expect(pluginManager.getPluginStatus(mockPluginManifest.id).initialized).toBe(false);
    });

    test('should handle plugin unloading and cleanup', async () => {
      // Register and load plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);

      // Initialize and start
      await pluginManager.initializePlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);

      // Unload plugin
      await pluginManager.unloadPlugin(mockPluginManifest.id);

      // Should be completely removed
      expect(() => pluginManager.getPluginStatus(mockPluginManifest.id)).toThrow();
      expect(pluginRegistry.getPlugin(mockPluginManifest.id)).toBeUndefined();
    });
  });

  describe('Intent Handling and Routing', () => {
    beforeEach(async () => {
      // Setup plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);
      await pluginManager.initializePlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);
    });

    test('should route intents to appropriate plugins', async () => {
      const intent = {
        id: 'test-intent-1',
        type: 'weather',
        parameters: { location: 'New York' },
        confidence: 0.9
      };

      const context = {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const result = await pluginManager.handleIntent(intent, context);

      expect(result).toBeDefined();
      expect(result.temperature).toBe(72);
      expect(result.condition).toBe('sunny');
    });

    test('should handle multiple plugins with different intents', async () => {
      // Register second plugin
      const reminderManifest = {
        ...mockPluginManifest,
        id: 'reminder-plugin',
        intents: [
          {
            intentId: 'set_reminder',
            name: 'Set Reminder',
            description: 'Sets reminders',
            examples: ['Remind me to call mom'],
            parameters: [
              {
                name: 'task',
                type: 'string',
                required: true,
                description: 'Task to remind about'
              }
            ],
            requiredPermissions: [],
            handler: 'handleIntent'
          }
        ]
      };

      class ReminderPlugin extends MockPlugin {
        id = 'reminder-plugin';

        async handleIntent(intent: any, context: any): Promise<any> {
          if (intent.type === 'reminder') {
            return { created: true, task: intent.parameters.task };
          }
          return super.handleIntent(intent, context);
        }
      }

      pluginRegistry.register(reminderManifest);
      const reminderPlugin = new ReminderPlugin();
      await pluginLoader.loadPlugin(reminderManifest, reminderPlugin);
      await pluginManager.initializePlugin(reminderManifest.id);
      await pluginManager.startPlugin(reminderManifest.id);

      // Test weather intent (first plugin)
      const weatherIntent = { id: 'test-1', type: 'weather', parameters: {} };
      const weatherResult = await pluginManager.handleIntent(weatherIntent, {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      });
      expect(weatherResult.condition).toBe('sunny');

      // Test reminder intent (second plugin)
      const reminderIntent = {
        id: 'test-2',
        type: 'reminder',
        parameters: { task: 'call mom' }
      };
      const reminderResult = await pluginManager.handleIntent(reminderIntent, {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      });
      expect(reminderResult.created).toBe(true);
      expect(reminderResult.task).toBe('call mom');
    });

    test('should handle intent routing failures gracefully', async () => {
      const invalidIntent = {
        id: 'test-intent',
        type: 'unknown_intent',
        parameters: {}
      };

      const context = {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      };

      // Should not throw, should return error result
      const result = await pluginManager.handleIntent(invalidIntent, context);
      expect(result).toBeDefined();
      expect(result.error).toBe('Unknown intent type');
    });
  });

  describe('Plugin Sandboxing and Security', () => {
    test('should isolate plugins in sandbox environment', async () => {
      // Register plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);

      // Plugin should not have access to host environment
      const sandboxContext = pluginSandbox.createSandbox(mockPluginManifest.id);

      // Verify sandbox isolation
      expect(sandboxContext.global).not.toBe(global);
      expect(sandboxContext.process).toBeUndefined();
      expect(sandboxContext.require).toBeUndefined();
      expect(sandboxContext.__dirname).toBeUndefined();
      expect(sandboxContext.__filename).toBeUndefined();
    });

    test('should enforce permission checks', async () => {
      const restrictedManifest = {
        ...mockPluginManifest,
        permissions: [
          {
            type: 'network',
            resource: 'api.restricted',
            access: 'write',
            description: 'Access restricted API',
            required: true
          }
        ]
      };

      // Validation should pass with proper permissions
      const validation = await pluginValidator.validatePlugin(restrictedManifest);
      expect(validation.valid).toBe(true);

      // Plugin operations should respect permissions
      pluginRegistry.register(restrictedManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(restrictedManifest, pluginInstance);

      // Permission checks should be enforced during intent handling
      const intent = { id: 'test', type: 'weather', parameters: {} };
      const context = {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      };

      // Should work with proper permissions
      const result = await pluginManager.handleIntent(intent, context);
      expect(result.temperature).toBe(72);
    });

    test('should prevent resource abuse', async () => {
      // Register plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);
      await pluginManager.initializePlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);

      // Simulate resource-intensive operations
      const intensiveIntent = { id: 'intensive', type: 'weather', parameters: {} };
      const context = {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      };

      // Multiple concurrent requests
      const promises = Array.from({ length: 100 }, () =>
        pluginManager.handleIntent(intensiveIntent, context)
      );

      const results = await Promise.all(promises);

      // All should complete without resource exhaustion
      expect(results.length).toBe(100);
      results.forEach(result => {
        expect(result.temperature).toBe(72);
      });
    });
  });

  describe('Plugin Communication and Events', () => {
    test('should handle inter-plugin communication', async () => {
      // Register two plugins that communicate
      const producerManifest = {
        ...mockPluginManifest,
        id: 'producer-plugin',
        intents: [
          {
            intentId: 'produce_data',
            name: 'Produce Data',
            description: 'Produces data for other plugins',
            examples: ['Produce test data'],
            parameters: [],
            requiredPermissions: [],
            handler: 'handleIntent'
          }
        ]
      };

      const consumerManifest = {
        ...mockPluginManifest,
        id: 'consumer-plugin',
        intents: [
          {
            intentId: 'consume_data',
            name: 'Consume Data',
            description: 'Consumes data from other plugins',
            examples: ['Process data'],
            parameters: [],
            requiredPermissions: [],
            handler: 'handleIntent'
          }
        ]
      };

      class ProducerPlugin extends MockPlugin {
        id = 'producer-plugin';

        async handleIntent(intent: any, context: any): Promise<any> {
          if (intent.type === 'produce_data') {
            // Emit event for other plugins
            eventEmitter.emit('data-produced', { data: 'test-data', source: this.id });
            return { produced: true };
          }
          return super.handleIntent(intent, context);
        }
      }

      class ConsumerPlugin extends MockPlugin {
        id = 'consumer-plugin';
        receivedData: any = null;

        constructor() {
          super();
          eventEmitter.on('data-produced', (data) => {
            this.receivedData = data;
          });
        }

        async handleIntent(intent: any, context: any): Promise<any> {
          if (intent.type === 'consume_data') {
            return { consumed: true, data: this.receivedData };
          }
          return super.handleIntent(intent, context);
        }
      }

      // Register and load plugins
      pluginRegistry.register(producerManifest);
      pluginRegistry.register(consumerManifest);

      const producerPlugin = new ProducerPlugin();
      const consumerPlugin = new ConsumerPlugin();

      await pluginLoader.loadPlugin(producerManifest, producerPlugin);
      await pluginLoader.loadPlugin(consumerManifest, consumerPlugin);

      await pluginManager.initializePlugin(producerManifest.id);
      await pluginManager.initializePlugin(consumerManifest.id);

      await pluginManager.startPlugin(producerManifest.id);
      await pluginManager.startPlugin(consumerManifest.id);

      // Produce data
      await pluginManager.handleIntent(
        { id: 'produce', type: 'produce_data', parameters: {} },
        { userId: 'test', sessionId: 'test', logger: { info: jest.fn(), error: jest.fn() } }
      );

      // Consume data
      const result = await pluginManager.handleIntent(
        { id: 'consume', type: 'consume_data', parameters: {} },
        { userId: 'test', sessionId: 'test', logger: { info: jest.fn(), error: jest.fn() } }
      );

      expect(result.consumed).toBe(true);
      expect(result.data.data).toBe('test-data');
      expect(result.data.source).toBe('producer-plugin');
    });

    test('should emit lifecycle events', async () => {
      const events: string[] = [];
      const eventData: any[] = [];

      eventEmitter.on('plugin-loaded', (data) => {
        events.push('plugin-loaded');
        eventData.push(data);
      });

      eventEmitter.on('plugin-initialized', (data) => {
        events.push('plugin-initialized');
        eventData.push(data);
      });

      eventEmitter.on('plugin-started', (data) => {
        events.push('plugin-started');
        eventData.push(data);
      });

      // Register and load plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);

      await pluginManager.initializePlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);

      // Check events were emitted
      expect(events).toContain('plugin-loaded');
      expect(events).toContain('plugin-initialized');
      expect(events).toContain('plugin-started');

      // Check event data
      const loadedEvent = eventData.find(d => d.event === 'plugin-loaded');
      expect(loadedEvent?.pluginId).toBe(mockPluginManifest.id);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent plugins', async () => {
      // Register multiple plugins
      const plugins = Array.from({ length: 10 }, (_, i) => ({
        ...mockPluginManifest,
        id: `test-plugin-${i}`,
        name: `Test Plugin ${i}`
      }));

      for (const pluginManifest of plugins) {
        pluginRegistry.register(pluginManifest);
        const pluginInstance = new MockPlugin();
        pluginInstance.id = pluginManifest.id;
        await pluginLoader.loadPlugin(pluginManifest, pluginInstance);
        await pluginManager.initializePlugin(pluginManifest.id);
        await pluginManager.startPlugin(pluginManifest.id);
      }

      // Test concurrent intent handling
      const intents = plugins.map((plugin, i) => ({
        id: `intent-${i}`,
        type: 'weather',
        parameters: { pluginId: plugin.id }
      }));

      const context = {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const startTime = Date.now();
      const results = await Promise.all(
        intents.map(intent => pluginManager.handleIntent(intent, context))
      );
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.temperature).toBe(72);
      });
    });

    test('should maintain performance under load', async () => {
      // Setup single plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);
      await pluginManager.initializePlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);

      // High-frequency requests
      const requestCount = 1000;
      const intent = { id: 'load-test', type: 'weather', parameters: {} };
      const context = {
        userId: 'test-user',
        sessionId: 'test-session',
        logger: { info: jest.fn(), error: jest.fn() }
      };

      const startTime = Date.now();
      const promises = Array.from({ length: requestCount }, () =>
        pluginManager.handleIntent(intent, context)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTime = totalTime / requestCount;

      // Performance requirements
      expect(avgTime).toBeLessThan(50); // < 50ms per request
      expect(results.length).toBe(requestCount);
      expect(results.every(r => r.temperature === 72)).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle plugin crashes gracefully', async () => {
      class CrashingPlugin extends MockPlugin {
        async handleIntent(intent: any, context: any): Promise<any> {
          if (intent.type === 'crash') {
            throw new Error('Plugin crashed');
          }
          return super.handleIntent(intent, context);
        }
      }

      // Register crashing plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new CrashingPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);
      await pluginManager.initializePlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);

      // Test normal operation
      const normalIntent = { id: 'normal', type: 'weather', parameters: {} };
      const normalResult = await pluginManager.handleIntent(normalIntent, {
        userId: 'test',
        sessionId: 'test',
        logger: { info: jest.fn(), error: jest.fn() }
      });
      expect(normalResult.temperature).toBe(72);

      // Test crash handling
      const crashIntent = { id: 'crash', type: 'crash', parameters: {} };
      await expect(
        pluginManager.handleIntent(crashIntent, {
          userId: 'test',
          sessionId: 'test',
          logger: { info: jest.fn(), error: jest.fn() }
        })
      ).rejects.toThrow('Plugin crashed');

      // Plugin should still be functional for other intents
      const recoveryResult = await pluginManager.handleIntent(normalIntent, {
        userId: 'test',
        sessionId: 'test',
        logger: { info: jest.fn(), error: jest.fn() }
      });
      expect(recoveryResult.temperature).toBe(72);
    });

    test('should support plugin restart after failures', async () => {
      // Register plugin
      pluginRegistry.register(mockPluginManifest);
      const pluginInstance = new MockPlugin();
      await pluginLoader.loadPlugin(mockPluginManifest, pluginInstance);
      await pluginManager.initializePlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);

      // Simulate failure and restart
      await pluginManager.stopPlugin(mockPluginManifest.id);
      await pluginManager.startPlugin(mockPluginManifest.id);

      // Should work after restart
      const result = await pluginManager.handleIntent(
        { id: 'test', type: 'weather', parameters: {} },
        { userId: 'test', sessionId: 'test', logger: { info: jest.fn(), error: jest.fn() } }
      );
      expect(result.temperature).toBe(72);
    });

    test('should validate plugin manifests', async () => {
      const invalidManifest = {
        ...mockPluginManifest,
        id: '', // Invalid: empty id
        version: 'invalid-version'
      };

      const validation = await pluginValidator.validatePlugin(invalidManifest);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Plugin Registry and Discovery', () => {
    test('should manage plugin registry correctly', () => {
      const manifest1 = { ...mockPluginManifest, id: 'plugin-1' };
      const manifest2 = { ...mockPluginManifest, id: 'plugin-2' };

      pluginRegistry.register(manifest1);
      pluginRegistry.register(manifest2);

      expect(pluginRegistry.getPlugin('plugin-1')).toEqual(manifest1);
      expect(pluginRegistry.getPlugin('plugin-2')).toEqual(manifest2);
      expect(pluginRegistry.listPlugins()).toHaveLength(2);

      pluginRegistry.unregister('plugin-1');
      expect(pluginRegistry.getPlugin('plugin-1')).toBeUndefined();
      expect(pluginRegistry.listPlugins()).toHaveLength(1);
    });

    test('should support plugin discovery by capabilities', () => {
      const weatherPlugin = {
        ...mockPluginManifest,
        id: 'weather-plugin',
        intents: [
          {
            intentId: 'get_weather',
            name: 'Get Weather',
            description: 'Weather intent',
            examples: ['Weather?'],
            parameters: [],
            requiredPermissions: [],
            handler: 'handleIntent'
          }
        ]
      };

      const reminderPlugin = {
        ...mockPluginManifest,
        id: 'reminder-plugin',
        intents: [
          {
            intentId: 'set_reminder',
            name: 'Set Reminder',
            description: 'Reminder intent',
            examples: ['Remind me'],
            parameters: [],
            requiredPermissions: [],
            handler: 'handleIntent'
          }
        ]
      };

      pluginRegistry.register(weatherPlugin);
      pluginRegistry.register(reminderPlugin);

      // Discover plugins by intent
      const weatherPlugins = pluginRegistry.findPluginsByIntent('get_weather');
      const reminderPlugins = pluginRegistry.findPluginsByIntent('set_reminder');

      expect(weatherPlugins).toHaveLength(1);
      expect(weatherPlugins[0].id).toBe('weather-plugin');
      expect(reminderPlugins).toHaveLength(1);
      expect(reminderPlugins[0].id).toBe('reminder-plugin');
    });
  });
});
