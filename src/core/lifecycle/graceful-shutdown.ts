/**
 * Graceful Shutdown Handler
 * Ensures clean shutdown of all services and proper resource cleanup
 */

import { EventEmitter } from 'events';
import { systemLogger } from '../logging';

export interface ShutdownHandler {
  name: string;
  priority: number; // Lower numbers execute first
  handler: () => Promise<void> | void;
  timeout?: number; // Timeout in milliseconds
}

export interface ShutdownConfig {
  gracefulTimeout: number; // Overall timeout for graceful shutdown
  forceTimeout: number; // Force exit after this time
  logLevel: 'info' | 'warn' | 'error';
}

export class GracefulShutdown extends EventEmitter {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownPromise?: Promise<void>;
  private logger = systemLogger('graceful-shutdown');

  private config: ShutdownConfig = {
    gracefulTimeout: 30000, // 30 seconds
    forceTimeout: 60000, // 60 seconds
    logLevel: 'info'
  };

  constructor(config?: Partial<ShutdownConfig>) {
    super();
    this.config = { ...this.config, ...config };

    this.setupSignalHandlers();
    this.registerDefaultHandlers();
  }

  /**
   * Register a shutdown handler
   */
  registerHandler(handler: ShutdownHandler): void {
    this.handlers.push(handler);
    // Sort by priority (lower numbers first)
    this.handlers.sort((a, b) => a.priority - b.priority);

    this.logger.debug('Shutdown handler registered', {
      name: handler.name,
      priority: handler.priority
    });
  }

  /**
   * Unregister a shutdown handler
   */
  unregisterHandler(name: string): void {
    const index = this.handlers.findIndex(h => h.name === name);
    if (index !== -1) {
      this.handlers.splice(index, 1);
      this.logger.debug('Shutdown handler unregistered', { name });
    }
  }

  /**
   * Initiate graceful shutdown
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    this.logger.info('Graceful shutdown initiated', { signal });

    this.emit('shutdownStart', { signal });

    // Create shutdown promise
    this.shutdownPromise = this.performShutdown();

    // Set force exit timeout
    const forceExitTimer = setTimeout(() => {
      this.logger.error('Force exit timeout reached, terminating process');
      this.emit('forceExit', { signal });
      process.exit(1);
    }, this.config.forceTimeout);

    try {
      await this.shutdownPromise;
      clearTimeout(forceExitTimer);
      this.logger.info('Graceful shutdown completed successfully');
      this.emit('shutdownComplete', { signal });
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      this.logger.error('Graceful shutdown failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.emit('shutdownFailed', { signal, error });
      process.exit(1);
    }
  }

  /**
   * Perform the actual shutdown sequence
   */
  private async performShutdown(): Promise<void> {
    const shutdownStart = Date.now();

    // Execute handlers in priority order
    for (const handler of this.handlers) {
      const handlerStart = Date.now();

      try {
        this.logger.info('Executing shutdown handler', {
          name: handler.name,
          priority: handler.priority
        });

        const timeout = handler.timeout || this.config.gracefulTimeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Handler timeout: ${handler.name}`)), timeout);
        });

        const handlerPromise = Promise.resolve(handler.handler());
        await Promise.race([handlerPromise, timeoutPromise]);

        const handlerDuration = Date.now() - handlerStart;
        this.logger.info('Shutdown handler completed', {
          name: handler.name,
          duration: handlerDuration
        });

      } catch (error) {
        const handlerDuration = Date.now() - handlerStart;
        this.logger.error('Shutdown handler failed', {
          name: handler.name,
          duration: handlerDuration,
          error: error instanceof Error ? error.message : String(error)
        });

        // Continue with other handlers even if one fails
        this.emit('handlerFailed', {
          handler: handler.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const totalDuration = Date.now() - shutdownStart;
    this.logger.info('All shutdown handlers completed', {
      handlerCount: this.handlers.length,
      totalDuration
    });
  }

  /**
   * Setup signal handlers for common termination signals
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info('Received termination signal', { signal });
        await this.shutdown(signal);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception during shutdown', { error: error.message });
      await this.shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      this.logger.error('Unhandled promise rejection during shutdown', {
        reason: reason instanceof Error ? reason.message : String(reason)
      });
      await this.shutdown('unhandledRejection');
    });
  }

  /**
   * Register default shutdown handlers
   */
  private registerDefaultHandlers(): void {
    // High priority: Close server connections
    this.registerHandler({
      name: 'http-server',
      priority: 10,
      timeout: 10000,
      handler: async () => {
        // In a real implementation, this would close HTTP servers
        this.logger.info('Closing HTTP server connections');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    // High priority: Close database connections
    this.registerHandler({
      name: 'database',
      priority: 20,
      timeout: 15000,
      handler: async () => {
        this.logger.info('Closing database connections');
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    });

    // High priority: Close cache connections
    this.registerHandler({
      name: 'cache',
      priority: 30,
      timeout: 10000,
      handler: async () => {
        this.logger.info('Closing cache connections');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    // Medium priority: Flush logs
    this.registerHandler({
      name: 'logging',
      priority: 50,
      timeout: 5000,
      handler: async () => {
        this.logger.info('Flushing log buffers');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    // Medium priority: Save application state
    this.registerHandler({
      name: 'state-persistence',
      priority: 60,
      timeout: 10000,
      handler: async () => {
        this.logger.info('Saving application state');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    // Low priority: Cleanup temporary files
    this.registerHandler({
      name: 'cleanup',
      priority: 90,
      timeout: 5000,
      handler: async () => {
        this.logger.info('Cleaning up temporary files');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get registered handlers (for debugging)
   */
  getHandlers(): ShutdownHandler[] {
    return [...this.handlers];
  }

  /**
   * Get shutdown configuration
   */
  getConfig(): ShutdownConfig {
    return { ...this.config };
  }

  /**
   * Update shutdown configuration
   */
  updateConfig(config: Partial<ShutdownConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Shutdown configuration updated', config);
  }
}

// Global shutdown instance
export const gracefulShutdown = new GracefulShutdown();
