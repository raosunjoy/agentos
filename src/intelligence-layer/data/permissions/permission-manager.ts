/**
 * Granular permission management system
 */

import { 
  Permission, 
  PermissionRequest, 
  PermissionEvaluationResult, 
  ConsentRecord, 
  PermissionPolicy,
  PermissionAction,
  RequestContext
} from './types';
import { ContextEvaluator } from './context-evaluator';
import { AuditLogger } from './audit-logger';

export class PermissionManager {
  private permissions: Map<string, Permission[]> = new Map();
  private consents: Map<string, ConsentRecord[]> = new Map();
  private policies: Map<string, PermissionPolicy> = new Map();
  private contextEvaluator: ContextEvaluator;
  private auditLogger: AuditLogger;

  constructor() {
    this.contextEvaluator = new ContextEvaluator();
    this.auditLogger = new AuditLogger();
  }

  /**
   * Grant permission to a user for a specific resource and action
   */
  async grantPermission(
    userId: string,
    resourceType: string,
    action: PermissionAction,
    grantedBy: string,
    options: {
      resourceId?: string;
      expiresAt?: Date;
      conditions?: any[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Permission> {
    const permission: Permission = {
      id: this.generateId(),
      userId,
      resourceType,
      resourceId: options.resourceId,
      action,
      granted: true,
      grantedBy,
      grantedAt: new Date(),
      expiresAt: options.expiresAt,
      conditions: options.conditions,
      metadata: options.metadata
    };

    // Store permission
    const userPermissions = this.permissions.get(userId) || [];
    userPermissions.push(permission);
    this.permissions.set(userId, userPermissions);

    // Log the grant
    await this.auditLogger.logPermissionGrant(permission);

    return permission;
  }

  /**
   * Revoke a specific permission
   */
  async revokePermission(permissionId: string, revokedBy: string): Promise<boolean> {
    for (const [userId, userPermissions] of this.permissions) {
      const permissionIndex = userPermissions.findIndex(p => p.id === permissionId);
      if (permissionIndex !== -1) {
        const permission = userPermissions[permissionIndex];
        userPermissions.splice(permissionIndex, 1);
        
        // Log the revocation
        await this.auditLogger.logPermissionRevocation(permission, revokedBy);
        
        return true;
      }
    }
    return false;
  }

  /**
   * Revoke all permissions for a user and resource type
   */
  async revokeAllPermissions(
    userId: string, 
    resourceType: string, 
    revokedBy: string
  ): Promise<number> {
    const userPermissions = this.permissions.get(userId) || [];
    const toRevoke = userPermissions.filter(p => p.resourceType === resourceType);
    
    // Remove permissions
    const remaining = userPermissions.filter(p => p.resourceType !== resourceType);
    this.permissions.set(userId, remaining);

    // Log revocations
    for (const permission of toRevoke) {
      await this.auditLogger.logPermissionRevocation(permission, revokedBy);
    }

    return toRevoke.length;
  }

  /**
   * Check if a user has permission for a specific action
   */
  async checkPermission(request: PermissionRequest): Promise<PermissionEvaluationResult> {
    const { userId, resourceType, resourceId, action, context } = request;

    // Get user permissions
    const userPermissions = this.permissions.get(userId) || [];
    
    // Find applicable permissions
    const applicablePermissions = userPermissions.filter(p => 
      p.resourceType === resourceType &&
      p.action === action &&
      p.granted &&
      (!p.resourceId || p.resourceId === resourceId) &&
      (!p.expiresAt || p.expiresAt > new Date())
    );

    if (applicablePermissions.length === 0) {
      const result: PermissionEvaluationResult = {
        granted: false,
        reason: 'No applicable permissions found',
        auditRequired: true
      };
      
      await this.auditLogger.logPermissionCheck(request, result);
      return result;
    }

    // Evaluate conditions for each permission
    for (const permission of applicablePermissions) {
      if (!permission.conditions || permission.conditions.length === 0) {
        const result: PermissionEvaluationResult = {
          granted: true,
          reason: 'Permission granted without conditions',
          expiresAt: permission.expiresAt,
          auditRequired: this.requiresAudit(resourceType, action)
        };
        
        await this.auditLogger.logPermissionCheck(request, result);
        return result;
      }

      // Evaluate conditions
      const conditionResult = await this.contextEvaluator.evaluateConditions(
        permission.conditions,
        context
      );

      if (conditionResult.satisfied) {
        const result: PermissionEvaluationResult = {
          granted: true,
          reason: 'Permission granted with satisfied conditions',
          conditions: permission.conditions,
          expiresAt: permission.expiresAt,
          auditRequired: this.requiresAudit(resourceType, action)
        };
        
        await this.auditLogger.logPermissionCheck(request, result);
        return result;
      }
    }

    // No permissions satisfied conditions
    const result: PermissionEvaluationResult = {
      granted: false,
      reason: 'Permission conditions not satisfied',
      auditRequired: true
    };
    
    await this.auditLogger.logPermissionCheck(request, result);
    return result;
  }

  /**
   * Get all permissions for a user
   */
  getUserPermissions(userId: string): Permission[] {
    return this.permissions.get(userId) || [];
  }

  /**
   * Get permissions for a specific resource type
   */
  getResourcePermissions(userId: string, resourceType: string): Permission[] {
    const userPermissions = this.permissions.get(userId) || [];
    return userPermissions.filter(p => p.resourceType === resourceType);
  }

  /**
   * Record user consent for data processing
   */
  async recordConsent(
    userId: string,
    resourceType: string,
    purpose: string,
    granted: boolean,
    expiresAt?: Date
  ): Promise<ConsentRecord> {
    const consent: ConsentRecord = {
      id: this.generateId(),
      userId,
      resourceType,
      purpose,
      granted,
      grantedAt: new Date(),
      expiresAt
    };

    const userConsents = this.consents.get(userId) || [];
    userConsents.push(consent);
    this.consents.set(userId, userConsents);

    await this.auditLogger.logConsentRecord(consent);
    return consent;
  }

  /**
   * Revoke user consent
   */
  async revokeConsent(consentId: string, revokedBy: string): Promise<boolean> {
    for (const [userId, userConsents] of this.consents) {
      const consent = userConsents.find(c => c.id === consentId);
      if (consent) {
        consent.revokedAt = new Date();
        consent.revokedBy = revokedBy;
        
        await this.auditLogger.logConsentRevocation(consent);
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has given consent for a specific purpose
   */
  hasConsent(userId: string, resourceType: string, purpose: string): boolean {
    const userConsents = this.consents.get(userId) || [];
    return userConsents.some(c => 
      c.resourceType === resourceType &&
      c.purpose === purpose &&
      c.granted &&
      !c.revokedAt &&
      (!c.expiresAt || c.expiresAt > new Date())
    );
  }

  /**
   * Get all consents for a user
   */
  getUserConsents(userId: string): ConsentRecord[] {
    return this.consents.get(userId) || [];
  }

  /**
   * Clean up expired permissions and consents
   */
  async cleanupExpired(): Promise<{ permissions: number; consents: number }> {
    let expiredPermissions = 0;
    let expiredConsents = 0;
    const now = new Date();

    // Clean up expired permissions
    for (const [userId, userPermissions] of this.permissions) {
      const validPermissions = userPermissions.filter(p => {
        if (p.expiresAt && p.expiresAt <= now) {
          expiredPermissions++;
          return false;
        }
        return true;
      });
      this.permissions.set(userId, validPermissions);
    }

    // Clean up expired consents
    for (const [userId, userConsents] of this.consents) {
      userConsents.forEach(c => {
        if (c.expiresAt && c.expiresAt <= now && !c.revokedAt) {
          c.revokedAt = now;
          c.revokedBy = 'system_expiry';
          expiredConsents++;
        }
      });
    }

    return { permissions: expiredPermissions, consents: expiredConsents };
  }

  /**
   * Register a permission policy
   */
  registerPolicy(policy: PermissionPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Get all active policies for a resource type
   */
  getPolicies(resourceType: string): PermissionPolicy[] {
    return Array.from(this.policies.values())
      .filter(p => p.resourceType === resourceType && p.active)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if an action requires audit logging
   */
  private requiresAudit(resourceType: string, action: PermissionAction): boolean {
    // Sensitive actions always require audit
    const sensitiveActions: PermissionAction[] = ['delete', 'share', 'export', 'modify_permissions'];
    if (sensitiveActions.includes(action)) {
      return true;
    }

    // Sensitive resource types require audit
    const sensitiveResources = ['health_data', 'location', 'contact'];
    return sensitiveResources.includes(resourceType);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get permission statistics
   */
  getStats(): {
    totalPermissions: number;
    totalConsents: number;
    activePermissions: number;
    expiredPermissions: number;
  } {
    let totalPermissions = 0;
    let activePermissions = 0;
    let expiredPermissions = 0;
    const now = new Date();

    for (const userPermissions of this.permissions.values()) {
      totalPermissions += userPermissions.length;
      for (const permission of userPermissions) {
        if (!permission.expiresAt || permission.expiresAt > now) {
          activePermissions++;
        } else {
          expiredPermissions++;
        }
      }
    }

    let totalConsents = 0;
    for (const userConsents of this.consents.values()) {
      totalConsents += userConsents.length;
    }

    return {
      totalPermissions,
      totalConsents,
      activePermissions,
      expiredPermissions
    };
  }
}