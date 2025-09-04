/**
 * AgentOS - The Future of Mobile Computing
 *
 * Main entry point for the AgentOS platform
 * Initializes all core systems and provides unified API
 */

// Core system exports
export * from './intelligence-layer';
export * from './plugin-framework';
export * from './voice-interface';
export * from './performance';
export * from './caregiver';

// Core systems
export * from './core/logging';
export * from './core/errors';

// Configuration and types
export type { AgentOSConfig } from './types/config';
export type { AgentOSStatus } from './types/system';

// Import types locally to avoid naming conflicts
import type { AgentOSConfig as ConfigType } from './types/config';
import type { AgentOSStatus as StatusType } from './types/system';

// Import core systems
import { initializeLogging, systemLogger, createTimer } from './core/logging';
import { errorHandler } from './core/errors';

// Main AgentOS class
export class AgentOS {
  private static instance: AgentOS;
  private isInitialized = false;
  private config: ConfigType;
  private logger = systemLogger('agentos');

  private constructor(config: ConfigType) {
    this.config = config;
  }

  /**
   * Get singleton instance of AgentOS
   */
  public static getInstance(config?: ConfigType): AgentOS {
    if (!AgentOS.instance) {
      AgentOS.instance = new AgentOS(config || AgentOS.getDefaultConfig());
    }
    return AgentOS.instance;
  }

  /**
   * Initialize all AgentOS systems
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.info('AgentOS already initialized');
      return;
    }

    const timer = createTimer('agentos_initialization');

    try {
      this.logger.info('Initializing AgentOS...', {
        version: this.config.version,
        environment: this.config.environment
      });

      // 0. Initialize core systems first
      this.logger.info('Initializing logging system...');
      initializeLogging({
        logLevel: this.config.logLevel || 'info'
      });
      this.logger.info('Logging system initialized');

      this.logger.info('Initializing error handling system...');
      // Error handler is already initialized as singleton
      this.logger.info('Error handling system initialized');

      // 1. Initialize plugin framework first (other systems depend on it)
      this.logger.info('Initializing plugin framework...');
      // Plugin initialization will be implemented

      // 2. Initialize intelligence layer
      this.logger.info('Initializing intelligence layer...');
      // Intelligence layer initialization will be implemented

      // 3. Initialize voice interface
      this.logger.info('Initializing voice interface...');
      // Voice interface initialization will be implemented

      // 4. Initialize performance optimization
      this.logger.info('Initializing performance optimization...');
      // Performance optimization initialization will be implemented

      // 5. Initialize caregiver system
      this.logger.info('Initializing caregiver system...');
      // Caregiver system initialization will be implemented

      this.isInitialized = true;
      const duration = timer.end();

      this.logger.info('AgentOS initialized successfully', {
        duration,
        version: this.config.version,
        environment: this.config.environment
      });

    } catch (error) {
      const duration = timer.end();
      await errorHandler.handleError(error, {
        component: 'agentos',
        operation: 'initialization',
        duration
      });
      throw error;
    }
  }

  /**
   * Shutdown AgentOS and cleanup resources
   */
  public async shutdown(): Promise<void> {
    const timer = createTimer('agentos_shutdown');

    try {
      this.logger.info('Shutting down AgentOS...');

      // Shutdown systems in reverse order
      // Implementation will be added as systems are completed

      this.isInitialized = false;
      const duration = timer.end();

      this.logger.info('AgentOS shutdown complete', { duration });

    } catch (error) {
      const duration = timer.end();
      await errorHandler.handleError(error, {
        component: 'agentos',
        operation: 'shutdown',
        duration
      });
      throw error;
    }
  }

  /**
   * Get current system status
   */
  public getStatus(): StatusType {
    return {
      initialized: this.isInitialized,
      version: this.config.version,
      environment: this.config.environment,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      // Additional status metrics will be added
    };
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): ConfigType {
    return {
      version: '0.1.0',
      environment: 'development',
      logLevel: 'info',
      enablePlugins: true,
      enableSecurity: true,
      enablePerformanceOptimization: true,
      enableVoiceInterface: true,
      enableCaregiverSystem: true,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxCPUUsage: 80, // 80%
      pluginSandbox: true,
      securityLevel: 'high',
      nlp: {
        confidenceThreshold: 0.7,
        cacheSize: 100,
        enableElderlyOptimizations: true,
        supportedLanguages: ['en', 'es', 'fr']
      },
      voice: {
        wakeWord: 'agent',
        speechRate: 0.8,
        pitch: 1.0,
        volume: 0.7
      },
      performance: {
        adaptiveScaling: true,
        batteryOptimization: true,
        thermalManagement: true,
        memoryManagement: true
      }
    };
  }
}

// Convenience functions for quick setup
export async function initializeAgentOS(config?: ConfigType): Promise<AgentOS> {
  const agentOS = AgentOS.getInstance(config);
  await agentOS.initialize();
  return agentOS;
}

export async function shutdownAgentOS(): Promise<void> {
  const agentOS = AgentOS.getInstance();
  await agentOS.shutdown();
}

// Export version information
export const AGENTOS_VERSION = '0.1.0';
export const AGENTOS_API_VERSION = '1.0.0';
