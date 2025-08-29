import { ConsentManager } from '../consent-manager';
import { ConsentRequest, SecurityContext } from '../types';

describe('ConsentManager', () => {
  let consentManager: ConsentManager;
  let mockSecurityContext: SecurityContext;

  beforeEach(() => {
    consentManager = new ConsentManager();
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

  describe('consent request handling', () => {
    it('should grant consent for non-sensitive data', async () => {
      const request: ConsentRequest = {
        id: 'consent-1',
        purpose: 'App functionality',
        dataTypes: ['user_preferences'],
        requester: 'test-app',
        context: mockSecurityContext
      };

      const decision = await consentManager.requestConsent(request);
      expect(decision.granted).toBe(true);
      expect(decision.revocable).toBe(true);
      expect(decision.conditions).toBeDefined();
    });

    it('should grant consent with strict conditions for sensitive data', async () => {
      const request: ConsentRequest = {
        id: 'consent-2',
        purpose: 'Health monitoring',
        dataTypes: ['health', 'location'],
        requester: 'health-app',
        context: mockSecurityContext
      };

      const decision = await consentManager.requestConsent(request);
      expect(decision.granted).toBe(true);
      expect(decision.conditions).toBeDefined();
      expect(decision.conditions!.length).toBeGreaterThan(0);
      expect(decision.expiresAt).toBeDefined();
      
      // Should have shorter expiration for sensitive data
      const expirationTime = decision.expiresAt! - Date.now();
      expect(expirationTime).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // 24 hours
    });

    it('should return existing consent if valid', async () => {
      const request: ConsentRequest = {
        id: 'consent-3',
        purpose: 'Data sync',
        dataTypes: ['contacts'],
        requester: 'sync-app',
        context: mockSecurityContext
      };

      // First request
      const firstDecision = await consentManager.requestConsent(request);
      expect(firstDecision.granted).toBe(true);

      // Second identical request should return existing consent
      const secondDecision = await consentManager.requestConsent(request);
      expect(secondDecision.granted).toBe(true);
    });
  });

  describe('consent validation', () => {
    it('should validate existing consent correctly', async () => {
      const request: ConsentRequest = {
        id: 'consent-4',
        purpose: 'Analytics',
        dataTypes: ['usage_data'],
        requester: 'analytics-service',
        context: mockSecurityContext
      };

      await consentManager.requestConsent(request);

      const hasConsent = consentManager.hasValidConsent(
        'Analytics',
        ['usage_data'],
        mockSecurityContext.userId
      );

      expect(hasConsent).toBe(true);
    });

    it('should return false for non-existent consent', () => {
      const hasConsent = consentManager.hasValidConsent(
        'Non-existent purpose',
        ['non_existent_data'],
        mockSecurityContext.userId
      );

      expect(hasConsent).toBe(false);
    });

    it('should return false for different user', async () => {
      const request: ConsentRequest = {
        id: 'consent-5',
        purpose: 'User sync',
        dataTypes: ['profile_data'],
        requester: 'sync-app',
        context: mockSecurityContext
      };

      await consentManager.requestConsent(request);

      const hasConsent = consentManager.hasValidConsent(
        'User sync',
        ['profile_data'],
        'different-user-id'
      );

      expect(hasConsent).toBe(false);
    });

    it('should return false for subset of data types not covered', async () => {
      const request: ConsentRequest = {
        id: 'consent-6',
        purpose: 'Limited access',
        dataTypes: ['basic_info'],
        requester: 'limited-app',
        context: mockSecurityContext
      };

      await consentManager.requestConsent(request);

      const hasConsent = consentManager.hasValidConsent(
        'Limited access',
        ['basic_info', 'sensitive_info'], // Requesting more than granted
        mockSecurityContext.userId
      );

      expect(hasConsent).toBe(false);
    });
  });

  describe('consent revocation', () => {
    it('should revoke consent successfully', async () => {
      const request: ConsentRequest = {
        id: 'consent-7',
        purpose: 'Temporary access',
        dataTypes: ['temp_data'],
        requester: 'temp-app',
        context: mockSecurityContext
      };

      await consentManager.requestConsent(request);
      
      const revoked = consentManager.revokeConsent(request.id, mockSecurityContext.userId);
      expect(revoked).toBe(true);

      // Should no longer have valid consent
      const hasConsent = consentManager.hasValidConsent(
        'Temporary access',
        ['temp_data'],
        mockSecurityContext.userId
      );
      expect(hasConsent).toBe(false);
    });

    it('should fail to revoke non-existent consent', () => {
      const revoked = consentManager.revokeConsent('non-existent-id', mockSecurityContext.userId);
      expect(revoked).toBe(false);
    });

    it('should fail to revoke consent for different user', async () => {
      const request: ConsentRequest = {
        id: 'consent-8',
        purpose: 'Protected access',
        dataTypes: ['protected_data'],
        requester: 'protected-app',
        context: mockSecurityContext
      };

      await consentManager.requestConsent(request);
      
      const revoked = consentManager.revokeConsent(request.id, 'different-user-id');
      expect(revoked).toBe(false);
    });
  });

  describe('consent history and audit', () => {
    it('should track consent history', async () => {
      const request: ConsentRequest = {
        id: 'consent-9',
        purpose: 'Audit test',
        dataTypes: ['audit_data'],
        requester: 'audit-app',
        context: mockSecurityContext
      };

      await consentManager.requestConsent(request);
      consentManager.revokeConsent(request.id, mockSecurityContext.userId);

      const history = consentManager.getConsentHistory(mockSecurityContext.userId);
      expect(history.length).toBeGreaterThanOrEqual(2); // Grant and revoke events
      
      const grantEvent = history.find(h => h.action === 'granted');
      const revokeEvent = history.find(h => h.action === 'revoked');
      
      expect(grantEvent).toBeDefined();
      expect(revokeEvent).toBeDefined();
    });

    it('should return user-specific consent history', async () => {
      const user1Context = { ...mockSecurityContext, userId: 'user-1' };
      const user2Context = { ...mockSecurityContext, userId: 'user-2' };

      const request1: ConsentRequest = {
        id: 'consent-10',
        purpose: 'User 1 access',
        dataTypes: ['user1_data'],
        requester: 'user1-app',
        context: user1Context
      };

      const request2: ConsentRequest = {
        id: 'consent-11',
        purpose: 'User 2 access',
        dataTypes: ['user2_data'],
        requester: 'user2-app',
        context: user2Context
      };

      await consentManager.requestConsent(request1);
      await consentManager.requestConsent(request2);

      const user1History = consentManager.getConsentHistory('user-1');
      const user2History = consentManager.getConsentHistory('user-2');

      expect(user1History.length).toBeGreaterThan(0);
      expect(user2History.length).toBeGreaterThan(0);
      
      // Histories should be separate
      expect(user1History.every(h => h.consent.context.userId === 'user-1')).toBe(true);
      expect(user2History.every(h => h.consent.context.userId === 'user-2')).toBe(true);
    });

    it('should get active consents for user', async () => {
      const request1: ConsentRequest = {
        id: 'consent-12',
        purpose: 'Active consent 1',
        dataTypes: ['data1'],
        requester: 'app1',
        context: mockSecurityContext
      };

      const request2: ConsentRequest = {
        id: 'consent-13',
        purpose: 'Active consent 2',
        dataTypes: ['data2'],
        requester: 'app2',
        context: mockSecurityContext
      };

      await consentManager.requestConsent(request1);
      await consentManager.requestConsent(request2);

      const activeConsents = consentManager.getUserConsents(mockSecurityContext.userId);
      expect(activeConsents.length).toBe(2);
      expect(activeConsents.every(c => c.granted)).toBe(true);
    });
  });

  describe('consent conditions and expiration', () => {
    it('should handle consent with retention limits', async () => {
      const request: ConsentRequest = {
        id: 'consent-14',
        purpose: 'Short-term access',
        dataTypes: ['financial'], // Sensitive data
        requester: 'finance-app',
        context: mockSecurityContext
      };

      const decision = await consentManager.requestConsent(request);
      expect(decision.granted).toBe(true);
      expect(decision.conditions).toBeDefined();
      
      const retentionCondition = decision.conditions!.find(c => c.type === 'retention_limit');
      expect(retentionCondition).toBeDefined();
    });

    it('should handle purpose limitation conditions', async () => {
      const request: ConsentRequest = {
        id: 'consent-15',
        purpose: 'Specific analytics',
        dataTypes: ['usage_patterns'],
        requester: 'analytics-app',
        context: mockSecurityContext
      };

      const decision = await consentManager.requestConsent(request);
      expect(decision.granted).toBe(true);
      
      const purposeCondition = decision.conditions!.find(c => c.type === 'purpose_limitation');
      expect(purposeCondition).toBeDefined();
      expect(purposeCondition!.value).toBe(request.purpose);
    });
  });

  describe('error handling', () => {
    it('should handle malformed consent requests', async () => {
      const malformedRequest: ConsentRequest = {
        id: '',
        purpose: '',
        dataTypes: [],
        requester: '',
        context: null as any
      };

      const decision = await consentManager.requestConsent(malformedRequest);
      expect(decision.granted).toBe(false);
    });

    it('should handle invalid user context', async () => {
      const invalidContext = {
        ...mockSecurityContext,
        userId: ''
      };

      const request: ConsentRequest = {
        id: 'consent-16',
        purpose: 'Test purpose',
        dataTypes: ['test_data'],
        requester: 'test-app',
        context: invalidContext
      };

      const decision = await consentManager.requestConsent(request);
      expect(decision.granted).toBe(false);
    });
  });
});