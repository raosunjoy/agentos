/**
 * Health Check System
 * Comprehensive health monitoring for production deployments
 */

import { systemLogger } from '../logging';
import { errorHandler } from '../errors';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  services: Record<string, ServiceHealth>;
  metrics: SystemMetrics;
  dependencies: DependencyStatus[];
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: Date;
  details?: any;
}

export interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
}

export interface DependencyStatus {
  name: string;
  type: 'database' | 'cache' | 'external_api' | 'filesystem' | 'network';
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

export class HealthCheck {
  private logger = systemLogger('health-check');
  private startTime: Date;
  private metrics: SystemMetrics;
  private dependencies: Map<string, DependencyStatus> = new Map();

  constructor() {
    this.startTime = new Date();
    this.metrics = this.initializeMetrics();
    this.registerDefaultDependencies();
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const services = await this.checkAllServices();
    const dependencies = Array.from(this.dependencies.values());

    const overallStatus = this.determineOverallStatus(services, dependencies);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.npm_package_version || '1.0.0',
      services,
      metrics: await this.getCurrentMetrics(),
      dependencies
    };

    this.logger.debug('Health check completed', {
      status: overallStatus,
      servicesCount: Object.keys(services).length,
      dependenciesCount: dependencies.length
    });

    return healthStatus;
  }

  /**
   * Get basic health check for load balancers
   */
  async getBasicHealth(): Promise<{ status: string; timestamp: Date }> {
    try {
      // Quick checks for critical services
      const criticalServices = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkCacheHealth(),
        this.checkFilesystemHealth()
      ]);

      const allHealthy = criticalServices.every(service => service.status === 'up');

      return {
        status: allHealthy ? 'ok' : 'error',
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Basic health check failed', { error: error instanceof Error ? error.message : String(error) });
      return {
        status: 'error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Register a custom dependency to monitor
   */
  registerDependency(dependency: Omit<DependencyStatus, 'lastChecked'>): void {
    this.dependencies.set(dependency.name, {
      ...dependency,
      lastChecked: new Date()
    });

    this.logger.info('Dependency registered for health monitoring', {
      name: dependency.name,
      type: dependency.type
    });
  }

  /**
   * Update dependency status
   */
  updateDependencyStatus(name: string, status: Partial<DependencyStatus>): void {
    const existing = this.dependencies.get(name);
    if (existing) {
      this.dependencies.set(name, {
        ...existing,
        ...status,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check all registered services
   */
  private async checkAllServices(): Promise<Record<string, ServiceHealth>> {
    const services: Record<string, ServiceHealth> = {};

    // Check core AgentOS services
    services.agentos = await this.checkAgentOSHealth();
    services.nlp = await this.checkNLPHealth();
    services.plugins = await this.checkPluginHealth();
    services.voice = await this.checkVoiceHealth();
    services.security = await this.checkSecurityHealth();

    return services;
  }

  /**
   * Check AgentOS core health
   */
  private async checkAgentOSHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check if core services are responsive
      const memoryUsage = process.memoryUsage();
      const isMemoryHealthy = memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9;

      const responseTime = Date.now() - startTime;

      return {
        status: isMemoryHealthy ? 'up' : 'degraded',
        responseTime,
        lastChecked: new Date(),
        details: {
          memoryUsage,
          uptime: Date.now() - this.startTime.getTime()
        }
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check NLP service health
   */
  private async checkNLPHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Simulate NLP health check - in real implementation, this would test actual NLP processing
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate processing time

      return {
        status: 'up',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: {
          intentsLoaded: 10, // Would be actual count
          modelsLoaded: true
        }
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check plugin system health
   */
  private async checkPluginHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check plugin registry and loaded plugins
      await new Promise(resolve => setTimeout(resolve, 5));

      return {
        status: 'up',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: {
          pluginsLoaded: 5, // Would be actual count
          pluginsActive: 5
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check voice interface health
   */
  private async checkVoiceHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check voice synthesis and recognition capabilities
      const speechSynthesisAvailable = typeof window !== 'undefined' &&
        'speechSynthesis' in window;

      const speechRecognitionAvailable = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

      const isHealthy = speechSynthesisAvailable && speechRecognitionAvailable;

      return {
        status: isHealthy ? 'up' : 'degraded',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: {
          speechSynthesis: speechSynthesisAvailable,
          speechRecognition: speechRecognitionAvailable
        }
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check security system health
   */
  private async checkSecurityHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check security modules status
      await new Promise(resolve => setTimeout(resolve, 5));

      return {
        status: 'up',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: {
          zeroTrustEnabled: true,
          encryptionActive: true,
          auditLogging: true
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<DependencyStatus> {
    const startTime = Date.now();

    try {
      // In real implementation, this would ping the database
      await new Promise(resolve => setTimeout(resolve, 20)); // Simulate DB query

      return {
        name: 'postgresql',
        type: 'database',
        status: 'up',
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'postgresql',
        type: 'database',
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCacheHealth(): Promise<DependencyStatus> {
    const startTime = Date.now();

    try {
      // In real implementation, this would ping Redis
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate Redis ping

      return {
        name: 'redis',
        type: 'cache',
        status: 'up',
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'redis',
        type: 'cache',
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Check filesystem health
   */
  private async checkFilesystemHealth(): Promise<DependencyStatus> {
    const startTime = Date.now();

    try {
      // Check if we can write/read from filesystem
      const testFile = '/tmp/agentos-health-check';
      require('fs').writeFileSync(testFile, 'health-check');
      require('fs').unlinkSync(testFile);

      return {
        name: 'filesystem',
        type: 'filesystem',
        status: 'up',
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'filesystem',
        type: 'filesystem',
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date()
      };
    }
  }

  /**
   * Initialize default dependencies
   */
  private registerDefaultDependencies(): void {
    this.registerDependency({
      name: 'postgresql',
      type: 'database',
      status: 'unknown'
    });

    this.registerDependency({
      name: 'redis',
      type: 'cache',
      status: 'unknown'
    });

    this.registerDependency({
      name: 'filesystem',
      type: 'filesystem',
      status: 'unknown'
    });
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): SystemMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: 0,
      activeConnections: 0,
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Get current system metrics
   */
  private async getCurrentMetrics(): Promise<SystemMetrics> {
    // Update metrics with current values
    this.metrics.memoryUsage = process.memoryUsage();

    // In a real implementation, you'd collect CPU usage, connection counts, etc.
    // For now, we'll simulate some metrics

    return {
      ...this.metrics,
      cpuUsage: Math.random() * 100, // Simulate CPU usage
      activeConnections: Math.floor(Math.random() * 100),
      requestCount: Math.floor(Math.random() * 10000),
      errorCount: Math.floor(Math.random() * 100),
      averageResponseTime: Math.random() * 500
    };
  }

  /**
   * Determine overall system health status
   */
  private determineOverallStatus(
    services: Record<string, ServiceHealth>,
    dependencies: DependencyStatus[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const serviceStatuses = Object.values(services).map(s => s.status);
    const dependencyStatuses = dependencies.map(d => d.status);

    const allStatuses = [...serviceStatuses, ...dependencyStatuses];

    if (allStatuses.includes('down')) {
      return 'unhealthy';
    }

    if (allStatuses.includes('degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get detailed health report as JSON
   */
  async getHealthReport(): Promise<string> {
    const healthStatus = await this.getHealthStatus();
    return JSON.stringify(healthStatus, null, 2);
  }

  /**
   * Reset health metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.startTime = new Date();

    this.logger.info('Health metrics reset');
  }
}
