/**
 * Tests for CaregiverAuthenticator
 */

import { CaregiverAuthenticator } from '../caregiver-auth';
import { ConsentManager } from '../consent-manager';
import { AccessAuditLogger } from '../access-audit-logger';
import {
  CaregiverRole,
  CaregiverRelationship,
  VerificationStatus,
  PermissionType,
  PermissionScope,
  AccessAuditLog,
  ConsentConfiguration
} from '../types';

// Mock implementations
class MockAuditLogger implements AccessAuditLogger {
  logs: AccessAuditLog[] = [];

  async log(entry: Omit<AccessAuditLog, 'id'>): Promise<void> {
    this.logs.push({
      ...entry,
      id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }
}

describe('CaregiverAuthenticator', () => {
  let authenticator: CaregiverAuthenticator;
  let consentManager: ConsentManager;
  let mockAuditLogger: MockAuditLogger;

  beforeEach(() => {
    mockAuditLogger = new MockAuditLogger();
    const config: ConsentConfiguration = {
      requireExplicitConsent: true,
      defaultPermissionDuration: 30,
      maxPermissionDuration: 365,
      allowEmergencyOverride: true,
      requirePeriodicReconfirmation: false,
      reconfirmationInterval: 90
    };
    consentManager = new ConsentManager(mockAuditLogger, config);
    authenticator = new CaregiverAuthenticator(consentManager, mockAuditLogger);
  });

  describe('registerCaregiver', () => {
    it('should register a new caregiver successfully', async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');

      expect(caregiver.name).toBe('John Doe');
      expect(caregiver.email).toBe('john@example.com');
      expect(caregiver.verificationStatus).toBe(VerificationStatus.PENDING);
      expect(caregiver.id).toBeDefined();
      expect(caregiver.createdAt).toBeInstanceOf(Date);
    });

    it('should log caregiver registration', async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      await authenticator.registerCaregiver(caregiverData, 'user_123');

      const registrationLog = mockAuditLogger.logs.find(log => 
        log.resource === 'caregiver_registration'
      );
      expect(registrationLog).toBeDefined();
      expect(registrationLog?.details?.invitedBy).toBe('user_123');
      expect(registrationLog?.success).toBe(true);
    });

    it('should emit caregiverRegistered event', async () => {
      const eventSpy = jest.fn();
      authenticator.on('caregiverRegistered', eventSpy);

      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');

      expect(eventSpy).toHaveBeenCalledWith({
        caregiver,
        invitedBy: 'user_123'
      });
    });
  });

  describe('verifyCaregiver', () => {
    let caregiverId: string;

    beforeEach(async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');
      caregiverId = caregiver.id;
    });

    it('should verify caregiver with valid code', async () => {
      // Mock the verification code (in real implementation, this would be sent via email/SMS)
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        attempts: 0
      });

      const verified = await authenticator.verifyCaregiver(caregiverId, mockCode);

      expect(verified).toBe(true);
      
      const caregiver = authenticator.getCaregiver(caregiverId);
      expect(caregiver?.verificationStatus).toBe(VerificationStatus.VERIFIED);
    });

    it('should reject invalid verification code', async () => {
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });

      const verified = await authenticator.verifyCaregiver(caregiverId, 'WRONG123');

      expect(verified).toBe(false);
      
      const failureLog = mockAuditLogger.logs.find(log => 
        log.resource === 'verification_failure' && log.details?.reason === 'invalid_code'
      );
      expect(failureLog).toBeDefined();
    });

    it('should reject expired verification code', async () => {
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago (expired)
        attempts: 0
      });

      const verified = await authenticator.verifyCaregiver(caregiverId, mockCode);

      expect(verified).toBe(false);
      
      const failureLog = mockAuditLogger.logs.find(log => 
        log.resource === 'verification_failure' && log.details?.reason === 'expired_code'
      );
      expect(failureLog).toBeDefined();
    });

    it('should emit caregiverVerified event', async () => {
      const eventSpy = jest.fn();
      authenticator.on('caregiverVerified', eventSpy);

      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });

      await authenticator.verifyCaregiver(caregiverId, mockCode);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: caregiverId,
          verificationStatus: VerificationStatus.VERIFIED
        })
      );
    });
  });

  describe('authenticate', () => {
    let caregiverId: string;
    let caregiverEmail: string;

    beforeEach(async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');
      caregiverId = caregiver.id;
      caregiverEmail = caregiver.email;

      // Verify the caregiver
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(caregiverId, mockCode);
    });

    it('should authenticate verified caregiver with valid credentials', async () => {
      const result = await authenticator.authenticate({
        email: caregiverEmail,
        password: 'validpassword'
      });

      expect(result.success).toBe(true);
      expect(result.caregiver?.id).toBe(caregiverId);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject authentication for non-existent caregiver', async () => {
      const result = await authenticator.authenticate({
        email: 'nonexistent@example.com',
        password: 'password'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      
      const failureLog = mockAuditLogger.logs.find(log => 
        log.resource === 'authentication_failure' && log.details?.reason === 'caregiver_not_found'
      );
      expect(failureLog).toBeDefined();
    });

    it('should reject authentication for unverified caregiver', async () => {
      // Create unverified caregiver
      const unverifiedData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };
      await authenticator.registerCaregiver(unverifiedData, 'user_123');

      const result = await authenticator.authenticate({
        email: 'jane@example.com',
        password: 'password'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account not verified');
    });

    it('should reject authentication with invalid password', async () => {
      const result = await authenticator.authenticate({
        email: caregiverEmail,
        password: 'short' // Less than 8 characters
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      
      const failureLog = mockAuditLogger.logs.find(log => 
        log.resource === 'authentication_failure' && log.details?.reason === 'invalid_password'
      );
      expect(failureLog).toBeDefined();
    });

    it('should require MFA for full access role', async () => {
      // Create caregiver with full access role
      const fullAccessData = {
        name: 'Admin Caregiver',
        email: 'admin@example.com',
        relationship: CaregiverRelationship.PROFESSIONAL_CAREGIVER,
        role: CaregiverRole.FULL_ACCESS
      };
      const adminCaregiver = await authenticator.registerCaregiver(fullAccessData, 'user_123');
      
      // Verify admin caregiver
      const mockCode = 'XYZ98765';
      (authenticator as any).verificationCodes.set(adminCaregiver.id, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(adminCaregiver.id, mockCode);

      const result = await authenticator.authenticate({
        email: 'admin@example.com',
        password: 'validpassword'
        // No MFA code provided
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('MFA required');
    });

    it('should authenticate with valid MFA code', async () => {
      // Create caregiver with full access role
      const fullAccessData = {
        name: 'Admin Caregiver',
        email: 'admin@example.com',
        relationship: CaregiverRelationship.PROFESSIONAL_CAREGIVER,
        role: CaregiverRole.FULL_ACCESS
      };
      const adminCaregiver = await authenticator.registerCaregiver(fullAccessData, 'user_123');
      
      // Verify admin caregiver
      const mockCode = 'XYZ98765';
      (authenticator as any).verificationCodes.set(adminCaregiver.id, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(adminCaregiver.id, mockCode);

      const result = await authenticator.authenticate({
        email: 'admin@example.com',
        password: 'validpassword',
        mfaCode: '123456' // Valid 6-digit MFA code
      });

      expect(result.success).toBe(true);
      expect(result.caregiver?.id).toBe(adminCaregiver.id);
    });

    it('should log successful authentication', async () => {
      await authenticator.authenticate({
        email: caregiverEmail,
        password: 'validpassword'
      });

      const successLog = mockAuditLogger.logs.find(log => 
        log.resource === 'authentication_success'
      );
      expect(successLog).toBeDefined();
      expect(successLog?.caregiverId).toBe(caregiverId);
      expect(successLog?.success).toBe(true);
    });

    it('should emit caregiverAuthenticated event', async () => {
      const eventSpy = jest.fn();
      authenticator.on('caregiverAuthenticated', eventSpy);

      const result = await authenticator.authenticate({
        email: caregiverEmail,
        password: 'validpassword'
      });

      expect(eventSpy).toHaveBeenCalledWith({
        caregiver: result.caregiver,
        session: expect.objectContaining({
          caregiverId,
          token: result.token
        })
      });
    });
  });

  describe('validateSession', () => {
    let token: string;
    let caregiverId: string;

    beforeEach(async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');
      caregiverId = caregiver.id;

      // Verify and authenticate
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(caregiverId, mockCode);

      const authResult = await authenticator.authenticate({
        email: 'john@example.com',
        password: 'validpassword'
      });
      token = authResult.token!;
    });

    it('should validate active session token', async () => {
      const caregiver = await authenticator.validateSession(token);

      expect(caregiver).toBeDefined();
      expect(caregiver?.id).toBe(caregiverId);
    });

    it('should return null for invalid token', async () => {
      const caregiver = await authenticator.validateSession('invalid_token');

      expect(caregiver).toBeNull();
    });

    it('should return null for expired session', async () => {
      // Manually expire the session
      const sessions = (authenticator as any).sessions;
      for (const [sessionId, session] of sessions.entries()) {
        if (session.token === token) {
          session.expiresAt = new Date(Date.now() - 1000); // 1 second ago
          sessions.set(sessionId, session);
          break;
        }
      }

      const caregiver = await authenticator.validateSession(token);

      expect(caregiver).toBeNull();
    });
  });

  describe('authorize', () => {
    let caregiverId: string;

    beforeEach(async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');
      caregiverId = caregiver.id;

      // Verify caregiver
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(caregiverId, mockCode);

      // Grant consent for activity summary
      const permissions = [{
        type: PermissionType.VIEW_ACTIVITY_SUMMARY,
        scope: PermissionScope.DAILY_SUMMARY,
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }];

      const request = await consentManager.createConsentRequest(
        caregiverId,
        permissions,
        CaregiverRole.DAILY_MONITOR
      );
      await consentManager.approveConsentRequest(request.id, 'user_123');
    });

    it('should authorize caregiver with proper consent and role', async () => {
      const authorized = await authenticator.authorize(
        caregiverId,
        PermissionType.VIEW_ACTIVITY_SUMMARY,
        PermissionScope.DAILY_SUMMARY
      );

      expect(authorized).toBe(true);
    });

    it('should deny authorization without consent', async () => {
      const authorized = await authenticator.authorize(
        caregiverId,
        PermissionType.VIEW_HEALTH_DATA // Not granted
      );

      expect(authorized).toBe(false);
      
      const denialLog = mockAuditLogger.logs.find(log => 
        log.success === false && log.details?.reason === 'no_consent'
      );
      expect(denialLog).toBeDefined();
    });

    it('should deny authorization for insufficient role', async () => {
      // First grant consent for MODIFY_SETTINGS to test role-based denial
      const modifyPermissions = [{
        type: PermissionType.MODIFY_SETTINGS,
        scope: PermissionScope.FULL_ACCESS,
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }];

      const modifyRequest = await consentManager.createConsentRequest(
        caregiverId,
        modifyPermissions,
        CaregiverRole.DAILY_MONITOR
      );
      await consentManager.approveConsentRequest(modifyRequest.id, 'user_123');

      // Try to access something that requires higher role
      const authorized = await authenticator.authorize(
        caregiverId,
        PermissionType.MODIFY_SETTINGS // Requires FULL_ACCESS role, but caregiver has DAILY_MONITOR
      );

      expect(authorized).toBe(false);
      
      const denialLog = mockAuditLogger.logs.find(log => 
        log.success === false && log.details?.reason === 'insufficient_role'
      );
      expect(denialLog).toBeDefined();
    });

    it('should deny authorization for unverified caregiver', async () => {
      // Create unverified caregiver
      const unverifiedData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };
      const unverifiedCaregiver = await authenticator.registerCaregiver(unverifiedData, 'user_123');

      const authorized = await authenticator.authorize(
        unverifiedCaregiver.id,
        PermissionType.VIEW_ACTIVITY_SUMMARY
      );

      expect(authorized).toBe(false);
    });
  });

  describe('logout', () => {
    let token: string;

    beforeEach(async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');

      // Verify and authenticate
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiver.id, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(caregiver.id, mockCode);

      const authResult = await authenticator.authenticate({
        email: 'john@example.com',
        password: 'validpassword'
      });
      token = authResult.token!;
    });

    it('should logout successfully with valid token', async () => {
      const loggedOut = await authenticator.logout(token);

      expect(loggedOut).toBe(true);
      
      // Session should be invalidated
      const caregiver = await authenticator.validateSession(token);
      expect(caregiver).toBeNull();
    });

    it('should return false for invalid token', async () => {
      const loggedOut = await authenticator.logout('invalid_token');

      expect(loggedOut).toBe(false);
    });

    it('should log logout event', async () => {
      await authenticator.logout(token);

      const logoutLog = mockAuditLogger.logs.find(log => 
        log.action === 'logout' && log.resource === 'session'
      );
      expect(logoutLog).toBeDefined();
      expect(logoutLog?.success).toBe(true);
    });

    it('should emit caregiverLoggedOut event', async () => {
      const eventSpy = jest.fn();
      authenticator.on('caregiverLoggedOut', eventSpy);

      await authenticator.logout(token);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          token,
          isActive: false
        })
      );
    });
  });

  describe('revokeCaregiver', () => {
    let caregiverId: string;

    beforeEach(async () => {
      const caregiverData = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };

      const caregiver = await authenticator.registerCaregiver(caregiverData, 'user_123');
      caregiverId = caregiver.id;

      // Verify caregiver
      const mockCode = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiverId, {
        code: mockCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(caregiverId, mockCode);
    });

    it('should revoke caregiver access successfully', async () => {
      const revoked = await authenticator.revokeCaregiver(
        caregiverId,
        'user_123',
        'No longer needed'
      );

      expect(revoked).toBe(true);
      
      const caregiver = authenticator.getCaregiver(caregiverId);
      expect(caregiver?.verificationStatus).toBe(VerificationStatus.REVOKED);
    });

    it('should return false for non-existent caregiver', async () => {
      const revoked = await authenticator.revokeCaregiver(
        'non_existent',
        'user_123'
      );

      expect(revoked).toBe(false);
    });

    it('should invalidate all sessions when revoking', async () => {
      // Authenticate to create session
      const authResult = await authenticator.authenticate({
        email: 'john@example.com',
        password: 'validpassword'
      });

      // Verify session is active
      let caregiver = await authenticator.validateSession(authResult.token!);
      expect(caregiver).toBeDefined();

      // Revoke caregiver
      await authenticator.revokeCaregiver(caregiverId, 'user_123');

      // Session should be invalidated
      caregiver = await authenticator.validateSession(authResult.token!);
      expect(caregiver).toBeNull();
    });

    it('should emit caregiverRevoked event', async () => {
      const eventSpy = jest.fn();
      authenticator.on('caregiverRevoked', eventSpy);

      await authenticator.revokeCaregiver(caregiverId, 'user_123', 'Test reason');

      expect(eventSpy).toHaveBeenCalledWith({
        caregiver: expect.objectContaining({
          id: caregiverId,
          verificationStatus: VerificationStatus.REVOKED
        }),
        revokedBy: 'user_123',
        reason: 'Test reason'
      });
    });
  });

  describe('getActiveCaregivers', () => {
    it('should return only verified caregivers', async () => {
      // Create and verify first caregiver
      const caregiver1Data = {
        name: 'John Doe',
        email: 'john@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.DAILY_MONITOR
      };
      const caregiver1 = await authenticator.registerCaregiver(caregiver1Data, 'user_123');
      
      const mockCode1 = 'ABC12345';
      (authenticator as any).verificationCodes.set(caregiver1.id, {
        code: mockCode1,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(caregiver1.id, mockCode1);

      // Create but don't verify second caregiver
      const caregiver2Data = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        relationship: CaregiverRelationship.FAMILY_MEMBER,
        role: CaregiverRole.EMERGENCY_CONTACT
      };
      await authenticator.registerCaregiver(caregiver2Data, 'user_123');

      // Create and revoke third caregiver
      const caregiver3Data = {
        name: 'Bob Smith',
        email: 'bob@example.com',
        relationship: CaregiverRelationship.FRIEND,
        role: CaregiverRole.DAILY_MONITOR
      };
      const caregiver3 = await authenticator.registerCaregiver(caregiver3Data, 'user_123');
      
      const mockCode3 = 'XYZ98765';
      (authenticator as any).verificationCodes.set(caregiver3.id, {
        code: mockCode3,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0
      });
      await authenticator.verifyCaregiver(caregiver3.id, mockCode3);
      await authenticator.revokeCaregiver(caregiver3.id, 'user_123');

      const activeCaregivers = authenticator.getActiveCaregivers();

      expect(activeCaregivers).toHaveLength(1);
      expect(activeCaregivers[0].id).toBe(caregiver1.id);
      expect(activeCaregivers[0].verificationStatus).toBe(VerificationStatus.VERIFIED);
    });
  });
});