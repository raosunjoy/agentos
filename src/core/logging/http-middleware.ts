/**
 * HTTP Request Logging Middleware
 * Provides structured logging for HTTP requests and responses
 */

import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { apiLogger, createTimer } from './logger-factory';
import { LogContext } from './logger';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

/**
 * HTTP request logging middleware
 */
export function httpRequestLogger() {
  const logger = apiLogger('http');

  return (req: Request, res: Response, next: NextFunction) => {
    // Generate unique request ID
    req.id = req.headers['x-request-id'] as string || uuidv4();
    req.startTime = Date.now();

    // Add request ID to response headers
    res.setHeader('x-request-id', req.id);

    // Create timer for request duration
    const timer = createTimer('http_request', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      correlationId: req.headers['x-correlation-id'] as string
    });

    // Log incoming request
    logger.info(`HTTP ${req.method} ${req.url}`, {
      requestId: req.id,
      method: req.method,
      url: req.url,
      headers: this.sanitizeHeaders(req.headers),
      query: req.query,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      correlationId: req.headers['x-correlation-id'] as string
    });

    // Override response.end to log response details
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void)) {
      const duration = timer.end({
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length'),
        responseTime: Date.now() - req.startTime
      });

      // Log response
      const level = res.statusCode >= 400 ? 'warn' : 'info';
      logger.log(level, `HTTP ${res.statusCode} ${req.method} ${req.url}`, {
        requestId: req.id,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        responseTime: duration,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      });

      // Call original end method
      if (typeof encoding === 'function') {
        return originalEnd.call(this, chunk, encoding);
      } else {
        return originalEnd.call(this, chunk, encoding);
      }
    };

    next();
  };
}

/**
 * Error logging middleware
 */
export function httpErrorLogger() {
  const logger = apiLogger('error');

  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.id || 'unknown';

    logger.error(`HTTP Error: ${error.message}`, {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }, error);

    // If response hasn't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        requestId,
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      });
    }

    next(error);
  };
}

/**
 * Security event logging middleware
 */
export function securityLogger() {
  const logger = apiLogger('security');

  return (req: Request, res: Response, next: NextFunction) => {
    // Log security-relevant events
    const suspiciousPatterns = this.detectSuspiciousActivity(req);

    if (suspiciousPatterns.length > 0) {
      logger.warn(`Security: Suspicious activity detected`, {
        requestId: req.id,
        method: req.method,
        url: req.url,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        patterns: suspiciousPatterns,
        headers: this.sanitizeHeaders(req.headers)
      });
    }

    // Log authentication attempts
    if (req.url.includes('/auth') || req.url.includes('/login')) {
      logger.info(`Authentication attempt`, {
        requestId: req.id,
        method: req.method,
        url: req.url,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    next();
  };
}

/**
 * Performance monitoring middleware
 */
export function performanceLogger() {
  const logger = apiLogger('performance');

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds

      // Log slow requests
      if (duration > 1000) { // More than 1 second
        logger.warn(`Slow request detected`, {
          requestId: req.id,
          method: req.method,
          url: req.url,
          duration,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        });
      } else if (duration > 500) { // More than 500ms
        logger.info(`Request performance`, {
          requestId: req.id,
          method: req.method,
          url: req.url,
          duration,
          statusCode: res.statusCode
        });
      }
    });

    next();
  };
}

/**
 * Sanitize headers for logging (remove sensitive information)
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
 * Detect suspicious activity patterns
 */
function detectSuspiciousActivity(req: Request): string[] {
  const patterns: string[] = [];

  // Check for common attack patterns
  if (req.url.includes('../') || req.url.includes('..\\')) {
    patterns.push('path_traversal');
  }

  if (req.url.includes('<script') || req.url.includes('javascript:')) {
    patterns.push('xss_attempt');
  }

  if (req.method === 'GET' && req.url.length > 2000) {
    patterns.push('long_url');
  }

  // Check for unusual user agents
  const userAgent = req.get('User-Agent') || '';
  if (userAgent.includes('sqlmap') || userAgent.includes('nmap')) {
    patterns.push('scanner_detected');
  }

  // Check for rapid requests from same IP (would need rate limiting context)
  // This is a simplified check - real implementation would use Redis/cache

  return patterns;
}

/**
 * Create correlation ID middleware
 */
export function correlationIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  };
}

/**
 * Request context middleware
 */
export function requestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add request context for use in other parts of the application
    (req as any).context = {
      requestId: req.id,
      correlationId: req.headers['x-correlation-id'],
      startTime: req.startTime,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      method: req.method,
      url: req.url
    };

    next();
  };
}
