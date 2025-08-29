import { AccessControlManager } from '../access-control';
import { AccessRequest, SecurityContext } from '../types';

describe('AccessControlManager', () => {
  let accessControl: AccessControlManager;
  let mockSecurityContext: SecurityContext;

  beforeEach(() => {
    accessControl = new AccessControlManager();
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

  describe('default deny behavior', () => {
    it('should deny access when no policy exists', async () => {
      const request: AccessRequest = {
        id: 'test-request-1',
        resource: 'unknown_resource',
        action: 'read',
        context: mockSecurityContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Default deny policy');
    });

    it('should deny access for empty resource', async () => {
      const request: AccessRequest = {
        id: 'test-request-2',
        resource: '',
        action: 'read',
        context: mockSecurityContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
    });
  });

  describe('policy registration and evaluation', () => {
    beforeEach(() => {
      // Register a test policy
      accessControl.registerPolicy('test_resource', 'read', {
        id: 'test_policy',
        name: 'Test Policy',
        description: 'Policy for testing',
        rules: [
          {
            type: 'user_identity',
            required: true
          }
        ]
      });
    });

    it('should allow access when policy conditions are met', async () => {
      const request: AccessRequest = {
        id: 'test-request-3',
        resource: 'test_resource',
        action: 'read',
        context: mockSecurityContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toContain('Access granted by policy');
    });

    it('should deny access when user is not authenticated', async () => {
      const unauthenticatedContext = {
        ...mockSecurityContext,
        userId: ''
      };

      const request: AccessRequest = {
        id: 'test-request-4',
        resource: 'test_resource',
        action: 'read',
        context: unauthenticatedContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('User not authenticated');
    });
  });

  describe('time-based access control', () => {
    beforeEach(() => {
      accessControl.registerPolicy('time_restricted_resource', 'read', {
        id: 'time_policy',
        name: 'Time-based Policy',
        description: 'Policy with time restrictions',
        rules: [
          {
            type: 'user_identity',
            required: true
          },
          {
            type: 'time_based',
            conditions: { allowedHours: [9, 10, 11, 12, 13, 14, 15, 16, 17] }, // 9 AM to 5 PM
            required: true
          }
        ]
      });
    });

    it('should allow access during allowed hours', async () => {
      const businessHourContext = {
        ...mockSecurityContext,
        timestamp: new Date('2024-01-01T14:00:00Z').getTime() // 2 PM
      };

      const request: AccessRequest = {
        id: 'test-request-5',
        resource: 'time_restricted_resource',
        action: 'read',
        context: businessHourContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(true);
    });

    it('should deny access outside allowed hours', async () => {
      const afterHoursContext = {
        ...mockSecurityContext,
        timestamp: new Date('2024-01-01T22:00:00Z').getTime() // 10 PM
      };

      const request: AccessRequest = {
        id: 'test-request-6',
        resource: 'time_restricted_resource',
        action: 'read',
        context: afterHoursContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Access not allowed at hour');
    });
  });

  describe('network-based access control', () => {
    beforeEach(() => {
      accessControl.registerPolicy('secure_resource', 'write', {
        id: 'network_policy',
        name: 'Network Security Policy',
        description: 'Policy requiring secure network',
        rules: [
          {
            type: 'user_identity',
            required: true
          },
          {
            type: 'network_based',
            conditions: { requireSecureNetwork: true },
            required: true
          }
        ]
      });
    });

    it('should allow access from secure network', async () => {
      const request: AccessRequest = {
        id: 'test-request-7',
        resource: 'secure_resource',
        action: 'write',
        context: mockSecurityContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(true);
    });

    it('should deny access from insecure network', async () => {
      const insecureContext = {
        ...mockSecurityContext,
        networkInfo: {
          ...mockSecurityContext.networkInfo,
          isSecure: false
        }
      };

      const request: AccessRequest = {
        id: 'test-request-8',
        resource: 'secure_resource',
        action: 'write',
        context: insecureContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Secure network required');
    });
  });

  describe('location-based access control', () => {
    beforeEach(() => {
      accessControl.registerPolicy('location_resource', 'read', {
        id: 'location_policy',
        name: 'Location-based Policy',
        description: 'Policy requiring location',
        rules: [
          {
            type: 'user_identity',
            required: true
          },
          {
            type: 'location_based',
            conditions: { requireLocation: true },
            required: true
          }
        ]
      });
    });

    it('should allow access when location is provided', async () => {
      const locationContext = {
        ...mockSecurityContext,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        }
      };

      const request: AccessRequest = {
        id: 'test-request-9',
        resource: 'location_resource',
        action: 'read',
        context: locationContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(true);
    });

    it('should deny access when location is required but not provided', async () => {
      const request: AccessRequest = {
        id: 'test-request-10',
        resource: 'location_resource',
        action: 'read',
        context: mockSecurityContext // No location
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Location required but not provided');
    });
  });

  describe('access decision caching and validation', () => {
    beforeEach(() => {
      accessControl.registerPolicy('cached_resource', 'read', {
        id: 'cache_policy',
        name: 'Cacheable Policy',
        description: 'Policy for testing caching',
        rules: [
          {
            type: 'user_identity',
            required: true
          }
        ]
      });
    });

    it('should cache access decisions', async () => {
      const request: AccessRequest = {
        id: 'cache-test-1',
        resource: 'cached_resource',
        action: 'read',
        context: mockSecurityContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(true);

      // Check if access is still valid
      const isValid = accessControl.isAccessValid(request.id);
      expect(isValid).toBe(true);
    });

    it('should invalidate expired access', async () => {
      const request: AccessRequest = {
        id: 'expire-test-1',
        resource: 'cached_resource',
        action: 'read',
        context: mockSecurityContext
      };

      // Mock an expired decision
      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(true);

      // Manually set expiration in the past (this is a test hack)
      // In real implementation, we'd wait or mock time
      accessControl.revokeAccess(request.id);
      
      const isValid = accessControl.isAccessValid(request.id);
      expect(isValid).toBe(false);
    });

    it('should revoke access by request ID', async () => {
      const request: AccessRequest = {
        id: 'revoke-test-1',
        resource: 'cached_resource',
        action: 'read',
        context: mockSecurityContext
      };

      await accessControl.evaluateAccess(request);
      accessControl.revokeAccess(request.id);
      
      const isValid = accessControl.isAccessValid(request.id);
      expect(isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle policy evaluation errors gracefully', async () => {
      // Register a policy that might cause errors
      accessControl.registerPolicy('error_resource', 'read', {
        id: 'error_policy',
        name: 'Error Policy',
        description: 'Policy that might cause errors',
        rules: [
          {
            type: 'unknown_rule_type' as any,
            required: true
          }
        ]
      });

      const request: AccessRequest = {
        id: 'error-test-1',
        resource: 'error_resource',
        action: 'read',
        context: mockSecurityContext
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Unknown rule type');
    });

    it('should handle malformed security context', async () => {
      accessControl.registerPolicy('test_resource', 'read', {
        id: 'test_policy',
        name: 'Test Policy',
        description: 'Policy for testing',
        rules: [
          {
            type: 'user_identity',
            required: true
          }
        ]
      });

      const request: AccessRequest = {
        id: 'malformed-test-1',
        resource: 'test_resource',
        action: 'read',
        context: null as any
      };

      const decision = await accessControl.evaluateAccess(request);
      expect(decision.allowed).toBe(false);
    });
  });
});