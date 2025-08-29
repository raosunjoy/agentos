# AgentOS Plugin Framework

A comprehensive SDK for developing plugins for AgentOS, the agent-centric mobile operating system.

## Overview

The AgentOS Plugin Framework enables developers to create powerful plugins that extend the capabilities of AgentOS through natural language intents. Plugins run in secure sandboxes and integrate seamlessly with the system's AI-powered agent.

## Features

- **Intent-Based Architecture**: Handle user intents expressed in natural language
- **Secure Sandboxing**: Isolated execution environment with resource limits
- **Unified Data Layer**: Access semantic data with privacy controls
- **Hot-Swappable**: Install, update, and remove plugins without reboots
- **TypeScript Support**: Full type safety and IntelliSense support
- **Comprehensive Testing**: Built-in testing utilities and frameworks
- **Performance Monitoring**: Real-time resource usage tracking

## Quick Start

### Installation

```bash
npm install @agentos/plugin-framework
```

### Create Your First Plugin

```bash
npx @agentos/create-plugin my-awesome-plugin
cd my-awesome-plugin
npm install
npm run build
```

### Basic Plugin Structure

```typescript
import {
  AgentOSPlugin,
  PluginMetadata,
  IntentDefinition,
  IntentResult,
  PluginContext,
  createIntentResult
} from '@agentos/plugin-framework';

export default class MyPlugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return {
      id: 'com.example.myplugin',
      name: 'My Awesome Plugin',
      version: '1.0.0',
      description: 'Does awesome things',
      author: 'Your Name',
      // ... other metadata
    };
  }

  getIntents(): IntentDefinition[] {
    return [
      {
        intentId: 'com.example.myplugin.hello',
        name: 'Say Hello',
        description: 'Greet the user',
        examples: ['say hello', 'greet me'],
        parameters: [],
        requiredPermissions: [],
        handler: 'handleHello'
      }
    ];
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    switch (intent) {
      case 'com.example.myplugin.hello':
        return createIntentResult(true, 'Hello from my plugin!');
      default:
        return createIntentResult(false, undefined, undefined, 'Unknown intent');
    }
  }
}
```

## Core Concepts

### Intents

Intents represent user goals expressed in natural language. Your plugin handles these intents and provides responses.

```typescript
{
  intentId: 'com.example.weather.current',
  name: 'Get Current Weather',
  description: 'Get current weather conditions',
  examples: [
    'what\'s the weather like',
    'current weather',
    'how\'s the weather today'
  ],
  parameters: [
    {
      name: 'location',
      type: 'string',
      required: false,
      description: 'Location for weather query'
    }
  ],
  requiredPermissions: ['network:weather_api:read'],
  handler: 'handleCurrentWeather'
}
```

### Permissions

Plugins must declare all required permissions in their manifest:

```json
{
  "permissions": [
    {
      "type": "data",
      "resource": "contacts",
      "access": "read",
      "description": "Read contacts for caller ID",
      "required": true
    },
    {
      "type": "system",
      "resource": "notifications",
      "access": "write",
      "description": "Send notifications",
      "required": false
    }
  ]
}
```

### Data Access

Access the unified data layer with privacy controls:

```typescript
// Read user preferences
const preferences = await this.readData('user_preferences', {
  userId: context.userId,
  category: 'weather'
});

// Save data
const id = await this.writeData('user_preferences', {
  userId: context.userId,
  key: 'default_location',
  value: 'New York'
});
```

## Plugin Development

### Using the SDK

The Plugin SDK provides utilities for creating and managing plugins:

```typescript
import { PluginSDK } from '@agentos/plugin-framework';

// Create a new plugin project
await PluginSDK.createPlugin({
  name: 'Weather Plugin',
  id: 'com.example.weather',
  version: '1.0.0',
  description: 'Get weather information',
  author: 'Your Name',
  outputPath: './plugins',
  template: 'intent-handler'
});

// Validate plugin structure
const validation = await PluginSDK.validatePluginProject('./my-plugin');
if (!validation.valid) {
  console.error('Validation failed:', validation.issues);
}

// Build plugin for distribution
const distPath = await PluginSDK.buildPlugin('./my-plugin');
```

### Plugin Templates

Choose from several templates when creating plugins:

- **basic**: Simple plugin with minimal functionality
- **intent-handler**: Plugin focused on handling multiple intents
- **data-processor**: Plugin for processing and analyzing data

### Testing

Write comprehensive tests for your plugins:

```typescript
import { MyPlugin } from '../src/index';
import { createMockContext } from '@agentos/plugin-framework/testing';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let context: PluginContext;

  beforeEach(() => {
    plugin = new MyPlugin();
    context = createMockContext();
  });

  test('should handle hello intent', async () => {
    const result = await plugin.handle('com.example.myplugin.hello', {}, context);
    
    expect(result.success).toBe(true);
    expect(result.response).toBe('Hello from my plugin!');
  });
});
```

## Plugin Management

### Installing Plugins

```typescript
import { PluginManager } from '@agentos/plugin-framework';

const pluginManager = new PluginManager({
  registryPath: './plugins/registry.json',
  pluginPaths: ['./plugins']
});

await pluginManager.initialize();

// Install a plugin
await pluginManager.installPlugin('./my-plugin', 'user-id');

// Enable the plugin
await pluginManager.enablePlugin('com.example.myplugin', 'user-id');
```

### Handling Intents

```typescript
// Process user intent
const result = await pluginManager.handleIntent(
  'com.example.myplugin.hello',
  { name: 'Alice' },
  'user-id'
);

console.log(result.response); // "Hello, Alice!"
```

### Plugin Discovery

```typescript
// Discover plugins in configured paths
const discoveredPlugins = await pluginManager.discoverPlugins();

// Search for plugins
const weatherPlugins = pluginManager.searchPlugins({
  keywords: ['weather'],
  status: 'enabled'
});

// Get plugin statistics
const stats = pluginManager.getStatistics();
console.log(`${stats.totalPlugins} plugins installed`);
```

## Security & Sandboxing

### Sandbox Isolation

Plugins run in secure sandboxes with:

- **Resource Limits**: Memory, CPU, and network constraints
- **API Restrictions**: Limited access to system APIs
- **File System Isolation**: Restricted file access
- **Network Controls**: Filtered network access

### Permission System

- **Declarative Permissions**: All permissions declared in manifest
- **Runtime Validation**: Permissions checked at runtime
- **User Consent**: Sensitive operations require user approval
- **Granular Control**: Fine-grained permission model

## Performance Monitoring

Monitor plugin performance in real-time:

```typescript
// Get performance metrics
const metrics = pluginManager.getPerformanceMetrics('com.example.myplugin');

console.log(`Memory usage: ${metrics.memoryUsageMB}MB`);
console.log(`CPU usage: ${metrics.cpuUsagePercent}%`);

// Check if plugin is exceeding limits
if (pluginManager.isExceedingLimits('com.example.myplugin')) {
  console.warn('Plugin exceeding resource limits');
}
```

## API Reference

### Core Classes

- [`AgentOSPlugin`](./docs/api-reference.md#agentos-plugin) - Base plugin class
- [`PluginManager`](./docs/api-reference.md#plugin-manager) - Plugin orchestrator
- [`PluginSDK`](./docs/api-reference.md#plugin-sdk) - Development utilities

### Interfaces

- [`PluginMetadata`](./docs/api-reference.md#plugin-metadata) - Plugin information
- [`IntentDefinition`](./docs/api-reference.md#intent-definition) - Intent specification
- [`PluginContext`](./docs/api-reference.md#plugin-context) - Runtime context
- [`IntentResult`](./docs/api-reference.md#intent-result) - Intent response

## Examples

### Weather Plugin

```typescript
export default class WeatherPlugin extends AgentOSPlugin {
  async handleCurrentWeather(parameters: any, context: PluginContext): Promise<IntentResult> {
    const location = parameters.location || await this.getUserLocation(context);
    
    try {
      const weather = await this.fetchWeather(location);
      
      return createIntentResult(
        true,
        `It's ${weather.temperature}°F and ${weather.condition} in ${location}`,
        { weather, location }
      );
    } catch (error) {
      return createIntentResult(
        false,
        undefined,
        undefined,
        'Unable to get weather information'
      );
    }
  }
}
```

### Task Manager Plugin

```typescript
export default class TaskManagerPlugin extends AgentOSPlugin {
  @RequirePermission('data:tasks:write')
  async handleAddTask(parameters: any, context: PluginContext): Promise<IntentResult> {
    const { title, dueDate, priority } = parameters;
    
    const taskId = await this.writeData('tasks', {
      userId: context.userId,
      title,
      dueDate: new Date(dueDate),
      priority: priority || 'medium',
      completed: false,
      createdAt: new Date()
    });
    
    await this.sendNotification(
      'Task Added',
      `"${title}" has been added to your task list`
    );
    
    return createIntentResult(
      true,
      `Task "${title}" added successfully`,
      { taskId, title }
    );
  }
}
```

## Documentation

- [Plugin Development Guide](./docs/plugin-development-guide.md)
- [API Reference](./docs/api-reference.md)
- [Best Practices](./docs/best-practices.md)
- [Security Guidelines](./docs/security-guidelines.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](../../LICENSE) file for details.

## Support

- **Documentation**: [docs.agentos.org](https://docs.agentos.org)
- **GitHub Issues**: [Report bugs and request features](https://github.com/agentos/agentos/issues)
- **Community Forum**: [community.agentos.org](https://community.agentos.org)
- **Discord**: [Join our community](https://discord.gg/agentos)