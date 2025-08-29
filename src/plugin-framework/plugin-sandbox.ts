/**
 * Security sandboxing system for third-party plugins
 * Provides isolated execution environments with resource limits
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import {
  PluginSandbox,
  ResourceLimits,
  PluginPerformanceMetrics
} from './types';

export class PluginSandboxManager extends EventEmitter {
  private sandboxes = new Map<string, SandboxInstance>();
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    super();
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * Create a new sandbox for a plugin
   */
  async createSandbox(pluginId: string, config: PluginSandbox): Promise<PluginSandbox> {
    if (this.sandboxes.has(pluginId)) {
      throw new Error(`Sandbox for plugin ${pluginId} already exists`);
    }

    const sandbox = new SandboxInstance(pluginId, config);
    await sandbox.initialize();

    this.sandboxes.set(pluginId, sandbox);
    this.performanceMonitor.startMonitoring(pluginId, config.resourceLimits);

    return config;
  }

  /**
   * Destroy a sandbox and cleanup resources
   */
  async destroySandbox(pluginId: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`Sandbox for plugin ${pluginId} not found`);
    }

    await sandbox.destroy();
    this.sandboxes.delete(pluginId);
    this.performanceMonitor.stopMonitoring(pluginId);
  }

  /**
   * Load a module in a sandbox
   */
  async loadModule(modulePath: string, sandbox: PluginSandbox): Promise<any> {
    const sandboxInstance = this.sandboxes.get(sandbox.pluginId);
    if (!sandboxInstance) {
      throw new Error(`Sandbox for plugin ${sandbox.pluginId} not found`);
    }

    return sandboxInstance.loadModule(modulePath);
  }

  /**
   * Execute code in a sandbox
   */
  async executeInSandbox(pluginId: string, code: string, context?: any): Promise<any> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`Sandbox for plugin ${pluginId} not found`);
    }

    return sandbox.execute(code, context);
  }

  /**
   * Get performance metrics for a plugin
   */
  getPerformanceMetrics(pluginId: string): PluginPerformanceMetrics | undefined {
    return this.performanceMonitor.getMetrics(pluginId);
  }

  /**
   * Check if a plugin is exceeding resource limits
   */
  isExceedingLimits(pluginId: string): boolean {
    return this.performanceMonitor.isExceedingLimits(pluginId);
  }

  /**
   * Get all active sandboxes
   */
  getActiveSandboxes(): string[] {
    return Array.from(this.sandboxes.keys());
  }
}

class SandboxInstance {
  private worker?: Worker;
  private initialized = false;
  private moduleCache = new Map<string, any>();

  constructor(
    private pluginId: string,
    private config: PluginSandbox
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create isolated worker thread for the plugin
    this.worker = new Worker(`
      const { parentPort } = require('worker_threads');
      const vm = require('vm');
      
      // Create isolated context
      const sandbox = {
        console: {
          log: (...args) => parentPort.postMessage({ type: 'log', level: 'info', args }),
          error: (...args) => parentPort.postMessage({ type: 'log', level: 'error', args }),
          warn: (...args) => parentPort.postMessage({ type: 'log', level: 'warn', args }),
          debug: (...args) => parentPort.postMessage({ type: 'log', level: 'debug', args })
        },
        setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 5000)), // Max 5s timeout
        clearTimeout,
        setInterval: (fn, interval) => setInterval(fn, Math.max(interval, 100)), // Min 100ms interval
        clearInterval,
        Buffer,
        process: {
          env: {},
          version: process.version,
          platform: process.platform
        }
      };
      
      // Add allowed APIs based on permissions
      const allowedAPIs = ${JSON.stringify(this.config.allowedAPIs)};
      
      if (allowedAPIs.includes('fetch')) {
        sandbox.fetch = require('node-fetch');
      }
      
      const context = vm.createContext(sandbox);
      
      parentPort.on('message', async (message) => {
        try {
          switch (message.type) {
            case 'execute':
              const result = vm.runInContext(message.code, context, {
                timeout: ${this.config.resourceLimits.maxExecutionTimeMs},
                displayErrors: true
              });
              parentPort.postMessage({ type: 'result', id: message.id, result });
              break;
              
            case 'loadModule':
              const moduleCode = require('fs').readFileSync(message.path, 'utf-8');
              const moduleResult = vm.runInContext(
                \`(function(exports, require, module, __filename, __dirname) {
                  \${moduleCode}
                  return module.exports || exports;
                })\`,
                context,
                { timeout: ${this.config.resourceLimits.maxExecutionTimeMs} }
              );
              
              const moduleExports = moduleResult({}, require, { exports: {} }, message.path, require('path').dirname(message.path));
              parentPort.postMessage({ type: 'moduleLoaded', id: message.id, exports: moduleExports });
              break;
          }
        } catch (error) {
          parentPort.postMessage({ 
            type: 'error', 
            id: message.id, 
            error: error.message,
            stack: error.stack 
          });
        }
      });
    `, { eval: true });

    // Set up resource monitoring
    this.setupResourceMonitoring();

    this.initialized = true;
  }

  async destroy(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = undefined;
    }
    this.moduleCache.clear();
    this.initialized = false;
  }

  async loadModule(modulePath: string): Promise<any> {
    if (!this.worker) {
      throw new Error('Sandbox not initialized');
    }

    // Check cache first
    if (this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath);
    }

    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);
      
      const messageHandler = (message: any) => {
        if (message.id === messageId) {
          this.worker!.off('message', messageHandler);
          
          if (message.type === 'moduleLoaded') {
            this.moduleCache.set(modulePath, message.exports);
            resolve(message.exports);
          } else if (message.type === 'error') {
            reject(new Error(`Module loading failed: ${message.error}`));
          }
        }
      };
      
      this.worker!.on('message', messageHandler);
      this.worker!.postMessage({
        type: 'loadModule',
        id: messageId,
        path: modulePath
      });
      
      // Timeout after resource limit
      setTimeout(() => {
        this.worker!.off('message', messageHandler);
        reject(new Error('Module loading timeout'));
      }, this.config.resourceLimits.maxExecutionTimeMs);
    });
  }

  async execute(code: string, context?: any): Promise<any> {
    if (!this.worker) {
      throw new Error('Sandbox not initialized');
    }

    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);
      
      const messageHandler = (message: any) => {
        if (message.id === messageId) {
          this.worker!.off('message', messageHandler);
          
          if (message.type === 'result') {
            resolve(message.result);
          } else if (message.type === 'error') {
            reject(new Error(`Execution failed: ${message.error}`));
          }
        }
      };
      
      this.worker!.on('message', messageHandler);
      this.worker!.postMessage({
        type: 'execute',
        id: messageId,
        code,
        context
      });
      
      // Timeout after resource limit
      setTimeout(() => {
        this.worker!.off('message', messageHandler);
        reject(new Error('Execution timeout'));
      }, this.config.resourceLimits.maxExecutionTimeMs);
    });
  }

  private setupResourceMonitoring(): void {
    if (!this.worker) return;

    // Monitor worker resource usage
    const checkResources = () => {
      if (!this.worker) return;

      const resourceUsage = this.worker.resourceLimits;
      
      // Check memory usage
      if (resourceUsage && resourceUsage.maxOldGenerationSizeMb) {
        const memoryUsage = resourceUsage.maxOldGenerationSizeMb;
        if (memoryUsage > this.config.resourceLimits.maxMemoryMB) {
          this.worker.terminate();
          throw new Error(`Plugin ${this.pluginId} exceeded memory limit`);
        }
      }
    };

    // Check resources every 5 seconds
    const resourceInterval = setInterval(checkResources, 5000);
    
    this.worker.on('exit', () => {
      clearInterval(resourceInterval);
    });
  }
}

class PerformanceMonitor {
  private metrics = new Map<string, PluginPerformanceMetrics>();
  private limits = new Map<string, ResourceLimits>();
  private intervals = new Map<string, NodeJS.Timeout>();

  startMonitoring(pluginId: string, limits: ResourceLimits): void {
    this.limits.set(pluginId, limits);
    this.metrics.set(pluginId, {
      memoryUsageMB: 0,
      cpuUsagePercent: 0,
      networkUsageKB: 0,
      intentHandlingTimeMs: 0,
      errorCount: 0,
      lastUpdated: new Date()
    });

    // Start monitoring interval
    const interval = setInterval(() => {
      this.updateMetrics(pluginId);
    }, 1000);
    
    this.intervals.set(pluginId, interval);
  }

  stopMonitoring(pluginId: string): void {
    const interval = this.intervals.get(pluginId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(pluginId);
    }
    
    this.metrics.delete(pluginId);
    this.limits.delete(pluginId);
  }

  getMetrics(pluginId: string): PluginPerformanceMetrics | undefined {
    return this.metrics.get(pluginId);
  }

  isExceedingLimits(pluginId: string): boolean {
    const metrics = this.metrics.get(pluginId);
    const limits = this.limits.get(pluginId);
    
    if (!metrics || !limits) {
      return false;
    }

    return (
      metrics.memoryUsageMB > limits.maxMemoryMB ||
      metrics.cpuUsagePercent > limits.maxCPUPercent ||
      metrics.networkUsageKB > limits.maxNetworkBandwidthKBps
    );
  }

  private updateMetrics(pluginId: string): void {
    const metrics = this.metrics.get(pluginId);
    if (!metrics) return;

    // Update metrics (simplified - in real implementation would use system APIs)
    metrics.lastUpdated = new Date();
    
    // In a real implementation, this would collect actual resource usage
    // from the worker thread and system monitoring APIs
  }
}