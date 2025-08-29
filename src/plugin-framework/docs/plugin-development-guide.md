# AgentOS Plugin Development Guide

This guide will help you create plugins for AgentOS, the agent-centric mobile operating system.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Plugin Architecture](#plugin-architecture)
3. [Creating Your First Plugin](#creating-your-first-plugin)
4. [Intent Handling](#intent-handling)
5. [Data Access](#data-access)
6. [Permissions](#permissions)
7. [Testing](#testing)
8. [Best Practices](#best-practices)
9. [Publishing](#publishing)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- TypeScript knowledge
- Basic understanding of AgentOS concepts

### Installation

```bash
npm install @agentos/plugin-framework
```

### Quick Start

Use the Plugin SDK to create a new plugin:

```typescript
import { PluginSDK } from '@agentos/plugin-framework';

await PluginSDK.createPlugin({
  name: 'My Awesome Plugin',
  id: 'com.mycompany.awesome',
  version: '1.0.0',
  description: 'An awesome plugin for AgentOS',
  author: 'Your Name',
  outputPath: './plugins',
  template: 'basic'
});
```

## Plugin Architecture

AgentOS plugins are TypeScript/JavaScript modules that extend the `AgentOSPlugin` base class. They run in secure sandboxes and communicate with the system through well-defined APIs.

### Core Components

- **Plugin Manifest** (`plugin.json`): Metadata and configuration
- **Main Module** (`src/index.ts`): Plugin implementation
- **Intent Handlers**: Functions that process user intents
- **Permissions**: Declared access requirements

### Plugin Lifecycle

1. **Installation**: Plugin is validated and registered
2. **Enabling**: Plugin is loaded and initialized
3. **Runtime**: Plugin handles intents and interacts with system
4. **Disabling**: Plugin is unloaded and resources cleaned up
5. **Uninstallation**: Plugin is removed from system

## Creating Your First Plugin

### 1. Plugin Manifest

Create `plugin.json` with your plugin metadata:

```json
{
  "id": "com.example.greeter",
  "name": "Greeter Plugin",
  "version": "1.0.0",
  "description": "A friendly greeting plugin",
  "author": "Your Name",
  "license": "MIT",
  "keywords": ["greeting", "hello"],
  "agentOSVersion": "1.0.0",
  "permissions": [
    {
      "type": "system",
      "resource": "notifications",
      "access": "write",
      "description": "Send greeting notifications",
      "required": false
    }
  ],
  "intents": []
}
```

### 2. Main Plugin Class

Create `src/index.ts`:

```typescript
import {
  AgentOSPlugin,
  PluginMetadata,
  IntentDefinition,
  IntentResult,
  PluginContext,
  createIntentResult,
  createPluginMetadata
} from '@agentos/plugin-framework';

export default class GreeterPlugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return createPluginMetadata(
      'com.example.greeter',
      'Greeter Plugin',
      '1.0.0',
      'A friendly greeting plugin',
      'Your Name'
    );
  }

  getIntents(): IntentDefinition[] {
    return [
      {
        intentId: 'com.example.greeter.hello',
        name: 'Say Hello',
        description: 'Greet the user',
        examples: ['say hello', 'greet me', 'hello'],
        parameters: [
          {
            name: 'name',
            type: 'string',
            required: false,
            description: 'Name to greet'
          }
        ],
        requiredPermissions: [],
        handler: 'handleHello'
      }
    ];
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    switch (intent) {
      case 'com.example.greeter.hello':
        return this.handleHello(parameters, context);
      default:
        return createIntentResult(false, undefined, undefined, `Unknown intent: ${intent}`);
    }
  }

  private async handleHello(parameters: any, context: PluginContext): Promise<IntentResult> {
    const name = parameters.name || 'there';
    const greeting = `Hello, ${name}! Nice to meet you.`;
    
    this.log('info', `Greeting user: ${name}`);
    
    return createIntentResult(true, greeting, { name, timestamp: new Date() });
  }
}

export function createPlugin(): GreeterPlugin {
  return new GreeterPlugin();
}
```

### 3. Package Configuration

Create `package.json`:

```json
{
  "name": "greeter-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@agentos/plugin-framework": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^4.9.0",
    "@types/node": "^18.0.0"
  }
}
```

## Intent Handling

Intents are the primary way users interact with your plugin. They represent user goals expressed in natural language.

### Defining Intents

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
      description: 'Location for weather query',
      validation: '^[a-zA-Z\\s,]+$'
    }
  ],
  requiredPermissions: ['network:weather_api:read'],
  handler: 'handleCurrentWeather'
}
```

### Intent Parameters

Parameters allow users to provide specific information:

- **Types**: `string`, `number`, `boolean`, `object`, `array`
- **Validation**: Regular expressions for string validation
- **Default Values**: Fallback values when not provided

### Handling Complex Intents

```typescript
async handleBooking(parameters: any, context: PluginContext): Promise<IntentResult> {
  const { service, date, time, duration } = parameters;
  
  try {
    // Validate parameters
    if (!service) {
      return createIntentResult(false, undefined, undefined, 'Service type is required');
    }
    
    // Process booking
    const booking = await this.createBooking(service, date, time, duration);
    
    // Send confirmation
    await this.sendNotification(
      'Booking Confirmed',
      `Your ${service} appointment is booked for ${date} at ${time}`
    );
    
    return createIntentResult(
      true,
      `Booking confirmed for ${service} on ${date}`,
      { bookingId: booking.id, service, date, time }
    );
  } catch (error) {
    this.log('error', 'Booking failed', error);
    return createIntentResult(false, undefined, undefined, error.message);
  }
}
```

## Data Access

AgentOS provides a unified data layer for secure cross-plugin data sharing.

### Reading Data

```typescript
// Read user preferences
const preferences = await this.readData('user_preferences', {
  userId: context.userId,
  category: 'weather'
});

// Read with complex query
const events = await this.readData('calendar_events', {
  userId: context.userId,
  startDate: { $gte: new Date() },
  endDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
});
```

### Writing Data

```typescript
// Save user preference
const prefId = await this.writeData('user_preferences', {
  userId: context.userId,
  category: 'weather',
  key: 'default_location',
  value: 'New York',
  updatedAt: new Date()
});

// Save complex data
const eventId = await this.writeData('calendar_events', {
  userId: context.userId,
  title: 'Doctor Appointment',
  startTime: new Date('2024-03-15T10:00:00Z'),
  endTime: new Date('2024-03-15T11:00:00Z'),
  location: 'Medical Center',
  reminders: [
    { type: 'notification', minutesBefore: 60 },
    { type: 'email', minutesBefore: 1440 }
  ]
});
```

### Data Subscriptions

```typescript
// Subscribe to data changes
const unsubscribe = this.context.dataAccess.subscribe('user_preferences', (data) => {
  this.log('info', 'User preferences updated', data);
  this.handlePreferenceChange(data);
});

// Cleanup subscription
await this.onDisable(context);
unsubscribe();
```

## Permissions

Plugins must declare all required permissions in their manifest.

### Permission Types

- **data**: Access to semantic data schemas
- **system**: System-level operations
- **network**: External network access
- **hardware**: Device hardware access

### Permission Examples

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
      "description": "Send appointment reminders",
      "required": false
    },
    {
      "type": "network",
      "resource": "weather_api",
      "access": "read",
      "description": "Fetch weather data",
      "required": true
    }
  ]
}
```

### Runtime Permission Checks

```typescript
@RequirePermission('data:contacts:read')
async getContactInfo(phoneNumber: string): Promise<Contact | null> {
  const contacts = await this.readData('contacts', {
    phoneNumber: phoneNumber
  });
  
  return contacts[0] || null;
}
```

### Requesting Additional Permissions

```typescript
async requestLocationAccess(): Promise<boolean> {
  const granted = await this.requestPermission('hardware:location:read');
  
  if (granted) {
    this.log('info', 'Location permission granted');
    return true;
  } else {
    this.log('warn', 'Location permission denied');
    return false;
  }
}
```

## Testing

### Unit Testing

```typescript
import { GreeterPlugin } from '../src/index';
import { PluginContext } from '@agentos/plugin-framework';

describe('GreeterPlugin', () => {
  let plugin: GreeterPlugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = new GreeterPlugin();
    mockContext = createMockContext();
  });

  test('should greet user with name', async () => {
    const result = await plugin.handle(
      'com.example.greeter.hello',
      { name: 'Alice' },
      mockContext
    );
    
    expect(result.success).toBe(true);
    expect(result.response).toBe('Hello, Alice! Nice to meet you.');
  });

  test('should greet user without name', async () => {
    const result = await plugin.handle(
      'com.example.greeter.hello',
      {},
      mockContext
    );
    
    expect(result.success).toBe(true);
    expect(result.response).toBe('Hello, there! Nice to meet you.');
  });
});

function createMockContext(): PluginContext {
  return {
    pluginId: 'com.example.greeter',
    userId: 'test-user',
    sessionId: 'test-session',
    permissions: new Set(),
    dataAccess: {
      read: jest.fn().mockResolvedValue([]),
      write: jest.fn().mockResolvedValue('test-id'),
      update: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {})
    },
    systemAccess: {
      sendNotification: jest.fn(),
      requestPermission: jest.fn().mockResolvedValue(true),
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
}
```

### Integration Testing

```typescript
import { PluginManager } from '@agentos/plugin-framework';

describe('Plugin Integration', () => {
  let pluginManager: PluginManager;

  beforeEach(async () => {
    pluginManager = new PluginManager({
      registryPath: './test-registry.json',
      pluginPaths: ['./test-plugins']
    });
    
    await pluginManager.initialize();
  });

  test('should install and enable plugin', async () => {
    await pluginManager.installPlugin('./greeter-plugin', 'test-user');
    await pluginManager.enablePlugin('com.example.greeter', 'test-user');
    
    expect(pluginManager.isPluginEnabled('com.example.greeter')).toBe(true);
  });

  test('should handle intent end-to-end', async () => {
    await pluginManager.installPlugin('./greeter-plugin', 'test-user');
    await pluginManager.enablePlugin('com.example.greeter', 'test-user');
    
    const result = await pluginManager.handleIntent(
      'com.example.greeter.hello',
      { name: 'Test' },
      'test-user'
    );
    
    expect(result.success).toBe(true);
    expect(result.response).toContain('Hello, Test');
  });
});
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
async handleIntent(parameters: any, context: PluginContext): Promise<IntentResult> {
  try {
    const result = await this.processRequest(parameters);
    return createIntentResult(true, 'Success', result);
  } catch (error) {
    this.log('error', 'Request failed', error);
    
    // Provide user-friendly error messages
    const userMessage = this.getUserFriendlyError(error);
    return createIntentResult(false, undefined, undefined, userMessage);
  }
}

private getUserFriendlyError(error: Error): string {
  if (error.message.includes('network')) {
    return 'Unable to connect to the service. Please check your internet connection.';
  }
  if (error.message.includes('permission')) {
    return 'Permission denied. Please check your plugin permissions.';
  }
  return 'Something went wrong. Please try again later.';
}
```

### 2. Performance Optimization

- Use lazy loading for heavy resources
- Cache frequently accessed data
- Implement proper cleanup in lifecycle hooks

```typescript
class WeatherPlugin extends AgentOSPlugin {
  private weatherCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  async getWeather(location: string): Promise<any> {
    const cached = this.weatherCache.get(location);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    const weather = await this.fetchWeatherData(location);
    this.weatherCache.set(location, {
      data: weather,
      timestamp: Date.now()
    });
    
    return weather;
  }

  async onDisable(context: PluginContext): Promise<void> {
    // Cleanup resources
    this.weatherCache.clear();
  }
}
```

### 3. User Experience

- Provide clear, helpful responses
- Use consistent language and tone
- Handle edge cases gracefully

```typescript
async handleBooking(parameters: any, context: PluginContext): Promise<IntentResult> {
  const { service, date } = parameters;
  
  // Validate input
  if (!service) {
    return createIntentResult(
      false,
      'I need to know what service you\'d like to book. Could you please specify?'
    );
  }
  
  // Parse date
  const bookingDate = this.parseDate(date);
  if (!bookingDate) {
    return createIntentResult(
      false,
      'I couldn\'t understand the date. Could you try saying it differently? For example: "tomorrow at 2 PM" or "March 15th"'
    );
  }
  
  // Check availability
  const available = await this.checkAvailability(service, bookingDate);
  if (!available) {
    const alternatives = await this.suggestAlternatives(service, bookingDate);
    return createIntentResult(
      false,
      `That time isn't available. How about ${alternatives.join(' or ')}?`,
      { alternatives }
    );
  }
  
  // Proceed with booking...
}
```

### 4. Security

- Validate all input parameters
- Use parameterized queries for data access
- Never expose sensitive information in logs

```typescript
async handleUserData(parameters: any, context: PluginContext): Promise<IntentResult> {
  // Validate input
  const userId = this.validateUserId(parameters.userId);
  if (!userId) {
    return createIntentResult(false, undefined, undefined, 'Invalid user ID');
  }
  
  // Check permissions
  if (!context.permissions.has('data:user_profile:read')) {
    return createIntentResult(false, undefined, undefined, 'Insufficient permissions');
  }
  
  // Sanitize data before logging
  this.log('info', 'Processing user data request', {
    userId: userId.substring(0, 8) + '...',
    timestamp: new Date()
  });
  
  // Process request...
}
```

## Publishing

### 1. Build Your Plugin

```bash
npm run build
npm test
```

### 2. Validate Plugin

```typescript
import { PluginSDK } from '@agentos/plugin-framework';

const validation = await PluginSDK.validatePluginProject('./my-plugin');

if (!validation.valid) {
  console.error('Validation failed:', validation.issues);
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
```

### 3. Package for Distribution

```bash
# Build distribution package
npm run build

# Create plugin package
tar -czf my-plugin-1.0.0.tgz dist/ plugin.json package.json README.md
```

### 4. Submit to Plugin Registry

Follow the AgentOS plugin registry submission guidelines to make your plugin available to users.

## Resources

- [AgentOS Plugin API Reference](./api-reference.md)
- [Example Plugins](../examples/)
- [Plugin Registry](https://plugins.agentos.org)
- [Community Forum](https://community.agentos.org)

## Support

- GitHub Issues: [agentos/plugin-framework](https://github.com/agentos/plugin-framework/issues)
- Documentation: [docs.agentos.org](https://docs.agentos.org)
- Community Discord: [discord.gg/agentos](https://discord.gg/agentos)