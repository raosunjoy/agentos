/**
 * Logger Factory - Central logging management for AgentOS
 * Provides singleton logger instances for different components
 */

import { Logger, LogCategory, LogLevel, LogContext } from './logger';

export class LoggerFactory {
  private static instance: LoggerFactory;
  private loggers: Map<string, Logger> = new Map();
  private globalLogLevel: LogLevel = LogLevel.INFO;
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  /**
   * Initialize the logger factory
   */
  initialize(config?: {
    logLevel?: LogLevel;
    enableConsole?: boolean;
    enableFile?: boolean;
    logDirectory?: string;
  }): void {
    if (this.isInitialized) return;

    this.globalLogLevel = config?.logLevel || this.getLogLevelFromEnv();
    this.isInitialized = true;

    // Set global log level
    process.env.LOG_LEVEL = this.globalLogLevel;

    console.log(`Logger Factory initialized with level: ${this.globalLogLevel}`);
  }

  /**
   * Get logger for a specific category and component
   */
  getLogger(category: LogCategory, component: string): Logger {
    const key = `${category}:${component}`;

    if (!this.loggers.has(key)) {
      const logger = new Logger(category, component);
      this.loggers.set(key, logger);
    }

    return this.loggers.get(key)!;
  }

  /**
   * Get system logger
   */
  getSystemLogger(component: string = 'system'): Logger {
    return this.getLogger(LogCategory.SYSTEM, component);
  }

  /**
   * Get security logger
   */
  getSecurityLogger(component: string = 'security'): Logger {
    return this.getLogger(LogCategory.SECURITY, component);
  }

  /**
   * Get performance logger
   */
  getPerformanceLogger(component: string = 'performance'): Logger {
    return this.getLogger(LogCategory.PERFORMANCE, component);
  }

  /**
   * Get business logger
   */
  getBusinessLogger(component: string = 'business'): Logger {
    return this.getLogger(LogCategory.BUSINESS, component);
  }

  /**
   * Get audit logger
   */
  getAuditLogger(component: string = 'audit'): Logger {
    return this.getLogger(LogCategory.AUDIT, component);
  }

  /**
   * Get plugin logger
   */
  getPluginLogger(pluginId: string): Logger {
    return this.getLogger(LogCategory.PLUGIN, pluginId);
  }

  /**
   * Get voice interface logger
   */
  getVoiceLogger(component: string = 'voice'): Logger {
    return this.getLogger(LogCategory.VOICE, component);
  }

  /**
   * Get NLP logger
   */
  getNLPLogger(component: string = 'nlp'): Logger {
    return this.getLogger(LogCategory.NLP, component);
  }

  /**
   * Get API logger
   */
  getAPILogger(component: string = 'api'): Logger {
    return this.getLogger(LogCategory.API, component);
  }

  /**
   * Get database logger
   */
  getDatabaseLogger(component: string = 'database'): Logger {
    return this.getLogger(LogCategory.DATABASE, component);
  }

  /**
   * Set global log level
   */
  setGlobalLogLevel(level: LogLevel): void {
    this.globalLogLevel = level;
    process.env.LOG_LEVEL = level;

    // Update all existing loggers
    for (const logger of this.loggers.values()) {
      // Winston loggers handle level changes through environment variables
      // In a more sophisticated implementation, we'd update each logger individually
    }
  }

  /**
   * Get current global log level
   */
  getGlobalLogLevel(): LogLevel {
    return this.globalLogLevel;
  }

  /**
   * Flush all loggers
   */
  async flushAll(): Promise<void> {
    const flushPromises = Array.from(this.loggers.values()).map(logger => logger.flush());
    await Promise.all(flushPromises);
  }

  /**
   * Get all active loggers
   */
  getActiveLoggers(): Map<string, Logger> {
    return new Map(this.loggers);
  }

  /**
   * Create a performance timing utility
   */
  createTimer(logger: Logger, operation: string, context?: LogContext) {
    const startTime = Date.now();

    return {
      end: (additionalContext?: LogContext) => {
        const duration = Date.now() - startTime;
        logger.performance(operation, duration, {
          ...context,
          ...additionalContext
        });
        return duration;
      },

      log: (level: LogLevel, message: string, additionalContext?: LogContext) => {
        const duration = Date.now() - startTime;
        const logContext = {
          ...context,
          ...additionalContext,
          operation,
          duration
        };

        switch (level) {
          case LogLevel.ERROR:
            logger.error(message, logContext);
            break;
          case LogLevel.WARN:
            logger.warn(message, logContext);
            break;
          case LogLevel.INFO:
            logger.info(message, logContext);
            break;
          case LogLevel.DEBUG:
            logger.debug(message, logContext);
            break;
          case LogLevel.TRACE:
            logger.trace(message, logContext);
            break;
        }
      }
    };
  }

  /**
   * Get log level from environment variable
   */
  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL || process.env.NODE_ENV === 'production' ? 'info' : 'debug';

    switch (envLevel.toLowerCase()) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      case 'trace':
      case 'silly':
        return LogLevel.TRACE;
      default:
        return LogLevel.INFO;
    }
  }
}

/**
 * Convenience functions for getting loggers
 */
export const loggerFactory = LoggerFactory.getInstance();

// System loggers
export const systemLogger = (component: string = 'system') => loggerFactory.getSystemLogger(component);
export const securityLogger = (component: string = 'security') => loggerFactory.getSecurityLogger(component);
export const performanceLogger = (component: string = 'performance') => loggerFactory.getPerformanceLogger(component);
export const businessLogger = (component: string = 'business') => loggerFactory.getBusinessLogger(component);
export const auditLogger = (component: string = 'audit') => loggerFactory.getAuditLogger(component);

// Component-specific loggers
export const pluginLogger = (pluginId: string) => loggerFactory.getPluginLogger(pluginId);
export const voiceLogger = (component: string = 'voice') => loggerFactory.getVoiceLogger(component);
export const nlpLogger = (component: string = 'nlp') => loggerFactory.getNLPLogger(component);
export const apiLogger = (component: string = 'api') => loggerFactory.getAPILogger(component);
export const dbLogger = (component: string = 'database') => loggerFactory.getDatabaseLogger(component);

/**
 * Initialize logging system
 */
export function initializeLogging(config?: {
  logLevel?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  logDirectory?: string;
}): void {
  loggerFactory.initialize(config);
}

/**
 * Performance timing utility
 */
export function createTimer(operation: string, context?: LogContext) {
  const logger = systemLogger('timer');
  return loggerFactory.createTimer(logger, operation, context);
}

/**
 * Flush all pending logs
 */
export async function flushAllLogs(): Promise<void> {
  await loggerFactory.flushAll();
}
