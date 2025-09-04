/**
 * AgentOS Logging System
 * Exports all logging functionality for use throughout the application
 */

export * from './logger';
export * from './logger-factory';
export * from './http-middleware';

// Re-export commonly used functions for convenience
export {
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
  flushAllLogs
} from './logger-factory';
