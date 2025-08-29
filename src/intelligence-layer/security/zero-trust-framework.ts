import { AccessControlManager } from './access-control';
import { ConsentManager } from './consent-manager';
import { AnomalyDetector } from './anomaly-detector';
import { ThreatResponseManager } from './threat-response';
import { 
  SecurityContext, 
  AccessRequest, 
  ConsentRequest, 
  SecurityEvent, 
  SecurityEventType,
  SecuritySeverity 
} from './types';

/**
 * Zero-trust security framework orchestrating all security components
 */
export class ZeroTrustFramework {
  private accessControl: AccessControlManager;
  private consentManager: ConsentManager;
  private anomalyDetector: AnomalyDetector;
  private threatResponse: ThreatResponseManager;
  private isInitialized: boolean = false;

  constructor() {
    this.accessControl = new AccessControlManager();
    this.consentManager = new ConsentManager();
    this.anomalyDetector = new AnomalyDetector();
    this.threatResponse = new ThreatResponseManager();
  }

  /**
   * Initialize the zero-trust framework
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Start continuous monitoring
      this.anomalyDetector.startMonitoring();

      // Set up default security policies
      await this.setupDefaultPolicies();

      this.isInitialized = true;
      console.log('Zero-trust security framework initialized');
    } catch (error) {
      console.error('Failed to initialize zero-trust framework:', error);
      throw error;
    }
  }

  /**
   * Shutdown the framework
   */
  async shutdown(): Promise<void> {
    this.anomalyDetector.stopMonitoring();
    this.isInitialized = false;
    console.log('Zero-trust security framework shutdown');
  }

  /**
   * Authorize access request using zero-trust principles
   */
  async authorizeAccess(request: AccessRequest): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Zero-trust framework not initialized');
    }

    try {
      // Step 1: Check for behavioral anomalies
      const anomalies = this.anomalyDetector.detectBehaviorAnomalies(
        request.context.userId, 
        request.context
      );

      if (anomalies.length > 0) {
        // Process anomalies through threat response
        for (const anomaly of anomalies) {
          await this.threatResponse.processSecurityEvent(anomaly);
        }

        // Block access if critical anomalies detected
        const criticalAnomalies = anomalies.filter(a => 
          a.severity === SecuritySeverity.CRITICAL || 
          a.severity === SecuritySeverity.HIGH
        );

        if (criticalAnomalies.length > 0) {
          this.recordSecurityEvent({
            id: `access_blocked_${Date.now()}`,
            type: SecurityEventType.UNAUTHORIZED_ACCESS,
            severity: SecuritySeverity.HIGH,
            timestamp: Date.now(),
            context: request.context,
            details: {
              reason: 'Access blocked due to behavioral anomalies',
              anomalies: criticalAnomalies.map(a => a.id)
            },
            resolved: false
          });

          return false;
        }
      }

      // Step 2: Evaluate access control policies
      const accessDecision = await this.accessControl.evaluateAccess(request);
      if (!accessDecision.allowed) {
        this.recordSecurityEvent({
          id: `access_denied_${Date.now()}`,
          type: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.MEDIUM,
          timestamp: Date.now(),
          context: request.context,
          details: {
            reason: accessDecision.reason,
            resource: request.resource,
            action: request.action
          },
          resolved: false
        });

        return false;
      }

      // Step 3: Check user consent for data access
      if (this.requiresConsent(request)) {
        const hasConsent = this.consentManager.hasValidConsent(
          request.resource,
          this.extractDataTypes(request),
          request.context.userId
        );

        if (!hasConsent) {
          this.recordSecurityEvent({
            id: `consent_required_${Date.now()}`,
            type: SecurityEventType.CONSENT_VIOLATION,
            severity: SecuritySeverity.MEDIUM,
            timestamp: Date.now(),
            context: request.context,
            details: {
              reason: 'Access requires user consent',
              resource: request.resource,
              action: request.action
            },
            resolved: false
          });

          return false;
        }
      }

      // Step 4: Record successful access
      this.recordSecurityEvent({
        id: `access_granted_${Date.now()}`,
        type: SecurityEventType.UNAUTHORIZED_ACCESS, // Using as general access event
        severity: SecuritySeverity.LOW,
        timestamp: Date.now(),
        context: request.context,
        details: {
          reason: 'Access granted',
          resource: request.resource,
          action: request.action
        },
        resolved: true
      });

      return true;

    } catch (error) {
      console.error('Error during access authorization:', error);
      
      // Default deny on error
      this.recordSecurityEvent({
        id: `access_error_${Date.now()}`,
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.HIGH,
        timestamp: Date.now(),
        context: request.context,
        details: {
          reason: `Authorization error: ${error.message}`,
          resource: request.resource,
          action: request.action
        },
        resolved: false
      });

      return false;
    }
  }

  /**
   * Request user consent for data access
   */
  async requestConsent(request: ConsentRequest): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Zero-trust framework not initialized');
    }

    try {
      const decision = await this.consentManager.requestConsent(request);
      
      this.recordSecurityEvent({
        id: `consent_${decision.granted ? 'granted' : 'denied'}_${Date.now()}`,
        type: SecurityEventType.CONSENT_VIOLATION,
        severity: SecuritySeverity.LOW,
        timestamp: Date.now(),
        context: request.context,
        details: {
          purpose: request.purpose,
          dataTypes: request.dataTypes,
          requester: request.requester,
          granted: decision.granted
        },
        resolved: true
      });

      return decision.granted;
    } catch (error) {
      console.error('Error during consent request:', error);
      return false;
    }
  }

  /**
   * Revoke user consent
   */
  async revokeConsent(consentId: string, userId: string): Promise<boolean> {
    const success = this.consentManager.revokeConsent(consentId, userId);
    
    if (success) {
      this.recordSecurityEvent({
        id: `consent_revoked_${Date.now()}`,
        type: SecurityEventType.CONSENT_VIOLATION,
        severity: SecuritySeverity.LOW,
        timestamp: Date.now(),
        context: { userId } as SecurityContext,
        details: {
          consentId,
          action: 'revoked'
        },
        resolved: true
      });
    }

    return success;
  }

  /**
   * Get security status and metrics
   */
  getSecurityStatus(): SecurityStatus {
    return {
      frameworkInitialized: this.isInitialized,
      activeThreats: this.threatResponse.getActiveResponses().length,
      recentEvents: this.getRecentSecurityEvents().length,
      monitoringActive: true, // Would check anomaly detector status
      lastUpdated: Date.now()
    };
  }

  /**
   * Get recent security events for dashboard
   */
  getRecentSecurityEvents(): SecurityEvent[] {
    // In a real implementation, this would query the event store
    return [];
  }

  private async setupDefaultPolicies(): Promise<void> {
    // Set up default access control policies
    this.accessControl.registerPolicy('user_data', 'read', {
      id: 'user_data_read',
      name: 'User Data Read Policy',
      description: 'Policy for reading user data',
      rules: [
        {
          type: 'user_identity',
          required: true
        },
        {
          type: 'device_trust',
          required: true
        }
      ]
    });

    this.accessControl.registerPolicy('user_data', 'write', {
      id: 'user_data_write',
      name: 'User Data Write Policy',
      description: 'Policy for writing user data',
      rules: [
        {
          type: 'user_identity',
          required: true
        },
        {
          type: 'device_trust',
          required: true
        },
        {
          type: 'network_based',
          conditions: { requireSecureNetwork: true },
          required: true
        }
      ]
    });

    this.accessControl.registerPolicy('sensitive_data', 'read', {
      id: 'sensitive_data_read',
      name: 'Sensitive Data Read Policy',
      description: 'Policy for reading sensitive data',
      rules: [
        {
          type: 'user_identity',
          required: true
        },
        {
          type: 'device_trust',
          required: true
        },
        {
          type: 'time_based',
          conditions: { allowedHours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
          required: true
        }
      ]
    });
  }

  private requiresConsent(request: AccessRequest): boolean {
    // Determine if the request requires user consent
    const sensitiveResources = ['contacts', 'location', 'health', 'financial', 'biometric'];
    return sensitiveResources.some(resource => 
      request.resource.toLowerCase().includes(resource)
    );
  }

  private extractDataTypes(request: AccessRequest): string[] {
    // Extract data types from the request
    // In a real implementation, this would be more sophisticated
    return [request.resource];
  }

  private recordSecurityEvent(event: SecurityEvent): void {
    this.anomalyDetector.recordEvent(event);
  }
}

interface SecurityStatus {
  frameworkInitialized: boolean;
  activeThreats: number;
  recentEvents: number;
  monitoringActive: boolean;
  lastUpdated: number;
}