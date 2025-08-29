/**
 * Core plugin interface that all AgentOS plugins must implement
 * Provides the contract for plugin lifecycle and intent handling
 */

import {
  PluginMetadata,
  PluginContext,
  PluginLifecycle,
  IntentHandler,
  IntentResult,
  IntentDefinition
} from './types';

/**
 * Base abstract class that all plugins must extend
 * Provides default implementations and enforces the plugin contract
 */
export abstract class AgentOSPlugin implements PluginLifecycle, IntentHandler {
  protected context?: PluginContext;
  
  /**
   * Plugin metadata - must be implemented by each plugin
   */
  abstract getMetadata(): PluginMetadata;
  
  /**
   * Get all intent definitions supported by this plugin
   */
  abstract getIntents(): IntentDefinition[];
  
  /**
   * Handle an intent request
   */
  abstract handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult>;
  
  /**
   * Initialize the plugin with system context
   */
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    await this.onInstall?.(context);
  }
  
  /**
   * Cleanup plugin resources
   */
  async cleanup(): Promise<void> {
    if (this.context) {
      await this.onUninstall?.(this.context);
    }
  }
  
  /**
   * Lifecycle hooks - optional implementations
   */
  async onInstall?(context: PluginContext): Promise<void> {
    // Default: no-op
  }
  
  async onEnable?(context: PluginContext): Promise<void> {
    // Default: no-op
  }
  
  async onDisable?(context: PluginContext): Promise<void> {
    // Default: no-op
  }
  
  async onUninstall?(context: PluginContext): Promise<void> {
    // Default: no-op
  }
  
  async onUpdate?(context: PluginContext, oldVersion: string): Promise<void> {
    // Default: no-op
  }
  
  /**
   * Utility methods for plugin developers
   */
  protected async requestPermission(permission: string): Promise<boolean> {
    if (!this.context) {
      throw new Error('Plugin not initialized');
    }
    return this.context.systemAccess.requestPermission(permission);
  }
  
  protected async sendNotification(title: string, message: string): Promise<void> {
    if (!this.context) {
      throw new Error('Plugin not initialized');
    }
    return this.context.systemAccess.sendNotification(title, message);
  }
  
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.context) {
      console[level](`[${this.getMetadata().id}] ${message}`, ...args);
      return;
    }
    this.context.logger[level](message, ...args);
  }
  
  protected async readData(schema: string, query: object = {}): Promise<any[]> {
    if (!this.context) {
      throw new Error('Plugin not initialized');
    }
    return this.context.dataAccess.read(schema, query);
  }
  
  protected async writeData(schema: string, data: object): Promise<string> {
    if (!this.context) {
      throw new Error('Plugin not initialized');
    }
    return this.context.dataAccess.write(schema, data);
  }
}

/**
 * Plugin factory interface for dynamic loading
 */
export interface PluginFactory {
  createPlugin(): AgentOSPlugin;
}

/**
 * Plugin module interface for ES modules
 */
export interface PluginModule {
  default: PluginFactory;
  metadata?: PluginMetadata;
}

/**
 * Decorator for registering intent handlers
 */
export function IntentHandler(intentId: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target._intentHandlers) {
      target._intentHandlers = new Map();
    }
    target._intentHandlers.set(intentId, descriptor.value);
  };
}

/**
 * Decorator for requiring permissions
 */
export function RequirePermission(permission: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const context = (this as AgentOSPlugin).context;
      if (!context) {
        throw new Error('Plugin not initialized');
      }
      
      if (!context.permissions.has(permission)) {
        throw new Error(`Missing required permission: ${permission}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Utility function to create a simple intent result
 */
export function createIntentResult(
  success: boolean,
  response?: string,
  data?: any,
  error?: string
): IntentResult {
  return {
    success,
    response,
    data,
    error
  };
}

/**
 * Utility function to create plugin metadata
 */
export function createPluginMetadata(
  id: string,
  name: string,
  version: string,
  description: string,
  author: string,
  options: Partial<PluginMetadata> = {}
): PluginMetadata {
  return {
    id,
    name,
    version,
    description,
    author,
    license: options.license || 'MIT',
    keywords: options.keywords || [],
    agentOSVersion: options.agentOSVersion || '1.0.0',
    permissions: options.permissions || [],
    intents: options.intents || [],
    createdAt: options.createdAt || new Date(),
    updatedAt: options.updatedAt || new Date(),
    ...options
  };
}