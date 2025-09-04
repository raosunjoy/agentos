/**
 * AgentOS Structured Logging System
 * Provides comprehensive logging with Winston for production deployment
 */

import winston, { Logger as WinstonLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'silly'
}

export enum LogCategory {
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  BUSINESS = 'business',
  AUDIT = 'audit',
  PLUGIN = 'plugin',
  VOICE = 'voice',
  NLP = 'nlp',
  API = 'api',
  DATABASE = 'database'
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  userAgent?: string;
  ipAddress?: string;
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: LogContext;
  error?: Error;
  timestamp: Date;
}

/**
 * Logger class for structured logging
 */
export class Logger extends EventEmitter {
  private winstonLogger: WinstonLogger;
  private category: LogCategory;
  private component: string;

  constructor(category: LogCategory, component: string) {
    super();
    this.category = category;
    this.component = component;
    this.winstonLogger = this.createWinstonLogger();
  }

  /**
   * Create Winston logger with appropriate configuration
   */
  private createWinstonLogger(): WinstonLogger {
    const logDir = path.join(process.cwd(), 'logs');
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const customFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      format.printf(({ timestamp, level, message, category, component, context, error, ...meta }) => {
        const logEntry: LogEntry = {
          level: level as LogLevel,
          category: category || this.category,
          message,
          context: {
            component: component || this.component,
            ...context,
            ...meta
          },
          error,
          timestamp: new Date(timestamp)
        };

        return JSON.stringify(logEntry);
      })
    );

    const transports: winston.transport[] = [];

    // Console transport for development
    if (isDevelopment) {
      transports.push(
        new transports.Console({
          level: process.env.LOG_LEVEL || 'debug',
          format: format.combine(
            format.colorize(),
            customFormat
          )
        })
      );
    }

    // File transports for all environments
    transports.push(
      // Error log file
      new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        format: customFormat
      }),

      // Combined log file
      new DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: customFormat
      }),

      // Security-specific log file
      new DailyRotateFile({
        filename: path.join(logDir, 'security-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxSize: '20m',
        maxFiles: '30d',
        format: customFormat
      })
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      format: customFormat,
      transports,
      defaultMeta: {
        category: this.category,
        component: this.component
      }
    });
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log a trace message
   */
  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Log a message with performance timing
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      operation,
      duration,
      category: LogCategory.PERFORMANCE
    });
  }

  /**
   * Log a security event
   */
  security(event: string, context?: LogContext): void {
    this.info(`Security: ${event}`, {
      ...context,
      category: LogCategory.SECURITY
    });
  }

  /**
   * Log an audit event
   */
  audit(action: string, context?: LogContext): void {
    this.info(`Audit: ${action}`, {
      ...context,
      category: LogCategory.AUDIT
    });
  }

  /**
   * Log business metrics
   */
  business(event: string, metrics: Record<string, any>, context?: LogContext): void {
    this.info(`Business: ${event}`, {
      ...context,
      category: LogCategory.BUSINESS,
      metadata: metrics
    });
  }

  /**
   * Generic log method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logData: any = {
      message,
      category: context?.category || this.category,
      component: context?.component || this.component,
      context,
      error
    };

    // Remove undefined context to avoid serialization issues
    if (!context) {
      delete logData.context;
    }

    this.winstonLogger.log(level, message, logData);
    this.emit('log', { level, message, context, error });
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(this.category, this.component);
    // In a real implementation, you'd configure the child logger with additional context
    return childLogger;
  }

  /**
   * Flush all pending logs
   */
  async flush(): Promise<void> {
    // Winston handles flushing automatically
    return Promise.resolve();
  }
}
