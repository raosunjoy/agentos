/**
 * Tests for ContextEvaluator
 */

import { ContextEvaluator } from '../context-evaluator';
import { PermissionCondition, RequestContext } from '../types';

describe('ContextEvaluator', () => {
  let evaluator: ContextEvaluator;
  let testContext: RequestContext;

  beforeEach(() => {
    evaluator = new ContextEvaluator();
    testContext = {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10
      },
      device: {
        id: 'device-123',
        type: 'mobile',
        trusted: true
      },
      network: {
        type: 'wifi',
        trusted: true
      },
      userActivity: 'working',
      sessionId: 'session-123'
    };
  });

  describe('Time Range Conditions', () => {
    it('should evaluate between time range correctly', async () => {
      const condition: PermissionCondition = {
        type: 'time_range',
        operator: 'between',
        value: [
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-15T17:00:00Z')
        ]
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail when time is outside range', async () => {
      const condition: PermissionCondition = {
        type: 'time_range',
        operator: 'between',
        value: [
          new Date('2024-01-15T18:00:00Z'),
          new Date('2024-01-15T22:00:00Z')
        ]
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(false);
      expect(result.failedConditions).toHaveLength(1);
    });

    it('should evaluate greater_than time condition', async () => {
      const condition: PermissionCondition = {
        type: 'time_range',
        operator: 'greater_than',
        value: new Date('2024-01-15T09:00:00Z')
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate less_than time condition', async () => {
      const condition: PermissionCondition = {
        type: 'time_range',
        operator: 'less_than',
        value: new Date('2024-01-15T12:00:00Z')
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });
  });

  describe('Location Conditions', () => {
    it('should evaluate location equals condition', async () => {
      const condition: PermissionCondition = {
        type: 'location',
        operator: 'equals',
        value: {
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 100 // meters
        }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail when location is too far', async () => {
      const condition: PermissionCondition = {
        type: 'location',
        operator: 'equals',
        value: {
          latitude: 40.7128, // New York
          longitude: -74.0060,
          radius: 100
        }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(false);
    });

    it('should evaluate location in list condition', async () => {
      const condition: PermissionCondition = {
        type: 'location',
        operator: 'in',
        value: [
          {
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 100
          },
          {
            latitude: 40.7128,
            longitude: -74.0060,
            radius: 100
          }
        ]
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should handle missing location context', async () => {
      const contextWithoutLocation = { ...testContext };
      delete contextWithoutLocation.location;

      const condition: PermissionCondition = {
        type: 'location',
        operator: 'not_equals',
        value: { latitude: 0, longitude: 0 }
      };

      const result = await evaluator.evaluateConditions([condition], contextWithoutLocation);
      expect(result.satisfied).toBe(true);
    });
  });

  describe('Device Conditions', () => {
    it('should evaluate device ID condition', async () => {
      const condition: PermissionCondition = {
        type: 'device',
        operator: 'equals',
        value: 'device-123'
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate device type condition', async () => {
      const condition: PermissionCondition = {
        type: 'device',
        operator: 'equals',
        value: 'mobile'
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate device in list condition', async () => {
      const condition: PermissionCondition = {
        type: 'device',
        operator: 'in',
        value: ['device-123', 'device-456']
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate trusted device condition', async () => {
      const condition: PermissionCondition = {
        type: 'device',
        operator: 'contains',
        value: 'trusted'
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail for untrusted device', async () => {
      const untrustedContext = {
        ...testContext,
        device: { ...testContext.device!, trusted: false }
      };

      const condition: PermissionCondition = {
        type: 'device',
        operator: 'contains',
        value: 'trusted'
      };

      const result = await evaluator.evaluateConditions([condition], untrustedContext);
      expect(result.satisfied).toBe(false);
    });
  });

  describe('Network Conditions', () => {
    it('should evaluate network type condition', async () => {
      const condition: PermissionCondition = {
        type: 'network',
        operator: 'equals',
        value: 'wifi'
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate network type in list condition', async () => {
      const condition: PermissionCondition = {
        type: 'network',
        operator: 'in',
        value: ['wifi', 'ethernet']
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate trusted network condition', async () => {
      const condition: PermissionCondition = {
        type: 'network',
        operator: 'contains',
        value: 'trusted'
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail for cellular network when wifi required', async () => {
      const cellularContext = {
        ...testContext,
        network: { type: 'cellular' as const, trusted: false }
      };

      const condition: PermissionCondition = {
        type: 'network',
        operator: 'equals',
        value: 'wifi'
      };

      const result = await evaluator.evaluateConditions([condition], cellularContext);
      expect(result.satisfied).toBe(false);
    });
  });

  describe('User Context Conditions', () => {
    it('should evaluate user activity condition', async () => {
      const condition: PermissionCondition = {
        type: 'user_context',
        operator: 'equals',
        value: 'working'
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate user activity in list condition', async () => {
      const condition: PermissionCondition = {
        type: 'user_context',
        operator: 'in',
        value: ['working', 'meeting', 'focused']
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate user activity pattern matching', async () => {
      const condition: PermissionCondition = {
        type: 'user_context',
        operator: 'matches_pattern',
        value: '^work.*'
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail pattern matching for different activity', async () => {
      const relaxingContext = { ...testContext, userActivity: 'relaxing' };

      const condition: PermissionCondition = {
        type: 'user_context',
        operator: 'matches_pattern',
        value: '^work.*'
      };

      const result = await evaluator.evaluateConditions([condition], relaxingContext);
      expect(result.satisfied).toBe(false);
    });
  });

  describe('Data Sensitivity Conditions', () => {
    it('should evaluate sensitivity level condition', async () => {
      const condition: PermissionCondition = {
        type: 'data_sensitivity',
        operator: 'equals',
        value: 'confidential',
        metadata: { sensitivity: 'confidential' }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate maximum sensitivity level', async () => {
      const condition: PermissionCondition = {
        type: 'data_sensitivity',
        operator: 'less_than',
        value: 'restricted',
        metadata: { sensitivity: 'confidential' }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail for higher sensitivity than allowed', async () => {
      const condition: PermissionCondition = {
        type: 'data_sensitivity',
        operator: 'less_than',
        value: 'internal',
        metadata: { sensitivity: 'restricted' }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(false);
    });
  });

  describe('Purpose Conditions', () => {
    it('should evaluate purpose condition', async () => {
      const condition: PermissionCondition = {
        type: 'purpose',
        operator: 'equals',
        value: 'medical_analysis',
        metadata: { purpose: 'medical_analysis' }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should evaluate purpose in allowed list', async () => {
      const condition: PermissionCondition = {
        type: 'purpose',
        operator: 'in',
        value: ['medical_analysis', 'health_monitoring', 'emergency_care'],
        metadata: { purpose: 'medical_analysis' }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail for unauthorized purpose', async () => {
      const condition: PermissionCondition = {
        type: 'purpose',
        operator: 'equals',
        value: 'marketing',
        metadata: { purpose: 'medical_analysis' }
      };

      const result = await evaluator.evaluateConditions([condition], testContext);
      expect(result.satisfied).toBe(false);
    });
  });

  describe('Multiple Conditions', () => {
    it('should satisfy all conditions when all are met', async () => {
      const conditions: PermissionCondition[] = [
        {
          type: 'time_range',
          operator: 'between',
          value: [
            new Date('2024-01-15T09:00:00Z'),
            new Date('2024-01-15T17:00:00Z')
          ]
        },
        {
          type: 'device',
          operator: 'contains',
          value: 'trusted'
        },
        {
          type: 'network',
          operator: 'equals',
          value: 'wifi'
        }
      ];

      const result = await evaluator.evaluateConditions(conditions, testContext);
      expect(result.satisfied).toBe(true);
    });

    it('should fail when any condition is not met', async () => {
      const conditions: PermissionCondition[] = [
        {
          type: 'time_range',
          operator: 'between',
          value: [
            new Date('2024-01-15T09:00:00Z'),
            new Date('2024-01-15T17:00:00Z')
          ]
        },
        {
          type: 'device',
          operator: 'equals',
          value: 'wrong-device'
        }
      ];

      const result = await evaluator.evaluateConditions(conditions, testContext);
      expect(result.satisfied).toBe(false);
      expect(result.failedConditions).toHaveLength(1);
      expect(result.failedConditions![0].type).toBe('device');
    });
  });

  describe('Utility Functions', () => {
    it('should correctly identify business hours', () => {
      // Create dates in local timezone for consistent testing
      const businessHour = new Date(2024, 0, 15, 14, 0, 0); // Monday 2 PM local time
      const nonBusinessHour = new Date(2024, 0, 15, 20, 0, 0); // Monday 8 PM local time
      const weekend = new Date(2024, 0, 13, 14, 0, 0); // Saturday 2 PM local time

      expect(evaluator.isBusinessHours(businessHour)).toBe(true);
      expect(evaluator.isBusinessHours(nonBusinessHour)).toBe(false);
      expect(evaluator.isBusinessHours(weekend)).toBe(false);
    });

    it('should correctly check geofence boundaries', () => {
      const userLocation = { latitude: 37.7749, longitude: -122.4194 };
      const geofence = { latitude: 37.7749, longitude: -122.4194, radius: 100 };
      const outsideGeofence = { latitude: 37.7849, longitude: -122.4294, radius: 50 };

      expect(evaluator.isWithinGeofence(userLocation, geofence)).toBe(true);
      expect(evaluator.isWithinGeofence(userLocation, outsideGeofence)).toBe(false);
    });
  });
});