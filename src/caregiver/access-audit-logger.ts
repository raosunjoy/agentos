/**
 * Access Audit Logger for caregiver system
 * Provides comprehensive audit trail for all caregiver access and actions
 */

import {
  AccessAuditLog,
  AuditAction
} from './types';

interface Session {
  startTime: Date;
  endTime: Date;
  duration: number;
  actions: AccessAuditLog[];
}

export interface AuditLogStorage {
  store(log: AccessAuditLog): Promise<void>;
  query(filters: AuditLogFilters): Promise<AccessAuditLog[]>;
  count(filters: AuditLogFilters): Promise<number>;
  purge(olderThan: Date): Promise<number>;
}

export interface AuditLogFilters {
  caregiverId?: string;
  action?: AuditAction;
  resource?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  actionsByType: Record<AuditAction, number>;
  mostActiveCaregiver: string;
  recentFailures: AccessAuditLog[];
}

export class AccessAuditLogger {
  private storage: AuditLogStorage;
  private retentionPeriod: number; // in days
  private alertThresholds: AuditAlertThresholds;

  constructor(
    storage: AuditLogStorage,
    retentionPeriod: number = 365,
    alertThresholds: AuditAlertThresholds = DEFAULT_ALERT_THRESHOLDS
  ) {
    this.storage = storage;
    this.retentionPeriod = retentionPeriod;
    this.alertThresholds = alertThresholds;

    // Set up periodic cleanup
    setInterval(() => this.cleanupOldLogs(), 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Log an access event
   */
  async log(entry: Omit<AccessAuditLog, 'id'>): Promise<void> {
    const logEntry: AccessAuditLog = {
      ...entry,
      id: this.generateLogId()
    };

    try {
      await this.storage.store(logEntry);
      
      // Check for suspicious patterns
      await this.checkForSuspiciousActivity(logEntry);
      
    } catch (error) {
      console.error('Failed to store audit log:', error);
      // In a real implementation, this would be handled more robustly
      // possibly with a fallback storage mechanism
    }
  }

  /**
   * Get audit logs for a specific caregiver
   */
  async getCaregiverAuditLogs(
    caregiverId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<AccessAuditLog[]> {
    const query: any = { caregiverId, limit };
    if (startDate !== undefined) query.startDate = startDate;
    if (endDate !== undefined) query.endDate = endDate;

    return this.storage.query(query);
  }

  /**
   * Get audit logs for a specific action type
   */
  async getActionAuditLogs(
    action: AuditAction,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<AccessAuditLog[]> {
    const query: any = { action, limit };
    if (startDate !== undefined) query.startDate = startDate;
    if (endDate !== undefined) query.endDate = endDate;

    return this.storage.query(query);
  }

  /**
   * Get failed access attempts
   */
  async getFailedAttempts(
    caregiverId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<AccessAuditLog[]> {
    const query: any = { success: false, limit };
    if (caregiverId !== undefined) query.caregiverId = caregiverId;
    if (startDate !== undefined) query.startDate = startDate;
    if (endDate !== undefined) query.endDate = endDate;

    return this.storage.query(query);
  }

  /**
   * Generate audit summary for a time period
   */
  async generateAuditSummary(
    startDate: Date,
    endDate: Date,
    caregiverId?: string
  ): Promise<AuditSummary> {
    const filters: any = { startDate, endDate };
    if (caregiverId !== undefined) filters.caregiverId = caregiverId;

    const logs = await this.storage.query(filters);
    const totalActions = logs.length;
    const successfulActions = logs.filter(log => log.success).length;
    const failedActions = totalActions - successfulActions;

    // Count actions by type
    const actionsByType: Record<AuditAction, number> = {} as Record<AuditAction, number>;
    Object.values(AuditAction).forEach(action => {
      actionsByType[action] = 0;
    });

    logs.forEach(log => {
      actionsByType[log.action]++;
    });

    // Find most active caregiver
    const caregiverCounts: Record<string, number> = {};
    logs.forEach(log => {
      caregiverCounts[log.caregiverId] = (caregiverCounts[log.caregiverId] || 0) + 1;
    });

    const mostActiveCaregiver = Object.entries(caregiverCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    // Get recent failures
    const recentFailures = logs
      .filter(log => !log.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalActions,
      successfulActions,
      failedActions,
      actionsByType,
      mostActiveCaregiver,
      recentFailures
    };
  }

  /**
   * Check for compliance violations
   */
  async checkCompliance(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const logs = await this.storage.query({ startDate, endDate });
    
    const violations: ComplianceViolation[] = [];
    
    // Check for unauthorized access attempts
    const unauthorizedAttempts = logs.filter(log => 
      !log.success && 
      (log.action === AuditAction.LOGIN || log.action === AuditAction.VIEW_DATA)
    );

    if (unauthorizedAttempts.length > this.alertThresholds.maxFailedAttempts) {
      violations.push({
        type: 'excessive_failed_attempts',
        severity: 'high',
        count: unauthorizedAttempts.length,
        description: `${unauthorizedAttempts.length} failed access attempts detected`
      });
    }

    // Check for unusual access patterns
    const accessPatterns = this.analyzeAccessPatterns(logs);
    if (accessPatterns.suspiciousPatterns.length > 0) {
      violations.push({
        type: 'suspicious_access_pattern',
        severity: 'medium',
        count: accessPatterns.suspiciousPatterns.length,
        description: 'Unusual access patterns detected'
      });
    }

    // Check for missing audit logs (gaps in expected activity)
    const auditGaps = this.detectAuditGaps(logs, startDate, endDate);
    if (auditGaps.length > 0) {
      violations.push({
        type: 'audit_gap',
        severity: 'low',
        count: auditGaps.length,
        description: 'Gaps in audit trail detected'
      });
    }

    return {
      period: { startDate, endDate },
      totalLogs: logs.length,
      violations,
      complianceScore: this.calculateComplianceScore(violations, logs.length)
    };
  }

  /**
   * Export audit logs for compliance reporting
   */
  async exportAuditLogs(
    filters: AuditLogFilters,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const logs = await this.storage.query(filters);
    
    if (format === 'csv') {
      return this.convertToCSV(logs);
    }
    
    return JSON.stringify(logs, null, 2);
  }

  private async checkForSuspiciousActivity(logEntry: AccessAuditLog): Promise<void> {
    // Check for rapid failed attempts
    if (!logEntry.success && logEntry.action === AuditAction.LOGIN) {
      const recentFailures = await this.storage.query({
        caregiverId: logEntry.caregiverId,
        action: AuditAction.LOGIN,
        success: false,
        startDate: new Date(logEntry.timestamp.getTime() - 15 * 60 * 1000), // Last 15 minutes from this log entry
        endDate: logEntry.timestamp,
        limit: 10
      });

      if (recentFailures.length >= this.alertThresholds.maxFailedAttempts) {
        await this.triggerSecurityAlert('rapid_failed_attempts', logEntry);
      }
    }

    // Check for unusual access times
    const hour = logEntry.timestamp.getHours();
    if (hour < 6 || hour > 22) { // Outside normal hours
      const recentNightAccess = await this.storage.query({
        caregiverId: logEntry.caregiverId,
        startDate: new Date(logEntry.timestamp.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days from this log entry
        endDate: new Date(logEntry.timestamp.getTime() - 1), // Exclude current entry
        limit: 100
      });

      const nightAccessCount = recentNightAccess.filter(log => {
        const logHour = log.timestamp.getHours();
        return logHour < 6 || logHour > 22;
      }).length;

      if (nightAccessCount === 0) { // First time accessing at night
        await this.triggerSecurityAlert('unusual_access_time', logEntry);
      }
    }

    // Check for access from new IP addresses
    if (logEntry.ipAddress) {
      const recentAccess = await this.storage.query({
        caregiverId: logEntry.caregiverId,
        startDate: new Date(logEntry.timestamp.getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days from this log entry
        endDate: new Date(logEntry.timestamp.getTime() - 1), // Exclude current entry
        limit: 1000
      });

      const knownIPs = new Set(
        recentAccess
          .filter(log => log.ipAddress)
          .map(log => log.ipAddress)
      );

      if (!knownIPs.has(logEntry.ipAddress)) {
        await this.triggerSecurityAlert('new_ip_address', logEntry);
      }
    }
  }

  private analyzeAccessPatterns(logs: AccessAuditLog[]): AccessPatternAnalysis {
    const patterns: AccessPattern[] = [];
    const suspiciousPatterns: SuspiciousPattern[] = [];

    // Group by caregiver
    const caregiverLogs: Record<string, AccessAuditLog[]> = {};
    logs.forEach(log => {
      if (!caregiverLogs[log.caregiverId]) {
        caregiverLogs[log.caregiverId] = [];
      }
      caregiverLogs[log.caregiverId]!.push(log);
    });

    // Analyze each caregiver's patterns
    Object.entries(caregiverLogs).forEach(([caregiverId, caregiverLogEntries]) => {
      const pattern = this.analyzeCaregiverPattern(caregiverId, caregiverLogEntries);
      patterns.push(pattern);

      // Check for suspicious patterns
      if (pattern.averageSessionDuration > 4 * 60 * 60 * 1000) { // > 4 hours
        suspiciousPatterns.push({
          caregiverId,
          type: 'long_session_duration',
          severity: 'medium',
          details: `Average session duration: ${pattern.averageSessionDuration / (60 * 60 * 1000)} hours`
        });
      }

      if (pattern.failureRate > 0.3) { // > 30% failure rate
        suspiciousPatterns.push({
          caregiverId,
          type: 'high_failure_rate',
          severity: 'high',
          details: `Failure rate: ${(pattern.failureRate * 100).toFixed(1)}%`
        });
      }
    });

    return { patterns, suspiciousPatterns };
  }

  private analyzeCaregiverPattern(caregiverId: string, logs: AccessAuditLog[]): AccessPattern {
    const sessions = this.groupIntoSessions(logs);
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    const averageSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    const failedActions = logs.filter(log => !log.success).length;
    const failureRate = logs.length > 0 ? failedActions / logs.length : 0;

    const actionCounts: Record<AuditAction, number> = {} as Record<AuditAction, number>;
    Object.values(AuditAction).forEach(action => {
      actionCounts[action] = 0;
    });
    logs.forEach(log => {
      actionCounts[log.action]++;
    });

    return {
      caregiverId,
      totalSessions,
      averageSessionDuration,
      failureRate,
      actionCounts,
      mostCommonAction: Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] as AuditAction
    };
  }

  private groupIntoSessions(logs: AccessAuditLog[]): Session[] {
    const sessions: Session[] = [];
    let currentSession: Session | null = null;
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    logs.forEach(log => {
      if (log.action === AuditAction.LOGIN) {
        currentSession = {
          startTime: log.timestamp,
          endTime: log.timestamp,
          duration: 0,
          actions: [log]
        } as Session;
              } else if (currentSession && currentSession.endTime && currentSession.startTime) {
        const timeSinceLastAction = log.timestamp.getTime() - currentSession.endTime.getTime();
        
        if (timeSinceLastAction > sessionTimeout) {
          // End current session
          currentSession.duration = currentSession.endTime.getTime() - currentSession.startTime.getTime();
          sessions.push(currentSession);
          currentSession = null;
        } else {
          // Continue current session
          currentSession.endTime = log.timestamp;
          currentSession.actions.push(log);
        }
      }

      if (log.action === AuditAction.LOGOUT && currentSession) {
        currentSession.endTime = log.timestamp;
        currentSession.duration = currentSession.endTime.getTime() - currentSession.startTime.getTime();
        sessions.push(currentSession);
        currentSession = null;
      }
    });

    // Close any remaining session
    if (currentSession) {
      currentSession.duration = currentSession.endTime.getTime() - currentSession.startTime.getTime();
      sessions.push(currentSession);
    }

    return sessions;
  }

  private detectAuditGaps(logs: AccessAuditLog[], startDate: Date, endDate: Date): AuditGap[] {
    const gaps: AuditGap[] = [];
    const sortedLogs = logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const expectedInterval = 60 * 60 * 1000; // 1 hour
    let lastTimestamp = startDate.getTime();

    sortedLogs.forEach(log => {
      const gap = log.timestamp.getTime() - lastTimestamp;
      if (gap > expectedInterval * 24) { // Gap > 24 hours
        gaps.push({
          startTime: new Date(lastTimestamp),
          endTime: log.timestamp,
          duration: gap
        });
      }
      lastTimestamp = log.timestamp.getTime();
    });

    // Check gap to end date
    const finalGap = endDate.getTime() - lastTimestamp;
    if (finalGap > expectedInterval * 24) {
      gaps.push({
        startTime: new Date(lastTimestamp),
        endTime: endDate,
        duration: finalGap
      });
    }

    return gaps;
  }

  private calculateComplianceScore(violations: ComplianceViolation[], totalLogs: number): number {
    let score = 100;
    
    violations.forEach(violation => {
      switch (violation.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    // Bonus for having sufficient audit coverage
    if (totalLogs > 1000) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async triggerSecurityAlert(alertType: string, logEntry: AccessAuditLog): Promise<void> {
    // Would integrate with alerting system
    console.warn(`Security alert: ${alertType}`, {
      caregiverId: logEntry.caregiverId,
      timestamp: logEntry.timestamp,
      details: logEntry.details
    });
  }

  private convertToCSV(logs: AccessAuditLog[]): string {
    const headers = ['ID', 'Caregiver ID', 'Action', 'Resource', 'Timestamp', 'Success', 'IP Address', 'User Agent', 'Details'];
    const rows = logs.map(log => [
      log.id,
      log.caregiverId,
      log.action,
      log.resource,
      log.timestamp.toISOString(),
      log.success.toString(),
      log.ipAddress || '',
      log.userAgent || '',
      JSON.stringify(log.details || {})
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  private async cleanupOldLogs(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.retentionPeriod * 24 * 60 * 60 * 1000);
    const purgedCount = await this.storage.purge(cutoffDate);
    
    if (purgedCount > 0) {
      console.log(`Purged ${purgedCount} old audit logs older than ${cutoffDate.toISOString()}`);
    }
  }

  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Interfaces and types for audit analysis
interface AuditAlertThresholds {
  maxFailedAttempts: number;
  maxSessionDuration: number; // in milliseconds
  maxUnusualAccessHours: number;
}

const DEFAULT_ALERT_THRESHOLDS: AuditAlertThresholds = {
  maxFailedAttempts: 5,
  maxSessionDuration: 4 * 60 * 60 * 1000, // 4 hours
  maxUnusualAccessHours: 3
};

interface AccessPatternAnalysis {
  patterns: AccessPattern[];
  suspiciousPatterns: SuspiciousPattern[];
}

interface AccessPattern {
  caregiverId: string;
  totalSessions: number;
  averageSessionDuration: number;
  failureRate: number;
  actionCounts: Record<AuditAction, number>;
  mostCommonAction: AuditAction;
}

interface SuspiciousPattern {
  caregiverId: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
}

interface AuditGap {
  startTime: Date;
  endTime: Date;
  duration: number;
}

interface ComplianceReport {
  period: { startDate: Date; endDate: Date };
  totalLogs: number;
  violations: ComplianceViolation[];
  complianceScore: number;
}

interface ComplianceViolation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  count: number;
  description: string;
}