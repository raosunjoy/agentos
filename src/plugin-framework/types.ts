/**
 * Core types and interfaces for the AgentOS Plugin Framework
 * Provides type definitions for plugin development and system integration
 */

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  agentOSVersion: string;
  dependencies?: Record<string, string>;
  permissions: PluginPermission[];
  intents: IntentDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginPermission {
  type: 'data' | 'system' | 'network' | 'hardware';
  resource: string;
  access: 'read' | 'write' | 'execute';
  description: string;
  required: boolean;
}

export interface IntentDefinition {
  intentId: string;
  name: string;
  description: string;
  examples: string[];
  parameters: IntentParameter[];
  requiredPermissions: string[];
  handler: string;
}

export interface IntentParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  validation?: string;
  defaultValue?: any;
}

export interface PluginContext {
  pluginId: string;
  userId: string;
  sessionId: string;
  permissions: Set<string>;
  dataAccess: DataAccessInterface;
  systemAccess: SystemAccessInterface;
  logger: PluginLogger;
}

export interface DataAccessInterface {
  read(schema: string, query: object): Promise<any[]>;
  write(schema: string, data: object): Promise<string>;
  update(schema: string, id: string, data: object): Promise<boolean>;
  delete(schema: string, id: string): Promise<boolean>;
  subscribe(schema: string, callback: (data: any) => void): () => void;
}

export interface SystemAccessInterface {
  sendNotification(title: string, message: string, options?: NotificationOptions): Promise<void>;
  requestPermission(permission: string): Promise<boolean>;
  executeWorkflow(workflowId: string, parameters: object): Promise<WorkflowResult>;
  registerIntent(intent: IntentDefinition): Promise<boolean>;
  unregisterIntent(intentId: string): Promise<boolean>;
}

export interface NotificationOptions {
  priority?: 'low' | 'normal' | 'high';
  actions?: NotificationAction[];
  icon?: string;
  sound?: boolean;
}

export interface NotificationAction {
  id: string;
  title: string;
  intent?: string;
}

export interface WorkflowResult {
  success: boolean;
  result?: any;
  error?: string;
  executionId: string;
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface PluginLifecycle {
  onInstall?(context: PluginContext): Promise<void>;
  onEnable?(context: PluginContext): Promise<void>;
  onDisable?(context: PluginContext): Promise<void>;
  onUninstall?(context: PluginContext): Promise<void>;
  onUpdate?(context: PluginContext, oldVersion: string): Promise<void>;
}

export interface IntentHandler {
  handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult>;
}

export interface IntentResult {
  success: boolean;
  response?: string;
  data?: any;
  error?: string;
  followUpIntents?: string[];
}

export interface PluginSandbox {
  pluginId: string;
  isolatedContext: boolean;
  resourceLimits: ResourceLimits;
  allowedAPIs: string[];
  networkAccess: boolean;
  fileSystemAccess: boolean;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCPUPercent: number;
  maxNetworkBandwidthKBps: number;
  maxStorageMB: number;
  maxExecutionTimeMs: number;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  recommendation?: string;
}

export interface PluginRegistryEntry {
  metadata: PluginMetadata;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  installPath: string;
  lastLoaded?: Date;
  errorMessage?: string;
  performanceMetrics?: PluginPerformanceMetrics;
}

export interface PluginPerformanceMetrics {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  networkUsageKB: number;
  intentHandlingTimeMs: number;
  errorCount: number;
  lastUpdated: Date;
}

export type PluginEvent = 
  | 'plugin:installed'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:uninstalled'
  | 'plugin:error'
  | 'intent:registered'
  | 'intent:unregistered';

export interface PluginEventData {
  pluginId: string;
  event: PluginEvent;
  timestamp: Date;
  data?: any;
  error?: string;
}