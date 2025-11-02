/**
 * Metrics Collector
 * Production-grade metrics collection and export for monitoring
 */

import { EventEmitter } from 'events';
import { systemLogger } from '../logging';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
}

export interface BusinessMetrics {
  userSessions: number;
  voiceInteractions: number;
  intentSuccessRate: number;
  pluginUsage: Record<string, number>;
  caregiverInteractions: number;
}

export interface SystemMetrics {
  uptime: number;
  heapUsed: number;
  heapTotal: number;
  externalMemory: number;
  rss: number;
  cpuUsage: number;
  eventLoopLag: number;
}

export class MetricsCollector extends EventEmitter {
  private metrics: MetricPoint[] = [];
  private performanceMetrics: PerformanceMetrics;
  private businessMetrics: BusinessMetrics;
  private systemMetrics: SystemMetrics;
  private logger = systemLogger('metrics-collector');
  private collectionInterval?: NodeJS.Timeout;
  private readonly maxMetricsHistory = 10000; // Keep last 10k metrics

  constructor() {
    super();
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.businessMetrics = this.initializeBusinessMetrics();
    this.systemMetrics = this.initializeSystemMetrics();
  }

  /**
   * Start metrics collection
   */
  startCollection(intervalMs: number = 30000): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.emit('metricsCollected', this.getAllMetrics());
    }, intervalMs);

    this.logger.info('Metrics collection started', { intervalMs });
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }

    this.logger.info('Metrics collection stopped');
  }

  /**
   * Record a custom metric
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
    type: MetricPoint['type'] = 'gauge'
  ): void {
    const metric: MetricPoint = {
      name,
      value,
      timestamp: new Date(),
      tags,
      type
    };

    this.metrics.push(metric);

    // Maintain history limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    this.emit('metricRecorded', metric);

    // Log high-value metrics
    if (value > 1000 || type === 'counter') {
      this.logger.debug('Metric recorded', { name, value, tags, type });
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, tags: Record<string, string> = {}): void {
    this.recordMetric(name, 1, tags, 'counter');
  }

  /**
   * Record response time
   */
  recordResponseTime(endpoint: string, method: string, duration: number, statusCode: number): void {
    this.recordMetric('http_request_duration', duration, {
      endpoint,
      method,
      status_code: statusCode.toString(),
      status_group: statusCode >= 400 ? 'error' : 'success'
    }, 'histogram');

    // Update performance metrics
    this.performanceMetrics.responseTime = (this.performanceMetrics.responseTime + duration) / 2;
    this.performanceMetrics.throughput++;
  }

  /**
   * Record error
   */
  recordError(errorType: string, context: Record<string, string> = {}): void {
    this.incrementCounter('errors_total', { error_type: errorType, ...context });
    this.performanceMetrics.errorRate++;
  }

  /**
   * Record voice interaction
   */
  recordVoiceInteraction(success: boolean, duration: number, intent?: string): void {
    this.incrementCounter('voice_interactions_total', {
      success: success.toString(),
      intent: intent || 'unknown'
    });

    this.recordMetric('voice_interaction_duration', duration, {
      success: success.toString(),
      intent: intent || 'unknown'
    }, 'histogram');

    this.businessMetrics.voiceInteractions++;
    if (success) {
      this.businessMetrics.intentSuccessRate =
        (this.businessMetrics.intentSuccessRate + 1) / 2;
    }
  }

  /**
   * Record plugin usage
   */
  recordPluginUsage(pluginId: string, action: string, duration?: number): void {
    this.incrementCounter('plugin_usage_total', {
      plugin_id: pluginId,
      action
    });

    if (duration) {
      this.recordMetric('plugin_execution_duration', duration, {
        plugin_id: pluginId,
        action
      }, 'histogram');
    }

    // Update business metrics
    if (!this.businessMetrics.pluginUsage[pluginId]) {
      this.businessMetrics.pluginUsage[pluginId] = 0;
    }
    this.businessMetrics.pluginUsage[pluginId]++;
  }

  /**
   * Record caregiver interaction
   */
  recordCaregiverInteraction(action: string, elderlyUserId: string): void {
    this.incrementCounter('caregiver_interactions_total', {
      action,
      elderly_user_id: elderlyUserId
    });

    this.businessMetrics.caregiverInteractions++;
  }

  /**
   * Collect current system metrics
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    this.systemMetrics = {
      uptime,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      externalMemory: memUsage.external,
      rss: memUsage.rss,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      eventLoopLag: 0 // Would need additional measurement
    };

    // Record system metrics
    this.recordMetric('process_heap_used', memUsage.heapUsed, {}, 'gauge');
    this.recordMetric('process_heap_total', memUsage.heapTotal, {}, 'gauge');
    this.recordMetric('process_rss', memUsage.rss, {}, 'gauge');
    this.recordMetric('process_uptime', uptime, {}, 'gauge');
    this.recordMetric('process_cpu_usage', this.systemMetrics.cpuUsage, {}, 'gauge');
  }

  /**
   * Get all current metrics
   */
  getAllMetrics(): {
    performance: PerformanceMetrics;
    business: BusinessMetrics;
    system: SystemMetrics;
    recentMetrics: MetricPoint[];
  } {
    return {
      performance: { ...this.performanceMetrics },
      business: { ...this.businessMetrics },
      system: { ...this.systemMetrics },
      recentMetrics: this.metrics.slice(-100) // Last 100 metrics
    };
  }

  /**
   * Get metrics by name and time range
   */
  getMetricsByName(
    name: string,
    startTime?: Date,
    endTime?: Date,
    tags?: Record<string, string>
  ): MetricPoint[] {
    let filtered = this.metrics.filter(m => m.name === name);

    if (startTime) {
      filtered = filtered.filter(m => m.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(m => m.timestamp <= endTime);
    }

    if (tags) {
      filtered = filtered.filter(m =>
        Object.entries(tags).every(([key, value]) => m.tags[key] === value)
      );
    }

    return filtered;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Group metrics by name and tags
    const groupedMetrics = new Map<string, MetricPoint[]>();

    this.metrics.slice(-1000).forEach(metric => {
      const key = `${metric.name}{${Object.entries(metric.tags)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')}}`;

      if (!groupedMetrics.has(key)) {
        groupedMetrics.set(key, []);
      }
      groupedMetrics.get(key)!.push(metric);
    });

    // Export latest value for each metric
    groupedMetrics.forEach((metrics, key) => {
      const latest = metrics[metrics.length - 1];
      lines.push(`${key} ${latest.value} ${latest.timestamp.getTime()}`);
    });

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }

  /**
   * Get aggregated statistics
   */
  getStatistics(timeRange?: number): {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
    topErrors: Array<{ error: string; count: number }>;
  } {
    const recentMetrics = timeRange
      ? this.metrics.filter(m => Date.now() - m.timestamp.getTime() < timeRange)
      : this.metrics;

    const requestMetrics = recentMetrics.filter(m => m.name === 'http_request_duration');
    const errorMetrics = recentMetrics.filter(m => m.name === 'errors_total');

    // Calculate statistics
    const totalRequests = requestMetrics.length;
    const errorRate = totalRequests > 0 ? (errorMetrics.length / totalRequests) * 100 : 0;
    const avgResponseTime = requestMetrics.length > 0
      ? requestMetrics.reduce((sum, m) => sum + m.value, 0) / requestMetrics.length
      : 0;

    // Top endpoints
    const endpointCounts = new Map<string, number>();
    requestMetrics.forEach(m => {
      const endpoint = m.tags.endpoint || 'unknown';
      endpointCounts.set(endpoint, (endpointCounts.get(endpoint) || 0) + 1);
    });

    const topEndpoints = Array.from(endpointCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    // Top errors
    const errorCounts = new Map<string, number>();
    errorMetrics.forEach(m => {
      const error = m.tags.error_type || 'unknown';
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });

    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    return {
      totalRequests,
      errorRate,
      avgResponseTime,
      topEndpoints,
      topErrors
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.businessMetrics = this.initializeBusinessMetrics();
    this.systemMetrics = this.initializeSystemMetrics();

    this.logger.info('Metrics collector reset');
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): PerformanceMetrics {
    return {
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0
    };
  }

  /**
   * Initialize business metrics
   */
  private initializeBusinessMetrics(): BusinessMetrics {
    return {
      userSessions: 0,
      voiceInteractions: 0,
      intentSuccessRate: 0,
      pluginUsage: {},
      caregiverInteractions: 0
    };
  }

  /**
   * Initialize system metrics
   */
  private initializeSystemMetrics(): SystemMetrics {
    return {
      uptime: 0,
      heapUsed: 0,
      heapTotal: 0,
      externalMemory: 0,
      rss: 0,
      cpuUsage: 0,
      eventLoopLag: 0
    };
  }
}
