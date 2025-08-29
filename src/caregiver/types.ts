/**
 * Types for caregiver integration system
 */

export interface CaregiverProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  relationship: CaregiverRelationship;
  role: CaregiverRole;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  lastActiveAt?: Date;
}

export enum CaregiverRelationship {
  FAMILY_MEMBER = 'family_member',
  FRIEND = 'friend',
  PROFESSIONAL_CAREGIVER = 'professional_caregiver',
  HEALTHCARE_PROVIDER = 'healthcare_provider',
  OTHER = 'other'
}

export enum CaregiverRole {
  EMERGENCY_CONTACT = 'emergency_contact',
  DAILY_MONITOR = 'daily_monitor',
  REMOTE_ASSISTANT = 'remote_assistant',
  FULL_ACCESS = 'full_access'
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  REVOKED = 'revoked'
}

export interface ConsentRequest {
  id: string;
  caregiverId: string;
  requestedPermissions: CaregiverPermission[];
  requestedRole: CaregiverRole;
  message?: string;
  expiresAt?: Date;
  createdAt: Date;
  status: ConsentStatus;
}

export enum ConsentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

export interface CaregiverPermission {
  type: PermissionType;
  scope: PermissionScope;
  expiresAt?: Date;
  grantedAt: Date;
  conditions?: PermissionCondition[];
}

export enum PermissionType {
  VIEW_ACTIVITY_SUMMARY = 'view_activity_summary',
  VIEW_HEALTH_DATA = 'view_health_data',
  VIEW_LOCATION = 'view_location',
  RECEIVE_EMERGENCY_ALERTS = 'receive_emergency_alerts',
  REMOTE_ASSISTANCE = 'remote_assistance',
  MODIFY_SETTINGS = 'modify_settings',
  VIEW_CONTACTS = 'view_contacts',
  VIEW_CALENDAR = 'view_calendar'
}

export enum PermissionScope {
  EMERGENCY_ONLY = 'emergency_only',
  DAILY_SUMMARY = 'daily_summary',
  REAL_TIME = 'real_time',
  FULL_ACCESS = 'full_access'
}

export interface PermissionCondition {
  type: ConditionType;
  value: string;
  operator: ConditionOperator;
}

export enum ConditionType {
  TIME_OF_DAY = 'time_of_day',
  DAY_OF_WEEK = 'day_of_week',
  LOCATION = 'location',
  EMERGENCY_STATUS = 'emergency_status'
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains'
}

export interface AccessAuditLog {
  id: string;
  caregiverId: string;
  action: AuditAction;
  resource: string;
  timestamp: Date;
  success: boolean;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  VIEW_DATA = 'view_data',
  MODIFY_SETTINGS = 'modify_settings',
  SEND_MESSAGE = 'send_message',
  EMERGENCY_ALERT = 'emergency_alert',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked'
}

export interface ConsentConfiguration {
  requireExplicitConsent: boolean;
  defaultPermissionDuration: number; // in days
  maxPermissionDuration: number; // in days
  allowEmergencyOverride: boolean;
  requirePeriodicReconfirmation: boolean;
  reconfirmationInterval: number; // in days
}