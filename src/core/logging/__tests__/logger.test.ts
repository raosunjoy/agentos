/**
 * Logger System Tests
 * Tests for the structured logging system
 */

import { Logger, LogLevel, LogCategory } from '../logger';
import { LoggerFactory } from '../logger-factory';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(LogCategory.SYSTEM, 'test-component');
  });

  test('should create logger with correct category and component', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  test('should log info messages', () => {
    const mockCallback = jest.fn();
    logger.on('log', mockCallback);

    logger.info('Test message', { test: 'value' });

    expect(mockCallback).toHaveBeenCalledWith({
      level: LogLevel.INFO,
      message: 'Test message',
      context: { test: 'value' },
      error: undefined
    });
  });

  test('should log error messages with error object', () => {
    const mockCallback = jest.fn();
    logger.on('log', mockCallback);

    const testError = new Error('Test error');
    logger.error('Error occurred', { operation: 'test' }, testError);

    expect(mockCallback).toHaveBeenCalledWith({
      level: LogLevel.ERROR,
      message: 'Error occurred',
      context: { operation: 'test' },
      error: testError
    });
  });

  test('should create performance timers', () => {
    const timer = logger.createTimer('test_operation');

    expect(typeof timer.end).toBe('function');
    expect(typeof timer.log).toBe('function');
  });

  test('should handle timer operations', () => {
    const mockCallback = jest.fn();
    logger.on('log', mockCallback);

    const timer = logger.createTimer('test_operation');

    // Simulate some operation
    setTimeout(() => {
      timer.end({ result: 'success' });

      expect(mockCallback).toHaveBeenCalled();
      const logEntry = mockCallback.mock.calls[0][0];
      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.message).toContain('test_operation');
      expect(logEntry.context).toHaveProperty('duration');
      expect(logEntry.context.result).toBe('success');
    }, 10);
  });
});

describe('LoggerFactory', () => {
  beforeEach(() => {
    // Reset singleton instance for testing
    (LoggerFactory as any).instance = null;
  });

  test('should return singleton instance', () => {
    const factory1 = LoggerFactory.getInstance();
    const factory2 = LoggerFactory.getInstance();

    expect(factory1).toBe(factory2);
  });

  test('should create system logger', () => {
    const factory = LoggerFactory.getInstance();
    const logger = factory.getSystemLogger('test');

    expect(logger).toBeInstanceOf(Logger);
  });

  test('should create voice logger', () => {
    const factory = LoggerFactory.getInstance();
    const logger = factory.getVoiceLogger('speech');

    expect(logger).toBeInstanceOf(Logger);
  });

  test('should create performance timer', () => {
    const factory = LoggerFactory.getInstance();
    const timer = factory.createTimer(
      factory.getSystemLogger('test'),
      'test_operation'
    );

    expect(typeof timer.end).toBe('function');
    expect(typeof timer.log).toBe('function');
  });

  test('should reuse logger instances', () => {
    const factory = LoggerFactory.getInstance();

    const logger1 = factory.getSystemLogger('component1');
    const logger2 = factory.getSystemLogger('component1');

    expect(logger1).toBe(logger2);
  });
});

describe('Log Levels', () => {
  test('should have correct log level values', () => {
    expect(LogLevel.ERROR).toBe('error');
    expect(LogLevel.WARN).toBe('warn');
    expect(LogLevel.INFO).toBe('info');
    expect(LogLevel.DEBUG).toBe('debug');
    expect(LogLevel.TRACE).toBe('silly');
  });
});

describe('Log Categories', () => {
  test('should have correct category values', () => {
    expect(LogCategory.SYSTEM).toBe('system');
    expect(LogCategory.SECURITY).toBe('security');
    expect(LogCategory.PERFORMANCE).toBe('performance');
    expect(LogCategory.BUSINESS).toBe('business');
    expect(LogCategory.AUDIT).toBe('audit');
    expect(LogCategory.PLUGIN).toBe('plugin');
    expect(LogCategory.VOICE).toBe('voice');
    expect(LogCategory.NLP).toBe('nlp');
    expect(LogCategory.API).toBe('api');
    expect(LogCategory.DATABASE).toBe('database');
  });
});
