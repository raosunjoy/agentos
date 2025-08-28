/**
 * Permission Validator - Validates access permissions for context data
 * 
 * Handles permission checking, validation, and enforcement for
 * context data access and updates.
 */

import {
  DataPermission,
  ServicePermission,
  TemporaryPermission,
  PermissionCondition,
  ServiceRestriction
} from './context-types';

export class PermissionValidator {
  private servicePermissions: Map<string, ServicePermission> = new Map();
  private rateLimits: Map<string, RateLimitTracker> = new Map();

  /**
   * Validate access permissions for context data
   */
  async validateAccess(
    serviceId: string,
    userId: string,
    dataTypes: string[]
  ): Promise<boolean> {
    try {
      // Check if service has general permissions
      const servicePermission = this.servicePermissions.get(serviceId);
      if (!servicePermission || !servicePermission.isActive) {
        return false;
      }

      // Check if service is rate limited
      if (this.isRateLimited(serviceId)) {
        return false;
      }

      // Check each data type permission
      for (const dataType of dataTypes) {
        if (!this.hasDataTypePermission(serviceId, dataType)) {
          return false;
        }
      }

      // Update rate limit tracking
      this.updateRateLimit(serviceId);

      return true;
    } catch (error) {
      console.error('Error validating access permissions:', error);
      return false;
    }
  }

  /**
   * Validate update permissions
   */
  async validateUpdate(
    serviceId: string,
    userId: string,
    updateFields: string[]
  ): Promise<boolean> {
    try {
      const servicePermission = this.servicePermissions.get(serviceId);
      if (!servicePermission || !servicePermission.isActive) {
        return false;
      }

      // Check if service has write permissions for each field
      for (const field of updateFields) {
        const hasWritePermission = servicePermission.permissions.includes(`write:${field}`) ||
                                 servicePermission.permissions.includes('write:*');
        
        if (!hasWritePermission) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating update permissions:', error);
      return false;
    }
  }

  /**
   * Register service permissions
   */
  registerServicePermissions(serviceId: string, permission: ServicePermission): void {
    this.servicePermissions.set(serviceId, permission);
  }

  /**
   * Revoke service permissions
   */
  revokeServicePermissions(serviceId: string): void {
    const permission = this.servicePermissions.get(serviceId);
    if (permission) {
      permission.isActive = false;
      this.servicePermissions.set(serviceId, permission);
    }
  }

  /**
   * Check if service has permission for specific data type
   */
  private hasDataTypePermission(serviceId: string, dataType: string): boolean {
    const servicePermission = this.servicePermissions.get(serviceId);
    if (!servicePermission) {
      return false;
    }

    return servicePermission.permissions.includes(`read:${dataType}`) ||
           servicePermission.permissions.includes('read:*');
  }

  /**
   * Check if service is rate limited
   */
  private isRateLimited(serviceId: string): boolean {
    const tracker = this.rateLimits.get(serviceId);
    if (!tracker) {
      return false;
    }

    const now = Date.now();
    const windowStart = now - tracker.windowMs;
    
    // Remove old requests
    tracker.requests = tracker.requests.filter(time => time > windowStart);
    
    return tracker.requests.length >= tracker.maxRequests;
  }

  /**
   * Update rate limit tracking
   */
  private updateRateLimit(serviceId: string): void {
    let tracker = this.rateLimits.get(serviceId);
    if (!tracker) {
      tracker = {
        requests: [],
        maxRequests: 100, // Default: 100 requests per hour
        windowMs: 60 * 60 * 1000 // 1 hour
      };
    }

    tracker.requests.push(Date.now());
    this.rateLimits.set(serviceId, tracker);
  }
}

interface RateLimitTracker {
  requests: number[];
  maxRequests: number;
  windowMs: number;
}