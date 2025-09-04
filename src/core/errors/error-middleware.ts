/**
 * Error Handling Middleware for Express
 * Provides comprehensive error handling for HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import {
  AgentOSError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ErrorSeverity
} from './error-types';
import { apiLogger } from '../logging';

declare global {
  namespace Express {
    interface Request {
      errorId?: string;
    }
  }
}

/**
 * Global error handling middleware
 */
export function globalErrorHandler() {
  const logger = apiLogger('error');

  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Generate error ID for tracking
    const errorId = req.errorId || generateErrorId();
    req.errorId = errorId;

    // Normalize error
    const normalizedError = normalizeError(error, {
      requestId: req.id,
      correlationId: req.headers['x-correlation-id'] as string,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.url,
      errorId
    });

    // Log error
    logger.error('Request error', {
      errorId,
      method: req.method,
      url: req.url,
      statusCode: normalizedError.getHttpStatusCode(),
      severity: normalizedError.severity,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestBody: sanitizeRequestBody(req.body),
      queryParams: req.query
    }, normalizedError);

    // Send error response
    sendErrorResponse(res, normalizedError, errorId);
  };
}

/**
 * 404 Not Found middleware
 */
export function notFoundHandler() {
  const logger = apiLogger('404');

  return (req: Request, res: Response, next: NextFunction): void => {
    const errorId = generateErrorId();

    logger.info('Route not found', {
      errorId,
      method: req.method,
      url: req.url,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });

    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested resource was not found',
        errorId,
        timestamp: new Date().toISOString()
      }
    });
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler for Joi/express-validator
 */
export function validationErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    if (!error || typeof error !== 'object') {
      return next(error);
    }

    // Handle Joi validation errors
    if (error.isJoi) {
      const validationError = new ValidationError(
        'Validation failed',
        error.details?.[0]?.path?.join('.'),
        error.details?.[0]?.context?.value,
        {
          requestId: req.id,
          correlationId: req.headers['x-correlation-id'] as string,
          validationErrors: error.details?.map((detail: any) => ({
            field: detail.path?.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        }
      );

      return next(validationError);
    }

    // Handle express-validator errors
    if (error.array && typeof error.array === 'function') {
      const errors = error.array();
      if (errors.length > 0) {
        const validationError = new ValidationError(
          errors[0].msg,
          errors[0].param,
          errors[0].value,
          {
            requestId: req.id,
            correlationId: req.headers['x-correlation-id'] as string,
            validationErrors: errors
          }
        );

        return next(validationError);
      }
    }

    next(error);
  };
}

/**
 * Rate limiting error handler
 */
export function rateLimitErrorHandler() {
  const logger = apiLogger('rate-limit');

  return (req: Request, res: Response, next: NextFunction): void => {
    const errorId = generateErrorId();

    logger.warn('Rate limit exceeded', {
      errorId,
      method: req.method,
      url: req.url,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.headers['x-correlation-id'] as string,
      rateLimitInfo: {
        limit: req.rateLimit?.limit,
        current: req.rateLimit?.current,
        remaining: req.rateLimit?.remaining,
        resetTime: req.rateLimit?.resetTime
      }
    });

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        errorId,
        retryAfter: req.rateLimit?.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  };
}

/**
 * Security error handler
 */
export function securityErrorHandler() {
  const logger = apiLogger('security');

  return (req: Request, res: Response, next: NextFunction): void => {
    const errorId = generateErrorId();

    logger.error('Security violation detected', {
      errorId,
      method: req.method,
      url: req.url,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.headers['x-correlation-id'] as string,
      headers: sanitizeHeaders(req.headers),
      suspiciousPatterns: detectSuspiciousPatterns(req)
    });

    res.status(403).json({
      error: {
        code: 'SECURITY_VIOLATION',
        message: 'Security violation detected',
        errorId,
        timestamp: new Date().toISOString()
      }
    });
  };
}

/**
 * Timeout error handler
 */
export function timeoutErrorHandler(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const errorId = generateErrorId();
        const logger = apiLogger('timeout');

        logger.warn('Request timeout', {
          errorId,
          method: req.method,
          url: req.url,
          timeoutMs,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.status(408).json({
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `Request timeout after ${timeoutMs}ms`,
            errorId,
            timeout: timeoutMs,
            timestamp: new Date().toISOString()
          }
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Error response formatter
 */
function sendErrorResponse(res: Response, error: AgentOSError, errorId: string): void {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const errorResponse = {
    error: {
      code: error.code,
      message: isDevelopment ? error.message : getUserFriendlyMessage(error),
      errorId,
      severity: error.severity,
      timestamp: error.timestamp.toISOString(),
      ...(isDevelopment && {
        stack: error.stack,
        context: error.context,
        cause: error.cause ? {
          name: error.cause.name,
          message: error.cause.message
        } : undefined
      })
    }
  };

  // Set appropriate status code
  const statusCode = error.getHttpStatusCode();
  res.status(statusCode).json(errorResponse);
}

/**
 * Normalize any error to AgentOSError
 */
function normalizeError(error: Error | any, context: any): AgentOSError {
  if (error instanceof AgentOSError) {
    return error.withContext(context);
  }

  // Handle common error types
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    return new ValidationError(error.message || 'Validation failed', undefined, undefined, context);
  }

  if (error.name === 'UnauthorizedError' || error.status === 401) {
    return new AuthenticationError(error.message || 'Authentication required', context);
  }

  if (error.name === 'ForbiddenError' || error.status === 403) {
    return new AuthorizationError(error.message || 'Access denied', context);
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new NetworkError(error.message || 'Network error', undefined, undefined, context);
  }

  // Generic error
  return new AgentOSError(
    'INTERNAL_ERROR',
    error.message || 'An unexpected error occurred',
    ErrorSeverity.HIGH,
    context,
    true,
    error
  );
}

/**
 * Get user-friendly error messages
 */
function getUserFriendlyMessage(error: AgentOSError): string {
  switch (error.code) {
    case 'AUTHENTICATION_FAILED':
      return 'Authentication failed. Please check your credentials.';
    case 'AUTHORIZATION_FAILED':
      return 'You do not have permission to access this resource.';
    case 'VALIDATION_ERROR':
      return 'The provided data is invalid. Please check your input.';
    case 'NETWORK_ERROR':
      return 'A network error occurred. Please try again later.';
    case 'DATABASE_CONNECTION_FAILED':
      return 'Service temporarily unavailable. Please try again later.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too many requests. Please slow down and try again later.';
    case 'SECURITY_VIOLATION':
      return 'Security violation detected.';
    case 'RESOURCE_EXHAUSTED':
      return 'Service is temporarily overloaded. Please try again later.';
    case 'TIMEOUT_ERROR':
      return 'The request timed out. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again later.';
  }
}

/**
 * Sanitize request body for logging
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'ssn'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize headers for logging
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  const sanitized = { ...headers };

  sensitiveHeaders.forEach(header => {
    if (sanitized[header.toLowerCase()]) {
      sanitized[header.toLowerCase()] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Detect suspicious patterns in requests
 */
function detectSuspiciousPatterns(req: Request): string[] {
  const patterns: string[] = [];

  // Check for path traversal
  if (req.url.includes('../') || req.url.includes('..\\')) {
    patterns.push('path_traversal');
  }

  // Check for XSS attempts
  if (req.url.includes('<script') || req.url.includes('javascript:')) {
    patterns.push('xss_attempt');
  }

  // Check for SQL injection patterns
  if (req.url.includes('\'') || req.url.includes('UNION') || req.url.includes('SELECT')) {
    patterns.push('sql_injection');
  }

  // Check for long URLs (potential buffer overflow)
  if (req.url.length > 2000) {
    patterns.push('long_url');
  }

  return patterns;
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Express error handling setup utility
 */
export function setupErrorHandling(app: any, options: {
  timeout?: number;
  enableRateLimit?: boolean;
  enableSecurity?: boolean;
} = {}): void {
  const { timeout = 30000, enableRateLimit = true, enableSecurity = true } = options;

  // Request timeout
  app.use(timeoutErrorHandler(timeout));

  // Rate limiting error handler
  if (enableRateLimit) {
    app.use('/api', rateLimitErrorHandler());
  }

  // Security error handler
  if (enableSecurity) {
    app.use(securityErrorHandler());
  }

  // Validation error handler
  app.use(validationErrorHandler());

  // 404 handler
  app.use(notFoundHandler());

  // Global error handler (must be last)
  app.use(globalErrorHandler());
}
