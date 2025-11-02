/**
 * AgentOS Main Entry Point
 * Production-ready mobile computing platform with AI orchestration
 */

import 'reflect-metadata'; // Required for dependency injection
import { AgentOS } from './core/agentos';
import { HttpServer } from './core/server/http-server';
import { gracefulShutdown } from './core/lifecycle/graceful-shutdown';
import { ConfigValidator } from './core/config/config-validator';
import { systemLogger } from './core/logging';
import { errorHandler } from './core/errors';

const logger = systemLogger('main');

/**
 * Main application class
 */
class AgentOSApplication {
  private agentOS?: AgentOS;
  private httpServer?: HttpServer;
  private configValidator: ConfigValidator;

  constructor() {
    this.configValidator = new ConfigValidator();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing AgentOS Application...');

      // Validate configuration
      const configValidation = this.configValidator.validateEnvironment();
      if (!configValidation.isValid) {
        logger.error('Configuration validation failed', {
          errors: configValidation.errors
        });
        throw new Error('Invalid configuration');
      }

      // Create AgentOS instance with validated config
      const agentOSConfig = {
        version: '1.0.0',
        environment: (process.env.NODE_ENV as any) || 'development',
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
        enablePlugins: true,
        enableSecurity: true,
        enablePerformanceOptimization: true,
        enableVoiceInterface: true,
        enableCaregiverSystem: false, // Enable based on license/features
        maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
        maxCPUUsage: 80,
        pluginSandbox: true,
        securityLevel: 'high',
        nlp: {
          confidenceThreshold: 0.8,
          cacheSize: 1000,
          enableElderlyOptimizations: true,
          supportedLanguages: ['en', 'es', 'fr']
        },
        voice: {
          wakeWord: 'hey agent',
          speechRate: 1.0,
          pitch: 1.0,
          volume: 0.8,
          enableNoiseFiltering: true,
          enableElderlyOptimizations: true,
          supportedLanguages: ['en', 'es', 'fr']
        },
        performance: {
          adaptiveScaling: true,
          batteryOptimization: true,
          thermalManagement: true,
          memoryManagement: true,
          maxMemoryUsage: 2 * 1024 * 1024 * 1024,
          maxCPUUsage: 80,
          enableModelQuantization: true,
          targetBatteryLifeHours: 8
        },
        caregiver: {
          enableEmergencyAlerts: true,
          enableDailyReports: true,
          enableRemoteAccess: true,
          maxConcurrentSessions: 5,
          sessionTimeoutMinutes: 30,
          auditLogRetentionDays: 90
        }
      };

      this.agentOS = new AgentOS(agentOSConfig);
      await this.agentOS.initialize();

      // Create HTTP server
      const serverConfig = {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
        enableHealthCheck: true,
        enableMetrics: true,
        enableCompression: true,
        enableSecurityHeaders: true
      };

      this.httpServer = new HttpServer(serverConfig);
      await this.httpServer.start();

      logger.info('AgentOS Application initialized successfully', {
        port: serverConfig.port,
        environment: agentOSConfig.environment
      });

    } catch (error) {
      logger.error('Failed to initialize AgentOS Application', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting AgentOS Application...');

      // Application is already initialized and running
      // Additional startup logic can go here

      logger.info('AgentOS Application started successfully');

    } catch (error) {
      logger.error('Failed to start AgentOS Application', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Shutdown the application
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down AgentOS Application...');

      // Shutdown HTTP server
      if (this.httpServer) {
        await this.httpServer.stop();
      }

      // Shutdown AgentOS
      if (this.agentOS) {
        await this.agentOS.shutdown();
      }

      logger.info('AgentOS Application shutdown complete');

    } catch (error) {
      logger.error('Error during AgentOS Application shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get application status
   */
  getStatus(): any {
    return {
      application: 'agentos',
      version: '1.0.0',
      status: 'running',
      environment: process.env.NODE_ENV || 'development',
      agentOS: this.agentOS?.getStatus(),
      httpServer: this.httpServer ? {
        port: this.httpServer.getConfig().port,
        host: this.httpServer.getConfig().host
      } : null,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

// Global application instance
let application: AgentOSApplication;

/**
 * Initialize AgentOS
 */
export async function initializeAgentOS(): Promise<AgentOSApplication> {
  if (!application) {
    application = new AgentOSApplication();
    await application.initialize();
  }
  return application;
}

/**
 * Start AgentOS
 */
export async function startAgentOS(): Promise<void> {
  const app = await initializeAgentOS();
  await app.start();
}

/**
 * Shutdown AgentOS
 */
export async function shutdownAgentOS(): Promise<void> {
  if (application) {
    await application.shutdown();
  }
}

/**
 * Get application status
 */
export function getApplicationStatus(): any {
  return application?.getStatus() || { status: 'not_initialized' };
}

// Graceful shutdown handlers
gracefulShutdown.registerHandler({
  name: 'application',
  priority: 100, // Highest priority - shutdown application last
  timeout: 15000,
  handler: async () => {
    await shutdownAgentOS();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: promise.toString()
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });

  // Attempt graceful shutdown
  shutdownAgentOS().finally(() => {
    process.exit(1);
  });
});

// Export main classes
export { AgentOS } from './core/agentos';
export { HttpServer } from './core/server/http-server';
export { HealthCheck } from './core/health/health-check';
export { MetricsCollector, PRDMetricsTracker } from './core/metrics';
export { ConfigValidator } from './core/config/config-validator';

// Export Phase 5 Advanced Features
export { AIScheduler } from './performance/ai-scheduler';
export { ModelQuantizer } from './performance/model-quantizer';
export { CaregiverIntegration } from './caregiver/caregiver-integration';
export { PluginMarketplace } from './plugin-marketplace/marketplace';

// Export PRD v1.3 Features
export { CoherenceMonitor } from './intelligence-layer/rgpx';
export { RGPxWorkflowIntegration } from './intelligence-layer/workflow/rgpx-integration';
export { BrowserManager } from './integration/browser';

// Main execution
if (require.main === module) {
  startAgentOS().catch((error) => {
    logger.error('Failed to start AgentOS', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}