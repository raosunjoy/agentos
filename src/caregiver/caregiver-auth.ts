/**
 * Caregiver Authentication and Authorization System
 * Handles secure authentication and role-based access control
 */

import { EventEmitter } from 'events';
import {
  CaregiverProfile,
  CaregiverRole,
  VerificationStatus,
  PermissionType,
  PermissionScope,
  AccessAuditLog,
  AuditAction
} from './types';
import { ConsentManager } from './consent-manager';

export interface AuthenticationResult {
  success: boolean;
  caregiver?: CaregiverProfile;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export interface AuthenticationCredentials {
  email: string;
  password?: string;
  mfaCode?: string;
  biometricData?: string;
}

export interface CaregiverSession {
  id: string;
  caregiverId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export class CaregiverAuthenticator extends EventEmitter {
  private caregivers: Map<string, CaregiverProfile> = new Map();
  private sessions: Map<string, CaregiverSession> = new Map();
  private verificationCodes: Map<string, VerificationCode> = new Map();
  private consentManager: ConsentManager;
  private auditLogger: AccessAuditLogger;

  constructor(consentManager: ConsentManager, auditLogger: AccessAuditLogger) {
    super();
    this.consentManager = consentManager;
    this.auditLogger = auditLogger;
    
    // Clean up expired sessions periodically
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Register a new caregiver (initiated by primary user)
   */
  async registerCaregiver(
    caregiverData: Omit<CaregiverProfile, 'id' | 'verificationStatus' | 'createdAt'>,
    invitedBy: string
  ): Promise<CaregiverProfile> {
    const caregiver: CaregiverProfile = {
      ...caregiverData,
      id: this.generateCaregiverId(),
      verificationStatus: VerificationStatus.PENDING,
      createdAt: new Date()
    };

    this.caregivers.set(caregiver.id, caregiver);

    // Generate verification code
    const verificationCode = this.generateVerificationCode(caregiver.id);
    
    // Send verification email/SMS (would integrate with notification service)
    await this.sendVerificationCode(caregiver, verificationCode);

    await this.auditLogger.log({
      caregiverId: caregiver.id,
      action: AuditAction.LOGIN,
      resource: 'caregiver_registration',
      timestamp: new Date(),
      success: true,
      details: { invitedBy, relationship: caregiver.relationship, role: caregiver.role }
    });

    this.emit('caregiverRegistered', { caregiver, invitedBy });

    return caregiver;
  }

  /**
   * Verify caregiver email/phone with verification code
   */
  async verifyCaregiver(caregiverId: string, code: string): Promise<boolean> {
    const caregiver = this.caregivers.get(caregiverId);
    if (!caregiver) {
      throw new Error('Caregiver not found');
    }

    const verificationCode = this.verificationCodes.get(caregiverId);
    if (!verificationCode || verificationCode.code !== code) {
      await this.auditLogger.log({
        caregiverId,
        action: AuditAction.LOGIN,
        resource: 'verification_failure',
        timestamp: new Date(),
        success: false,
        details: { reason: 'invalid_code' }
      });
      return false;
    }

    if (verificationCode.expiresAt < new Date()) {
      await this.auditLogger.log({
        caregiverId,
        action: AuditAction.LOGIN,
        resource: 'verification_failure',
        timestamp: new Date(),
        success: false,
        details: { reason: 'expired_code' }
      });
      return false;
    }

    // Update caregiver status
    caregiver.verificationStatus = VerificationStatus.VERIFIED;
    this.caregivers.set(caregiverId, caregiver);
    
    // Remove verification code
    this.verificationCodes.delete(caregiverId);

    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.LOGIN,
      resource: 'verification_success',
      timestamp: new Date(),
      success: true,
      details: {}
    });

    this.emit('caregiverVerified', caregiver);

    return true;
  }

  /**
   * Authenticate caregiver login
   */
  async authenticate(
    credentials: AuthenticationCredentials,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthenticationResult> {
    try {
      // Find caregiver by email
      const caregiver = Array.from(this.caregivers.values())
        .find(c => c.email === credentials.email);

      if (!caregiver) {
        await this.auditLogger.log({
          caregiverId: 'unknown',
          action: AuditAction.LOGIN,
          resource: 'authentication_failure',
          timestamp: new Date(),
          success: false,
          details: { reason: 'caregiver_not_found', email: credentials.email },
          ipAddress,
          userAgent
        });
        return { success: false, error: 'Invalid credentials' };
      }

      if (caregiver.verificationStatus !== VerificationStatus.VERIFIED) {
        await this.auditLogger.log({
          caregiverId: caregiver.id,
          action: AuditAction.LOGIN,
          resource: 'authentication_failure',
          timestamp: new Date(),
          success: false,
          details: { reason: 'not_verified' },
          ipAddress,
          userAgent
        });
        return { success: false, error: 'Account not verified' };
      }

      // Verify password (would use proper password hashing in real implementation)
      if (!this.verifyPassword(credentials.password || '', caregiver.id)) {
        await this.auditLogger.log({
          caregiverId: caregiver.id,
          action: AuditAction.LOGIN,
          resource: 'authentication_failure',
          timestamp: new Date(),
          success: false,
          details: { reason: 'invalid_password' },
          ipAddress,
          userAgent
        });
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if MFA is required for this role
      if (this.requiresMFA(caregiver.role) && !credentials.mfaCode) {
        return { success: false, error: 'MFA required' };
      }

      if (credentials.mfaCode && !this.verifyMFA(caregiver.id, credentials.mfaCode)) {
        await this.auditLogger.log({
          caregiverId: caregiver.id,
          action: AuditAction.LOGIN,
          resource: 'authentication_failure',
          timestamp: new Date(),
          success: false,
          details: { reason: 'invalid_mfa' },
          ipAddress,
          userAgent
        });
        return { success: false, error: 'Invalid MFA code' };
      }

      // Create session
      const session = await this.createSession(caregiver.id, ipAddress, userAgent);
      
      // Update last active time
      caregiver.lastActiveAt = new Date();
      this.caregivers.set(caregiver.id, caregiver);

      await this.auditLogger.log({
        caregiverId: caregiver.id,
        action: AuditAction.LOGIN,
        resource: 'authentication_success',
        timestamp: new Date(),
        success: true,
        details: { sessionId: session.id },
        ipAddress,
        userAgent
      });

      this.emit('caregiverAuthenticated', { caregiver, session });

      return {
        success: true,
        caregiver,
        token: session.token,
        expiresAt: session.expiresAt
      };

    } catch (error) {
      await this.auditLogger.log({
        caregiverId: 'unknown',
        action: AuditAction.LOGIN,
        resource: 'authentication_error',
        timestamp: new Date(),
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        userAgent
      });
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Validate session token and return caregiver
   */
  async validateSession(token: string): Promise<CaregiverProfile | null> {
    const session = Array.from(this.sessions.values())
      .find(s => s.token === token && s.isActive);

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      session.isActive = false;
      this.sessions.set(session.id, session);
      return null;
    }

    // Update last activity
    session.lastActivityAt = new Date();
    this.sessions.set(session.id, session);

    return this.caregivers.get(session.caregiverId) || null;
  }

  /**
   * Check if caregiver is authorized for specific action
   */
  async authorize(
    caregiverId: string,
    permissionType: PermissionType,
    scope?: PermissionScope,
    resource?: string
  ): Promise<boolean> {
    const caregiver = this.caregivers.get(caregiverId);
    if (!caregiver || caregiver.verificationStatus !== VerificationStatus.VERIFIED) {
      return false;
    }

    // Check consent-based permissions
    const hasConsent = this.consentManager.hasPermission(caregiverId, permissionType, scope);
    if (!hasConsent) {
      await this.auditLogger.log({
        caregiverId,
        action: AuditAction.VIEW_DATA,
        resource: resource || 'unknown',
        timestamp: new Date(),
        success: false,
        details: { reason: 'no_consent', permissionType, scope }
      });
      return false;
    }

    // Check role-based permissions
    const hasRolePermission = this.checkRolePermission(caregiver.role, permissionType);
    if (!hasRolePermission) {
      await this.auditLogger.log({
        caregiverId,
        action: AuditAction.VIEW_DATA,
        resource: resource || 'unknown',
        timestamp: new Date(),
        success: false,
        details: { reason: 'insufficient_role', role: caregiver.role, permissionType }
      });
      return false;
    }

    return true;
  }

  /**
   * Logout caregiver and invalidate session
   */
  async logout(token: string): Promise<boolean> {
    const session = Array.from(this.sessions.values())
      .find(s => s.token === token);

    if (!session) {
      return false;
    }

    session.isActive = false;
    this.sessions.set(session.id, session);

    await this.auditLogger.log({
      caregiverId: session.caregiverId,
      action: AuditAction.LOGOUT,
      resource: 'session',
      timestamp: new Date(),
      success: true,
      details: { sessionId: session.id }
    });

    this.emit('caregiverLoggedOut', session);

    return true;
  }

  /**
   * Revoke caregiver access (by primary user)
   */
  async revokeCaregiver(caregiverId: string, revokedBy: string, reason?: string): Promise<boolean> {
    const caregiver = this.caregivers.get(caregiverId);
    if (!caregiver) {
      return false;
    }

    // Update verification status
    caregiver.verificationStatus = VerificationStatus.REVOKED;
    this.caregivers.set(caregiverId, caregiver);

    // Invalidate all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.caregiverId === caregiverId) {
        session.isActive = false;
        this.sessions.set(sessionId, session);
      }
    }

    // Revoke consent
    await this.consentManager.revokeConsent(caregiverId, revokedBy, reason);

    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.PERMISSION_REVOKED,
      resource: 'caregiver_access',
      timestamp: new Date(),
      success: true,
      details: { revokedBy, reason }
    });

    this.emit('caregiverRevoked', { caregiver, revokedBy, reason });

    return true;
  }

  /**
   * Get caregiver profile
   */
  getCaregiver(caregiverId: string): CaregiverProfile | undefined {
    return this.caregivers.get(caregiverId);
  }

  /**
   * Get all active caregivers
   */
  getActiveCaregivers(): CaregiverProfile[] {
    return Array.from(this.caregivers.values())
      .filter(c => c.verificationStatus === VerificationStatus.VERIFIED);
  }

  private async createSession(
    caregiverId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CaregiverSession> {
    const session: CaregiverSession = {
      id: this.generateSessionId(),
      caregiverId,
      token: this.generateSessionToken(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      lastActivityAt: new Date(),
      ipAddress,
      userAgent,
      isActive: true
    };

    this.sessions.set(session.id, session);
    return session;
  }

  private generateVerificationCode(caregiverId: string): VerificationCode {
    const code: VerificationCode = {
      code: Math.random().toString(36).substr(2, 8).toUpperCase(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      attempts: 0
    };

    this.verificationCodes.set(caregiverId, code);
    return code;
  }

  private async sendVerificationCode(caregiver: CaregiverProfile, code: VerificationCode): Promise<void> {
    // Would integrate with email/SMS service
    console.log(`Verification code for ${caregiver.email}: ${code.code}`);
  }

  private verifyPassword(password: string, caregiverId: string): boolean {
    // Would use proper password hashing (bcrypt, etc.)
    return password.length >= 8;
  }

  private requiresMFA(role: CaregiverRole): boolean {
    return role === CaregiverRole.FULL_ACCESS || role === CaregiverRole.REMOTE_ASSISTANT;
  }

  private verifyMFA(caregiverId: string, code: string): boolean {
    // Would integrate with TOTP/SMS MFA service
    return code.length === 6;
  }

  private checkRolePermission(role: CaregiverRole, permissionType: PermissionType): boolean {
    const rolePermissions: Record<CaregiverRole, PermissionType[]> = {
      [CaregiverRole.EMERGENCY_CONTACT]: [
        PermissionType.RECEIVE_EMERGENCY_ALERTS
      ],
      [CaregiverRole.DAILY_MONITOR]: [
        PermissionType.VIEW_ACTIVITY_SUMMARY,
        PermissionType.RECEIVE_EMERGENCY_ALERTS
      ],
      [CaregiverRole.REMOTE_ASSISTANT]: [
        PermissionType.VIEW_ACTIVITY_SUMMARY,
        PermissionType.RECEIVE_EMERGENCY_ALERTS,
        PermissionType.REMOTE_ASSISTANCE,
        PermissionType.VIEW_LOCATION
      ],
      [CaregiverRole.FULL_ACCESS]: [
        PermissionType.VIEW_ACTIVITY_SUMMARY,
        PermissionType.VIEW_HEALTH_DATA,
        PermissionType.VIEW_LOCATION,
        PermissionType.RECEIVE_EMERGENCY_ALERTS,
        PermissionType.REMOTE_ASSISTANCE,
        PermissionType.MODIFY_SETTINGS,
        PermissionType.VIEW_CONTACTS,
        PermissionType.VIEW_CALENDAR
      ]
    };

    return rolePermissions[role]?.includes(permissionType) || false;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        session.isActive = false;
        this.sessions.set(sessionId, session);
      }
    }
  }

  private generateCaregiverId(): string {
    return `caregiver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionToken(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}

interface VerificationCode {
  code: string;
  expiresAt: Date;
  attempts: number;
}

export interface AccessAuditLogger {
  log(entry: Omit<AccessAuditLog, 'id'>): Promise<void>;
}