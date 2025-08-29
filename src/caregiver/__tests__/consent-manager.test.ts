/**
 * Tests for ConsentManager
 */

import { ConsentManager } from '../consent-manager';
import { AccessAuditLogger } from '../access-audit-logger';
import {
  CaregiverRole,
  PermissionType,
  PermissionScope,
  ConsentStatus,
  ConsentConfiguration,
  CaregiverPermission,
  AccessAuditLog
} from '../types';

// Mock audit logger
class MockAuditLogger implements AccessAuditLogger {
  logs: AccessAuditLog[] = [];

  async log(entry: Omit<AccessAuditLog, 'id'>): Promise<void> {
    this.logs.push({
      ...entry,
      id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }
}

describe('ConsentManager', () => {
  let consentManager: ConsentManager;
  let mockAuditLogger: MockAuditLogger;
  let config: ConsentConfiguration;

  beforeEach(() => {
    mockAuditLogger = new MockAuditLogger();
    config = {
      requireExplicitConsent: true,
      defaultPermissionDuration: 30, // 30 days
      maxPermissionDuration: 365, // 1 year
      allowEmergencyOverride: true,
      requirePeriodicReconfirmation: false,
      reconfirmationInterval: 90 // 90 days
    };
    consentManager = new ConsentManager(mockAuditLogger, config);
  });

  describe('createConsentRequest', () => {
    it('should create a consent request with valid parameters', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR,
        'Please allow me to monitor daily activities'
      );

      expect(request.caregiverId).toBe(caregiverId);
      expect(request.requestedRole).toBe(CaregiverRole.DAILY_MONITOR);
      expect(request.status).toBe(ConsentStatus.PENDING);
      expect(request.requestedPermissions).toHaveLength(1);
      expect(request.message).toBe('Please allow me to monitor daily activities');
    });

    it('should auto-approve emergency contacts when explicit consent not required', async () => {
      config.requireExplicitConsent = false;
      consentManager = new ConsentManager(mockAuditLogger, config);

      const caregiverId = 'emergency_caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.RECEIVE_EMERGENCY_ALERTS,
          scope: PermissionScope.EMERGENCY_ONLY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.EMERGENCY_CONTACT
      );

      expect(request.status).toBe(ConsentStatus.APPROVED);
      expect(consentManager.hasPermission(caregiverId, PermissionType.RECEIVE_EMERGENCY_ALERTS)).toBe(true);
    });

    it('should validate and set expiration dates for permissions', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
          // No expiresAt set
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      const requestedPermission = request.requestedPermissions[0];
      expect(requestedPermission.expiresAt).toBeDefined();
      
      // Should be set to default duration (30 days)
      const expectedExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const actualExpiry = requestedPermission.expiresAt!;
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe('approveConsentRequest', () => {
    it('should approve a valid pending consent request', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      const approved = await consentManager.approveConsentRequest(
        request.id,
        'user_456'
      );

      expect(approved).toBe(true);
      expect(consentManager.hasPermission(caregiverId, PermissionType.VIEW_ACTIVITY_SUMMARY)).toBe(true);
      
      const updatedRequest = consentManager.getConsentRequest(request.id);
      expect(updatedRequest?.status).toBe(ConsentStatus.APPROVED);
    });

    it('should reject approval of expired consent request', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      // Create request with past expiration
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR,
        undefined,
        pastDate
      );

      const approved = await consentManager.approveConsentRequest(
        request.id,
        'user_456'
      );

      expect(approved).toBe(false);
      expect(consentManager.hasPermission(caregiverId, PermissionType.VIEW_ACTIVITY_SUMMARY)).toBe(false);
      
      const updatedRequest = consentManager.getConsentRequest(request.id);
      expect(updatedRequest?.status).toBe(ConsentStatus.EXPIRED);
    });

    it('should throw error for invalid request ID', async () => {
      await expect(
        consentManager.approveConsentRequest('invalid_id', 'user_456')
      ).rejects.toThrow('Invalid or already processed consent request');
    });

    it('should limit permission duration to maximum allowed', async () => {
      const caregiverId = 'caregiver_123';
      const longDuration = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000); // 400 days
      
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date(),
          expiresAt: longDuration
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');
      
      const grantedPermissions = consentManager.getCaregiverPermissions(caregiverId);
      const permission = grantedPermissions[0];
      
      // Should be limited to max duration (365 days)
      const maxExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      expect(permission.expiresAt!.getTime()).toBeLessThanOrEqual(maxExpiry.getTime());
    });
  });

  describe('denyConsentRequest', () => {
    it('should deny a pending consent request', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      const denied = await consentManager.denyConsentRequest(
        request.id,
        'user_456',
        'Privacy concerns'
      );

      expect(denied).toBe(true);
      expect(consentManager.hasPermission(caregiverId, PermissionType.VIEW_ACTIVITY_SUMMARY)).toBe(false);
      
      const updatedRequest = consentManager.getConsentRequest(request.id);
      expect(updatedRequest?.status).toBe(ConsentStatus.DENIED);
    });
  });

  describe('revokeConsent', () => {
    it('should revoke existing consent for a caregiver', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');
      expect(consentManager.hasPermission(caregiverId, PermissionType.VIEW_ACTIVITY_SUMMARY)).toBe(true);

      const revoked = await consentManager.revokeConsent(
        caregiverId,
        'user_456',
        'No longer needed'
      );

      expect(revoked).toBe(true);
      expect(consentManager.hasPermission(caregiverId, PermissionType.VIEW_ACTIVITY_SUMMARY)).toBe(false);
      expect(consentManager.getCaregiverPermissions(caregiverId)).toHaveLength(0);
    });

    it('should return false for non-existent caregiver', async () => {
      const revoked = await consentManager.revokeConsent(
        'non_existent_caregiver',
        'user_456'
      );

      expect(revoked).toBe(false);
    });
  });

  describe('hasPermission', () => {
    beforeEach(async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        {
          type: PermissionType.RECEIVE_EMERGENCY_ALERTS,
          scope: PermissionScope.EMERGENCY_ONLY,
          grantedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');
    });

    it('should return true for granted permissions', () => {
      expect(consentManager.hasPermission(
        'caregiver_123',
        PermissionType.VIEW_ACTIVITY_SUMMARY,
        PermissionScope.DAILY_SUMMARY
      )).toBe(true);

      expect(consentManager.hasPermission(
        'caregiver_123',
        PermissionType.RECEIVE_EMERGENCY_ALERTS
      )).toBe(true);
    });

    it('should return false for non-granted permissions', () => {
      expect(consentManager.hasPermission(
        'caregiver_123',
        PermissionType.VIEW_HEALTH_DATA
      )).toBe(false);

      expect(consentManager.hasPermission(
        'caregiver_123',
        PermissionType.MODIFY_SETTINGS
      )).toBe(false);
    });

    it('should return false for non-existent caregiver', () => {
      expect(consentManager.hasPermission(
        'non_existent',
        PermissionType.VIEW_ACTIVITY_SUMMARY
      )).toBe(false);
    });

    it('should return false for expired permissions', async () => {
      const caregiverId = 'caregiver_expired';
      const expiredPermissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago (expired)
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        expiredPermissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');

      expect(consentManager.hasPermission(
        caregiverId,
        PermissionType.VIEW_ACTIVITY_SUMMARY
      )).toBe(false);
    });
  });

  describe('getPendingConsentRequests', () => {
    it('should return only pending and non-expired requests', async () => {
      // Create pending request
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request1 = await consentManager.createConsentRequest(
        'caregiver_1',
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      // Create and approve another request
      const request2 = await consentManager.createConsentRequest(
        'caregiver_2',
        permissions,
        CaregiverRole.DAILY_MONITOR
      );
      await consentManager.approveConsentRequest(request2.id, 'user_456');

      // Create expired request
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await consentManager.createConsentRequest(
        'caregiver_3',
        permissions,
        CaregiverRole.DAILY_MONITOR,
        undefined,
        expiredDate
      );

      const pendingRequests = consentManager.getPendingConsentRequests();
      
      expect(pendingRequests).toHaveLength(1);
      expect(pendingRequests[0].id).toBe(request1.id);
      expect(pendingRequests[0].status).toBe(ConsentStatus.PENDING);
    });
  });

  describe('audit logging', () => {
    it('should log consent request creation', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      expect(mockAuditLogger.logs).toHaveLength(1);
      expect(mockAuditLogger.logs[0].caregiverId).toBe(caregiverId);
      expect(mockAuditLogger.logs[0].action).toBe('permission_granted');
      expect(mockAuditLogger.logs[0].resource).toBe('consent_request');
    });

    it('should log consent approval', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');

      expect(mockAuditLogger.logs).toHaveLength(2); // Creation + approval
      const approvalLog = mockAuditLogger.logs[1];
      expect(approvalLog.caregiverId).toBe(caregiverId);
      expect(approvalLog.action).toBe('permission_granted');
      expect(approvalLog.resource).toBe('consent_approval');
      expect(approvalLog.details?.approvedBy).toBe('user_456');
    });

    it('should log consent revocation', async () => {
      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');
      await consentManager.revokeConsent(caregiverId, 'user_456', 'Test revocation');

      expect(mockAuditLogger.logs).toHaveLength(3); // Creation + approval + revocation
      const revocationLog = mockAuditLogger.logs[2];
      expect(revocationLog.caregiverId).toBe(caregiverId);
      expect(revocationLog.action).toBe('permission_revoked');
      expect(revocationLog.resource).toBe('consent_revocation');
      expect(revocationLog.details?.reason).toBe('Test revocation');
    });
  });

  describe('event emission', () => {
    it('should emit consentRequestCreated event', async () => {
      const eventSpy = jest.fn();
      consentManager.on('consentRequestCreated', eventSpy);

      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      expect(eventSpy).toHaveBeenCalledWith(request);
    });

    it('should emit consentApproved event', async () => {
      const eventSpy = jest.fn();
      consentManager.on('consentApproved', eventSpy);

      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');

      expect(eventSpy).toHaveBeenCalledWith({
        caregiverId,
        permissions: expect.any(Array),
        approvedBy: 'user_456'
      });
    });

    it('should emit consentRevoked event', async () => {
      const eventSpy = jest.fn();
      consentManager.on('consentRevoked', eventSpy);

      const caregiverId = 'caregiver_123';
      const permissions: CaregiverPermission[] = [
        {
          type: PermissionType.VIEW_ACTIVITY_SUMMARY,
          scope: PermissionScope.DAILY_SUMMARY,
          grantedAt: new Date()
        }
      ];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );

      await consentManager.approveConsentRequest(request.id, 'user_456');
      await consentManager.revokeConsent(caregiverId, 'user_456', 'Test reason');

      expect(eventSpy).toHaveBeenCalledWith({
        caregiverId,
        revokedBy: 'user_456',
        reason: 'Test reason',
        revokedPermissions: expect.any(Array)
      });
    });
  });
});