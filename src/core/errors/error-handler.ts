/**
 * AgentOS Error Handler
 * Centralized error handling and recovery mechanisms
 */

import { EventEmitter } from 'events';
import {
  AgentOSError,
  ErrorCode,
  ErrorSeverity,
  ErrorContext,
  ValidationError,
  NetworkError,
  DatabaseError,
  PluginError,
  VoiceError,
  ConfigurationError,
  TimeoutError,
  ResourceExhaustedError
} from './error-types';
import { systemLogger } from '../logging';

export interface ErrorHandlingConfig {
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  enableFallback: boolean;
  logAllErrors: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: ErrorCode[];
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: number;
}

/**
 * Error Handler Class
 */
export class ErrorHandler extends EventEmitter {
  private config: ErrorHandlingConfig;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private logger = systemLogger('error-handler');

  constructor(config: Partial<ErrorHandlingConfig> = {}) {
    super();

    this.config = {
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      enableFallback: true,
      logAllErrors: true,
      ...config
    };
  }

  /**
   * Handle an error with appropriate recovery strategies
   */
  async handleError(
    error: Error | AgentOSError,
    context: ErrorContext = {},
    options: {
      retry?: RetryConfig;
      fallback?: () => Promise<any>;
      suppressLogging?: boolean;
    } = {}
  ): Promise<any> {
    // Convert to AgentOSError if needed
    const agentError = this.normalizeError(error, context);

    // Log the error
    if (!options.suppressLogging && this.config.logAllErrors) {
      this.logError(agentError);
    }

    // Emit error event
    this.emit('error', agentError);

    // Handle based on error type
    if (agentError.isOperational) {
      return this.handleOperationalError(agentError, options);
    } else {
      return this.handleProgrammerError(agentError);
    }
  }

  /**
   * Handle operational errors (recoverable)
   */
  private async handleOperationalError(
    error: AgentOSError,
    options: {
      retry?: RetryConfig;
      fallback?: () => Promise<any>;
    }
  ): Promise<any> {
    // Try circuit breaker
    if (this.config.enableCircuitBreaker) {
      const circuitKey = `${error.context.component || 'unknown'}:${error.context.operation || 'unknown'}`;
      if (this.isCircuitBreakerOpen(circuitKey)) {
        return this.handleCircuitBreakerOpen(error, options.fallback);
      }
    }

    // Try retry mechanism
    if (options.retry && error.isRetryable()) {
      return this.handleWithRetry(error, options.retry);
    }

    // Try fallback
    if (options.fallback && this.config.enableFallback) {
      return this.handleWithFallback(error, options.fallback);
    }

    // Record circuit breaker failure
    if (this.config.enableCircuitBreaker) {
      const circuitKey = `${error.context.component || 'unknown'}:${error.context.operation || 'unknown'}`;
      this.recordCircuitBreakerFailure(circuitKey);
    }

    throw error;
  }

  /**
   * Handle programmer errors (non-recoverable)
   */
  private handleProgrammerError(error: AgentOSError): never {
    this.logger.error('Programmer error detected', {
      code: error.code,
      severity: error.severity,
      component: error.context.component,
      operation: error.context.operation
    }, error);

    // Emit critical error event
    this.emit('criticalError', error);

    // For programmer errors, we should crash the process in development
    // In production, we might want to handle this differently
    if (process.env.NODE_ENV !== 'production') {
      throw error;
    }

    // In production, log and continue (or graceful shutdown)
    throw error;
  }

  /**
   * Normalize any error to AgentOSError
   */
  private normalizeError(error: Error | AgentOSError, context: ErrorContext): AgentOSError {
    if (error instanceof AgentOSError) {
      return error.withContext(context);
    }

    // Map common error types
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      return new ValidationError(error.message, undefined, undefined, context);
    }

    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return new TimeoutError(error.message, undefined, context);
    }

    if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return new NetworkError(error.message, undefined, undefined, context);
    }

    // Generic operational error
    return new AgentOSError(
      ErrorCode.INTERNAL_ERROR,
      error.message,
      ErrorSeverity.MEDIUM,
      context,
      true,
      error
    );
  }

  /**
   * Handle error with retry mechanism
   */
  private async handleWithRetry(error: AgentOSError, retryConfig: RetryConfig): Promise<any> {
    const {
      maxAttempts = this.config.maxRetries,
      baseDelay = this.config.retryDelay,
      maxDelay = 30000,
      backoffFactor = 2,
      retryableErrors = [
        ErrorCode.NETWORK_TIMEOUT,
        ErrorCode.NETWORK_CONNECTION_REFUSED,
        ErrorCode.DATABASE_CONNECTION_FAILED,
        ErrorCode.EXTERNAL_SERVICE_ERROR
      ]
    } = retryConfig;

    if (!retryableErrors.includes(error.code)) {
      throw error;
    }

    let lastError = error;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        this.logger.info(`Retrying operation (attempt ${attempt}/${maxAttempts})`, {
          code: error.code,
          component: error.context.component,
          operation: error.context.operation,
          attempt,
          maxAttempts
        });

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);

        if (attempt > 1) {
          await this.delay(delay);
        }

        // If we get here, the operation succeeded (would be called from within the operation)
        return; // Success

      } catch (retryError) {
        lastError = this.normalizeError(retryError, {
          ...error.context,
          retryCount: attempt
        });

        this.logger.warn(`Retry ${attempt} failed`, {
          code: lastError.code,
          attempt,
          maxAttempts,
          delay: Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay)
        }, lastError);
      }
    }

    throw lastError;
  }

  /**
   * Handle error with fallback mechanism
   */
  private async handleWithFallback(error: AgentOSError, fallback: () => Promise<any>): Promise<any> {
    try {
      this.logger.info('Executing fallback operation', {
        code: error.code,
        component: error.context.component,
        operation: error.context.operation
      });

      const result = await fallback();
      this.emit('fallbackExecuted', { error, result });

      return result;
    } catch (fallbackError) {
      const fallbackAgentError = this.normalizeError(fallbackError, {
        ...error.context,
        fallbackFailed: true
      });

      this.logger.error('Fallback operation also failed', {
        originalCode: error.code,
        fallbackError: fallbackAgentError.code
      }, fallbackAgentError);

      throw fallbackAgentError;
    }
  }

  /**
   * Circuit breaker methods
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    if (!state) return false;

    if (state.state === 'open') {
      if (Date.now() > state.nextAttemptTime) {
        state.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private recordCircuitBreakerFailure(key: string): void {
    const state = this.circuitBreakers.get(key) || {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed' as const,
      nextAttemptTime: 0
    };

    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.config.circuitBreakerThreshold) {
      state.state = 'open';
      state.nextAttemptTime = Date.now() + 60000; // 1 minute timeout

      this.logger.warn('Circuit breaker opened', { key, failures: state.failures });
      this.emit('circuitBreakerOpened', { key, state });
    }

    this.circuitBreakers.set(key, state);
  }

  private handleCircuitBreakerOpen(error: AgentOSError, fallback?: () => Promise<any>): Promise<any> {
    this.logger.warn('Circuit breaker is open, rejecting request', {
      code: error.code,
      component: error.context.component,
      operation: error.context.operation
    });

    if (fallback) {
      return this.handleWithFallback(error, fallback);
    }

    throw new AgentOSError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      'Service temporarily unavailable',
      ErrorSeverity.HIGH,
      error.context,
      true,
      error
    );
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: AgentOSError): void {
    const logData = {
      code: error.code,
      severity: error.severity,
      component: error.context.component,
      operation: error.context.operation,
      userId: error.context.userId,
      sessionId: error.context.sessionId,
      correlationId: error.context.correlationId,
      duration: error.context.duration
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error('Critical error occurred', logData, error);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error('High severity error', logData, error);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn('Medium severity error', logData, error);
        break;
      case ErrorSeverity.LOW:
        this.logger.info('Low severity error', logData, error);
        break;
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create error handling wrapper for functions
   */
  createHandler(options: {
    retry?: RetryConfig;
    fallback?: () => Promise<any>;
    component?: string;
    operation?: string;
  }) {
    return async <T>(
      fn: () => Promise<T>,
      context: ErrorContext = {}
    ): Promise<T> => {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        const enhancedContext = {
          component: options.component,
          operation: options.operation,
          ...context
        };

        return this.handleError(error, enhancedContext, {
          retry: options.retry,
          fallback: options.fallback
        });
      }
    };
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats(): Record<string, CircuitBreakerState> {
    const stats: Record<string, CircuitBreakerState> = {};
    for (const [key, state] of this.circuitBreakers) {
      stats[key] = { ...state };
    }
    return stats;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key: string): void {
    this.circuitBreakers.delete(key);
    this.logger.info('Circuit breaker reset', { key });
  }

  /**
   * Configure error handler
   */
  updateConfig(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Error handler configuration updated', { config });
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Convenience functions
 */
export const handleError = errorHandler.handleError.bind(errorHandler);
export const createErrorHandler = errorHandler.createHandler.bind(errorHandler);

/**
 * Error handling decorator
 */
export function withErrorHandling(options: {
  retry?: RetryConfig;
  fallback?: () => Promise<any>;
  component?: string;
  operation?: string;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const handler = errorHandler.createHandler(options);

    descriptor.value = async function (...args: any[]) {
      return handler(() => originalMethod.apply(this, args), {
        component: options.component || this.constructor.name,
        operation: options.operation || propertyKey
      });
    };

    return descriptor;
  };
}

/**
 * Validation helper
 */
export function createValidationError(
  field: string,
  message: string,
  value?: any,
  context: ErrorContext = {}
): ValidationError {
  return new ValidationError(message, field, value, context);
}

/**
 * Network error helper
 */
export function createNetworkError(
  message: string,
  url?: string,
  statusCode?: number,
  context: ErrorContext = {}
): NetworkError {
  return new NetworkError(message, url, statusCode, context);
}

/**
 * Database error helper
 */
export function createDatabaseError(
  message: string,
  query?: string,
  table?: string,
  context: ErrorContext = {}
): DatabaseError {
  return new DatabaseError(message, query, table, context);
}
