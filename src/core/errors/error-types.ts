/**
 * AgentOS Error Types and Classes
 * Comprehensive error handling system for production deployment
 */

export enum ErrorCode {
  // System Errors
  SYSTEM_INITIALIZATION_FAILED = 'SYSTEM_INITIALIZATION_FAILED',
  SYSTEM_SHUTDOWN_FAILED = 'SYSTEM_SHUTDOWN_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',

  // Authentication & Authorization
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_FAILED = 'MFA_FAILED',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INPUT_VALIDATION_FAILED = 'INPUT_VALIDATION_FAILED',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',

  // Data Access Errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_CONFLICT = 'DATA_CONFLICT',

  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_REFUSED = 'NETWORK_CONNECTION_REFUSED',
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',

  // Voice & Speech Errors
  SPEECH_RECOGNITION_FAILED = 'SPEECH_RECOGNITION_FAILED',
  SPEECH_SYNTHESIS_FAILED = 'SPEECH_SYNTHESIS_FAILED',
  VOICE_ACTIVITY_DETECTION_FAILED = 'VOICE_ACTIVITY_DETECTION_FAILED',
  AUDIO_PROCESSING_FAILED = 'AUDIO_PROCESSING_FAILED',

  // NLP Errors
  NLP_PROCESSING_FAILED = 'NLP_PROCESSING_FAILED',
  INTENT_CLASSIFICATION_FAILED = 'INTENT_CLASSIFICATION_FAILED',
  ENTITY_EXTRACTION_FAILED = 'ENTITY_EXTRACTION_FAILED',
  LANGUAGE_DETECTION_FAILED = 'LANGUAGE_DETECTION_FAILED',

  // Plugin Errors
  PLUGIN_LOAD_FAILED = 'PLUGIN_LOAD_FAILED',
  PLUGIN_EXECUTION_FAILED = 'PLUGIN_EXECUTION_FAILED',
  PLUGIN_SANDBOX_ERROR = 'PLUGIN_SANDBOX_ERROR',
  PLUGIN_PERMISSION_DENIED = 'PLUGIN_PERMISSION_DENIED',

  // Security Errors
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  CERTIFICATE_ERROR = 'CERTIFICATE_ERROR',

  // Performance Errors
  PERFORMANCE_DEGRADATION = 'PERFORMANCE_DEGRADATION',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // External Service Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  THIRD_PARTY_API_ERROR = 'THIRD_PARTY_API_ERROR',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',

  // File System Errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',

  // Generic Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  operation?: string;
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  duration?: number;
  retryCount?: number;
  metadata?: Record<string, any>;
}

/**
 * Base AgentOS Error Class
 */
export class AgentOSError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly isOperational: boolean;
  public readonly cause?: Error;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    isOperational: boolean = true,
    cause?: Error
  ) {
    super(message);
    this.name = 'AgentOSError';
    this.code = code;
    this.severity = severity;
    this.context = {
      timestamp: new Date(),
      ...context
    };
    this.isOperational = isOperational;
    this.cause = cause;
    this.timestamp = this.context.timestamp!;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      isOperational: this.isOperational,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }

  /**
   * Create a child error with additional context
   */
  withContext(additionalContext: Partial<ErrorContext>): AgentOSError {
    return new AgentOSError(
      this.code,
      this.message,
      this.severity,
      { ...this.context, ...additionalContext },
      this.isOperational,
      this.cause
    );
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.NETWORK_CONNECTION_REFUSED,
      ErrorCode.DATABASE_CONNECTION_FAILED,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      ErrorCode.THIRD_PARTY_API_ERROR
    ];

    return this.isOperational && retryableCodes.includes(this.code);
  }

  /**
   * Get HTTP status code for API responses
   */
  getHttpStatusCode(): number {
    switch (this.severity) {
      case ErrorSeverity.CRITICAL:
        return 500;
      case ErrorSeverity.HIGH:
        return 503;
      case ErrorSeverity.MEDIUM:
        return 400;
      case ErrorSeverity.LOW:
        return 422;
      default:
        return 500;
    }
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends AgentOSError {
  constructor(message: string = 'Authentication failed', context: ErrorContext = {}) {
    super(
      ErrorCode.AUTHENTICATION_FAILED,
      message,
      ErrorSeverity.HIGH,
      context,
      true
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends AgentOSError {
  constructor(message: string = 'Authorization failed', context: ErrorContext = {}) {
    super(
      ErrorCode.AUTHORIZATION_FAILED,
      message,
      ErrorSeverity.HIGH,
      context,
      true
    );
    this.name = 'AuthorizationError';
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AgentOSError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    message: string,
    field?: string,
    value?: any,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      ErrorSeverity.MEDIUM,
      { ...context, field, value },
      true
    );
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Network Error
 */
export class NetworkError extends AgentOSError {
  public readonly statusCode?: number;
  public readonly url?: string;

  constructor(
    message: string,
    url?: string,
    statusCode?: number,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.NETWORK_ERROR,
      message,
      ErrorSeverity.MEDIUM,
      { ...context, url, statusCode },
      true
    );
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AgentOSError {
  public readonly query?: string;
  public readonly table?: string;

  constructor(
    message: string,
    query?: string,
    table?: string,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.DATABASE_QUERY_FAILED,
      message,
      ErrorSeverity.HIGH,
      { ...context, query, table },
      false
    );
    this.name = 'DatabaseError';
    this.query = query;
    this.table = table;
  }
}

/**
 * Plugin Error
 */
export class PluginError extends AgentOSError {
  public readonly pluginId?: string;

  constructor(
    message: string,
    pluginId?: string,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.PLUGIN_EXECUTION_FAILED,
      message,
      ErrorSeverity.MEDIUM,
      { ...context, pluginId },
      true
    );
    this.name = 'PluginError';
    this.pluginId = pluginId;
  }
}

/**
 * Voice Interface Error
 */
export class VoiceError extends AgentOSError {
  public readonly audioData?: any;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SPEECH_RECOGNITION_FAILED,
    audioData?: any,
    context: ErrorContext = {}
  ) {
    super(
      code,
      message,
      ErrorSeverity.MEDIUM,
      { ...context, audioData },
      true
    );
    this.name = 'VoiceError';
    this.audioData = audioData;
  }
}

/**
 * Configuration Error
 */
export class ConfigurationError extends AgentOSError {
  public readonly configKey?: string;

  constructor(
    message: string,
    configKey?: string,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.CONFIGURATION_ERROR,
      message,
      ErrorSeverity.HIGH,
      { ...context, configKey },
      false
    );
    this.name = 'ConfigurationError';
    this.configKey = configKey;
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends AgentOSError {
  public readonly timeout?: number;

  constructor(
    message: string,
    timeout?: number,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.TIMEOUT_ERROR,
      message,
      ErrorSeverity.MEDIUM,
      { ...context, timeout },
      true
    );
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/**
 * Resource Exhausted Error
 */
export class ResourceExhaustedError extends AgentOSError {
  public readonly resource?: string;
  public readonly limit?: number;
  public readonly current?: number;

  constructor(
    message: string,
    resource?: string,
    limit?: number,
    current?: number,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.RESOURCE_EXHAUSTED,
      message,
      ErrorSeverity.HIGH,
      { ...context, resource, limit, current },
      true
    );
    this.name = 'ResourceExhaustedError';
    this.resource = resource;
    this.limit = limit;
    this.current = current;
  }
}
