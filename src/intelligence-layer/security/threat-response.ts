import { SecurityEvent, SecuritySeverity, ThreatResponse, ThreatAction, SecurityEventType } from './types';

/**
 * Automatic threat response system
 */
export class ThreatResponseManager {
  private responseRules: Map<string, ResponseRule> = new Map();
  private activeResponses: Map<string, ThreatResponse> = new Map();
  private responseHistory: ResponseRecord[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Process security event and determine appropriate response
   */
  async processSecurityEvent(event: SecurityEvent): Promise<ThreatResponse | null> {
    const rule = this.findMatchingRule(event);
    if (!rule) {
      return null;
    }

    const response = await this.executeResponse(event, rule);
    
    if (response) {
      this.activeResponses.set(event.id, response);
      this.recordResponse(event, response);
    }

    return response;
  }

  /**
   * Add custom response rule
   */
  addResponseRule(rule: ResponseRule): void {
    this.responseRules.set(rule.id, rule);
  }

  /**
   * Remove response rule
   */
  removeResponseRule(ruleId: string): void {
    this.responseRules.delete(ruleId);
  }

  /**
   * Get active threat responses
   */
  getActiveResponses(): ThreatResponse[] {
    return Array.from(this.activeResponses.values());
  }

  /**
   * Get response history for audit
   */
  getResponseHistory(): ResponseRecord[] {
    return [...this.responseHistory];
  }

  /**
   * Manually resolve a threat response
   */
  resolveResponse(eventId: string): boolean {
    const response = this.activeResponses.get(eventId);
    if (response) {
      this.activeResponses.delete(eventId);
      return true;
    }
    return false;
  }

  private findMatchingRule(event: SecurityEvent): ResponseRule | null {
    for (const rule of this.responseRules.values()) {
      if (this.ruleMatches(rule, event)) {
        return rule;
      }
    }
    return null;
  }

  private ruleMatches(rule: ResponseRule, event: SecurityEvent): boolean {
    // Check event type match
    if (rule.eventTypes && !rule.eventTypes.includes(event.type)) {
      return false;
    }

    // Check severity threshold
    if (rule.minSeverity && this.getSeverityLevel(event.severity) < this.getSeverityLevel(rule.minSeverity)) {
      return false;
    }

    // Check custom conditions
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, event)) {
          return false;
        }
      }
    }

    return true;
  }

  private async executeResponse(event: SecurityEvent, rule: ResponseRule): Promise<ThreatResponse> {
    const response: ThreatResponse = {
      action: rule.action,
      reason: rule.description,
      automatic: rule.automatic,
      timestamp: Date.now()
    };

    try {
      switch (rule.action) {
        case ThreatAction.BLOCK:
          await this.executeBlockAction(event, rule);
          break;
        
        case ThreatAction.QUARANTINE:
          await this.executeQuarantineAction(event, rule);
          break;
        
        case ThreatAction.ALERT_USER:
          await this.executeAlertAction(event, rule);
          break;
        
        case ThreatAction.REVOKE_PERMISSIONS:
          await this.executeRevokePermissionsAction(event, rule);
          break;
        
        case ThreatAction.DISABLE_PLUGIN:
          await this.executeDisablePluginAction(event, rule);
          break;
        
        case ThreatAction.FORCE_LOGOUT:
          await this.executeForceLogoutAction(event, rule);
          break;
      }
    } catch (error) {
      console.error(`Failed to execute threat response: ${error.message}`);
      response.reason = `Response execution failed: ${error.message}`;
    }

    return response;
  }

  private async executeBlockAction(event: SecurityEvent, rule: ResponseRule): Promise<void> {
    // Block the specific request or IP address
    console.log(`Blocking access for event: ${event.id}`);
    
    // In a real implementation, this would:
    // - Add IP to blocklist
    // - Block specific user session
    // - Prevent access to specific resources
  }

  private async executeQuarantineAction(event: SecurityEvent, rule: ResponseRule): Promise<void> {
    // Quarantine suspicious activity
    console.log(`Quarantining activity for event: ${event.id}`);
    
    // In a real implementation, this would:
    // - Isolate suspicious processes
    // - Limit network access
    // - Restrict file system access
  }

  private async executeAlertAction(event: SecurityEvent, rule: ResponseRule): Promise<void> {
    // Send alert to user and/or administrators
    console.log(`Sending alert for event: ${event.id}`);
    
    // In a real implementation, this would:
    // - Send push notification to user
    // - Email security team
    // - Log to security information system
    
    await this.sendUserAlert(event);
  }

  private async executeRevokePermissionsAction(event: SecurityEvent, rule: ResponseRule): Promise<void> {
    // Revoke permissions for suspicious activity
    console.log(`Revoking permissions for event: ${event.id}`);
    
    // In a real implementation, this would:
    // - Revoke specific app permissions
    // - Invalidate access tokens
    // - Reset user consent decisions
  }

  private async executeDisablePluginAction(event: SecurityEvent, rule: ResponseRule): Promise<void> {
    // Disable malicious or compromised plugin
    console.log(`Disabling plugin for event: ${event.id}`);
    
    // In a real implementation, this would:
    // - Unload plugin from memory
    // - Disable plugin in registry
    // - Quarantine plugin files
  }

  private async executeForceLogoutAction(event: SecurityEvent, rule: ResponseRule): Promise<void> {
    // Force user logout for security
    console.log(`Forcing logout for event: ${event.id}`);
    
    // In a real implementation, this would:
    // - Invalidate all user sessions
    // - Clear authentication tokens
    // - Require re-authentication
  }

  private async sendUserAlert(event: SecurityEvent): Promise<void> {
    // Simulate sending user alert
    const alertMessage = this.generateAlertMessage(event);
    console.log(`User Alert: ${alertMessage}`);
    
    // In a real implementation, this would integrate with:
    // - Push notification service
    // - SMS gateway
    // - Email service
    // - In-app notification system
  }

  private generateAlertMessage(event: SecurityEvent): string {
    switch (event.type) {
      case SecurityEventType.UNAUTHORIZED_ACCESS:
        return `Unauthorized access attempt detected from ${event.context.networkInfo?.ipAddress}`;
      
      case SecurityEventType.SUSPICIOUS_BEHAVIOR:
        return `Suspicious activity detected on your account`;
      
      case SecurityEventType.DATA_BREACH_ATTEMPT:
        return `Potential data breach attempt blocked`;
      
      case SecurityEventType.MALICIOUS_PLUGIN:
        return `Malicious plugin detected and disabled`;
      
      case SecurityEventType.CONSENT_VIOLATION:
        return `App attempted to access data without proper consent`;
      
      case SecurityEventType.ANOMALOUS_PATTERN:
        return `Unusual activity pattern detected on your account`;
      
      default:
        return `Security event detected: ${event.type}`;
    }
  }

  private evaluateCondition(condition: ResponseCondition, event: SecurityEvent): boolean {
    switch (condition.type) {
      case 'user_id':
        return event.context.userId === condition.value;
      
      case 'ip_address':
        return event.context.networkInfo?.ipAddress === condition.value;
      
      case 'device_id':
        return event.context.deviceId === condition.value;
      
      case 'time_window':
        const timeWindow = condition.value as number;
        return Date.now() - event.timestamp < timeWindow;
      
      default:
        return false;
    }
  }

  private getSeverityLevel(severity: SecuritySeverity): number {
    switch (severity) {
      case SecuritySeverity.LOW: return 1;
      case SecuritySeverity.MEDIUM: return 2;
      case SecuritySeverity.HIGH: return 3;
      case SecuritySeverity.CRITICAL: return 4;
      default: return 0;
    }
  }

  private recordResponse(event: SecurityEvent, response: ThreatResponse): void {
    this.responseHistory.push({
      event,
      response,
      timestamp: Date.now()
    });

    // Keep only recent history (last 30 days)
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.responseHistory = this.responseHistory.filter(record => record.timestamp > cutoff);
  }

  private initializeDefaultRules(): void {
    // Rule for unauthorized access attempts
    this.addResponseRule({
      id: 'block_unauthorized_access',
      name: 'Block Unauthorized Access',
      description: 'Block IP addresses with repeated unauthorized access attempts',
      eventTypes: [SecurityEventType.UNAUTHORIZED_ACCESS],
      minSeverity: SecuritySeverity.MEDIUM,
      action: ThreatAction.BLOCK,
      automatic: true,
      conditions: [
        {
          type: 'time_window',
          value: 300000 // 5 minutes
        }
      ]
    });

    // Rule for suspicious behavior
    this.addResponseRule({
      id: 'alert_suspicious_behavior',
      name: 'Alert on Suspicious Behavior',
      description: 'Alert user when suspicious behavior is detected',
      eventTypes: [SecurityEventType.SUSPICIOUS_BEHAVIOR, SecurityEventType.ANOMALOUS_PATTERN],
      minSeverity: SecuritySeverity.MEDIUM,
      action: ThreatAction.ALERT_USER,
      automatic: true
    });

    // Rule for malicious plugins
    this.addResponseRule({
      id: 'disable_malicious_plugin',
      name: 'Disable Malicious Plugin',
      description: 'Automatically disable plugins detected as malicious',
      eventTypes: [SecurityEventType.MALICIOUS_PLUGIN],
      minSeverity: SecuritySeverity.HIGH,
      action: ThreatAction.DISABLE_PLUGIN,
      automatic: true
    });

    // Rule for critical security events
    this.addResponseRule({
      id: 'force_logout_critical',
      name: 'Force Logout on Critical Events',
      description: 'Force user logout for critical security events',
      minSeverity: SecuritySeverity.CRITICAL,
      action: ThreatAction.FORCE_LOGOUT,
      automatic: false // Require manual confirmation for logout
    });
  }
}

interface ResponseRule {
  id: string;
  name: string;
  description: string;
  eventTypes?: SecurityEventType[];
  minSeverity?: SecuritySeverity;
  action: ThreatAction;
  automatic: boolean;
  conditions?: ResponseCondition[];
}

interface ResponseCondition {
  type: 'user_id' | 'ip_address' | 'device_id' | 'time_window';
  value: any;
}

interface ResponseRecord {
  event: SecurityEvent;
  response: ThreatResponse;
  timestamp: number;
}