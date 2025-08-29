/**
 * Audit logging for permission system
 */

import { 
  Permission, 
  PermissionRequest, 
  PermissionEvaluationResult, 
  ConsentRecord, 
  AuditLogEntry 
} from './types';

export class AuditLogger {
  private auditLog: AuditLogEntry[] = [];
  private maxLogSize: number = 10000;

  /**
   * Log permission grant
   */
  async logPermissionGrant(permission: Permission): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: permission.userId,
      action: `grant_permission_${permission.action}`,
      resourceType: permission.resourceType,
      resourceId: permission.resourceId,
      result: 'granted',
      reason: `Permission granted by ${permission.grantedBy}`,
      context: {
        timestamp: new Date(),
        sessionId: 'system'
      },
      metadata: {
        permissionId: permission.id,
        grantedBy: permission.grantedBy,
        expiresAt: permission.expiresAt,
        conditions: permission.conditions
      }
    };

    this.addLogEntry(entry);
  }

  /**
   * Log permission revocation
   */
  async logPermissionRevocation(permission: Permission, revokedBy: string): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: permission.userId,
      action: `revoke_permission_${permission.action}`,
      resourceType: permission.resourceType,
      resourceId: permission.resourceId,
      result: 'revoked',
      reason: `Permission revoked by ${revokedBy}`,
      context: {
        timestamp: new Date(),
        sessionId: 'system'
      },
      metadata: {
        permissionId: permission.id,
        revokedBy,
        originallyGrantedBy: permission.grantedBy,
        originallyGrantedAt: permission.grantedAt
      }
    };

    this.addLogEntry(entry);
  }

  /**
   * Log permission check
   */
  async logPermissionCheck(
    request: PermissionRequest, 
    result: PermissionEvaluationResult
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: request.userId,
      action: `check_permission_${request.action}`,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      result: result.granted ? 'granted' : 'denied',
      reason: result.reason,
      context: request.context,
      metadata: {
        purpose: request.purpose,
        conditions: result.conditions,
        expiresAt: result.expiresAt
      }
    };

    this.addLogEntry(entry);
  }

  /**
   * Log consent record
   */
  async logConsentRecord(consent: ConsentRecord): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: consent.userId,
      action: 'record_consent',
      resourceType: consent.resourceType,
      result: consent.granted ? 'granted' : 'denied',
      reason: `Consent ${consent.granted ? 'granted' : 'denied'} for ${consent.purpose}`,
      context: {
        timestamp: new Date(),
        sessionId: 'system'
      },
      metadata: {
        consentId: consent.id,
        purpose: consent.purpose,
        expiresAt: consent.expiresAt
      }
    };

    this.addLogEntry(entry);
  }

  /**
   * Log consent revocation
   */
  async logConsentRevocation(consent: ConsentRecord): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: consent.userId,
      action: 'revoke_consent',
      resourceType: consent.resourceType,
      result: 'revoked',
      reason: `Consent revoked by ${consent.revokedBy}`,
      context: {
        timestamp: new Date(),
        sessionId: 'system'
      },
      metadata: {
        consentId: consent.id,
        purpose: consent.purpose,
        revokedBy: consent.revokedBy,
        revokedAt: consent.revokedAt,
        originallyGrantedAt: consent.grantedAt
      }
    };

    this.addLogEntry(entry);
  }

  /**
   * Get audit log entries for a user
   */
  getUserAuditLog(userId: string, limit?: number): AuditLogEntry[] {
    const userEntries = this.auditLog
      .filter(entry => entry.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? userEntries.slice(0, limit) : userEntries;
  }

  /**
   * Get audit log entries for a resource
   */
  getResourceAuditLog(resourceType: string, resourceId?: string, limit?: number): AuditLogEntry[] {
    const resourceEntries = this.auditLog
      .filter(entry => 
        entry.resourceType === resourceType &&
        (!resourceId || entry.resourceId === resourceId)
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? resourceEntries.slice(0, limit) : resourceEntries;
  }

  /**
   * Get audit log entries within a time range
   */
  getAuditLogByTimeRange(startTime: Date, endTime: Date): AuditLogEntry[] {
    return this.auditLog
      .filter(entry => 
        entry.timestamp >= startTime && entry.timestamp <= endTime
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get audit log entries by action type
   */
  getAuditLogByAction(action: string, limit?: number): AuditLogEntry[] {
    const actionEntries = this.auditLog
      .filter(entry => entry.action.includes(action))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? actionEntries.slice(0, limit) : actionEntries;
  }

  /**
   * Get failed permission attempts
   */
  getFailedAttempts(userId?: string, limit?: number): AuditLogEntry[] {
    const failedEntries = this.auditLog
      .filter(entry => 
        entry.result === 'denied' &&
        (!userId || entry.userId === userId)
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? failedEntries.slice(0, limit) : failedEntries;
  }

  /**
   * Get audit statistics
   */
  getAuditStats(): {
    totalEntries: number;
    entriesByResult: Record<string, number>;
    entriesByAction: Record<string, number>;
    entriesByResourceType: Record<string, number>;
    recentActivity: number;
  } {
    const stats = {
      totalEntries: this.auditLog.length,
      entriesByResult: {} as Record<string, number>,
      entriesByAction: {} as Record<string, number>,
      entriesByResourceType: {} as Record<string, number>,
      recentActivity: 0
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const entry of this.auditLog) {
      // Count by result
      stats.entriesByResult[entry.result] = (stats.entriesByResult[entry.result] || 0) + 1;
      
      // Count by action
      stats.entriesByAction[entry.action] = (stats.entriesByAction[entry.action] || 0) + 1;
      
      // Count by resource type
      stats.entriesByResourceType[entry.resourceType] = 
        (stats.entriesByResourceType[entry.resourceType] || 0) + 1;
      
      // Count recent activity
      if (entry.timestamp > oneDayAgo) {
        stats.recentActivity++;
      }
    }

    return stats;
  }

  /**
   * Export audit log for compliance
   */
  exportAuditLog(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'id', 'timestamp', 'userId', 'action', 'resourceType', 
        'resourceId', 'result', 'reason'
      ];
      
      const rows = this.auditLog.map(entry => [
        entry.id,
        entry.timestamp.toISOString(),
        entry.userId,
        entry.action,
        entry.resourceType,
        entry.resourceId || '',
        entry.result,
        entry.reason
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(this.auditLog, null, 2);
  }

  /**
   * Clear old audit log entries
   */
  clearOldEntries(olderThan: Date): number {
    const initialLength = this.auditLog.length;
    this.auditLog = this.auditLog.filter(entry => entry.timestamp > olderThan);
    return initialLength - this.auditLog.length;
  }

  /**
   * Add log entry and manage log size
   */
  private addLogEntry(entry: AuditLogEntry): void {
    this.auditLog.push(entry);
    
    // Maintain maximum log size
    if (this.auditLog.length > this.maxLogSize) {
      // Remove oldest entries
      const toRemove = this.auditLog.length - this.maxLogSize;
      this.auditLog.splice(0, toRemove);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set maximum log size
   */
  setMaxLogSize(size: number): void {
    this.maxLogSize = size;
    
    // Trim current log if necessary
    if (this.auditLog.length > size) {
      const toRemove = this.auditLog.length - size;
      this.auditLog.splice(0, toRemove);
    }
  }

  /**
   * Get current log size
   */
  getLogSize(): number {
    return this.auditLog.length;
  }
}