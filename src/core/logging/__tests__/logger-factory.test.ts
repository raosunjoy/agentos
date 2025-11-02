/**
 * Unit Tests for Logger Factory
 * Comprehensive testing of logger creation, configuration, and management
 */

import { Logger } from '../logger';
import {
  initializeLogging,
  systemLogger,
  securityLogger,
  performanceLogger,
  businessLogger,
  auditLogger,
  pluginLogger,
  voiceLogger,
  nlpLogger,
  apiLogger,
  dbLogger,
  createTimer,
  closeAllLoggers
} from '../logger-factory';

describe('LoggerFactory', () => {
  beforeEach(() => {
    // Reset global config before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Close all loggers after each test to clean up
    closeAllLoggers();
  });

  describe('initializeLogging', () => {
    test('should initialize logging with default configuration', () => {
      initializeLogging();

      const logger = systemLogger('test');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('should initialize logging with custom configuration', () => {
      const config = {
        logLevel: 'debug' as const,
        enableConsole: true,
        enableFile: false,
        logDirectory: '/tmp/logs',
        maxFiles: '7d',
        maxSize: '5m'
      };

      initializeLogging(config);

      const logger = systemLogger('test');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('should update existing loggers when reinitialized', () => {
      initializeLogging({ logLevel: 'info' });
      const logger1 = systemLogger('test');

      initializeLogging({ logLevel: 'debug' });
      const logger2 = systemLogger('test');

      // Should be the same instance but with updated config
      expect(logger1).toBe(logger2);
    });
  });

  describe('Logger Creation Functions', () => {
    beforeEach(() => {
      initializeLogging();
    });

    test('systemLogger should create logger with system category', () => {
      const logger = systemLogger('test-component');
      expect(logger).toBeInstanceOf(Logger);

      // Test that it logs correctly
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logger.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('securityLogger should create logger with security category', () => {
      const logger = securityLogger('auth');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('performanceLogger should create logger with performance category', () => {
      const logger = performanceLogger('api');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('businessLogger should create logger with business category', () => {
      const logger = businessLogger('transactions');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('auditLogger should create logger with audit category', () => {
      const logger = auditLogger('access');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('pluginLogger should create logger with plugin category', () => {
      const logger = pluginLogger('weather-plugin');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('voiceLogger should create logger with voice category', () => {
      const logger = voiceLogger('speech-to-text');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('nlpLogger should create logger with nlp category', () => {
      const logger = nlpLogger('intent-classifier');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('apiLogger should create logger with api category', () => {
      const logger = apiLogger('requests');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('dbLogger should create logger with database category', () => {
      const logger = dbLogger('queries');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('should reuse logger instances for same category and component', () => {
      const logger1 = systemLogger('test-component');
      const logger2 = systemLogger('test-component');

      expect(logger1).toBe(logger2);
    });

    test('should create different instances for different components', () => {
      const logger1 = systemLogger('component1');
      const logger2 = systemLogger('component2');

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('createTimer', () => {
    beforeEach(() => {
      initializeLogging();
    });

    test('should create a timer that measures execution time', () => {
      const logger = systemLogger('timer-test');
      const logSpy = jest.spyOn(logger, 'debug').mockImplementation();

      const timer = createTimer('test-operation', logger);

      // Simulate some work
      setTimeout(() => {
        const duration = timer.end();
        expect(duration).toBeGreaterThan(0);
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('test-operation'),
          expect.objectContaining({
            timerName: 'test-operation',
            duration: duration
          })
        );
      }, 10);
    });

    test('should start timer immediately upon creation', () => {
      const timer = createTimer('immediate-test');

      // Should be able to end immediately (though duration might be very small)
      const duration = timer.end();
      expect(typeof duration).toBe('number');
    });

    test('should handle custom context in timer logs', () => {
      const logger = systemLogger('timer-test');
      const logSpy = jest.spyOn(logger, 'debug').mockImplementation();

      const timer = createTimer('custom-context-test', logger);
      timer.end({ customField: 'test-value', operationId: 123 });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('custom-context-test'),
        expect.objectContaining({
          customField: 'test-value',
          operationId: 123
        })
      );
    });

    test('should provide manual log method', () => {
      const logger = systemLogger('manual-log-test');
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation();

      const timer = createTimer('manual-log-test', logger);

      // Manually log without ending timer
      timer.log('info', 'Manual log message', { manual: true });

      expect(infoSpy).toHaveBeenCalledWith(
        'Manual log message',
        expect.objectContaining({
          timerName: 'manual-log-test',
          manual: true
        })
      );
    });

    test('should handle timer.end() being called multiple times', () => {
      const timer = createTimer('multiple-end-test');

      const duration1 = timer.end();
      const duration2 = timer.end();

      expect(duration1).toBe(duration2);
      expect(duration1).toBeGreaterThanOrEqual(0);
    });

    test('should provide duration property', () => {
      const timer = createTimer('duration-property-test');

      // Access duration before ending
      expect(timer.duration).toBe(0);

      timer.end();

      // Access duration after ending
      expect(timer.duration).toBeGreaterThan(0);
    });
  });

  describe('closeAllLoggers', () => {
    test('should close all managed loggers', () => {
      initializeLogging();

      // Create multiple loggers
      const logger1 = systemLogger('test1');
      const logger2 = securityLogger('test2');
      const logger3 = performanceLogger('test3');

      // Mock the close method
      const closeSpy1 = jest.spyOn(logger1, 'close');
      const closeSpy2 = jest.spyOn(logger2, 'close');
      const closeSpy3 = jest.spyOn(logger3, 'close');

      closeAllLoggers();

      expect(closeSpy1).toHaveBeenCalled();
      expect(closeSpy2).toHaveBeenCalled();
      expect(closeSpy3).toHaveBeenCalled();
    });
  });

  describe('Logger Factory Integration', () => {
    test('should handle complex logging scenarios', () => {
      initializeLogging({
        logLevel: 'debug',
        enableConsole: true,
        enableFile: false
      });

      const systemLog = systemLogger('integration-test');
      const securityLog = securityLogger('auth-test');
      const timer = createTimer('integration-timer', systemLog);

      // Test various logging scenarios
      systemLog.info('System operation started', { userId: '123', action: 'login' });
      securityLog.warn('Suspicious login attempt', { ip: '192.168.1.1', attempts: 3 });

      timer.end({ result: 'success', recordsProcessed: 150 });

      // Verify all operations completed without errors
      expect(systemLog).toBeDefined();
      expect(securityLog).toBeDefined();
      expect(timer.duration).toBeGreaterThan(0);
    });

    test('should handle error scenarios gracefully', () => {
      initializeLogging();

      const logger = systemLogger('error-test');

      const error = new Error('Test error');
      const context = { operation: 'test', userId: '123' };

      // Should not throw when logging errors
      expect(() => {
        logger.error('An error occurred', context, error);
      }).not.toThrow();
    });

    test('should support different log levels', () => {
      initializeLogging({ logLevel: 'debug' });

      const logger = systemLogger('level-test');

      // All these should work without throwing
      expect(() => logger.debug('Debug message')).not.toThrow();
      expect(() => logger.info('Info message')).not.toThrow();
      expect(() => logger.warn('Warning message')).not.toThrow();
      expect(() => logger.error('Error message')).not.toThrow();
      expect(() => logger.trace('Trace message')).not.toThrow();
    });
  });
});
