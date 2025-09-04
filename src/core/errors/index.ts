/**
 * AgentOS Error Handling System
 * Comprehensive error management for production deployment
 */

export * from './error-types';
export * from './error-handler';
export * from './error-middleware';
export * from './retry-mechanism';

// Re-export commonly used functions and classes
export {
  AgentOSError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NetworkError,
  DatabaseError,
  PluginError,
  VoiceError,
  ConfigurationError,
  TimeoutError,
  ResourceExhaustedError
} from './error-types';

export {
  errorHandler,
  handleError,
  createErrorHandler,
  withErrorHandling
} from './error-handler';

export {
  globalErrorHandler,
  notFoundHandler,
  asyncErrorHandler,
  validationErrorHandler,
  rateLimitErrorHandler,
  securityErrorHandler,
  timeoutErrorHandler,
  setupErrorHandling
} from './error-middleware';

export {
  retryMechanism,
  withRetry,
  createRetryWrapper,
  retryDecorator,
  retryHttpRequest,
  retryDatabaseOperation
} from './retry-mechanism';
