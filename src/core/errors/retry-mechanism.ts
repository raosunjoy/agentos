/**
 * Retry Mechanism with Exponential Backoff
 * Provides robust retry logic for transient failures
 */

import { EventEmitter } from 'events';
import { AgentOSError, ErrorCode, ErrorContext } from './error-types';
import { systemLogger } from '../logging';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryableErrors: ErrorCode[];
  retryCondition?: (error: AgentOSError, attempt: number) => boolean;
  onRetry?: (error: AgentOSError, attempt: number, delay: number) => void;
  onMaxRetriesReached?: (error: AgentOSError, attempts: number) => void;
}

export interface RetryStats {
  attempts: number;
  totalDelay: number;
  startTime: number;
  endTime: number;
  errors: AgentOSError[];
}

/**
 * Retry Mechanism Class
 */
export class RetryMechanism extends EventEmitter {
  private logger = systemLogger('retry-mechanism');

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context: ErrorContext = {}
  ): Promise<T> {
    const finalConfig = this.getDefaultConfig(config);
    const stats: RetryStats = {
      attempts: 0,
      totalDelay: 0,
      startTime: Date.now(),
      endTime: 0,
      errors: []
    };

    let lastError: AgentOSError;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      stats.attempts = attempt;

      try {
        this.logger.debug('Executing operation', {
          attempt,
          maxAttempts: finalConfig.maxAttempts,
          operation: context.operation,
          component: context.component
        });

        const result = await operation();

        stats.endTime = Date.now();

        this.logger.info('Operation succeeded after retry', {
          attempt,
          totalDelay: stats.totalDelay,
          duration: stats.endTime - stats.startTime,
          operation: context.operation,
          component: context.component
        });

        this.emit('success', { result, stats, context });
        return result;

      } catch (error) {
        lastError = this.normalizeError(error, {
          ...context,
          retryCount: attempt - 1
        });

        stats.errors.push(lastError);

        this.logger.warn('Operation failed', {
          attempt,
          maxAttempts: finalConfig.maxAttempts,
          error: lastError.code,
          operation: context.operation,
          component: context.component
        }, lastError);

        // Check if we should retry
        if (attempt < finalConfig.maxAttempts && this.shouldRetry(lastError, attempt, finalConfig)) {
          const delay = this.calculateDelay(attempt, finalConfig);

          stats.totalDelay += delay;

          if (finalConfig.onRetry) {
            finalConfig.onRetry(lastError, attempt, delay);
          }

          this.emit('retry', { error: lastError, attempt, delay, stats, context });

          this.logger.info('Retrying operation', {
            attempt: attempt + 1,
            delay,
            operation: context.operation,
            component: context.component
          });

          await this.delay(delay);
        } else {
          // Max retries reached or not retryable
          stats.endTime = Date.now();

          if (finalConfig.onMaxRetriesReached) {
            finalConfig.onMaxRetriesReached(lastError, attempt);
          }

          this.emit('maxRetriesReached', { error: lastError, stats, context });

          this.logger.error('Max retries reached', {
            attempts: attempt,
            totalDelay: stats.totalDelay,
            duration: stats.endTime - stats.startTime,
            operation: context.operation,
            component: context.component
          }, lastError);

          throw lastError;
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  /**
   * Execute with circuit breaker pattern
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerKey: string,
    config: Partial<RetryConfig> = {},
    context: ErrorContext = {}
  ): Promise<T> {
    // Check circuit breaker state (simplified - in real implementation, use a circuit breaker library)
    const circuitState = this.getCircuitBreakerState(circuitBreakerKey);

    if (circuitState === 'open') {
      throw new AgentOSError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `Circuit breaker is open for ${circuitBreakerKey}`,
        'high',
        { ...context, circuitBreakerKey },
        true
      );
    }

    try {
      const result = await this.execute(operation, config, context);

      // Reset circuit breaker on success
      this.resetCircuitBreaker(circuitBreakerKey);

      return result;
    } catch (error) {
      // Record failure for circuit breaker
      this.recordCircuitBreakerFailure(circuitBreakerKey);

      throw error;
    }
  }

  /**
   * Create retry wrapper for methods
   */
  createRetryWrapper<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    config: Partial<RetryConfig> = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      return this.execute(() => fn(...args), config);
    };
  }

  /**
   * Create retry decorator
   */
  createRetryDecorator(config: Partial<RetryConfig> = {}) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const retryMechanism = new RetryMechanism();
        const context = {
          component: target.constructor.name,
          operation: propertyKey
        };

        return retryMechanism.execute(
          () => originalMethod.apply(this, args),
          config,
          context
        );
      };

      return descriptor;
    };
  }

  /**
   * Get default retry configuration
   */
  private getDefaultConfig(config: Partial<RetryConfig>): RetryConfig {
    return {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true,
      retryableErrors: [
        ErrorCode.NETWORK_ERROR,
        ErrorCode.NETWORK_TIMEOUT,
        ErrorCode.DATABASE_CONNECTION_FAILED,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        ErrorCode.THIRD_PARTY_API_ERROR
      ],
      ...config
    };
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: AgentOSError, attempt: number, config: RetryConfig): boolean {
    // Check if error is in retryable list
    if (!config.retryableErrors.includes(error.code)) {
      return false;
    }

    // Check custom retry condition
    if (config.retryCondition && !config.retryCondition(error, attempt)) {
      return false;
    }

    // Check if it's an operational error
    if (!error.isOperational) {
      return false;
    }

    return true;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
    const delay = Math.min(exponentialDelay, config.maxDelay);

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitter = delay * 0.1 * Math.random(); // 10% jitter
      return delay + jitter;
    }

    return delay;
  }

  /**
   * Normalize error to AgentOSError
   */
  private normalizeError(error: Error | AgentOSError, context: ErrorContext): AgentOSError {
    if (error instanceof AgentOSError) {
      return error.withContext(context);
    }

    // Map common errors
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return new AgentOSError(
        ErrorCode.TIMEOUT_ERROR,
        error.message,
        'medium',
        context,
        true,
        error
      );
    }

    if (error.message.includes('network') || error.code === 'ECONNREFUSED') {
      return new AgentOSError(
        ErrorCode.NETWORK_ERROR,
        error.message,
        'medium',
        context,
        true,
        error
      );
    }

    return new AgentOSError(
      ErrorCode.INTERNAL_ERROR,
      error.message,
      'medium',
      context,
      true,
      error
    );
  }

  /**
   * Circuit breaker state management (simplified)
   */
  private circuitBreakerStates: Map<string, { failures: number; lastFailure: number; state: 'closed' | 'open' | 'half-open' }> = new Map();

  private getCircuitBreakerState(key: string): 'closed' | 'open' | 'half-open' {
    const state = this.circuitBreakerStates.get(key);
    if (!state) return 'closed';

    // Simple circuit breaker logic
    if (state.state === 'open' && Date.now() - state.lastFailure > 60000) { // 1 minute
      state.state = 'half-open';
    }

    return state.state;
  }

  private recordCircuitBreakerFailure(key: string): void {
    const state = this.circuitBreakerStates.get(key) || { failures: 0, lastFailure: 0, state: 'closed' as const };

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= 5) { // Threshold
      state.state = 'open';
      this.logger.warn('Circuit breaker opened', { key, failures: state.failures });
    }

    this.circuitBreakerStates.set(key, state);
  }

  private resetCircuitBreaker(key: string): void {
    const state = this.circuitBreakerStates.get(key);
    if (state) {
      state.failures = 0;
      state.state = 'closed';
      this.logger.info('Circuit breaker reset', { key });
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global retry mechanism instance
 */
export const retryMechanism = new RetryMechanism();

/**
 * Convenience functions
 */
export const withRetry = retryMechanism.execute.bind(retryMechanism);
export const createRetryWrapper = retryMechanism.createRetryWrapper.bind(retryMechanism);
export const retryDecorator = retryMechanism.createRetryDecorator.bind(retryMechanism);

/**
 * HTTP request retry wrapper
 */
export async function retryHttpRequest<T>(
  requestFn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: ErrorContext = {}
): Promise<T> {
  const httpConfig: Partial<RetryConfig> = {
    maxAttempts: 3,
    baseDelay: 1000,
    retryableErrors: [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.EXTERNAL_SERVICE_ERROR
    ],
    retryCondition: (error) => {
      // Don't retry 4xx client errors (except 408, 429)
      if (error.context.statusCode && error.context.statusCode >= 400 && error.context.statusCode < 500) {
        return error.context.statusCode === 408 || error.context.statusCode === 429;
      }
      return true;
    },
    ...config
  };

  return retryMechanism.execute(requestFn, httpConfig, context);
}

/**
 * Database operation retry wrapper
 */
export async function retryDatabaseOperation<T>(
  dbFn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: ErrorContext = {}
): Promise<T> {
  const dbConfig: Partial<RetryConfig> = {
    maxAttempts: 5,
    baseDelay: 500,
    retryableErrors: [
      ErrorCode.DATABASE_CONNECTION_FAILED,
      ErrorCode.DATABASE_QUERY_FAILED
    ],
    ...config
  };

  return retryMechanism.execute(dbFn, dbConfig, context);
}
