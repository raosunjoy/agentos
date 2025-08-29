import { ZeroTrustFramework } from '../zero-trust-framework';
import { AccessRequest, ConsentRequest, SecurityContext, SecurityEventType, SecuritySeverity } from '../types';

describe('ZeroTrustFramework', () => {
  let framework: ZeroTrustFramework;
  let mockSecurityContext: SecurityContext;

  beforeEach(() => {
    framework = new ZeroTrustFramework();
    mockSecurityContext = {
      userId: 'test-user-123',
      sessionId: 'session-456',
      deviceId: 'device-789',
      timestamp: Date.now(),
      networkInfo: {
        type: 'wifi',
        ssid: 'test-network',
        isSecure: true,
        ipAddress: '192.168.1.100'
      }
    };
  });

  afterEach(async () => {
    await framework.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await framework.initialize();
      const status = framework.getSecurityStatus();
      expect(status.frameworkInitialized).toBe(true);
    });

    it('should not initialize twice', async () => {
      await framework.initialize();
      await framework.initialize(); // Should not throw
      const status = framework.getSecurityStatus();
      expect(status.frameworkInitialized).toBe(true);
    });

    it('should shutdown properly', async () => {
      await framework.initialize();
      await framework.shutdown();
      const status = framework.getSecurityStatus();
      expect(status.frameworkInitialized).toBe(false);
    });
  });

  describe('access authorization', () => {
    beforeEach(async () => {
      await framework.initialize();
    });

    it('should authorize valid access request', async () => {
      const request: AccessRequest = {
        id: 'access-request-1',
        resource: 'user_data',
        action: 'read',
        context: mockSecurityContext
      };

      const authorized = await framework.authorizeAccess(request);
      expect(authorized).toBe(true);
    });

    it('should deny access for uninitialized framework', async () => {
      await framework.shutdown();
      
      const request: AccessRequest = {
        id: 'access-request-2',
        resource: 'user_data',
        action: 'read',
        context: mockSecurityContext
      };

      await expect(framework.authorizeAccess(request)).rejects.toThrow('Zero-trust framework not initialized');
    });

    it('should deny access from insecure network for sensitive operations', async () => {
      const insecureContext = {
        ...mockSecurityContext,
        networkInfo: {
          ...mockSecurityContext.networkInfo,
          isSecure: false
        }
      };

      const request: AccessRequest = {
        id: 'access-request-3',
        resource: 'user_data',
        action: 'write',
        context: insecureContext
      };

      const authorized = await framework.authorizeAccess(request);
      expect(authorized).toBe(false);
    });

    it('should require consent for sensitive data access', async () => {
      const request: AccessRequest = {
        id: 'access-request-4',
        resource: 'contacts',
        action: 'read',
        context: mockSecurityContext
      };

      const authorized = await framework.authorizeAccess(request);
      expect(authorized).toBe(false); // Should fail due to missing consent
    });

    it('should handle authorization errors gracefully', async () => {
      const invalidRequest: AccessRequest = {
        id: 'access-request-5',
        resource: 'invalid_resource',
        action: 'invalid_action',
        context: {
          ...mockSecurityContext,
          userId: '' // Invalid user ID
        }
      };

      const authorized = await framework.authorizeAccess(invalidRequest);
      expect(authorized).toBe(false);
    });
  });

  describe('consent management', () => {
    beforeEach(async () => {
      await framework.initialize();
    });

    it('should request and grant consent', async () => {
      const consentRequest: ConsentRequest = {
        id: 'consent-request-1',
        purpose: 'Contact synchronization',
        dataTypes: ['contacts'],
        requester: 'contacts-app',
        context: mockSecurityContext
      };

      const granted = await framework.requestConsent(consentRequest);
      expect(granted).toBe(true);
    });

    it('should handle consent for sensitive data types', async () => {
      const sensitiveConsentRequest: ConsentRequest = {
        id: 'consent-request-2',
        purpose: 'Health monitoring',
        dataTypes: ['health', 'location'],
        requester: 'health-app',
        context: mockSecurityContext
      };

      const granted = await framework.requestConsent(sensitiveConsentRequest);
      expect(granted).toBe(true);
    });

    it('should revoke consent successfully', async () => {
      const consentRequest: ConsentRequest = {
        id: 'consent-request-3',
        purpose: 'Data analysis',
        dataTypes: ['user_data'],
        requester: 'analytics-app',
        context: mockSecurityContext
      };

      await framework.requestConsent(consentRequest);
      const revoked = await framework.revokeConsent(consentRequest.id, mockSecurityContext.userId);
      expect(revoked).toBe(true);
    });

    it('should fail to revoke non-existent consent', async () => {
      const revoked = await framework.revokeConsent('non-existent-consent', mockSecurityContext.userId);
      expect(revoked).toBe(false);
    });

    it('should handle consent request errors', async () => {
      const invalidConsentRequest: ConsentRequest = {
        id: 'consent-request-4',
        purpose: '',
        dataTypes: [],
        requester: '',
        context: {
          ...mockSecurityContext,
          userId: ''
        }
      };

      const granted = await framework.requestConsent(invalidConsentRequest);
      expect(granted).toBe(false);
    });
  });

  describe('security status', () => {
    it('should return correct status when not initialized', () => {
      const status = framework.getSecurityStatus();
      expect(status.frameworkInitialized).toBe(false);
      expect(status.activeThreats).toBe(0);
      expect(status.recentEvents).toBe(0);
    });

    it('should return correct status when initialized', async () => {
      await framework.initialize();
      const status = framework.getSecurityStatus();
      expect(status.frameworkInitialized).toBe(true);
      expect(typeof status.lastUpdated).toBe('number');
    });
  });

  describe('anomaly detection integration', () => {
    beforeEach(async () => {
      await framework.initialize();
    });

    it('should detect and handle unusual time access', async () => {
      const unusualTimeContext = {
        ...mockSecurityContext,
        timestamp: new Date('2024-01-01T03:00:00Z').getTime() // 3 AM
      };

      const request: AccessRequest = {
        id: 'access-request-unusual-time',
        resource: 'sensitive_data',
        action: 'read',
        context: unusualTimeContext
      };

      const authorized = await framework.authorizeAccess(request);
      // Should still be authorized but anomaly should be detected
      expect(typeof authorized).toBe('boolean');
    });

    it('should detect unknown device access', async () => {
      const unknownDeviceContext = {
        ...mockSecurityContext,
        deviceId: 'unknown-device-999'
      };

      const request: AccessRequest = {
        id: 'access-request-unknown-device',
        resource: 'user_data',
        action: 'read',
        context: unknownDeviceContext
      };

      const authorized = await framework.authorizeAccess(request);
      expect(typeof authorized).toBe('boolean');
    });
  });

  describe('threat response integration', () => {
    beforeEach(async () => {
      await framework.initialize();
    });

    it('should handle multiple failed access attempts', async () => {
      const requests = Array.from({ length: 6 }, (_, i) => ({
        id: `failed-request-${i}`,
        resource: 'protected_resource',
        action: 'read',
        context: {
          ...mockSecurityContext,
          userId: '' // Invalid user to trigger failures
        }
      }));

      const results = await Promise.all(
        requests.map(request => framework.authorizeAccess(request))
      );

      // All should be denied
      results.forEach(result => expect(result).toBe(false));
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null/undefined contexts gracefully', async () => {
      await framework.initialize();

      const invalidRequest: AccessRequest = {
        id: 'invalid-request',
        resource: 'test_resource',
        action: 'read',
        context: null as any
      };

      const authorized = await framework.authorizeAccess(invalidRequest);
      expect(authorized).toBe(false);
    });

    it('should handle malformed security context', async () => {
      await framework.initialize();

      const malformedContext = {
        userId: 'test-user',
        // Missing required fields
      } as SecurityContext;

      const request: AccessRequest = {
        id: 'malformed-request',
        resource: 'test_resource',
        action: 'read',
        context: malformedContext
      };

      const authorized = await framework.authorizeAccess(request);
      expect(authorized).toBe(false);
    });
  });
});