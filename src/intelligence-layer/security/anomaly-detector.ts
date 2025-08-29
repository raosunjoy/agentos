import { SecurityEvent, SecurityEventType, SecuritySeverity, SecurityContext, AnomalyPattern } from './types';

/**
 * Continuous monitoring and anomaly detection system
 */
export class AnomalyDetector {
  private patterns: Map<string, AnomalyPattern> = new Map();
  private eventHistory: SecurityEvent[] = [];
  private userBehaviorProfiles: Map<string, UserBehaviorProfile> = new Map();
  private isMonitoring: boolean = false;

  constructor() {
    this.initializeDefaultPatterns();
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Start periodic analysis
    setInterval(() => {
      this.analyzeRecentActivity();
    }, 60000); // Analyze every minute
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
  }

  /**
   * Record security event for analysis
   */
  recordEvent(event: SecurityEvent): void {
    this.eventHistory.push(event);
    
    // Keep only recent events (last 24 hours)
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    this.eventHistory = this.eventHistory.filter(e => e.timestamp > cutoff);

    // Immediate analysis for high-severity events
    if (event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL) {
      this.analyzeEvent(event);
    }
  }

  /**
   * Detect anomalies in user behavior
   */
  detectBehaviorAnomalies(userId: string, context: SecurityContext): SecurityEvent[] {
    const profile = this.getUserBehaviorProfile(userId);
    const anomalies: SecurityEvent[] = [];

    // Check for unusual access patterns
    const timeAnomaly = this.detectTimeAnomaly(profile, context);
    if (timeAnomaly) {
      anomalies.push(timeAnomaly);
    }

    // Check for unusual location access
    const locationAnomaly = this.detectLocationAnomaly(profile, context);
    if (locationAnomaly) {
      anomalies.push(locationAnomaly);
    }

    // Check for unusual device usage
    const deviceAnomaly = this.detectDeviceAnomaly(profile, context);
    if (deviceAnomaly) {
      anomalies.push(deviceAnomaly);
    }

    // Update user profile with current behavior
    this.updateUserProfile(userId, context);

    return anomalies;
  }

  /**
   * Analyze recent activity for patterns
   */
  private analyzeRecentActivity(): void {
    if (!this.isMonitoring) {
      return;
    }

    const recentEvents = this.getRecentEvents(60 * 60 * 1000); // Last hour
    
    // Check for suspicious patterns
    this.detectRapidFailures(recentEvents);
    this.detectUnusualVolumeSpikes(recentEvents);
    this.detectCoordinatedAttacks(recentEvents);
  }

  /**
   * Analyze individual security event
   */
  private analyzeEvent(event: SecurityEvent): void {
    // Check against known patterns
    for (const pattern of this.patterns.values()) {
      if (this.matchesPattern(event, pattern)) {
        this.handlePatternMatch(event, pattern);
      }
    }
  }

  private detectTimeAnomaly(profile: UserBehaviorProfile, context: SecurityContext): SecurityEvent | null {
    const hour = new Date(context.timestamp).getHours();
    
    // Check if this is an unusual time for this user
    if (profile.typicalActiveHours.length > 0) {
      const isTypicalHour = profile.typicalActiveHours.includes(hour);
      const hourFrequency = profile.hourlyActivity[hour] || 0;
      
      if (!isTypicalHour && hourFrequency < 0.1) { // Less than 10% of activity
        return {
          id: `time_anomaly_${Date.now()}`,
          type: SecurityEventType.ANOMALOUS_PATTERN,
          severity: SecuritySeverity.MEDIUM,
          timestamp: context.timestamp,
          context,
          details: {
            anomalyType: 'unusual_time',
            hour,
            typicalHours: profile.typicalActiveHours
          },
          resolved: false
        };
      }
    }

    return null;
  }

  private detectLocationAnomaly(profile: UserBehaviorProfile, context: SecurityContext): SecurityEvent | null {
    if (!context.location || profile.knownLocations.length === 0) {
      return null;
    }

    // Check if location is significantly different from known locations
    const isKnownLocation = profile.knownLocations.some(loc => 
      this.calculateDistance(context.location!, loc) < 1000 // Within 1km
    );

    if (!isKnownLocation) {
      return {
        id: `location_anomaly_${Date.now()}`,
        type: SecurityEventType.ANOMALOUS_PATTERN,
        severity: SecuritySeverity.MEDIUM,
        timestamp: context.timestamp,
        context,
        details: {
          anomalyType: 'unusual_location',
          location: context.location,
          knownLocations: profile.knownLocations.length
        },
        resolved: false
      };
    }

    return null;
  }

  private detectDeviceAnomaly(profile: UserBehaviorProfile, context: SecurityContext): SecurityEvent | null {
    // Check if this is a new device
    if (!profile.knownDevices.includes(context.deviceId)) {
      return {
        id: `device_anomaly_${Date.now()}`,
        type: SecurityEventType.ANOMALOUS_PATTERN,
        severity: SecuritySeverity.HIGH,
        timestamp: context.timestamp,
        context,
        details: {
          anomalyType: 'unknown_device',
          deviceId: context.deviceId,
          knownDevices: profile.knownDevices.length
        },
        resolved: false
      };
    }

    return null;
  }

  private detectRapidFailures(events: SecurityEvent[]): void {
    const failureEvents = events.filter(e => 
      e.type === SecurityEventType.UNAUTHORIZED_ACCESS ||
      e.type === SecurityEventType.DATA_BREACH_ATTEMPT
    );

    if (failureEvents.length > 5) { // More than 5 failures in an hour
      const anomaly: SecurityEvent = {
        id: `rapid_failures_${Date.now()}`,
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
        severity: SecuritySeverity.HIGH,
        timestamp: Date.now(),
        context: failureEvents[0].context,
        details: {
          anomalyType: 'rapid_failures',
          failureCount: failureEvents.length,
          timeWindow: '1 hour'
        },
        resolved: false
      };

      this.recordEvent(anomaly);
    }
  }

  private detectUnusualVolumeSpikes(events: SecurityEvent[]): void {
    const currentHourEvents = events.length;
    const averageHourlyEvents = this.calculateAverageHourlyEvents();

    if (currentHourEvents > averageHourlyEvents * 3) { // 3x normal volume
      const anomaly: SecurityEvent = {
        id: `volume_spike_${Date.now()}`,
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
        severity: SecuritySeverity.MEDIUM,
        timestamp: Date.now(),
        context: events[0]?.context || {} as SecurityContext,
        details: {
          anomalyType: 'volume_spike',
          currentVolume: currentHourEvents,
          averageVolume: averageHourlyEvents
        },
        resolved: false
      };

      this.recordEvent(anomaly);
    }
  }

  private detectCoordinatedAttacks(events: SecurityEvent[]): void {
    // Group events by IP address
    const ipGroups = new Map<string, SecurityEvent[]>();
    
    events.forEach(event => {
      const ip = event.context.networkInfo?.ipAddress;
      if (ip) {
        if (!ipGroups.has(ip)) {
          ipGroups.set(ip, []);
        }
        ipGroups.get(ip)!.push(event);
      }
    });

    // Check for coordinated attacks from multiple IPs
    const suspiciousIPs = Array.from(ipGroups.entries())
      .filter(([ip, events]) => events.length > 3)
      .map(([ip]) => ip);

    if (suspiciousIPs.length > 2) {
      const anomaly: SecurityEvent = {
        id: `coordinated_attack_${Date.now()}`,
        type: SecurityEventType.SUSPICIOUS_BEHAVIOR,
        severity: SecuritySeverity.CRITICAL,
        timestamp: Date.now(),
        context: events[0].context,
        details: {
          anomalyType: 'coordinated_attack',
          suspiciousIPs,
          eventCount: events.length
        },
        resolved: false
      };

      this.recordEvent(anomaly);
    }
  }

  private getUserBehaviorProfile(userId: string): UserBehaviorProfile {
    if (!this.userBehaviorProfiles.has(userId)) {
      this.userBehaviorProfiles.set(userId, {
        userId,
        typicalActiveHours: [],
        hourlyActivity: {},
        knownLocations: [],
        knownDevices: [],
        lastUpdated: Date.now()
      });
    }

    return this.userBehaviorProfiles.get(userId)!;
  }

  private updateUserProfile(userId: string, context: SecurityContext): void {
    const profile = this.getUserBehaviorProfile(userId);
    const hour = new Date(context.timestamp).getHours();

    // Update hourly activity
    profile.hourlyActivity[hour] = (profile.hourlyActivity[hour] || 0) + 1;

    // Update typical active hours
    if (!profile.typicalActiveHours.includes(hour)) {
      const totalActivity = Object.values(profile.hourlyActivity).reduce((sum, count) => sum + count, 0);
      const hourActivity = profile.hourlyActivity[hour];
      
      if (hourActivity / totalActivity > 0.05) { // More than 5% of activity
        profile.typicalActiveHours.push(hour);
      }
    }

    // Update known devices
    if (!profile.knownDevices.includes(context.deviceId)) {
      profile.knownDevices.push(context.deviceId);
    }

    // Update known locations
    if (context.location) {
      const isKnownLocation = profile.knownLocations.some(loc => 
        this.calculateDistance(context.location!, loc) < 100 // Within 100m
      );
      
      if (!isKnownLocation) {
        profile.knownLocations.push(context.location);
      }
    }

    profile.lastUpdated = Date.now();
  }

  private getRecentEvents(timeWindow: number): SecurityEvent[] {
    const cutoff = Date.now() - timeWindow;
    return this.eventHistory.filter(event => event.timestamp > cutoff);
  }

  private calculateAverageHourlyEvents(): number {
    const hoursOfData = Math.min(24, this.eventHistory.length / 10); // Rough estimate
    return hoursOfData > 0 ? this.eventHistory.length / hoursOfData : 0;
  }

  private matchesPattern(event: SecurityEvent, pattern: AnomalyPattern): boolean {
    // Simple pattern matching - in reality this would be more sophisticated
    return event.type.toString().includes(pattern.type);
  }

  private handlePatternMatch(event: SecurityEvent, pattern: AnomalyPattern): void {
    // Escalate based on pattern severity
    if (pattern.severity === SecuritySeverity.CRITICAL) {
      // Immediate response required
      console.warn(`Critical pattern detected: ${pattern.description}`, event);
    }
  }

  private calculateDistance(loc1: GeolocationCoordinates, loc2: GeolocationCoordinates): number {
    // Haversine formula for distance calculation
    const R = 6371e3; // Earth's radius in meters
    const φ1 = loc1.latitude * Math.PI/180;
    const φ2 = loc2.latitude * Math.PI/180;
    const Δφ = (loc2.latitude-loc1.latitude) * Math.PI/180;
    const Δλ = (loc2.longitude-loc1.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private initializeDefaultPatterns(): void {
    this.patterns.set('rapid_login_failures', {
      id: 'rapid_login_failures',
      type: 'unauthorized_access',
      description: 'Multiple failed login attempts in short time',
      threshold: 5,
      timeWindow: 300000, // 5 minutes
      severity: SecuritySeverity.HIGH
    });

    this.patterns.set('unusual_data_access', {
      id: 'unusual_data_access',
      type: 'data_breach_attempt',
      description: 'Unusual patterns in data access',
      threshold: 10,
      timeWindow: 3600000, // 1 hour
      severity: SecuritySeverity.MEDIUM
    });
  }
}

interface UserBehaviorProfile {
  userId: string;
  typicalActiveHours: number[];
  hourlyActivity: Record<number, number>;
  knownLocations: GeolocationCoordinates[];
  knownDevices: string[];
  lastUpdated: number;
}