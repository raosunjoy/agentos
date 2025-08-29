/**
 * Types for the granular permission system
 */

export interface Permission {
  id: string;
  userId: string;
  resourceType: string;
  resourceId?: string;
  action: PermissionAction;
  granted: boolean;
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  conditions?: PermissionCondition[];
  metadata?: Record<string, any>;
}

export type PermissionAction = 
  | 'read' 
  | 'write' 
  | 'delete' 
  | 'share' 
  | 'export' 
  | 'modify_permissions';

export interface PermissionCondition {
  type: ConditionType;
  operator: ConditionOperator;
  value: any;
  metadata?: Record<string, any>;
}

export type ConditionType = 
  | 'time_range'
  | 'location'
  | 'device'
  | 'network'
  | 'user_context'
  | 'data_sensitivity'
  | 'purpose';

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'contains'
  | 'matches_pattern';

export interface PermissionRequest {
  userId: string;
  resourceType: string;
  resourceId?: string;
  action: PermissionAction;
  context: RequestContext;
  purpose?: string;
}

export interface RequestContext {
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  device?: {
    id: string;
    type: string;
    trusted: boolean;
  };
  network?: {
    type: 'wifi' | 'cellular' | 'ethernet';
    trusted: boolean;
  };
  userActivity?: string;
  sessionId?: string;
}

export interface PermissionEvaluationResult {
  granted: boolean;
  reason: string;
  conditions?: PermissionCondition[];
  expiresAt?: Date;
  auditRequired: boolean;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  resourceType: string;
  purpose: string;
  granted: boolean;
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  result: 'granted' | 'denied' | 'revoked';
  reason: string;
  context: RequestContext;
  metadata?: Record<string, any>;
}

export interface PermissionPolicy {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  defaultAction: 'allow' | 'deny';
  rules: PermissionRule[];
  priority: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionRule {
  id: string;
  name: string;
  conditions: PermissionCondition[];
  action: 'allow' | 'deny';
  priority: number;
  auditRequired?: boolean;
  notificationRequired?: boolean;
}