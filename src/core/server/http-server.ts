/**
 * Production HTTP Server
 * Enterprise-grade HTTP server with security, monitoring, and graceful shutdown
 */

import * as express from 'express';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as cors from 'cors';
import { systemLogger } from '../logging';
import { errorHandler } from '../errors';
import { gracefulShutdown } from '../lifecycle/graceful-shutdown';
import { HealthCheck } from '../health/health-check';
import { MetricsCollector } from '../metrics/metrics-collector';

export interface ServerConfig {
  port: number;
  host: string;
  trustProxy: boolean;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  enableCompression: boolean;
  enableSecurityHeaders: boolean;
  enableHealthCheck: boolean;
  enableMetrics: boolean;
  requestTimeout: number;
  keepAliveTimeout: number;
}

export class HttpServer {
  private app: express.Application;
  private server?: any;
  private config: ServerConfig;
  private logger = systemLogger('http-server');
  private healthCheck: HealthCheck;
  private metricsCollector: MetricsCollector;

  constructor(config?: Partial<ServerConfig>) {
    this.config = {
      port: 3000,
      host: '0.0.0.0',
      trustProxy: true,
      corsOrigins: ['http://localhost:3000'],
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: 100,
      enableCompression: true,
      enableSecurityHeaders: true,
      enableHealthCheck: true,
      enableMetrics: true,
      requestTimeout: 30000, // 30 seconds
      keepAliveTimeout: 65000, // 65 seconds
      ...config
    };

    this.app = express();
    this.healthCheck = new HealthCheck();
    this.metricsCollector = new MetricsCollector();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupGracefulShutdown();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Trust proxy for accurate IP addresses
    if (this.config.trustProxy) {
      this.app.set('trust proxy', 1);
    }

    // Security headers
    if (this.config.enableSecurityHeaders) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      }));
    }

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    if (this.config.enableCompression) {
      this.app.use(compression({
        level: 6,
        threshold: 1024
      }));
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging and metrics
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      // Log request
      this.logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Track metrics
      if (this.config.enableMetrics) {
        this.metricsCollector.incrementCounter('http_requests_total', {
          method: req.method,
          endpoint: req.path
        });
      }

      // Track response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Log response
        this.logger.info('HTTP Response', {
          method: req.method,
          url: req.url,
          statusCode,
          duration
        });

        // Record metrics
        if (this.config.enableMetrics) {
          this.metricsCollector.recordResponseTime(req.path, req.method, duration, statusCode);

          if (statusCode >= 400) {
            this.metricsCollector.recordError('http_error', {
              status_code: statusCode.toString(),
              endpoint: req.path
            });
          }
        }
      });

      next();
    });

    // Request timeout
    this.app.use((req, res, next) => {
      res.setTimeout(this.config.requestTimeout, () => {
        this.logger.warn('Request timeout', {
          method: req.method,
          url: req.url,
          timeout: this.config.requestTimeout
        });
        res.status(408).json({ error: 'Request timeout' });
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    if (this.config.enableHealthCheck) {
      this.app.get('/health', async (req, res) => {
        try {
          const health = await this.healthCheck.getHealthStatus();
          const statusCode = health.status === 'healthy' ? 200 :
                           health.status === 'degraded' ? 200 : 503;

          res.status(statusCode).json(health);
        } catch (error) {
          this.logger.error('Health check failed', {
            error: error instanceof Error ? error.message : String(error)
          });
          res.status(503).json({
            status: 'unhealthy',
            error: 'Health check failed'
          });
        }
      });

      // Basic health check for load balancers
      this.app.get('/health/basic', async (req, res) => {
        try {
          const health = await this.healthCheck.getBasicHealth();
          res.status(health.status === 'ok' ? 200 : 503).json(health);
        } catch (error) {
          res.status(503).json({ status: 'error' });
        }
      });
    }

    // Metrics endpoint
    if (this.config.enableMetrics) {
      this.app.get('/metrics', (req, res) => {
        try {
          const format = req.query.format as string || 'json';

          if (format === 'prometheus') {
            res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
            res.send(this.metricsCollector.exportPrometheus());
          } else {
            res.json(this.metricsCollector.getAllMetrics());
          }
        } catch (error) {
          this.logger.error('Metrics export failed', {
            error: error instanceof Error ? error.message : String(error)
          });
          res.status(500).json({ error: 'Metrics export failed' });
        }
      });

      // Metrics statistics
      this.app.get('/metrics/stats', (req, res) => {
        try {
          const timeRange = req.query.range ? parseInt(req.query.range as string) : undefined;
          const stats = this.metricsCollector.getStatistics(timeRange);
          res.json(stats);
        } catch (error) {
          res.status(500).json({ error: 'Statistics calculation failed' });
        }
      });
    }

    // API routes
    this.app.get('/api/v1/status', (req, res) => {
      res.json({
        status: 'running',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Voice interaction endpoint (example)
    this.app.post('/api/v1/voice/interact', async (req, res) => {
      try {
        const { text, userId, sessionId } = req.body;

        if (!text) {
          return res.status(400).json({ error: 'Text input required' });
        }

        // In a real implementation, this would process through AgentOS
        // For now, simulate a response
        const response = {
          text: `Processed: ${text}`,
          confidence: 0.95,
          intent: 'general_query',
          timestamp: new Date().toISOString()
        };

        // Record metrics
        if (this.config.enableMetrics) {
          this.metricsCollector.recordVoiceInteraction(true, 150, 'general_query');
        }

        res.json(response);
      } catch (error) {
        this.logger.error('Voice interaction failed', {
          error: error instanceof Error ? error.message : String(error)
        });

        if (this.config.enableMetrics) {
          this.metricsCollector.recordError('voice_interaction_error');
        }

        res.status(500).json({ error: 'Voice interaction failed' });
      }
    });

    // Plugin management endpoints (example)
    this.app.get('/api/v1/plugins', (req, res) => {
      // In a real implementation, this would list plugins
      res.json({
        plugins: [
          { id: 'weather', name: 'Weather Plugin', version: '1.0.0', enabled: true },
          { id: 'reminder', name: 'Reminder Plugin', version: '1.0.0', enabled: true }
        ]
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      this.logger.warn('Route not found', {
        method: req.method,
        url: req.url,
        ip: req.ip
      });

      if (this.config.enableMetrics) {
        this.metricsCollector.recordError('route_not_found', {
          method: req.method,
          path: req.path
        });
      }

      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`
      });
    });

    // Error handler
    this.app.use(async (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const statusCode = err.statusCode || 500;
      const message = err.message || 'Internal Server Error';

      this.logger.error('Request error', {
        error: message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        statusCode
      });

      if (this.config.enableMetrics) {
        this.metricsCollector.recordError('request_error', {
          status_code: statusCode.toString(),
          error_type: err.name || 'unknown'
        });
      }

      res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    gracefulShutdown.registerHandler({
      name: 'http-server',
      priority: 10,
      timeout: 10000,
      handler: async () => {
        this.logger.info('Closing HTTP server connections');

        return new Promise((resolve) => {
          if (this.server) {
            this.server.close((err?: Error) => {
              if (err) {
                this.logger.error('Error closing HTTP server', { error: err.message });
              } else {
                this.logger.info('HTTP server closed successfully');
              }
              resolve();
            });

            // Force close after timeout
            setTimeout(() => {
              this.logger.warn('Force closing HTTP server');
              this.server?.close();
              resolve();
            }, 8000);
          } else {
            resolve();
          }
        });
      }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.logger.info('HTTP Server started', {
            host: this.config.host,
            port: this.config.port,
            environment: process.env.NODE_ENV || 'development'
          });

          // Configure server timeouts
          if (this.server) {
            this.server.keepAliveTimeout = this.config.keepAliveTimeout;
            this.server.headersTimeout = this.config.keepAliveTimeout + 1000;
          }

          // Start metrics collection
          if (this.config.enableMetrics) {
            this.metricsCollector.startCollection();
          }

          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('HTTP Server failed to start', { error: error.message });
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close((err?: Error) => {
          if (err) {
            this.logger.error('Error stopping HTTP server', { error: err.message });
          } else {
            this.logger.info('HTTP server stopped');
          }

          // Stop metrics collection
          if (this.config.enableMetrics) {
            this.metricsCollector.stopCollection();
          }

          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get server instance
   */
  getServer(): any {
    return this.server;
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get health check instance
   */
  getHealthCheck(): HealthCheck {
    return this.healthCheck;
  }
}
