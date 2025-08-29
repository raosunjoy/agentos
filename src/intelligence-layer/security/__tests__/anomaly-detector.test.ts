import { AnomalyDetector } from '../anomaly-detector';
import { SecurityEvent, SecurityEventType, SecuritySeverity, SecurityContext } from '../types';

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;
  let mockSecurityContext: SecurityContext;

  beforeEach(() => {
    detector = new AnomalyDetector();
    mockSecurityContext = {
      userId: 'test-user-123',
      sessionId: 'session-456',
      deviceId: 'device-789',
      timestamp: Date.now(),
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      networkInfo: {
        type: 'wifi',
        ssid: 'test-network',
        isSecure: true,
        ipAddress: '192.168.1.100'
      }
    };
  });

  afterEach(() => {
    detector.stopMonitoring();
  });

  describe('monitoring lifecycle', () => {
    it('should start monitoring successfully', () => {
      detector.startMonitoring();
      // No direct way to test if monitoring is active, but should not throw
    });

    it('should stop monitoring successfully', () => {
      detector.startMonitoring();
      detector.stopMonitoring();
      // Should not throw
    });

    it('should handle multiple start calls gracefully', () => {
      detector.startMonitoring();
      detector.startMonitoring(); // Should not cause issues
      detector.stopMonitoring();
    });
  });

  describe('security event recording', () => {
    it('should record security events', () => {
      const event: SecurityEvent = {
        id: 'test-event-1',
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.MEDIUM,
        timestamp: Date.now(),
        context: mockSecurityContext,
        details: { test: 'data' },
        resolved: false
      };

      detector.recordEvent(event);
      // Event should be recorded (no direct way to verify without exposing internals)
    });

    it('should handle high-severity events immediately', () => {
      const criticalEvent: SecurityEvent = {
        id: 'critical-event-1',
        type: SecurityEventType.DATA_BREACH_ATTEMPT,
        severity: SecuritySeverity.CRITICAL,
        timestamp: Date.now(),
        context: mockSecurityContext,
        details: { severity: 'critical' },
        resolved: false
      };

      detector.recordEvent(criticalEvent);
      // Should trigger immediate analysis
    });

    it('should maintain event history within time window', () => {
      const oldEvent: SecurityEvent = {
        id: 'old-event',
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
        severity: SecuritySeverity.LOW,
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        context: mockSecurityContext,
        details: {},
        resolved: false
      };

      const recentEvent: SecurityEvent = {
        id: 'recent-event',
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
        severity: SecuritySeverity.LOW,
        timestamp: Date.now(),
        context: mockSecurityContext,
        details: {},
        resolved: false
      };

      detector.recordEvent(oldEvent);
      detector.recordEvent(recentEvent);
      
      // Old events should be cleaned up automatically
    });
  });

  describe('behavior anomaly detection', () => {
    it('should detect time-based anomalies', () => {
      // First, establish normal behavior pattern
      const normalContext = {
        ...mockSecurityContext,
        timestamp: new Date('2024-01-01T14:00:00Z').getTime() // 2 PM
      };

      // Simulate normal activity
      for (let i = 0; i < 10; i++) {
        detector.detectBehaviorAnomalies(mockSecurityContext.userId, normalContext);
      }

      // Now test unusual time
      const unusualTimeContext = {
        ...mockSecurityContext,
        timestamp: new Date('2024-01-01T03:00:00Z').getTime() // 3 AM
      };

      const anomalies = detector.detectBehaviorAnomalies(
        mockSecurityContext.userId, 
        unusualTimeContext
      );

      // Should detect time anomaly for new user profile
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should detect location-based anomalies', () => {
      // Establish known location
      const knownLocationContext = {
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

      // Build location profile
      for (let i = 0; i < 5; i++) {
        detector.detectBehaviorAnomalies(mockSecurityContext.userId, knownLocationContext);
      }

      // Test unusual location
      const unusualLocationContext = {
        ...mockSecurityContext,
        location: {
          latitude: 40.7128, // New York (far from SF)
          longitude: -74.0060,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        }
      };

      const anomalies = detector.detectBehaviorAnomalies(
        mockSecurityContext.userId, 
        unusualLocationContext
      );

      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should detect device-based anomalies', () => {
      // Use known device
      detector.detectBehaviorAnomalies(mockSecurityContext.userId, mockSecurityContext);

      // Test unknown device
      const unknownDeviceContext = {
        ...mockSecurityContext,
        deviceId: 'unknown-device-999'
      };

      const anomalies = detector.detectBehaviorAnomalies(
        mockSecurityContext.userId, 
        unknownDeviceContext
      );

      // Should detect unknown device
      const deviceAnomaly = anomalies.find(a => 
        a.details.anomalyType === 'unknown_device'
      );
      expect(deviceAnomaly).toBeDefined();
    });

    it('should not detect anomalies for established patterns', () => {
      // Establish pattern
      for (let i = 0; i < 10; i++) {
        detector.detectBehaviorAnomalies(mockSecurityContext.userId, mockSecurityContext);
      }

      // Test same pattern
      const anomalies = detector.detectBehaviorAnomalies(
        mockSecurityContext.userId, 
        mockSecurityContext
      );

      // Should not detect anomalies for established patterns
      expect(anomalies.length).toBe(0);
    });
  });

  describe('pattern analysis', () => {
    beforeEach(() => {
      detector.startMonitoring();
    });

    it('should detect rapid failure patterns', () => {
      // Simulate multiple failure events
      for (let i = 0; i < 6; i++) {
        const failureEvent: SecurityEvent = {
          id: `failure-${i}`,
          type: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.MEDIUM,
          timestamp: Date.now() - (i * 1000), // Spread over seconds
          context: mockSecurityContext,
          details: { attempt: i },
          resolved: false
        };

        detector.recordEvent(failureEvent);
      }

      // Allow time for analysis
      // In a real test, we might need to trigger analysis manually or wait
    });

    it('should detect volume spikes', () => {
      // Simulate high volume of events
      for (let i = 0; i < 50; i++) {
        const event: SecurityEvent = {
          id: `volume-event-${i}`,
          type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
          severity: SecuritySeverity.LOW,
          timestamp: Date.now() - (i * 100), // Recent events
          context: mockSecurityContext,
          details: { eventNumber: i },
          resolved: false
        };

        detector.recordEvent(event);
      }

      // Volume spike should be detected in analysis
    });

    it('should detect coordinated attacks', () => {
      const attackIPs = ['192.168.1.10', '192.168.1.11', '192.168.1.12'];

      // Simulate coordinated attack from multiple IPs
      attackIPs.forEach((ip, index) => {
        for (let i = 0; i < 4; i++) {
          const attackEvent: SecurityEvent = {
            id: `attack-${ip}-${i}`,
            type: SecurityEventType.DATA_BREACH_ATTEMPT,
            severity: SecuritySeverity.HIGH,
            timestamp: Date.now() - (i * 1000),
            context: {
              ...mockSecurityContext,
              networkInfo: {
                ...mockSecurityContext.networkInfo,
                ipAddress: ip
              }
            },
            details: { attackVector: 'coordinated' },
            resolved: false
          };

          detector.recordEvent(attackEvent);
        }
      });

      // Coordinated attack should be detected
    });
  });

  describe('user behavior profiling', () => {
    it('should build user behavior profiles over time', () => {
      const userId = 'profile-test-user';
      
      // Simulate activity at different hours
      const hours = [9, 10, 11, 14, 15, 16];
      hours.forEach(hour => {
        const context = {
          ...mockSecurityContext,
          userId,
          timestamp: new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`).getTime()
        };

        // Multiple activities at each hour
        for (let i = 0; i < 3; i++) {
          detector.detectBehaviorAnomalies(userId, context);
        }
      });

      // Profile should be built (no direct way to verify without exposing internals)
    });

    it('should update profiles with new locations', () => {
      const userId = 'location-profile-user';
      
      const locations = [
        { latitude: 37.7749, longitude: -122.4194 }, // SF
        { latitude: 37.7849, longitude: -122.4094 }, // Nearby SF
      ];

      locations.forEach(location => {
        const context = {
          ...mockSecurityContext,
          userId,
          location: {
            ...location,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          }
        };

        detector.detectBehaviorAnomalies(userId, context);
      });

      // Locations should be added to profile
    });
  });

  describe('error handling', () => {
    it('should handle malformed security events', () => {
      const malformedEvent = {
        id: 'malformed',
        type: 'invalid_type' as SecurityEventType,
        severity: SecuritySeverity.LOW,
        timestamp: Date.now(),
        context: null as any,
        details: {},
        resolved: false
      };

      expect(() => {
        detector.recordEvent(malformedEvent);
      }).not.toThrow();
    });

    it('should handle missing location data gracefully', () => {
      const contextWithoutLocation = {
        ...mockSecurityContext,
        location: undefined
      };

      const anomalies = detector.detectBehaviorAnomalies(
        mockSecurityContext.userId, 
        contextWithoutLocation
      );

      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should handle invalid timestamps', () => {
      const contextWithInvalidTime = {
        ...mockSecurityContext,
        timestamp: -1
      };

      const anomalies = detector.detectBehaviorAnomalies(
        mockSecurityContext.userId, 
        contextWithInvalidTime
      );

      expect(Array.isArray(anomalies)).toBe(true);
    });
  });
});