/**
 * Tests for plugin interface and base classes
 */

import {
  AgentOSPlugin,
  createIntentResult,
  createPluginMetadata,
  IntentHandler,
  RequirePermission
} from '../plugin-interface';
import {
  PluginMetadata,
  IntentDefinition,
  IntentResult,
  PluginContext
} from '../types';

// Mock plugin for testing
class TestPlugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return createPluginMetadata(
      'test.plugin',
      'Test Plugin',
      '1.0.0',
      'A test plugin',
      'Test Author'
    );
  }

  getIntents(): IntentDefinition[] {
    return [
      {
        intentId: 'test.hello',
        name: 'Test Hello',
        description: 'Test greeting',
        examples: ['hello'],
        parameters: [],
        requiredPermissions: [],
        handler: 'handleHello'
      }
    ];
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    if (intent === 'test.hello') {
      return createIntentResult(true, 'Hello from test plugin');
    }
    return createIntentResult(false, undefined, undefined, 'Unknown intent');
  }

  @RequirePermission('test:permission')
  async restrictedMethod(): Promise<string> {
    return 'success';
  }
}

describe('AgentOSPlugin', () => {
  let plugin: TestPlugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = new TestPlugin();
    mockContext = {
      pluginId: 'test.plugin',
      userId: 'test-user',
      sessionId: 'test-session',
      permissions: new Set(['test:permission']),
      dataAccess: {
        read: jest.fn().mockResolvedValue([]),
        write: jest.fn().mockResolvedValue('test-id'),
        update: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn().mockReturnValue(() => {})
      },
      systemAccess: {
        sendNotification: jest.fn().mockResolvedValue(undefined),
        requestPermission: jest.fn().mockResolvedValue(true),
        executeWorkflow: jest.fn().mockResolvedValue({
          success: true,
          result: null,
          executionId: 'test-workflow'
        }),
        registerIntent: jest.fn().mockResolvedValue(true),
        unregisterIntent: jest.fn().mockResolvedValue(true)
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });

  describe('Plugin Metadata', () => {
    test('should return correct metadata', () => {
      const metadata = plugin.getMetadata();
      
      expect(metadata.id).toBe('test.plugin');
      expect(metadata.name).toBe('Test Plugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('A test plugin');
      expect(metadata.author).toBe('Test Author');
    });

    test('should return intents', () => {
      const intents = plugin.getIntents();
      
      expect(intents).toHaveLength(1);
      expect(intents[0].intentId).toBe('test.hello');
      expect(intents[0].name).toBe('Test Hello');
    });
  });

  describe('Plugin Initialization', () => {
    test('should initialize with context', async () => {
      await plugin.initialize(mockContext);
      expect(plugin['context']).toBe(mockContext);
    });

    test('should cleanup resources', async () => {
      await plugin.initialize(mockContext);
      await plugin.cleanup();
      // Should not throw
    });
  });

  describe('Intent Handling', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    test('should handle known intent', async () => {
      const result = await plugin.handle('test.hello', {}, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.response).toBe('Hello from test plugin');
    });

    test('should handle unknown intent', async () => {
      const result = await plugin.handle('unknown.intent', {}, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown intent');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    test('should request permission', async () => {
      const granted = await plugin['requestPermission']('test:permission');
      
      expect(granted).toBe(true);
      expect(mockContext.systemAccess.requestPermission).toHaveBeenCalledWith('test:permission');
    });

    test('should send notification', async () => {
      await plugin['sendNotification']('Test Title', 'Test Message');
      
      expect(mockContext.systemAccess.sendNotification).toHaveBeenCalledWith(
        'Test Title',
        'Test Message'
      );
    });

    test('should log messages', () => {
      plugin['log']('info', 'Test message', { data: 'test' });
      
      expect(mockContext.logger.info).toHaveBeenCalledWith('Test message', { data: 'test' });
    });

    test('should read data', async () => {
      await plugin['readData']('test_schema', { query: 'test' });
      
      expect(mockContext.dataAccess.read).toHaveBeenCalledWith('test_schema', { query: 'test' });
    });

    test('should write data', async () => {
      const id = await plugin['writeData']('test_schema', { data: 'test' });
      
      expect(id).toBe('test-id');
      expect(mockContext.dataAccess.write).toHaveBeenCalledWith('test_schema', { data: 'test' });
    });
  });

  describe('Permission Decorator', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    test('should allow method with required permission', async () => {
      const result = await plugin.restrictedMethod();
      expect(result).toBe('success');
    });

    test('should throw error without required permission', async () => {
      mockContext.permissions.clear();
      
      await expect(plugin.restrictedMethod()).rejects.toThrow(
        'Missing required permission: test:permission'
      );
    });

    test('should throw error when not initialized', async () => {
      const uninitializedPlugin = new TestPlugin();
      
      await expect(uninitializedPlugin.restrictedMethod()).rejects.toThrow(
        'Plugin not initialized'
      );
    });
  });

  describe('Error Handling', () => {
    test('should throw error when accessing context before initialization', async () => {
      await expect(plugin['requestPermission']('test')).rejects.toThrow(
        'Plugin not initialized'
      );
    });

    test('should handle logging without context', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      plugin['log']('info', 'Test message');
      
      expect(consoleSpy).toHaveBeenCalledWith('[test.plugin] Test message');
      consoleSpy.mockRestore();
    });
  });
});

describe('Utility Functions', () => {
  describe('createIntentResult', () => {
    test('should create successful result', () => {
      const result = createIntentResult(true, 'Success message', { data: 'test' });
      
      expect(result.success).toBe(true);
      expect(result.response).toBe('Success message');
      expect(result.data).toEqual({ data: 'test' });
      expect(result.error).toBeUndefined();
    });

    test('should create error result', () => {
      const result = createIntentResult(false, undefined, undefined, 'Error message');
      
      expect(result.success).toBe(false);
      expect(result.response).toBeUndefined();
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Error message');
    });
  });

  describe('createPluginMetadata', () => {
    test('should create metadata with required fields', () => {
      const metadata = createPluginMetadata(
        'test.id',
        'Test Name',
        '1.0.0',
        'Test Description',
        'Test Author'
      );
      
      expect(metadata.id).toBe('test.id');
      expect(metadata.name).toBe('Test Name');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('Test Description');
      expect(metadata.author).toBe('Test Author');
      expect(metadata.license).toBe('MIT');
      expect(metadata.keywords).toEqual([]);
      expect(metadata.agentOSVersion).toBe('1.0.0');
    });

    test('should create metadata with optional fields', () => {
      const metadata = createPluginMetadata(
        'test.id',
        'Test Name',
        '1.0.0',
        'Test Description',
        'Test Author',
        {
          license: 'Apache-2.0',
          keywords: ['test', 'example'],
          agentOSVersion: '1.1.0'
        }
      );
      
      expect(metadata.license).toBe('Apache-2.0');
      expect(metadata.keywords).toEqual(['test', 'example']);
      expect(metadata.agentOSVersion).toBe('1.1.0');
    });
  });
});