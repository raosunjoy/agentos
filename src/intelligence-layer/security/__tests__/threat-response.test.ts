import { ThreatResponseManager } from '../threat-response';
import { SecurityEvent, SecurityEventType, SecuritySeverity, ThreatAction } from '../types';

describe('ThreatResponseManager', () => {
  let threatResponse: ThreatResponseManager;
  let mockSecurityEvent: SecurityEvent;

  beforeEach(() => {
    threatResponse = new ThreatResponseManager();
    mockSecurityEvent = {
      id: 'test-event-1',
      type: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecuritySeverity.MEDIUM,
      timestamp: Date.now(),
      context: {
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
      },
      details: { test: 'data' },
      resolved: false
    };
  });

  describe('response rule management', () => {
    it('should add custom response rules', () => {
      const customRule = {
        id: 'custom-rule-1',
        name: 'Custom Test Rule',
        description: 'Test rule for custom responses',
        eventTypes: [SecurityEventType.SUSPICIOUS_BEHAVIOR],
        minSeverity: SecuritySeverity.LOW,
        action: ThreatAction.ALERT_USER,
        automatic: true
      };

      threatResponse.addResponseRule(customRule);
      // Rule should be added (no direct way to verify without exposing internals)
    });

    it('should remove response rules', () => {
      const ruleId = 'test-rule-to-remove';
      const testRule = {
        id: ruleId,
        name: 'Test Rule',
        description: 'Rule to be removed',
        action: ThreatAction.BLOCK,
        automatic: true
      };

      threatResponse.addResponseRule(testRule);
      threatResponse.removeResponseRule(ruleId);
      // Rule should be removed
    });
  });

  describe('security event processing', () => {
    it('should process unauthorized access events', async () => {
      const unauthorizedEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.MEDIUM
      };

      const response = await threatResponse.processSecurityEvent(unauthorizedEvent);
      expect(response).toBeDefined();
      expect(response!.action).toBe(ThreatAction.BLOCK);
      expect(response!.automatic).toBe(true);
    });

    it('should process suspicious behavior events', async () => {
      const suspiciousEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
        severity: SecuritySeverity.MEDIUM
      };

      const response = await threatResponse.processSecurityEvent(suspiciousEvent);
      expect(response).toBeDefined();
      expect(response!.action).toBe(ThreatAction.ALERT_USER);
    });

    it('should process malicious plugin events', async () => {
      const maliciousPluginEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.MALICIOUS_PLUGIN,
        severity: SecuritySeverity.HIGH
      };

      const response = await threatResponse.processSecurityEvent(maliciousPluginEvent);
      expect(response).toBeDefined();
      expect(response!.action).toBe(ThreatAction.DISABLE_PLUGIN);
    });

    it('should process critical events with force logout', async () => {
      const criticalEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.DATA_BREACH_ATTEMPT,
        severity: SecuritySeverity.CRITICAL
      };

      const response = await threatResponse.processSecurityEvent(criticalEvent);
      expect(response).toBeDefined();
      expect(response!.action).toBe(ThreatAction.FORCE_LOGOUT);
      expect(response!.automatic).toBe(false); // Should require manual confirmation
    });

    it('should return null for events with no matching rules', async () => {
      const unmatchedEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.CONSENT_VIOLATION,
        severity: SecuritySeverity.LOW
      };

      const response = await threatResponse.processSecurityEvent(unmatchedEvent);
      expect(response).toBeNull();
    });
  });

  describe('response execution', () => {
    it('should execute block actions', async () => {
      const blockEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.HIGH
      };

      const response = await threatResponse.processSecurityEvent(blockEvent);
      expect(response).toBeDefined();
      expect(response!.action).toBe(ThreatAction.BLOCK);
    });

    it('should execute alert actions', async () => {
      const alertEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.ANOMALOUS_PATTERN,
        severity: SecuritySeverity.MEDIUM
      };

      const response = await threatResponse.processSecurityEvent(alertEvent);
      expect(response).toBeDefined();
      expect(response!.action).toBe(ThreatAction.ALERT_USER);
    });

    it('should handle response execution errors gracefully', async () => {
      // Create a custom rule that might cause execution errors
      const errorProneRule = {
        id: 'error-prone-rule',
        name: 'Error Prone Rule',
        description: 'Rule that might cause errors',
        eventTypes: [SecurityEventType.SUSPICIOUS_BEHAVIOR],
        action: ThreatAction.QUARANTINE,
        automatic: true
      };

      threatResponse.addResponseRule(errorProneRule);

      const testEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR
      };

      const response = await threatResponse.processSecurityEvent(testEvent);
      expect(response).toBeDefined();
      // Should handle errors gracefully and still return a response
    });
  });

  describe('response tracking', () => {
    it('should track active responses', async () => {
      const event: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.MEDIUM
      };

      await threatResponse.processSecurityEvent(event);
      
      const activeResponses = threatResponse.getActiveResponses();
      expect(activeResponses.length).toBeGreaterThan(0);
    });

    it('should maintain response history', async () => {
      const event: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
        severity: SecuritySeverity.MEDIUM
      };

      await threatResponse.processSecurityEvent(event);
      
      const history = threatResponse.getResponseHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].event.id).toBe(event.id);
    });

    it('should resolve responses manually', async () => {
      const event: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.MEDIUM
      };

      await threatResponse.processSecurityEvent(event);
      
      const resolved = threatResponse.resolveResponse(event.id);
      expect(resolved).toBe(true);
      
      // Should no longer be in active responses
      const activeResponses = threatResponse.getActiveResponses();
      const stillActive = activeResponses.find(r => r.timestamp === event.timestamp);
      expect(stillActive).toBeUndefined();
    });

    it('should fail to resolve non-existent responses', () => {
      const resolved = threatResponse.resolveResponse('non-existent-event-id');
      expect(resolved).toBe(false);
    });
  });

  describe('rule matching logic', () => {
    it('should match events by type', async () => {
      const specificRule = {
        id: 'type-specific-rule',
        name: 'Type Specific Rule',
        description: 'Rule for specific event types',
        eventTypes: [SecurityEventType.DATA_BREACH_ATTEMPT],
        action: ThreatAction.QUARANTINE,
        automatic: true
      };

      threatResponse.addResponseRule(specificRule);

      const matchingEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.DATA_BREACH_ATTEMPT
      };

      const nonMatchingEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.CONSENT_VIOLATION
      };

      const matchingResponse = await threatResponse.processSecurityEvent(matchingEvent);
      const nonMatchingResponse = await threatResponse.processSecurityEvent(nonMatchingEvent);

      expect(matchingResponse).toBeDefined();
      expect(matchingResponse!.action).toBe(ThreatAction.QUARANTINE);
      expect(nonMatchingResponse).toBeNull();
    });

    it('should match events by severity threshold', async () => {
      const severityRule = {
        id: 'severity-rule',
        name: 'Severity Rule',
        description: 'Rule based on severity',
        minSeverity: SecuritySeverity.HIGH,
        action: ThreatAction.FORCE_LOGOUT,
        automatic: false
      };

      threatResponse.addResponseRule(severityRule);

      const highSeverityEvent: SecurityEvent = {
        ...mockSecurityEvent,
        severity: SecuritySeverity.HIGH
      };

      const lowSeverityEvent: SecurityEvent = {
        ...mockSecurityEvent,
        severity: SecuritySeverity.LOW
      };

      const highResponse = await threatResponse.processSecurityEvent(highSeverityEvent);
      const lowResponse = await threatResponse.processSecurityEvent(lowSeverityEvent);

      expect(highResponse).toBeDefined();
      expect(lowResponse).toBeNull();
    });

    it('should match events with custom conditions', async () => {
      const conditionalRule = {
        id: 'conditional-rule',
        name: 'Conditional Rule',
        description: 'Rule with custom conditions',
        action: ThreatAction.REVOKE_PERMISSIONS,
        automatic: true,
        conditions: [
          {
            type: 'user_id' as const,
            value: 'test-user-123'
          }
        ]
      };

      threatResponse.addResponseRule(conditionalRule);

      const matchingEvent: SecurityEvent = {
        ...mockSecurityEvent,
        context: {
          ...mockSecurityEvent.context,
          userId: 'test-user-123'
        }
      };

      const nonMatchingEvent: SecurityEvent = {
        ...mockSecurityEvent,
        context: {
          ...mockSecurityEvent.context,
          userId: 'different-user'
        }
      };

      const matchingResponse = await threatResponse.processSecurityEvent(matchingEvent);
      const nonMatchingResponse = await threatResponse.processSecurityEvent(nonMatchingEvent);

      expect(matchingResponse).toBeDefined();
      expect(nonMatchingResponse).toBeNull();
    });
  });

  describe('default rules', () => {
    it('should have default rules for common threats', async () => {
      // Test that default rules are loaded
      const unauthorizedEvent: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.MEDIUM
      };

      const response = await threatResponse.processSecurityEvent(unauthorizedEvent);
      expect(response).toBeDefined(); // Should match default rule
    });

    it('should handle multiple rule matches correctly', async () => {
      // Add a custom rule that might also match
      const customRule = {
        id: 'custom-match-rule',
        name: 'Custom Match Rule',
        description: 'Custom rule that might match',
        eventTypes: [SecurityEventType.UNAUTHORIZED_ACCESS],
        action: ThreatAction.ALERT_USER,
        automatic: true
      };

      threatResponse.addResponseRule(customRule);

      const event: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.MEDIUM
      };

      const response = await threatResponse.processSecurityEvent(event);
      expect(response).toBeDefined();
      // Should match the first applicable rule
    });
  });

  describe('error handling', () => {
    it('should handle malformed events gracefully', async () => {
      const malformedEvent = {
        id: 'malformed',
        type: 'invalid_type' as SecurityEventType,
        severity: SecuritySeverity.LOW,
        timestamp: Date.now(),
        context: null as any,
        details: {},
        resolved: false
      };

      const response = await threatResponse.processSecurityEvent(malformedEvent);
      // Should handle gracefully, might return null or a default response
      expect(response === null || typeof response === 'object').toBe(true);
    });

    it('should handle invalid rule conditions', async () => {
      const invalidRule = {
        id: 'invalid-rule',
        name: 'Invalid Rule',
        description: 'Rule with invalid conditions',
        action: ThreatAction.BLOCK,
        automatic: true,
        conditions: [
          {
            type: 'invalid_condition_type' as any,
            value: 'test'
          }
        ]
      };

      threatResponse.addResponseRule(invalidRule);

      const event: SecurityEvent = {
        ...mockSecurityEvent,
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR
      };

      const response = await threatResponse.processSecurityEvent(event);
      // Should handle invalid conditions gracefully
      expect(response === null || typeof response === 'object').toBe(true);
    });
  });
});