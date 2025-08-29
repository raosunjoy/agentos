# AgentOS Plugin Framework API Reference

Complete API reference for the AgentOS Plugin Framework.

## Core Classes

### AgentOSPlugin

Base class that all plugins must extend.

```typescript
abstract class AgentOSPlugin implements PluginLifecycle, IntentHandler {
  protected context?: PluginContext;
  
  abstract getMetadata(): PluginMetadata;
  abstract getIntents(): IntentDefinition[];
  abstract handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult>;
  
  async initialize(context: PluginContext): Promise<void>;
  async cleanup(): Promise<void>;
  
  // Lifecycle hooks (optional)
  async onInstall?(context: PluginContext): Promise<void>;
  async onEnable?(context: PluginContext): Promise<void>;
  async onDisable?(context: PluginContext): Promise<void>;
  async onUninstall?(context: PluginContext): Promise<void>;
  async onUpdate?(context: PluginContext, oldVersion: string): Promise<void>;
  
  // Utility methods
  protected async requestPermission(permission: string): Promise<boolean>;
  protected async sendNotification(title: string, message: string): Promise<void>;
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void;
  protected async readData(schema: string, query: object = {}): Promise<any[]>;
  protected async writeData(schema: string, data: object): Promise<string>;
}
```

### PluginManager

Main orchestrator for plugin operations.

```typescript
class PluginManager extends EventEmitter {
  constructor(config: PluginFrameworkConfig);
  
  async initialize(): Promise<void>;
  async installPlugin(pluginPath: string, userId: string): Promise<void>;
  async uninstallPlugin(pluginId: string): Promise<void>;
  async enablePlugin(pluginId: string, userId: string): Promise<void>;
  async disablePlugin(pluginId: string): Promise<void>;
  async handleIntent(intent: string, parameters: object, userId: string): Promise<IntentResult>;
  
  getAvailableIntents(): IntentDefinition[];
  getPlugin(pluginId: string): PluginRegistryEntry | undefined;
  getAllPlugins(): Map<string, PluginRegistryEntry>;
  searchPlugins(criteria: SearchCriteria): PluginRegistryEntry[];
  isPluginEnabled(pluginId: string): boolean;
  getStatistics(): PluginStatistics;
  
  async checkForUpdates(pluginId?: string): Promise<UpdateInfo[]>;
  async updatePlugin(pluginId: string, userId: string): Promise<void>;
  async discoverPlugins(): Promise<string[]>;
}
```

### PluginSDK

Development utilities for plugin creators.

```typescript
class PluginSDK {
  static async createPlugin(options: CreatePluginOptions): Promise<void>;
  static async validatePluginProject(pluginPath: string): Promise<ValidationResult>;
  static async buildPlugin(pluginPath: string, outputPath?: string): Promise<string>;
  
  static createIntent(options: CreateIntentOptions): IntentDefinition;
  static createPermission(options: CreatePermissionOptions): PluginPermission;
  static createParameter(options: CreateParameterOptions): IntentParameter;
}
```

## Core Interfaces

### PluginMetadata

Plugin identification and configuration.

```typescript
interface PluginMetadata {
  id: string;                    // Unique plugin identifier
  name: string;                  // Human-readable name
  version: string;               // Semantic version
  description: string;           // Plugin description
  author: string;                // Author name
  license: string;               // License identifier
  homepage?: string;             // Plugin homepage URL
  repository?: string;           // Source repository URL
  keywords: string[];            // Search keywords
  agentOSVersion: string;        // Compatible AgentOS version
  dependencies?: Record<string, string>; // Plugin dependencies
  permissions: PluginPermission[]; // Required permissions
  intents: IntentDefinition[];   // Supported intents
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
}
```

### PluginContext

Runtime context provided to plugins.

```typescript
interface PluginContext {
  pluginId: string;              // Plugin identifier
  userId: string;                // Current user ID
  sessionId: string;             // Session identifier
  permissions: Set<string>;      // Granted permissions
  dataAccess: DataAccessInterface; // Data layer access
  systemAccess: SystemAccessInterface; // System operations
  logger: PluginLogger;          // Logging interface
}
```

### IntentDefinition

Definition of a user intent.

```typescript
interface IntentDefinition {
  intentId: string;              // Unique intent identifier
  name: string;                  // Human-readable name
  description: string;           // Intent description
  examples: string[];            // Example phrases
  parameters: IntentParameter[]; // Expected parameters
  requiredPermissions: string[]; // Required permissions
  handler: string;               // Handler method name
}
```

### IntentResult

Result of intent processing.

```typescript
interface IntentResult {
  success: boolean;              // Whether intent succeeded
  response?: string;             // User-facing response
  data?: any;                    // Structured result data
  error?: string;                // Error message if failed
  followUpIntents?: string[];    // Suggested follow-up intents
}
```

### PluginPermission

Permission requirement declaration.

```typescript
interface PluginPermission {
  type: 'data' | 'system' | 'network' | 'hardware';
  resource: string;              // Resource identifier
  access: 'read' | 'write' | 'execute';
  description: string;           // Human-readable description
  required: boolean;             // Whether permission is required
}
```

## Data Access Interface

### DataAccessInterface

Interface for accessing the semantic data layer.

```typescript
interface DataAccessInterface {
  read(schema: string, query: object): Promise<any[]>;
  write(schema: string, data: object): Promise<string>;
  update(schema: string, id: string, data: object): Promise<boolean>;
  delete(schema: string, id: string): Promise<boolean>;
  subscribe(schema: string, callback: (data: any) => void): () => void;
}
```

#### Methods

**read(schema, query)**
- `schema`: Data schema name (e.g., 'contacts', 'calendar_events')
- `query`: Query object for filtering data
- Returns: Array of matching records

**write(schema, data)**
- `schema`: Data schema name
- `data`: Object to store
- Returns: Generated record ID

**update(schema, id, data)**
- `schema`: Data schema name
- `id`: Record ID to update
- `data`: Updated fields
- Returns: Success boolean

**delete(schema, id)**
- `schema`: Data schema name
- `id`: Record ID to delete
- Returns: Success boolean

**subscribe(schema, callback)**
- `schema`: Data schema name to watch
- `callback`: Function called on data changes
- Returns: Unsubscribe function

## System Access Interface

### SystemAccessInterface

Interface for system-level operations.

```typescript
interface SystemAccessInterface {
  sendNotification(title: string, message: string, options?: NotificationOptions): Promise<void>;
  requestPermission(permission: string): Promise<boolean>;
  executeWorkflow(workflowId: string, parameters: object): Promise<WorkflowResult>;
  registerIntent(intent: IntentDefinition): Promise<boolean>;
  unregisterIntent(intentId: string): Promise<boolean>;
}
```

#### Methods

**sendNotification(title, message, options)**
- `title`: Notification title
- `message`: Notification body
- `options`: Additional notification options
- Returns: Promise that resolves when sent

**requestPermission(permission)**
- `permission`: Permission string to request
- Returns: Boolean indicating if granted

**executeWorkflow(workflowId, parameters)**
- `workflowId`: Workflow to execute
- `parameters`: Workflow parameters
- Returns: Workflow execution result

**registerIntent(intent)**
- `intent`: Intent definition to register
- Returns: Success boolean

**unregisterIntent(intentId)**
- `intentId`: Intent ID to unregister
- Returns: Success boolean

## Utility Functions

### createIntentResult

Create a standardized intent result.

```typescript
function createIntentResult(
  success: boolean,
  response?: string,
  data?: any,
  error?: string
): IntentResult
```

### createPluginMetadata

Create plugin metadata with defaults.

```typescript
function createPluginMetadata(
  id: string,
  name: string,
  version: string,
  description: string,
  author: string,
  options?: Partial<PluginMetadata>
): PluginMetadata
```

## Decorators

### @IntentHandler

Mark a method as an intent handler.

```typescript
@IntentHandler('com.example.plugin.action')
async handleAction(parameters: any, context: PluginContext): Promise<IntentResult> {
  // Handler implementation
}
```

### @RequirePermission

Require a specific permission for method execution.

```typescript
@RequirePermission('data:contacts:read')
async getContacts(): Promise<Contact[]> {
  // Method implementation
}
```

## Events

### PluginManager Events

The PluginManager emits the following events:

- `initialized`: Plugin manager is ready
- `pluginInstalled`: Plugin was installed
- `pluginUninstalled`: Plugin was uninstalled
- `pluginEnabled`: Plugin was enabled
- `pluginDisabled`: Plugin was disabled
- `pluginError`: Plugin error occurred
- `intentRegistered`: Intent was registered
- `intentUnregistered`: Intent was unregistered

```typescript
pluginManager.on('pluginEnabled', (event: PluginEventData) => {
  console.log(`Plugin ${event.pluginId} enabled`);
});
```

## Configuration

### PluginFrameworkConfig

Configuration for the plugin framework.

```typescript
interface PluginFrameworkConfig {
  registryPath: string;          // Path to plugin registry file
  pluginPaths: string[];         // Directories to scan for plugins
  sandboxEnabled?: boolean;      // Enable plugin sandboxing
  performanceMonitoring?: boolean; // Enable performance monitoring
  maxPlugins?: number;           // Maximum number of plugins
  defaultResourceLimits?: ResourceLimits; // Default resource limits
}
```

### ResourceLimits

Resource limits for plugin sandboxes.

```typescript
interface ResourceLimits {
  maxMemoryMB: number;           // Maximum memory usage
  maxCPUPercent: number;         // Maximum CPU usage
  maxNetworkBandwidthKBps: number; // Maximum network bandwidth
  maxStorageMB: number;          // Maximum storage usage
  maxExecutionTimeMs: number;    // Maximum execution time
}
```

## Error Handling

### Common Error Types

- `PluginValidationError`: Plugin validation failed
- `PermissionDeniedError`: Required permission not granted
- `IntentNotFoundError`: Intent handler not found
- `PluginNotFoundError`: Plugin not registered
- `SandboxError`: Sandbox execution error

### Error Handling Best Practices

```typescript
async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
  try {
    // Intent processing logic
    return createIntentResult(true, 'Success');
  } catch (error) {
    this.log('error', 'Intent handling failed', error);
    
    if (error instanceof PermissionDeniedError) {
      return createIntentResult(false, undefined, undefined, 'Permission denied');
    }
    
    if (error instanceof ValidationError) {
      return createIntentResult(false, undefined, undefined, 'Invalid input');
    }
    
    return createIntentResult(false, undefined, undefined, 'Internal error');
  }
}
```

## Plugin Lifecycle

### Installation Flow

1. Plugin validation
2. Compatibility checking
3. Registry registration
4. Event emission

### Runtime Flow

1. Plugin loading
2. Context creation
3. Intent registration
4. Ready for requests

### Cleanup Flow

1. Intent unregistration
2. Resource cleanup
3. Plugin unloading
4. Registry update

## Security Model

### Sandbox Isolation

Plugins run in isolated sandboxes with:
- Limited API access
- Resource constraints
- Network restrictions
- File system isolation

### Permission System

- Declarative permissions in manifest
- Runtime permission checking
- User consent for sensitive operations
- Granular access control

### Data Protection

- Encrypted data storage
- User-controlled sharing
- Audit logging
- Privacy compliance

## Performance Considerations

### Best Practices

- Use lazy loading for heavy resources
- Implement proper caching strategies
- Clean up resources in lifecycle hooks
- Monitor memory usage
- Optimize intent processing

### Resource Monitoring

The framework automatically monitors:
- Memory usage
- CPU consumption
- Network bandwidth
- Execution time
- Error rates

## Testing

### Unit Testing

```typescript
import { createMockContext } from '@agentos/plugin-framework/testing';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let context: PluginContext;

  beforeEach(() => {
    plugin = new MyPlugin();
    context = createMockContext();
  });

  test('should handle intent', async () => {
    const result = await plugin.handle('my.intent', {}, context);
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing

```typescript
import { PluginTestHarness } from '@agentos/plugin-framework/testing';

describe('Plugin Integration', () => {
  let harness: PluginTestHarness;

  beforeEach(async () => {
    harness = new PluginTestHarness();
    await harness.loadPlugin('./my-plugin');
  });

  test('should process intent end-to-end', async () => {
    const result = await harness.processIntent('my.intent', { param: 'value' });
    expect(result.success).toBe(true);
  });
});
```

## Migration Guide

### Upgrading from v0.x to v1.0

1. Update plugin manifest format
2. Migrate to new permission system
3. Update intent definitions
4. Implement new lifecycle hooks
5. Update test configurations

See the [Migration Guide](./migration-guide.md) for detailed instructions.