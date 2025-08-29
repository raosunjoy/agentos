/**
 * Plugin performance monitoring and resource management
 * Tracks plugin resource usage and enforces limits
 */

import { EventEmitter } from 'events';
import { PluginPerformanceMetrics, ResourceLimits } from './types';

export class PluginPerformanceMonitor extends EventEmitter {
  private metrics = new Map<string, PluginPerformanceMetrics>();
  private limits = new Map<string, ResourceLimits>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private alertThresholds = new Map<string, AlertThresholds>();
  private violationCounts = new Map<string, ViolationCount>();

  constructor() {
    super();
  }

  /**
   * Start monitoring a plugin
   */
  startMonitoring(pluginId: string, limits: ResourceLimits, thresholds?: AlertThresholds): void {
    this.limits.set(pluginId, limits);
    this.alertThresholds.set(pluginId, thresholds || this.getDefaultThresholds());
    this.violationCounts.set(pluginId, { memory: 0, cpu: 0, network: 0, execution: 0 });

    // Initialize metrics
    this.metrics.set(pluginId, {
      memoryUsageMB: 0,
      cpuUsagePercent: 0,
      networkUsageKB: 0,
      intentHandlingTimeMs: 0,
      errorCount: 0,
      lastUpdated: new Date()
    });

    // Start monitoring interval
    const interval = setInterval(() => {
      this.collectMetrics(pluginId);
    }, 1000); // Collect metrics every second

    this.intervals.set(pluginId, interval);
    this.emit('monitoringStarted', { pluginId, limits });
  }

  /**
   * Stop monitoring a plugin
   */
  stopMonitoring(pluginId: string): void {
    const interval = this.intervals.get(pluginId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(pluginId);
    }

    this.metrics.delete(pluginId);
    this.limits.delete(pluginId);
    this.alertThresholds.delete(pluginId);
    this.violationCounts.delete(pluginId);

    this.emit('monitoringStopped', { pluginId });
  }

  /**
   * Get current metrics for a plugin
   */
  getMetrics(pluginId: string): PluginPerformanceMetrics | undefined {
    return this.metrics.get(pluginId);
  }

  /**
   * Get all monitored plugins and their metrics
   */
  getAllMetrics(): Map<string, PluginPerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Check if plugin is exceeding resource limits
   */
  isExceedingLimits(pluginId: string): boolean {
    const metrics = this.metrics.get(pluginId);
    const limits = this.limits.get(pluginId);

    if (!metrics || !limits) {
      return false;
    }

    return (
      metrics.memoryUsageMB > limits.maxMemoryMB ||
      metrics.cpuUsagePercent > limits.maxCPUPercent ||
      metrics.networkUsageKB > limits.maxNetworkBandwidthKBps
    );
  }

  /**
   * Get performance summary for all plugins
   */
  getPerformanceSummary(): PerformanceSummary {
    const allMetrics = Array.from(this.metrics.values());
    
    if (allMetrics.length === 0) {
      return {
        totalPlugins: 0,
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        totalNetworkUsage: 0,
        pluginsExceedingLimits: 0,
        totalErrors: 0
      };
    }

    const totalMemory = allMetrics.reduce((sum, m) => sum + m.memoryUsageMB, 0);
    const totalCpu = allMetrics.reduce((sum, m) => sum + m.cpuUsagePercent, 0);
    const totalNetwork = allMetrics.reduce((sum, m) => sum + m.networkUsageKB, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    
    const exceedingLimits = Array.from(this.metrics.keys())
      .filter(pluginId => this.isExceedingLimits(pluginId)).length;

    return {
      totalPlugins: allMetrics.length,
      averageMemoryUsage: totalMemory / allMetrics.length,
      averageCpuUsage: totalCpu / allMetrics.length,
      totalNetworkUsage: totalNetwork,
      pluginsExceedingLimits: exceedingLimits,
      totalErrors
    };
  }

  /**
   * Record intent handling time
   */
  recordIntentHandling(pluginId: string, executionTimeMs: number): void {
    const metrics = this.metrics.get(pluginId);
    if (metrics) {
      metrics.intentHandlingTimeMs = executionTimeMs;
      metrics.lastUpdated = new Date();

      // Check execution time limits
      const limits = this.limits.get(pluginId);
      if (limits && executionTimeMs > limits.maxExecutionTimeMs) {
        this.handleViolation(pluginId, 'execution', executionTimeMs, limits.maxExecutionTimeMs);
      }
    }
  }

  /**
   * Record an error for a plugin
   */
  recordError(pluginId: string, error: Error): void {
    const metrics = this.metrics.get(pluginId);
    if (metrics) {
      metrics.errorCount++;
      metrics.lastUpdated = new Date();

      this.emit('pluginError', {
        pluginId,
        error: error.message,
        errorCount: metrics.errorCount,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get performance history for a plugin
   */
  getPerformanceHistory(pluginId: string, duration: number = 3600000): PerformanceHistory {
    // In a real implementation, this would return historical data
    // For now, return current metrics as a single data point
    const metrics = this.metrics.get(pluginId);
    
    if (!metrics) {
      return {
        pluginId,
        startTime: new Date(Date.now() - duration),
        endTime: new Date(),
        dataPoints: []
      };
    }

    return {
      pluginId,
      startTime: new Date(Date.now() - duration),
      endTime: new Date(),
      dataPoints: [
        {
          timestamp: metrics.lastUpdated,
          memoryUsageMB: metrics.memoryUsageMB,
          cpuUsagePercent: metrics.cpuUsagePercent,
          networkUsageKB: metrics.networkUsageKB,
          intentHandlingTimeMs: metrics.intentHandlingTimeMs
        }
      ]
    };
  }

  /**
   * Set custom alert thresholds for a plugin
   */
  setAlertThresholds(pluginId: string, thresholds: AlertThresholds): void {
    this.alertThresholds.set(pluginId, thresholds);
  }

  /**
   * Get plugins that are approaching resource limits
   */
  getPluginsApproachingLimits(): PluginAlert[] {
    const alerts: PluginAlert[] = [];

    for (const [pluginId, metrics] of this.metrics) {
      const limits = this.limits.get(pluginId);
      const thresholds = this.alertThresholds.get(pluginId);

      if (!limits || !thresholds) continue;

      // Check memory usage
      const memoryUsagePercent = (metrics.memoryUsageMB / limits.maxMemoryMB) * 100;
      if (memoryUsagePercent >= thresholds.memoryWarningPercent) {
        alerts.push({
          pluginId,
          type: 'memory',
          severity: memoryUsagePercent >= thresholds.memoryCriticalPercent ? 'critical' : 'warning',
          message: `Memory usage at ${memoryUsagePercent.toFixed(1)}% of limit`,
          currentValue: metrics.memoryUsageMB,
          limit: limits.maxMemoryMB,
          timestamp: new Date()
        });
      }

      // Check CPU usage
      const cpuUsagePercent = (metrics.cpuUsagePercent / limits.maxCPUPercent) * 100;
      if (cpuUsagePercent >= thresholds.cpuWarningPercent) {
        alerts.push({
          pluginId,
          type: 'cpu',
          severity: cpuUsagePercent >= thresholds.cpuCriticalPercent ? 'critical' : 'warning',
          message: `CPU usage at ${cpuUsagePercent.toFixed(1)}% of limit`,
          currentValue: metrics.cpuUsagePercent,
          limit: limits.maxCPUPercent,
          timestamp: new Date()
        });
      }

      // Check network usage
      const networkUsagePercent = (metrics.networkUsageKB / limits.maxNetworkBandwidthKBps) * 100;
      if (networkUsagePercent >= thresholds.networkWarningPercent) {
        alerts.push({
          pluginId,
          type: 'network',
          severity: networkUsagePercent >= thresholds.networkCriticalPercent ? 'critical' : 'warning',
          message: `Network usage at ${networkUsagePercent.toFixed(1)}% of limit`,
          currentValue: metrics.networkUsageKB,
          limit: limits.maxNetworkBandwidthKBps,
          timestamp: new Date()
        });
      }
    }

    return alerts;
  }

  /**
   * Force garbage collection for a plugin (if supported)
   */
  async forceGarbageCollection(pluginId: string): Promise<void> {
    // In a real implementation, this would trigger GC in the plugin's sandbox
    this.emit('garbageCollectionRequested', { pluginId, timestamp: new Date() });
  }

  /**
   * Generate performance report
   */
  generateReport(pluginId?: string): PerformanceReport {
    const reportTime = new Date();
    
    if (pluginId) {
      // Single plugin report
      const metrics = this.metrics.get(pluginId);
      const limits = this.limits.get(pluginId);
      
      if (!metrics || !limits) {
        throw new Error(`Plugin ${pluginId} not found or not monitored`);
      }

      return {
        reportTime,
        type: 'single_plugin',
        pluginId,
        metrics,
        limits,
        violations: this.violationCounts.get(pluginId) || { memory: 0, cpu: 0, network: 0, execution: 0 },
        recommendations: this.generateRecommendations(pluginId)
      };
    } else {
      // System-wide report
      const summary = this.getPerformanceSummary();
      const alerts = this.getPluginsApproachingLimits();
      
      return {
        reportTime,
        type: 'system_wide',
        summary,
        alerts,
        topResourceConsumers: this.getTopResourceConsumers(),
        recommendations: this.generateSystemRecommendations()
      };
    }
  }

  // Private methods

  private collectMetrics(pluginId: string): void {
    // In a real implementation, this would collect actual metrics from the plugin sandbox
    // For now, we'll simulate metric collection
    
    const metrics = this.metrics.get(pluginId);
    const limits = this.limits.get(pluginId);
    
    if (!metrics || !limits) return;

    // Simulate metric collection (replace with actual implementation)
    const previousMemory = metrics.memoryUsageMB;
    const memoryDelta = (Math.random() - 0.5) * 2; // Random change
    metrics.memoryUsageMB = Math.max(0, previousMemory + memoryDelta);
    
    const previousCpu = metrics.cpuUsagePercent;
    const cpuDelta = (Math.random() - 0.5) * 5;
    metrics.cpuUsagePercent = Math.max(0, Math.min(100, previousCpu + cpuDelta));
    
    const previousNetwork = metrics.networkUsageKB;
    const networkDelta = (Math.random() - 0.5) * 10;
    metrics.networkUsageKB = Math.max(0, previousNetwork + networkDelta);
    
    metrics.lastUpdated = new Date();

    // Check for violations
    this.checkViolations(pluginId, metrics, limits);
  }

  private checkViolations(pluginId: string, metrics: PluginPerformanceMetrics, limits: ResourceLimits): void {
    // Check memory violation
    if (metrics.memoryUsageMB > limits.maxMemoryMB) {
      this.handleViolation(pluginId, 'memory', metrics.memoryUsageMB, limits.maxMemoryMB);
    }

    // Check CPU violation
    if (metrics.cpuUsagePercent > limits.maxCPUPercent) {
      this.handleViolation(pluginId, 'cpu', metrics.cpuUsagePercent, limits.maxCPUPercent);
    }

    // Check network violation
    if (metrics.networkUsageKB > limits.maxNetworkBandwidthKBps) {
      this.handleViolation(pluginId, 'network', metrics.networkUsageKB, limits.maxNetworkBandwidthKBps);
    }
  }

  private handleViolation(pluginId: string, type: keyof ViolationCount, currentValue: number, limit: number): void {
    const violations = this.violationCounts.get(pluginId);
    if (violations) {
      violations[type]++;
    }

    this.emit('resourceViolation', {
      pluginId,
      type,
      currentValue,
      limit,
      violationCount: violations?.[type] || 0,
      timestamp: new Date()
    });

    // Take action based on violation severity
    const violationCount = violations?.[type] || 0;
    if (violationCount >= 5) {
      this.emit('severeViolation', {
        pluginId,
        type,
        violationCount,
        recommendation: 'Consider disabling plugin or increasing limits'
      });
    }
  }

  private getDefaultThresholds(): AlertThresholds {
    return {
      memoryWarningPercent: 80,
      memoryCriticalPercent: 95,
      cpuWarningPercent: 80,
      cpuCriticalPercent: 95,
      networkWarningPercent: 80,
      networkCriticalPercent: 95
    };
  }

  private getTopResourceConsumers(): TopResourceConsumer[] {
    const consumers: TopResourceConsumer[] = [];
    
    for (const [pluginId, metrics] of this.metrics) {
      consumers.push({
        pluginId,
        memoryUsageMB: metrics.memoryUsageMB,
        cpuUsagePercent: metrics.cpuUsagePercent,
        networkUsageKB: metrics.networkUsageKB
      });
    }

    // Sort by memory usage (could also sort by other metrics)
    return consumers.sort((a, b) => b.memoryUsageMB - a.memoryUsageMB).slice(0, 5);
  }

  private generateRecommendations(pluginId: string): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics.get(pluginId);
    const limits = this.limits.get(pluginId);
    const violations = this.violationCounts.get(pluginId);

    if (!metrics || !limits || !violations) return recommendations;

    // Memory recommendations
    if (metrics.memoryUsageMB > limits.maxMemoryMB * 0.8) {
      recommendations.push('Consider optimizing memory usage or increasing memory limits');
    }

    // CPU recommendations
    if (metrics.cpuUsagePercent > limits.maxCPUPercent * 0.8) {
      recommendations.push('Consider optimizing CPU-intensive operations');
    }

    // Error recommendations
    if (metrics.errorCount > 10) {
      recommendations.push('High error count detected - review plugin logs and error handling');
    }

    // Violation recommendations
    if (violations.memory > 0) {
      recommendations.push('Memory violations detected - consider increasing memory limits or optimizing usage');
    }

    return recommendations;
  }

  private generateSystemRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = this.getPerformanceSummary();

    if (summary.pluginsExceedingLimits > 0) {
      recommendations.push(`${summary.pluginsExceedingLimits} plugins are exceeding resource limits`);
    }

    if (summary.averageMemoryUsage > 100) {
      recommendations.push('High system memory usage - consider reviewing plugin resource allocation');
    }

    if (summary.totalErrors > 50) {
      recommendations.push('High system error count - review plugin stability');
    }

    return recommendations;
  }
}

// Supporting interfaces

export interface AlertThresholds {
  memoryWarningPercent: number;
  memoryCriticalPercent: number;
  cpuWarningPercent: number;
  cpuCriticalPercent: number;
  networkWarningPercent: number;
  networkCriticalPercent: number;
}

export interface ViolationCount {
  memory: number;
  cpu: number;
  network: number;
  execution: number;
}

export interface PerformanceSummary {
  totalPlugins: number;
  averageMemoryUsage: number;
  averageCpuUsage: number;
  totalNetworkUsage: number;
  pluginsExceedingLimits: number;
  totalErrors: number;
}

export interface PluginAlert {
  pluginId: string;
  type: 'memory' | 'cpu' | 'network';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  limit: number;
  timestamp: Date;
}

export interface PerformanceHistory {
  pluginId: string;
  startTime: Date;
  endTime: Date;
  dataPoints: PerformanceDataPoint[];
}

export interface PerformanceDataPoint {
  timestamp: Date;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  networkUsageKB: number;
  intentHandlingTimeMs: number;
}

export interface TopResourceConsumer {
  pluginId: string;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  networkUsageKB: number;
}

export interface PerformanceReport {
  reportTime: Date;
  type: 'single_plugin' | 'system_wide';
  pluginId?: string;
  metrics?: PluginPerformanceMetrics;
  limits?: ResourceLimits;
  violations?: ViolationCount;
  summary?: PerformanceSummary;
  alerts?: PluginAlert[];
  topResourceConsumers?: TopResourceConsumer[];
  recommendations: string[];
}