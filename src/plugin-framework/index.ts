/**
 * AgentOS Plugin Framework
 * Main entry point for the plugin development SDK
 */

// Core interfaces and types
export * from './types';
export * from './plugin-interface';

// Plugin management system
export { PluginLoader } from './plugin-loader';
export { PluginRegistry, UpdateInfo, PluginStatistics, CompatibilityResult } from './plugin-registry';
export { PluginValidator } from './plugin-validator';
export { PluginSandboxManager } from './plugin-sandbox';

// Plugin manager - main orchestrator
export { PluginManager } from './plugin-manager';

// Plugin lifecycle management
export { PluginDiscovery } from './plugin-discovery';
export { PluginCompatibilityChecker } from './plugin-compatibility';
export { PluginUpdater } from './plugin-updater';
export { PluginPerformanceMonitor } from './plugin-performance-monitor';

// Utilities for plugin developers
export { PluginSDK } from './plugin-sdk';
export { createExamplePlugin } from './examples/example-plugin';

// Version information
export const PLUGIN_FRAMEWORK_VERSION = '1.0.0';
export const SUPPORTED_AGENTOS_VERSIONS = ['1.0.0', '1.0.x', '^1.0.0'];

export interface PluginFrameworkConfig {
  registryPath: string;
  pluginPaths: string[];
  sandboxEnabled?: boolean;
  performanceMonitoring?: boolean;
  maxPlugins?: number;
  defaultResourceLimits?: {
    maxMemoryMB: number;
    maxCPUPercent: number;
    maxNetworkBandwidthKBps: number;
    maxStorageMB: number;
    maxExecutionTimeMs: number;
  };
}

/**
 * Initialize the plugin framework
 */
export async function initializePluginFramework(config: PluginFrameworkConfig): Promise<PluginManager> {
  const pluginManager = new PluginManager(config);
  await pluginManager.initialize();
  return pluginManager;
}