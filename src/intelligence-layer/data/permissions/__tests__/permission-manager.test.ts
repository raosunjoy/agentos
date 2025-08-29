/**
 * Tests for PermissionManager
 */

import { PermissionManager } from '../permission-manager';
import { PermissionRequest, RequestContext } from '../types';

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let testContext: RequestContext;

  beforeEach(() => {
    permissionManager = new PermissionManager();
    testContext = {
      timestamp: new Date(),
      device: {
        id: 'test-device',
        type: 'mobile',
        trusted: true
      },
      network: {
        type: 'wifi',
        trusted: true
      },
      sessionId: 'test-session'
    };
  });

  describe('Permission Granting', () => {
    it('should grant permission successfully', async () => {
      const permission = await permissionManager.grantPermission(
        'user1',
        'contact',
        'read',
        'admin'
      );

      expect(permission.id).toBeDefined();
      expect(permission.userId).toBe('user1');
      expect(permission.resourceType).toBe('contact');
      expect(permission.action).toBe('read');
      expect(permission.granted).toBe(true);
      expect(permission.grantedBy).toBe('admin');
    });

    it('should grant permission with expiration', async () => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const permission = await permissionManager.grantPermission(
        'user1',
        'contact',
        'read',
        'admin',
        { expiresAt }
      );

      expect(permission.expiresAt).toEqual(expiresAt);
    });

    it('should grant permission with conditions', async () => {
      const conditions = [
        {
          type: 'time_range' as const,
          operator: 'between' as const,
          value: [new Date(), new Date(Date.now() + 3600000)]
        }
      ];

      const permission = await permissionManager.grantPermission(
        'user1',
        'contact',
        'read',
        'admin',
        { conditions }
      );

      expect(permission.conditions).toEqual(conditions);
    });
  });

  describe('Permission Checking', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('user1', 'contact', 'read', 'admin');
    });

    it('should grant access for valid permission', async () => {
      const request: PermissionRequest = {
        userId: 'user1',
        resourceType: 'contact',
        action: 'read',
        context: testContext
      };

      const result = await permissionManager.checkPermission(request);
      expect(result.granted).toBe(true);
      expect(result.reason).toContain('granted');
    });

    it('should deny access for non-existent permission', async () => {
      const request: PermissionRequest = {
        userId: 'user2',
        resourceType: 'contact',
        action: 'read',
        context: testContext
      };

      const result = await permissionManager.checkPermission(request);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('No applicable permissions');
    });

    it('should deny access for wrong action', async () => {
      const request: PermissionRequest = {
        userId: 'user1',
        resourceType: 'contact',
        action: 'delete',
        context: testContext
      };

      const result = await permissionManager.checkPermission(request);
      expect(result.granted).toBe(false);
    });

    it('should deny access for expired permission', async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      await permissionManager.grantPermission(
        'user2',
        'contact',
        'read',
        'admin',
        { expiresAt: expiredDate }
      );

      const request: PermissionRequest = {
        userId: 'user2',
        resourceType: 'contact',
        action: 'read',
        context: testContext
      };

      const result = await permissionManager.checkPermission(request);
      expect(result.granted).toBe(false);
    });
  });

  describe('Permission Revocation', () => {
    it('should revoke specific permission', async () => {
      const permission = await permissionManager.grantPermission(
        'user1',
        'contact',
        'read',
        'admin'
      );

      const revoked = await permissionManager.revokePermission(permission.id, 'admin');
      expect(revoked).toBe(true);

      const userPermissions = permissionManager.getUserPermissions('user1');
      expect(userPermissions).toHaveLength(0);
    });

    it('should revoke all permissions for resource type', async () => {
      await permissionManager.grantPermission('user1', 'contact', 'read', 'admin');
      await permissionManager.grantPermission('user1', 'contact', 'write', 'admin');
      await permissionManager.grantPermission('user1', 'event', 'read', 'admin');

      const revokedCount = await permissionManager.revokeAllPermissions(
        'user1',
        'contact',
        'admin'
      );

      expect(revokedCount).toBe(2);
      
      const userPermissions = permissionManager.getUserPermissions('user1');
      expect(userPermissions).toHaveLength(1);
      expect(userPermissions[0].resourceType).toBe('event');
    });

    it('should return false when revoking non-existent permission', async () => {
      const revoked = await permissionManager.revokePermission('non-existent', 'admin');
      expect(revoked).toBe(false);
    });
  });

  describe('Consent Management', () => {
    it('should record user consent', async () => {
      const consent = await permissionManager.recordConsent(
        'user1',
        'health_data',
        'medical_analysis',
        true
      );

      expect(consent.id).toBeDefined();
      expect(consent.userId).toBe('user1');
      expect(consent.resourceType).toBe('health_data');
      expect(consent.purpose).toBe('medical_analysis');
      expect(consent.granted).toBe(true);
    });

    it('should check consent existence', async () => {
      await permissionManager.recordConsent(
        'user1',
        'health_data',
        'medical_analysis',
        true
      );

      const hasConsent = permissionManager.hasConsent(
        'user1',
        'health_data',
        'medical_analysis'
      );
      expect(hasConsent).toBe(true);
    });

    it('should revoke consent', async () => {
      const consent = await permissionManager.recordConsent(
        'user1',
        'health_data',
        'medical_analysis',
        true
      );

      const revoked = await permissionManager.revokeConsent(consent.id, 'user1');
      expect(revoked).toBe(true);

      const hasConsent = permissionManager.hasConsent(
        'user1',
        'health_data',
        'medical_analysis'
      );
      expect(hasConsent).toBe(false);
    });

    it('should handle expired consent', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      await permissionManager.recordConsent(
        'user1',
        'health_data',
        'medical_analysis',
        true,
        expiredDate
      );

      const hasConsent = permissionManager.hasConsent(
        'user1',
        'health_data',
        'medical_analysis'
      );
      expect(hasConsent).toBe(false);
    });
  });

  describe('Permission Queries', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('user1', 'contact', 'read', 'admin');
      await permissionManager.grantPermission('user1', 'contact', 'write', 'admin');
      await permissionManager.grantPermission('user1', 'event', 'read', 'admin');
    });

    it('should get all user permissions', () => {
      const permissions = permissionManager.getUserPermissions('user1');
      expect(permissions).toHaveLength(3);
    });

    it('should get permissions for specific resource type', () => {
      const contactPermissions = permissionManager.getResourcePermissions('user1', 'contact');
      expect(contactPermissions).toHaveLength(2);
      expect(contactPermissions.every(p => p.resourceType === 'contact')).toBe(true);
    });

    it('should return empty array for non-existent user', () => {
      const permissions = permissionManager.getUserPermissions('non-existent');
      expect(permissions).toHaveLength(0);
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up expired permissions and consents', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      
      // Add expired permission
      await permissionManager.grantPermission(
        'user1',
        'contact',
        'read',
        'admin',
        { expiresAt: expiredDate }
      );
      
      // Add valid permission
      await permissionManager.grantPermission('user1', 'event', 'read', 'admin');
      
      // Add expired consent
      await permissionManager.recordConsent(
        'user1',
        'health_data',
        'analysis',
        true,
        expiredDate
      );

      const result = await permissionManager.cleanupExpired();
      
      expect(result.permissions).toBe(1);
      expect(result.consents).toBe(1);
      
      const remainingPermissions = permissionManager.getUserPermissions('user1');
      expect(remainingPermissions).toHaveLength(1);
      expect(remainingPermissions[0].resourceType).toBe('event');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      await permissionManager.grantPermission('user1', 'contact', 'read', 'admin');
      await permissionManager.grantPermission(
        'user1',
        'event',
        'read',
        'admin',
        { expiresAt: new Date(Date.now() - 1000) } // expired
      );
      await permissionManager.recordConsent('user1', 'health_data', 'analysis', true);

      const stats = permissionManager.getStats();
      
      expect(stats.totalPermissions).toBe(2);
      expect(stats.activePermissions).toBe(1);
      expect(stats.expiredPermissions).toBe(1);
      expect(stats.totalConsents).toBe(1);
    });
  });
});