/**
 * Consent Manager for caregiver access control
 * Handles explicit consent mechanisms and granular permission management
 */

import { EventEmitter } from 'events';
import {
  CaregiverProfile,
  ConsentRequest,
  CaregiverPermission,
  ConsentStatus,
  PermissionType,
  PermissionScope,
  CaregiverRole,
  VerificationStatus,
  ConsentConfiguration,
  AccessAuditLog,
  AuditAction
} from './types';

export class ConsentManager extends EventEmitter {
  private consentRequests: Map<string, ConsentRequest> = new Map();
  private activeConsents: Map<string, CaregiverPermission[]> = new Map();
  private auditLogger: AccessAuditLogger;
  private config: ConsentConfiguration;

  constructor(auditLogger: AccessAuditLogger, config: ConsentConfiguration) {
    super();
    this.auditLogger = auditLogger;
    this.config = config;
    
    // Set up periodic consent reconfirmation if enabled
    if (config.requirePeriodicReconfirmation) {
      this.setupPeriodicReconfirmation();
    }
  }

  /**
   * Create a new consent request from a caregiver
   */
  async createConsentRequest(
    caregiverId: string,
    requestedPermissions: CaregiverPermission[],
    requestedRole: CaregiverRole,
    message?: string,
    expiresAt?: Date
  ): Promise<ConsentRequest> {
    if (!this.config.requireExplicitConsent && requestedRole === CaregiverRole.EMERGENCY_CONTACT) {
      // Auto-approve emergency contacts if explicit consent not required
      return this.autoApproveEmergencyConsent(caregiverId, requestedPermissions, requestedRole);
    }

    const request: ConsentRequest = {
      id: this.generateRequestId(),
      caregiverId,
      requestedPermissions: this.validatePermissions(requestedPermissions),
      requestedRole,
      message,
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      createdAt: new Date(),
      status: ConsentStatus.PENDING
    };

    this.consentRequests.set(request.id, request);
    
    // Emit event for UI notification
    this.emit('consentRequestCreated', request);
    
    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.PERMISSION_GRANTED,
      resource: 'consent_request',
      timestamp: new Date(),
      success: true,
      details: { requestId: request.id, requestedRole, permissionCount: requestedPermissions.length }
    });

    return request;
  }

  /**
   * Approve a consent request
   */
  async approveConsentRequest(
    requestId: string,
    userId: string,
    customPermissions?: CaregiverPermission[]
  ): Promise<boolean> {
    const request = this.consentRequests.get(requestId);
    if (!request || request.status !== ConsentStatus.PENDING) {
      throw new Error('Invalid or already processed consent request');
    }

    if (request.expiresAt && request.expiresAt < new Date()) {
      request.status = ConsentStatus.EXPIRED;
      this.consentRequests.set(requestId, request);
      return false;
    }

    // Use custom permissions if provided, otherwise use requested permissions
    const permissions = customPermissions || request.requestedPermissions;
    const validatedPermissions = this.validateAndLimitPermissions(permissions);

    // Store active consent
    this.activeConsents.set(request.caregiverId, validatedPermissions);
    
    // Update request status
    request.status = ConsentStatus.APPROVED;
    this.consentRequests.set(requestId, request);

    // Emit approval event
    this.emit('consentApproved', {
      caregiverId: request.caregiverId,
      permissions: validatedPermissions,
      approvedBy: userId
    });

    await this.auditLogger.log({
      caregiverId: request.caregiverId,
      action: AuditAction.PERMISSION_GRANTED,
      resource: 'consent_approval',
      timestamp: new Date(),
      success: true,
      details: { 
        requestId, 
        approvedBy: userId, 
        permissionCount: validatedPermissions.length 
      }
    });

    return true;
  }

  /**
   * Deny a consent request
   */
  async denyConsentRequest(requestId: string, userId: string, reason?: string): Promise<boolean> {
    const request = this.consentRequests.get(requestId);
    if (!request || request.status !== ConsentStatus.PENDING) {
      throw new Error('Invalid or already processed consent request');
    }

    request.status = ConsentStatus.DENIED;
    this.consentRequests.set(requestId, request);

    this.emit('consentDenied', {
      caregiverId: request.caregiverId,
      deniedBy: userId,
      reason
    });

    await this.auditLogger.log({
      caregiverId: request.caregiverId,
      action: AuditAction.PERMISSION_REVOKED,
      resource: 'consent_denial',
      timestamp: new Date(),
      success: true,
      details: { requestId, deniedBy: userId, reason }
    });

    return true;
  }

  /**
   * Revoke existing consent for a caregiver
   */
  async revokeConsent(caregiverId: string, userId: string, reason?: string): Promise<boolean> {
    const permissions = this.activeConsents.get(caregiverId);
    if (!permissions) {
      return false;
    }

    // Remove active consent
    this.activeConsents.delete(caregiverId);

    // Update any pending requests from this caregiver
    for (const [requestId, request] of this.consentRequests.entries()) {
      if (request.caregiverId === caregiverId && request.status === ConsentStatus.PENDING) {
        request.status = ConsentStatus.REVOKED;
        this.consentRequests.set(requestId, request);
      }
    }

    this.emit('consentRevoked', {
      caregiverId,
      revokedBy: userId,
      reason,
      revokedPermissions: permissions
    });

    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.PERMISSION_REVOKED,
      resource: 'consent_revocation',
      timestamp: new Date(),
      success: true,
      details: { revokedBy: userId, reason, permissionCount: permissions.length }
    });

    return true;
  }

  /**
   * Check if caregiver has specific permission
   */
  hasPermission(
    caregiverId: string, 
    permissionType: PermissionType, 
    scope?: PermissionScope
  ): boolean {
    const permissions = this.activeConsents.get(caregiverId);
    if (!permissions) {
      return false;
    }

    return permissions.some(permission => {
      // Check if permission is expired
      if (permission.expiresAt && permission.expiresAt < new Date()) {
        return false;
      }

      // Check permission type match
      if (permission.type !== permissionType) {
        return false;
      }

      // Check scope if specified
      if (scope && permission.scope !== scope) {
        return false;
      }

      // Check conditions if any
      if (permission.conditions && !this.evaluateConditions(permission.conditions)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get all active permissions for a caregiver
   */
  getCaregiverPermissions(caregiverId: string): CaregiverPermission[] {
    const permissions = this.activeConsents.get(caregiverId);
    if (!permissions) {
      return [];
    }

    // Filter out expired permissions
    const activePermissions = permissions.filter(permission => 
      !permission.expiresAt || permission.expiresAt > new Date()
    );

    // Update stored permissions if any were filtered out
    if (activePermissions.length !== permissions.length) {
      this.activeConsents.set(caregiverId, activePermissions);
    }

    return activePermissions;
  }

  /**
   * Get all pending consent requests
   */
  getPendingConsentRequests(): ConsentRequest[] {
    return Array.from(this.consentRequests.values())
      .filter(request => request.status === ConsentStatus.PENDING)
      .filter(request => !request.expiresAt || request.expiresAt > new Date());
  }

  /**
   * Get consent request by ID
   */
  getConsentRequest(requestId: string): ConsentRequest | undefined {
    return this.consentRequests.get(requestId);
  }

  private validatePermissions(permissions: CaregiverPermission[]): CaregiverPermission[] {
    return permissions.map(permission => ({
      ...permission,
      grantedAt: new Date(),
      expiresAt: permission.expiresAt || new Date(
        Date.now() + this.config.defaultPermissionDuration * 24 * 60 * 60 * 1000
      )
    }));
  }

  private validateAndLimitPermissions(permissions: CaregiverPermission[]): CaregiverPermission[] {
    const maxDuration = this.config.maxPermissionDuration * 24 * 60 * 60 * 1000;
    
    return permissions.map(permission => {
      const expiresAt = permission.expiresAt || new Date(
        Date.now() + this.config.defaultPermissionDuration * 24 * 60 * 60 * 1000
      );
      
      // Limit to maximum duration
      const limitedExpiresAt = new Date(Math.min(
        expiresAt.getTime(),
        Date.now() + maxDuration
      ));

      return {
        ...permission,
        grantedAt: new Date(),
        expiresAt: limitedExpiresAt
      };
    });
  }

  private async autoApproveEmergencyConsent(
    caregiverId: string,
    requestedPermissions: CaregiverPermission[],
    requestedRole: CaregiverRole
  ): Promise<ConsentRequest> {
    const request: ConsentRequest = {
      id: this.generateRequestId(),
      caregiverId,
      requestedPermissions,
      requestedRole,
      createdAt: new Date(),
      status: ConsentStatus.APPROVED
    };

    // Only grant emergency permissions for auto-approval
    const emergencyPermissions = requestedPermissions.filter(p => 
      p.type === PermissionType.RECEIVE_EMERGENCY_ALERTS ||
      p.scope === PermissionScope.EMERGENCY_ONLY
    );

    this.activeConsents.set(caregiverId, this.validatePermissions(emergencyPermissions));
    this.consentRequests.set(request.id, request);

    this.emit('consentAutoApproved', {
      caregiverId,
      permissions: emergencyPermissions,
      role: requestedRole
    });

    return request;
  }

  private evaluateConditions(conditions: any[]): boolean {
    // Simplified condition evaluation - would be more complex in real implementation
    return conditions.every(condition => {
      switch (condition.type) {
        case 'time_of_day':
          const currentHour = new Date().getHours();
          return this.evaluateTimeCondition(currentHour, condition);
        case 'emergency_status':
          return true; // Would check actual emergency status
        default:
          return true;
      }
    });
  }

  private evaluateTimeCondition(currentHour: number, condition: any): boolean {
    const targetHour = parseInt(condition.value);
    switch (condition.operator) {
      case 'greater_than':
        return currentHour > targetHour;
      case 'less_than':
        return currentHour < targetHour;
      case 'equals':
        return currentHour === targetHour;
      default:
        return true;
    }
  }

  private setupPeriodicReconfirmation(): void {
    const interval = this.config.reconfirmationInterval * 24 * 60 * 60 * 1000;
    
    setInterval(() => {
      this.checkForReconfirmationNeeded();
    }, interval);
  }

  private checkForReconfirmationNeeded(): void {
    const reconfirmationThreshold = new Date(
      Date.now() - this.config.reconfirmationInterval * 24 * 60 * 60 * 1000
    );

    for (const [caregiverId, permissions] of this.activeConsents.entries()) {
      const needsReconfirmation = permissions.some(permission => 
        permission.grantedAt < reconfirmationThreshold
      );

      if (needsReconfirmation) {
        this.emit('reconfirmationRequired', { caregiverId, permissions });
      }
    }
  }

  private generateRequestId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface AccessAuditLogger {
  log(entry: Omit<AccessAuditLog, 'id'>): Promise<void>;
}