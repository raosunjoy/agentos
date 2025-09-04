# AgentOS Plugin Framework

The Plugin Framework provides a secure, sandboxed environment for extending AgentOS functionality through third-party plugins. It supports hot-swappable plugins with comprehensive security controls and resource management.

## Features

- 🔒 **Security Sandboxing**: Isolated execution environments with resource limits
- 🔌 **Hot-Swappable**: Load and unload plugins without restarting the system
- 🛡️ **Permission System**: Granular access controls for data, system, network, and hardware resources
- 📊 **Performance Monitoring**: Real-time monitoring of plugin resource usage
- ✅ **Validation**: Comprehensive plugin validation and compatibility checking
- 🎯 **Intent System**: Declarative intent handling with automatic routing

## Architecture

```
Plugin Framework
├── Plugin Manager (Orchestrator)
├── Plugin Loader (Lifecycle Management)
├── Plugin Sandbox (Security Isolation)
├── Plugin Validator (Security & Compatibility)
├── Plugin Registry (Discovery & Metadata)
└── Plugin SDK (Development Tools)
```

## Quick Start

### 1. Create a Plugin

```typescript
import {
  AgentOSPlugin,
  createPluginMetadata,
  createIntentResult,
  IntentHandler,
  RequirePermission,
} from './plugin-framework';

class MyPlugin extends AgentOSPlugin {
  getMetadata() {
    return createPluginMetadata(
      'my-plugin',
      'My Custom Plugin',
      '1.0.0',
      'A plugin that does amazing things',
      'Your Name',
      {
        permissions: [
          {
            type: 'network',
            resource: 'api',
            access: 'read',
            description: 'Access external APIs',
            required: true,
          },
        ],
        intents: [
          {
            intentId: 'my_intent',
            name: 'My Intent',
            description: 'Handle custom user requests',
            examples: ['Do something amazing'],
            parameters: [
              {
                name: 'input',
                type: 'string',
                required: true,
                description: 'User input',
              },
            ],
            requiredPermissions: ['network'],
          },
        ],
      }
    );
  }

  getIntents() {
    return this.getMetadata().intents;
  }

  @IntentHandler('my_intent')
  @RequirePermission('network')
  async handleMyIntent(intent: string, parameters: any, context: any) {
    try {
      const result = await this.processRequest(parameters.input);
      return createIntentResult(true, result);
    } catch (error) {
      return createIntentResult(
        false,
        'Failed to process request',
        undefined,
        error.message
      );
    }
  }

  async handle(intent: string, parameters: object, context: any) {
    throw new Error(`Intent ${intent} not handled by this plugin`);
  }

  private async processRequest(input: string): Promise<string> {
    // Your plugin logic here
    return `Processed: ${input}`;
  }
}

// Factory function for dynamic loading
export function createMyPlugin() {
  return new MyPlugin();
}

export default {
  createPlugin: createMyPlugin,
};
```

### 2. Create Plugin Manifest

Create a `plugin.json` file in your plugin directory:

```json
{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "A plugin that does amazing things",
  "author": "Your Name",
  "license": "MIT",
  "agentOSVersion": "1.0.0",
  "permissions": [
    {
      "type": "network",
      "resource": "api",
      "access": "read",
      "description": "Access external APIs",
      "required": true
    }
  ],
  "intents": [
    {
      "intentId": "my_intent",
      "name": "My Intent",
      "description": "Handle custom user requests",
      "examples": ["Do something amazing"],
      "parameters": [
        {
          "name": "input",
          "type": "string",
          "required": true,
          "description": "User input"
        }
      ],
      "requiredPermissions": ["network"]
    }
  ]
}
```

### 3. Load the Plugin

```typescript
import { PluginManager } from './plugin-framework';

const pluginManager = new PluginManager({
  registryPath: './plugin-registry',
  pluginPaths: ['./plugins'],
  sandboxEnabled: true,
  performanceMonitoring: true,
});

// Initialize the plugin manager
await pluginManager.initialize();

// Load your plugin
const pluginPath = './plugins/my-plugin';
await pluginManager.loadPlugin(pluginPath);

// The plugin is now active and can handle intents
```

## Plugin Lifecycle

Plugins follow a well-defined lifecycle:

1. **Validation**: Plugin code and manifest are validated for security and compatibility
2. **Loading**: Plugin is loaded into a secure sandbox environment
3. **Initialization**: Plugin's `initialize()` method is called with context
4. **Execution**: Plugin handles intents and provides functionality
5. **Cleanup**: Plugin resources are cleaned up when unloaded

### Lifecycle Hooks

```typescript
class MyPlugin extends AgentOSPlugin {
  async onInstall(context: PluginContext): Promise<void> {
    // Called when plugin is first installed
    console.log('Plugin installed!');
  }

  async onEnable(context: PluginContext): Promise<void> {
    // Called when plugin is enabled
    console.log('Plugin enabled!');
  }

  async onDisable(context: PluginContext): Promise<void> {
    // Called when plugin is disabled
    console.log('Plugin disabled!');
  }

  async onUninstall(context: PluginContext): Promise<void> {
    // Called when plugin is uninstalled
    console.log('Plugin uninstalled!');
  }

  async onUpdate(context: PluginContext, oldVersion: string): Promise<void> {
    // Called when plugin is updated
    console.log(`Plugin updated from ${oldVersion}`);
  }
}
```

## Security Model

### Permission Types

- **Data**: Access to user data and system databases
- **System**: File system, notifications, and system APIs
- **Network**: External API calls and network access
- **Hardware**: Device sensors, camera, microphone, etc.

### Sandboxing

Plugins run in isolated environments with:

- Resource limits (CPU, memory, network)
- Restricted API access
- File system isolation
- Process isolation using worker threads

### Validation

Before loading, plugins are validated for:

- Security vulnerabilities (eval, dangerous modules)
- Dependency conflicts
- Permission compatibility
- Code quality standards

## Intent System

The intent system allows plugins to handle natural language requests:

```typescript
// Define intents in plugin metadata
{
  "intents": [
    {
      "intentId": "get_weather",
      "name": "Get Weather",
      "description": "Get current weather conditions",
      "examples": ["What's the weather?", "How's the weather today?"],
      "parameters": [
        {
          "name": "location",
          "type": "string",
          "required": false,
          "description": "Location for weather query"
        }
      ]
    }
  ]
}

// Handle intents in plugin code
@IntentHandler('get_weather')
async handleGetWeather(intent: string, parameters: any, context: any) {
  const location = parameters.location || 'current';
  const weather = await this.getWeatherData(location);
  return createIntentResult(true, `Weather in ${location}: ${weather}`);
}
```

## Development Tools

### Plugin SDK

The Plugin SDK provides utilities for plugin development:

```typescript
import { PluginSDK } from './plugin-framework';

// Create plugin templates
const template = PluginSDK.createTemplate('basic-plugin');

// Validate plugin structure
const validation = PluginSDK.validatePluginStructure('./my-plugin');

// Generate documentation
const docs = PluginSDK.generateDocumentation('./my-plugin');
```

### CLI Tools

```bash
# Create new plugin
agentos plugin create my-plugin --template basic

# Validate plugin
agentos plugin validate ./my-plugin

# Package plugin
agentos plugin package ./my-plugin --output ./dist

# Publish to marketplace
agentos plugin publish ./my-plugin
```

## Best Practices

### Security

- Request minimum necessary permissions
- Validate all input parameters
- Use sandbox-friendly APIs
- Handle errors gracefully

### Performance

- Implement efficient algorithms
- Use caching where appropriate
- Monitor resource usage
- Clean up resources properly

### User Experience

- Provide clear error messages
- Support cancellation of long-running operations
- Handle network failures gracefully
- Follow platform conventions

## Examples

See the `examples/` directory for complete plugin implementations:

- **Weather Plugin**: Demonstrates API integration and intent handling
- **Calendar Plugin**: Shows data access and scheduling features
- **Notification Plugin**: Illustrates system integration

## API Reference

For detailed API documentation, see:

- [Plugin Interface](./docs/api-reference.md)
- [Plugin Development Guide](./docs/plugin-development-guide.md)

## Contributing

Contributions to the Plugin Framework are welcome! Please see the main AgentOS contributing guidelines.
