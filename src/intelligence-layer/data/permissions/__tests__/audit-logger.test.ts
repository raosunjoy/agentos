/**
 * Tests for AuditLogger
 */

import { AuditLogger } from '../audit-logger';
import { Permission, PermissionRequest, PermissionEvaluationResult, ConsentRecord } from '../types';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let testPermission: Permission;
  let testRequest: PermissionRequest;
  let testConsent: ConsentRecord;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    
    testPermission = {
      id: 'perm-123',
      userId: 'user1',
      resourceType: 'contact',
      action: 'read',
      granted: true,
      grantedBy: 'admin',
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000)
    };

    testRequest = {
      userId: 'user1',
      resourceType: 'contact',
      action: 'read',
      context: {
        timestamp: new Date(),
        sessionId: 'session-123'
      }
    };

    testConsent = {
      id: 'consent-123',
      userId: 'user1',
      resourceType: 'health_data',
      purpose: 'medical_analysis',
      granted: true,
      grantedAt: new Date()
    };
  });

  describe('Permission Logging', () => {
    it('should log permission grant', async () => {
      await auditLogger.logPermissionGrant(testPermission);
      
      const userLog = auditLogger.getUserAuditLog('user1');
      expect(userLog).toHaveLength(1);
      
      const entry = userLog[0];
      expect(entry.userId).toBe('user1');
      expect(entry.action).toBe('grant_permission_read');
      expect(entry.resourceType).toBe('contact');
      expect(entry.result).toBe('granted');
      expect(entry.metadata?.permissionId).toBe('perm-123');
      expect(entry.metadata?.grantedBy).toBe('admin');
    });

    it('should log permission revocation', async () => {
      await auditLogger.logPermissionRevocation(testPermission, 'admin');
      
      const userLog = auditLogger.getUserAuditLog('user1');
      expect(userLog).toHaveLength(1);
      
      const entry = userLog[0];
      expect(entry.action).toBe('revoke_permission_read');
      expect(entry.result).toBe('revoked');
      expect(entry.metadata?.revokedBy).toBe('admin');
      expect(entry.metadata?.permissionId).toBe('perm-123');
    });

    it('should log permission check with granted result', async () => {
      const result: PermissionEvaluationResult = {
        granted: true,
        reason: 'Permission granted',
        auditRequired: true
      };

      await auditLogger.logPermissionCheck(testRequest, result);
      
      const userLog = auditLogger.getUserAuditLog('user1');
      expect(userLog).toHaveLength(1);
      
      const entry = userLog[0];
      expect(entry.action).toBe('check_permission_read');
      expect(entry.result).toBe('granted');
      expect(entry.reason).toBe('Permission granted');
    });

    it('should log permission check with denied result', async () => {
      const result: PermissionEvaluationResult = {
        granted: false,
        reason: 'No applicable permissions',
        auditRequired: true
      };

      await auditLogger.logPermissionCheck(testRequest, result);
      
      const userLog = auditLogger.getUserAuditLog('user1');
      expect(userLog).toHaveLength(1);
      
      const entry = userLog[0];
      expect(entry.result).toBe('denied');
      expect(entry.reason).toBe('No applicable permissions');
    });
  });

  describe('Consent Logging', () => {
    it('should log consent record', async () => {
      await auditLogger.logConsentRecord(testConsent);
      
      const userLog = auditLogger.getUserAuditLog('user1');
      expect(userLog).toHaveLength(1);
      
      const entry = userLog[0];
      expect(entry.action).toBe('record_consent');
      expect(entry.resourceType).toBe('health_data');
      expect(entry.result).toBe('granted');
      expect(entry.metadata?.consentId).toBe('consent-123');
      expect(entry.metadata?.purpose).toBe('medical_analysis');
    });

    it('should log consent revocation', async () => {
      const revokedConsent = {
        ...testConsent,
        revokedAt: new Date(),
        revokedBy: 'user1'
      };

      await auditLogger.logConsentRevocation(revokedConsent);
      
      const userLog = auditLogger.getUserAuditLog('user1');
      expect(userLog).toHaveLength(1);
      
      const entry = userLog[0];
      expect(entry.action).toBe('revoke_consent');
      expect(entry.result).toBe('revoked');
      expect(entry.metadata?.revokedBy).toBe('user1');
    });

    it('should log denied consent', async () => {
      const deniedConsent = { ...testConsent, granted: false };
      
      await auditLogger.logConsentRecord(deniedConsent);
      
      const userLog = auditLogger.getUserAuditLog('user1');
      expect(userLog).toHaveLength(1);
      
      const entry = userLog[0];
      expect(entry.result).toBe('denied');
      expect(entry.reason).toContain('denied');
    });
  });

  describe('Audit Log Queries', () => {
    beforeEach(async () => {
      // Add multiple log entries
      await auditLogger.logPermissionGrant(testPermission);
      await auditLogger.logPermissionRevocation(testPermission, 'admin');
      await auditLogger.logConsentRecord(testConsent);
      
      // Add entries for different user
      const otherPermission = { ...testPermission, userId: 'user2' };
      await auditLogger.logPermissionGrant(otherPermission);
    });

    it('should get user audit log', () => {
      const user1Log = auditLogger.getUserAuditLog('user1');
      const user2Log = auditLogger.getUserAuditLog('user2');
      
      expect(user1Log).toHaveLength(3);
      expect(user2Log).toHaveLength(1);
      expect(user1Log.every(entry => entry.userId === 'user1')).toBe(true);
    });

    it('should get user audit log with limit', () => {
      const limitedLog = auditLogger.getUserAuditLog('user1', 2);
      expect(limitedLog).toHaveLength(2);
    });

    it('should get resource audit log', () => {
      const contactLog = auditLogger.getResourceAuditLog('contact');
      const healthLog = auditLogger.getResourceAuditLog('health_data');
      
      expect(contactLog).toHaveLength(3); // 2 for user1, 1 for user2
      expect(healthLog).toHaveLength(1);
    });

    it('should get audit log by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneHourFromNow = new Date(now.getTime() + 3600000);
      
      const recentLog = auditLogger.getAuditLogByTimeRange(oneHourAgo, oneHourFromNow);
      expect(recentLog.length).toBeGreaterThan(0);
      
      const futureLog = auditLogger.getAuditLogByTimeRange(oneHourFromNow, new Date(oneHourFromNow.getTime() + 3600000));
      expect(futureLog).toHaveLength(0);
    });

    it('should get audit log by action', () => {
      const grantLog = auditLogger.getAuditLogByAction('grant_permission');
      const revokeLog = auditLogger.getAuditLogByAction('revoke');
      
      expect(grantLog).toHaveLength(2);
      expect(revokeLog).toHaveLength(1);
    });

    it('should get failed attempts', () => {
      // Add a denied permission check
      const deniedResult: PermissionEvaluationResult = {
        granted: false,
        reason: 'Access denied',
        auditRequired: true
      };
      
      auditLogger.logPermissionCheck(testRequest, deniedResult);
      
      const failedAttempts = auditLogger.getFailedAttempts();
      expect(failedAttempts).toHaveLength(1);
      expect(failedAttempts[0].result).toBe('denied');
    });

    it('should get failed attempts for specific user', () => {
      const deniedResult: PermissionEvaluationResult = {
        granted: false,
        reason: 'Access denied',
        auditRequired: true
      };
      
      auditLogger.logPermissionCheck(testRequest, deniedResult);
      
      const user1Failures = auditLogger.getFailedAttempts('user1');
      const user2Failures = auditLogger.getFailedAttempts('user2');
      
      expect(user1Failures).toHaveLength(1);
      expect(user2Failures).toHaveLength(0);
    });
  });

  describe('Audit Statistics', () => {
    beforeEach(async () => {
      await auditLogger.logPermissionGrant(testPermission);
      await auditLogger.logPermissionRevocation(testPermission, 'admin');
      await auditLogger.logConsentRecord(testConsent);
      
      const deniedResult: PermissionEvaluationResult = {
        granted: false,
        reason: 'Access denied',
        auditRequired: true
      };
      await auditLogger.logPermissionCheck(testRequest, deniedResult);
    });

    it('should provide accurate statistics', () => {
      const stats = auditLogger.getAuditStats();
      
      expect(stats.totalEntries).toBe(4);
      expect(stats.entriesByResult.granted).toBe(2);
      expect(stats.entriesByResult.revoked).toBe(1);
      expect(stats.entriesByResult.denied).toBe(1);
      expect(stats.entriesByResourceType.contact).toBe(3);
      expect(stats.entriesByResourceType.health_data).toBe(1);
      expect(stats.recentActivity).toBe(4); // All entries are recent
    });
  });

  describe('Export and Maintenance', () => {
    beforeEach(async () => {
      await auditLogger.logPermissionGrant(testPermission);
      await auditLogger.logConsentRecord(testConsent);
    });

    it('should export audit log as JSON', () => {
      const jsonExport = auditLogger.exportAuditLog('json');
      const parsed = JSON.parse(jsonExport);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0]).toHaveProperty('timestamp');
      expect(parsed[0]).toHaveProperty('userId');
    });

    it('should export audit log as CSV', () => {
      const csvExport = auditLogger.exportAuditLog('csv');
      const lines = csvExport.split('\n');
      
      expect(lines[0]).toContain('id,timestamp,userId'); // Header
      expect(lines).toHaveLength(3); // Header + 2 entries
    });

    it('should clear old entries', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const clearedCount = auditLogger.clearOldEntries(futureDate);
      
      expect(clearedCount).toBe(2);
      expect(auditLogger.getLogSize()).toBe(0);
    });

    it('should manage log size', () => {
      auditLogger.setMaxLogSize(1);
      
      // Add another entry, should remove the oldest
      auditLogger.logPermissionGrant({ ...testPermission, id: 'perm-456' });
      
      expect(auditLogger.getLogSize()).toBe(1);
    });

    it('should get current log size', () => {
      expect(auditLogger.getLogSize()).toBe(2);
    });
  });
});