/**
 * Unit Tests for Error Handler
 * Comprehensive testing of centralized error handling, circuit breaker, and fallback mechanisms
 */

import {
  errorHandler,
  createErrorHandler,
  handleError,
  AgentOSError,
  ErrorCode,
  ErrorSeverity,
  ErrorContext
} from '../index';

describe('ErrorHandler', () => {
  beforeEach(() => {
    // Reset circuit breakers and error handler state
    jest.clearAllMocks();
  });

  describe('handleError', () => {
    test('should handle successful operations without issues', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'successful-operation'
      };

      const result = await errorHandler.handleError(
        async () => 'success',
        context
      );

      expect(result).toBe('success');
    });

    test('should normalize and rethrow AgentOSError instances', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'error-operation'
      };

      const originalError = new AgentOSError(
        'Test error',
        ErrorCode.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM,
        context
      );

      await expect(
        errorHandler.handleError(
          async () => { throw originalError; },
          context
        )
      ).rejects.toThrow(AgentOSError);
    });

    test('should normalize generic errors to AgentOSError', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'generic-error'
      };

      const genericError = new Error('Generic error');

      await expect(
        errorHandler.handleError(
          async () => { throw genericError; },
          context
        )
      ).rejects.toThrow(AgentOSError);
    });

    test('should normalize non-Error throws to AgentOSError', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'string-error'
      };

      await expect(
        errorHandler.handleError(
          async () => { throw 'String error'; },
          context
        )
      ).rejects.toThrow(AgentOSError);
    });

    test('should execute fallback when provided and operation fails', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'fallback-test'
      };

      const fallback = jest.fn().mockReturnValue('fallback-result');

      const result = await errorHandler.handleError(
        async () => { throw new Error('Operation failed'); },
        context,
        { fallback }
      );

      expect(result).toBe('fallback-result');
      expect(fallback).toHaveBeenCalled();
    });

    test('should use retry mechanism when configured', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'retry-test'
      };

      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await errorHandler.handleError(
        operation,
        context,
        {
          retry: {
            maxAttempts: 3,
            baseDelay: 10,
            retryableErrors: [ErrorCode.UNKNOWN_ERROR]
          }
        }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should implement circuit breaker pattern', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'circuit-breaker-test'
      };

      // Configure circuit breaker with low threshold
      const circuitBreakerOptions = {
        threshold: 2,
        resetTimeout: 1000
      };

      // First two attempts fail
      await expect(
        errorHandler.handleError(
          async () => { throw new Error('Fail 1'); },
          context,
          { circuitBreaker: circuitBreakerOptions }
        )
      ).rejects.toThrow();

      await expect(
        errorHandler.handleError(
          async () => { throw new Error('Fail 2'); },
          context,
          { circuitBreaker: circuitBreakerOptions }
        )
      ).rejects.toThrow();

      // Third attempt should be blocked by circuit breaker
      await expect(
        errorHandler.handleError(
          async () => 'should-not-execute',
          context,
          { circuitBreaker: circuitBreakerOptions }
        )
      ).rejects.toThrow(AgentOSError);

      // Check that circuit breaker stats are tracked
      const stats = errorHandler.getCircuitBreakerStats(`${context.component}:${context.operation}`);
      expect(stats).toBeDefined();
    });

    test('should log errors appropriately', async () => {
      const context: ErrorContext = {
        component: 'test',
        operation: 'logging-test'
      };

      // Mock logger to verify error logging
      const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      };

      // Replace the error handler's logger temporarily
      const originalLogger = (errorHandler as any).logger;
      (errorHandler as any).logger = mockLogger;

      try {
        await expect(
          errorHandler.handleError(
            async () => { throw new Error('Test error'); },
            context
          )
        ).rejects.toThrow();

        expect(mockLogger.error).toHaveBeenCalled();
      } finally {
        // Restore original logger
        (errorHandler as any).logger = originalLogger;
      }
    });
  });

  describe('updateConfig', () => {
    test('should update error handler configuration', () => {
      const newConfig = {
        enableRetry: false,
        maxRetries: 5,
        enableCircuitBreaker: false
      };

      errorHandler.updateConfig(newConfig);

      // Configuration should be updated (internal state)
      expect((errorHandler as any).config).toMatchObject(newConfig);
    });

    test('should merge with existing configuration', () => {
      const originalConfig = { ...((errorHandler as any).config) };

      errorHandler.updateConfig({ maxRetries: 10 });

      const updatedConfig = (errorHandler as any).config;
      expect(updatedConfig.maxRetries).toBe(10);
      expect(updatedConfig.enableRetry).toBe(originalConfig.enableRetry);
    });
  });

  describe('getCircuitBreakerStats', () => {
    test('should return stats for specific circuit breaker', () => {
      const key = 'test-component:test-operation';
      const stats = errorHandler.getCircuitBreakerStats(key);

      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    test('should return stats for all circuit breakers', () => {
      const allStats = errorHandler.getCircuitBreakerStats();

      expect(allStats).toBeDefined();
      expect(typeof allStats).toBe('object');
    });
  });

  describe('resetCircuitBreaker', () => {
    test('should reset circuit breaker state', () => {
      const key = 'test-component:test-operation';

      // This should not throw
      expect(() => {
        errorHandler.resetCircuitBreaker(key);
      }).not.toThrow();
    });
  });

  describe('createErrorHandler', () => {
    test('should create a scoped error handler', () => {
      const defaultContext: ErrorContext = {
        component: 'scoped-test',
        operation: 'default-operation'
      };

      const scopedHandler = createErrorHandler(defaultContext);

      expect(scopedHandler).toHaveProperty('handleError');
      expect(typeof scopedHandler.handleError).toBe('function');
    });

    test('should use default context in scoped handler', async () => {
      const defaultContext: ErrorContext = {
        component: 'scoped-test',
        operation: 'default-operation'
      };

      const scopedHandler = createErrorHandler(defaultContext);

      const result = await scopedHandler.handleError(async () => 'success');

      expect(result).toBe('success');
    });

    test('should merge default context with provided options', async () => {
      const defaultContext: ErrorContext = {
        component: 'scoped-test',
        operation: 'default-operation'
      };

      const scopedHandler = createErrorHandler(defaultContext);

      // This should work and merge contexts
      await expect(
        scopedHandler.handleError(async () => 'success')
      ).resolves.toBe('success');
    });
  });

  describe('Error Handler Integration', () => {
    test('should handle complex error scenarios with retries and fallbacks', async () => {
      const context: ErrorContext = {
        component: 'integration-test',
        operation: 'complex-scenario'
      };

      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new AgentOSError('Temporary error', ErrorCode.NETWORK_ERROR);
        }
        return 'success';
      });

      const fallback = jest.fn().mockReturnValue('fallback-result');

      const result = await errorHandler.handleError(
        operation,
        context,
        {
          retry: {
            maxAttempts: 3,
            baseDelay: 10,
            retryableErrors: [ErrorCode.NETWORK_ERROR]
          },
          fallback
        }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(fallback).not.toHaveBeenCalled();
    });

    test('should use fallback when retries are exhausted', async () => {
      const context: ErrorContext = {
        component: 'integration-test',
        operation: 'fallback-scenario'
      };

      const operation = jest.fn().mockImplementation(() => {
        throw new AgentOSError('Persistent error', ErrorCode.DATABASE_QUERY_FAILED);
      });

      const fallback = jest.fn().mockReturnValue('fallback-result');

      const result = await errorHandler.handleError(
        operation,
        context,
        {
          retry: {
            maxAttempts: 2,
            baseDelay: 10,
            retryableErrors: [ErrorCode.NETWORK_ERROR] // Not DATABASE_QUERY_FAILED
          },
          fallback
        }
      );

      expect(result).toBe('fallback-result');
      expect(operation).toHaveBeenCalledTimes(1); // No retries for non-retryable error
      expect(fallback).toHaveBeenCalled();
    });

    test('should handle nested error scenarios', async () => {
      const context: ErrorContext = {
        component: 'nested-test',
        operation: 'nested-operation'
      };

      const operation = jest.fn().mockImplementation(async () => {
        try {
          throw new Error('Inner error');
        } catch (innerError) {
          throw new AgentOSError(
            'Outer error',
            ErrorCode.UNKNOWN_ERROR,
            ErrorSeverity.HIGH,
            context,
            true,
            innerError as Error
          );
        }
      });

      await expect(
        errorHandler.handleError(operation, context)
      ).rejects.toThrow(AgentOSError);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle high-frequency error scenarios', async () => {
      const context: ErrorContext = {
        component: 'performance-test',
        operation: 'high-frequency'
      };

      const operations = Array.from({ length: 100 }, () =>
        errorHandler.handleError(
          async () => { throw new Error('Frequent error'); },
          { ...context, requestId: Math.random().toString() },
          { fallback: () => 'fallback' }
        )
      );

      const results = await Promise.allSettled(operations);

      // All operations should complete (with fallbacks)
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
    });

    test('should maintain state consistency under concurrent operations', async () => {
      const context: ErrorContext = {
        component: 'concurrency-test',
        operation: 'concurrent-ops'
      };

      const operations = Array.from({ length: 50 }, (_, i) =>
        errorHandler.handleError(
          async () => {
            if (i % 3 === 0) throw new Error('Intermittent error');
            return `success-${i}`;
          },
          { ...context, requestId: `req-${i}` },
          { fallback: () => `fallback-${i}` }
        )
      );

      const results = await Promise.all(operations);

      // Should have mix of successes and fallbacks
      expect(results.length).toBe(50);
      expect(results.some(result => result.startsWith('success-'))).toBe(true);
      expect(results.some(result => result.startsWith('fallback-'))).toBe(true);
    });
  });
});
