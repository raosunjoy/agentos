/**
 * Monitoring Service for caregiver integration
 * Handles daily interaction summaries, emergency detection, and remote assistance
 */

import { EventEmitter } from 'events';
import {
  CaregiverProfile,
  PermissionType,
  PermissionScope,
  AccessAuditLog,
  AuditAction
} from './types';

export interface InteractionSummary {
  id: string;
  userId: string;
  date: Date;
  totalInteractions: number;
  voiceCommands: number;
  successfulTasks: number;
  failedTasks: number;
  emergencyAlerts: number;
  healthMetrics?: HealthMetrics;
  activityPatterns: ActivityPattern[];
  concerns: Concern[];
  generatedAt: Date;
}

export interface HealthMetrics {
  heartRate?: number;
  bloodPressure?: { systolic: number; diastolic: number };
  steps?: number;
  sleepHours?: number;
  medicationCompliance?: number; // percentage
}

export interface ActivityPattern {
  type: ActivityType;
  frequency: number;
  averageDuration: number; // in minutes
  timeOfDay: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export enum ActivityType {
  VOICE_COMMANDS = 'voice_commands',
  MEDICATION_REMINDERS = 'medication_reminders',
  EMERGENCY_CALLS = 'emergency_calls',
  SOCIAL_INTERACTIONS = 'social_interactions',
  HEALTH_CHECKS = 'health_checks',
  ENTERTAINMENT = 'entertainment'
}

export interface Concern {
  type: ConcernType;
  severity: ConcernSeverity;
  description: string;
  detectedAt: Date;
  resolved: boolean;
}

export enum ConcernType {
  MISSED_MEDICATION = 'missed_medication',
  UNUSUAL_INACTIVITY = 'unusual_inactivity',
  REPEATED_FAILURES = 'repeated_failures',
  EMERGENCY_PATTERN = 'emergency_pattern',
  HEALTH_ANOMALY = 'health_anomaly',
  SOCIAL_ISOLATION = 'social_isolation'
}

export enum ConcernSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  type: EmergencyType;
  severity: EmergencySeverity;
  description: string;
  location?: Location;
  detectedAt: Date;
  resolvedAt?: Date;
  caregiverNotifications: CaregiverNotification[];
  autoActions: AutoAction[];
}

export enum EmergencyType {
  FALL_DETECTION = 'fall_detection',
  MEDICAL_EMERGENCY = 'medical_emergency',
  NO_RESPONSE = 'no_response',
  PANIC_BUTTON = 'panic_button',
  UNUSUAL_BEHAVIOR = 'unusual_behavior',
  DEVICE_MALFUNCTION = 'device_malfunction'
}

export enum EmergencySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
}

export interface CaregiverNotification {
  caregiverId: string;
  method: NotificationMethod;
  sentAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

export enum NotificationMethod {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  PHONE_CALL = 'phone_call'
}

export interface AutoAction {
  type: AutoActionType;
  executedAt: Date;
  success: boolean;
  details?: Record<string, any>;
}

export enum AutoActionType {
  CALL_EMERGENCY_SERVICES = 'call_emergency_services',
  SEND_LOCATION = 'send_location',
  ACTIVATE_RECORDING = 'activate_recording',
  UNLOCK_DOORS = 'unlock_doors',
  TURN_ON_LIGHTS = 'turn_on_lights'
}

export interface RemoteAssistanceSession {
  id: string;
  caregiverId: string;
  userId: string;
  type: AssistanceType;
  startedAt: Date;
  endedAt?: Date;
  status: SessionStatus;
  permissions: RemotePermission[];
  actions: RemoteAction[];
  encrypted: boolean;
}

export enum AssistanceType {
  SCREEN_SHARING = 'screen_sharing',
  VOICE_CALL = 'voice_call',
  DEVICE_CONTROL = 'device_control',
  TROUBLESHOOTING = 'troubleshooting',
  EMERGENCY_SUPPORT = 'emergency_support'
}

export enum SessionStatus {
  REQUESTED = 'requested',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
  REJECTED = 'rejected'
}

export interface RemotePermission {
  type: RemotePermissionType;
  granted: boolean;
  grantedAt?: Date;
  expiresAt?: Date;
}

export enum RemotePermissionType {
  VIEW_SCREEN = 'view_screen',
  CONTROL_DEVICE = 'control_device',
  ACCESS_SETTINGS = 'access_settings',
  VIEW_HEALTH_DATA = 'view_health_data',
  MAKE_CALLS = 'make_calls'
}

export interface RemoteAction {
  type: string;
  executedAt: Date;
  success: boolean;
  details?: Record<string, any>;
}

export class MonitoringService extends EventEmitter {
  private summaries: Map<string, InteractionSummary[]> = new Map();
  private emergencyAlerts: Map<string, EmergencyAlert> = new Map();
  private assistanceSessions: Map<string, RemoteAssistanceSession> = new Map();
  private auditLogger: AccessAuditLogger;
  private encryptionService: EncryptionService;

  constructor(auditLogger: AccessAuditLogger, encryptionService: EncryptionService) {
    super();
    this.auditLogger = auditLogger;
    this.encryptionService = encryptionService;
  }

  /**
   * Generate daily interaction summary for a user
   */
  async generateDailySummary(
    userId: string,
    date: Date,
    interactions: UserInteraction[]
  ): Promise<InteractionSummary> {
    const summary: InteractionSummary = {
      id: this.generateSummaryId(),
      userId,
      date,
      totalInteractions: interactions.length,
      voiceCommands: interactions.filter(i => i.type === 'voice_command').length,
      successfulTasks: interactions.filter(i => i.success).length,
      failedTasks: interactions.filter(i => !i.success).length,
      emergencyAlerts: interactions.filter(i => i.type === 'emergency').length,
      activityPatterns: this.analyzeActivityPatterns(interactions),
      concerns: this.detectConcerns(interactions),
      generatedAt: new Date()
    };

    // Store summary
    if (!this.summaries.has(userId)) {
      this.summaries.set(userId, []);
    }
    this.summaries.get(userId)!.push(summary);

    // Log summary generation
    await this.auditLogger.log({
      caregiverId: 'system',
      action: AuditAction.VIEW_DATA,
      resource: 'daily_summary',
      timestamp: new Date(),
      success: true,
      details: { userId, summaryId: summary.id, date: date.toISOString() }
    });

    this.emit('summaryGenerated', summary);

    return summary;
  }

  /**
   * Get daily summaries for a user within a date range
   */
  async getDailySummaries(
    userId: string,
    startDate: Date,
    endDate: Date,
    caregiverId?: string
  ): Promise<InteractionSummary[]> {
    if (caregiverId) {
      await this.auditLogger.log({
        caregiverId,
        action: AuditAction.VIEW_DATA,
        resource: 'daily_summaries',
        timestamp: new Date(),
        success: true,
        details: { userId, startDate: startDate.toISOString(), endDate: endDate.toISOString() }
      });
    }

    const userSummaries = this.summaries.get(userId) || [];
    return userSummaries.filter(summary => 
      summary.date >= startDate && summary.date <= endDate
    );
  }

  /**
   * Detect emergency situations and trigger alerts
   */
  async detectEmergency(
    userId: string,
    type: EmergencyType,
    severity: EmergencySeverity,
    description: string,
    location?: Location,
    additionalData?: Record<string, any>
  ): Promise<EmergencyAlert> {
    const alert: EmergencyAlert = {
      id: this.generateAlertId(),
      userId,
      type,
      severity,
      description,
      location,
      detectedAt: new Date(),
      caregiverNotifications: [],
      autoActions: []
    };

    // Execute automatic actions based on severity
    if (severity === EmergencySeverity.CRITICAL) {
      await this.executeAutoActions(alert);
    }

    // Notify caregivers
    await this.notifyCaregivers(alert);

    // Store alert
    this.emergencyAlerts.set(alert.id, alert);

    // Log emergency detection
    await this.auditLogger.log({
      caregiverId: 'system',
      action: AuditAction.EMERGENCY_ALERT,
      resource: 'emergency_detection',
      timestamp: new Date(),
      success: true,
      details: { 
        userId, 
        alertId: alert.id, 
        type, 
        severity, 
        location: location ? `${location.latitude},${location.longitude}` : undefined 
      }
    });

    this.emit('emergencyDetected', alert);

    return alert;
  }

  /**
   * Start remote assistance session
   */
  async startRemoteAssistance(
    caregiverId: string,
    userId: string,
    type: AssistanceType,
    requestedPermissions: RemotePermissionType[]
  ): Promise<RemoteAssistanceSession> {
    const session: RemoteAssistanceSession = {
      id: this.generateSessionId(),
      caregiverId,
      userId,
      type,
      startedAt: new Date(),
      status: SessionStatus.REQUESTED,
      permissions: requestedPermissions.map(permType => ({
        type: permType,
        granted: false
      })),
      actions: [],
      encrypted: true
    };

    // Store session
    this.assistanceSessions.set(session.id, session);

    // Request user consent for remote assistance
    this.emit('remoteAssistanceRequested', {
      session,
      caregiverId,
      userId,
      requestedPermissions
    });

    // Log session start
    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.REMOTE_ASSISTANCE,
      resource: 'assistance_session',
      timestamp: new Date(),
      success: true,
      details: { 
        sessionId: session.id, 
        userId, 
        type, 
        permissionCount: requestedPermissions.length 
      }
    });

    return session;
  }

  /**
   * Grant permissions for remote assistance session
   */
  async grantRemotePermissions(
    sessionId: string,
    grantedPermissions: RemotePermissionType[],
    userId: string
  ): Promise<boolean> {
    const session = this.assistanceSessions.get(sessionId);
    if (!session || session.status !== SessionStatus.REQUESTED) {
      return false;
    }

    // Update permissions
    session.permissions.forEach(permission => {
      if (grantedPermissions.includes(permission.type)) {
        permission.granted = true;
        permission.grantedAt = new Date();
        permission.expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      }
    });

    // Activate session if any permissions granted
    if (grantedPermissions.length > 0) {
      session.status = SessionStatus.ACTIVE;
      this.emit('remoteAssistanceActivated', session);
    } else {
      session.status = SessionStatus.REJECTED;
      this.emit('remoteAssistanceRejected', session);
    }

    // Update stored session
    this.assistanceSessions.set(sessionId, session);

    // Log permission grant
    await this.auditLogger.log({
      caregiverId: session.caregiverId,
      action: AuditAction.PERMISSION_GRANTED,
      resource: 'remote_permissions',
      timestamp: new Date(),
      success: true,
      details: { 
        sessionId, 
        userId, 
        grantedPermissions: grantedPermissions.join(',') 
      }
    });

    return true;
  }

  /**
   * Execute remote action during assistance session
   */
  async executeRemoteAction(
    sessionId: string,
    actionType: string,
    actionData: Record<string, any>,
    caregiverId: string
  ): Promise<boolean> {
    const session = this.assistanceSessions.get(sessionId);
    if (!session || session.status !== SessionStatus.ACTIVE) {
      return false;
    }

    // Check if caregiver has required permissions
    const hasPermission = this.checkRemotePermission(session, actionType);
    if (!hasPermission) {
      await this.auditLogger.log({
        caregiverId,
        action: AuditAction.REMOTE_ASSISTANCE,
        resource: 'remote_action',
        timestamp: new Date(),
        success: false,
        details: { sessionId, actionType, reason: 'insufficient_permissions' }
      });
      return false;
    }

    // Execute action (would integrate with actual device control)
    const success = await this.performRemoteAction(actionType, actionData);

    // Record action
    const action: RemoteAction = {
      type: actionType,
      executedAt: new Date(),
      success,
      details: actionData
    };

    session.actions.push(action);
    this.assistanceSessions.set(sessionId, session);

    // Log action
    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.REMOTE_ASSISTANCE,
      resource: 'remote_action',
      timestamp: new Date(),
      success,
      details: { sessionId, actionType, userId: session.userId }
    });

    this.emit('remoteActionExecuted', { session, action });

    return success;
  }

  /**
   * End remote assistance session
   */
  async endRemoteAssistance(sessionId: string, caregiverId: string): Promise<boolean> {
    const session = this.assistanceSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = SessionStatus.ENDED;
    session.endedAt = new Date();
    this.assistanceSessions.set(sessionId, session);

    // Log session end
    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.REMOTE_ASSISTANCE,
      resource: 'assistance_session_end',
      timestamp: new Date(),
      success: true,
      details: { 
        sessionId, 
        userId: session.userId, 
        duration: session.endedAt.getTime() - session.startedAt.getTime(),
        actionCount: session.actions.length
      }
    });

    this.emit('remoteAssistanceEnded', session);

    return true;
  }

  /**
   * Get emergency alerts for a user
   */
  getEmergencyAlerts(userId: string, limit: number = 50): EmergencyAlert[] {
    return Array.from(this.emergencyAlerts.values())
      .filter(alert => alert.userId === userId)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get active remote assistance sessions
   */
  getActiveAssistanceSessions(caregiverId?: string): RemoteAssistanceSession[] {
    return Array.from(this.assistanceSessions.values())
      .filter(session => 
        session.status === SessionStatus.ACTIVE &&
        (!caregiverId || session.caregiverId === caregiverId)
      );
  }

  private analyzeActivityPatterns(interactions: UserInteraction[]): ActivityPattern[] {
    const patterns: ActivityPattern[] = [];
    
    // Group interactions by type
    const groupedInteractions = interactions.reduce((groups, interaction) => {
      const type = this.mapInteractionToActivityType(interaction.type);
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(interaction);
      return groups;
    }, {} as Record<ActivityType, UserInteraction[]>);

    // Analyze each activity type
    Object.entries(groupedInteractions).forEach(([type, typeInteractions]) => {
      const activityType = type as ActivityType;
      const frequency = typeInteractions.length;
      const averageDuration = typeInteractions.reduce((sum, i) => sum + (i.duration || 0), 0) / frequency;
      
      // Determine most common time of day
      const hours = typeInteractions.map(i => i.timestamp.getHours());
      const mostCommonHour = this.getMostFrequent(hours);
      const timeOfDay = this.getTimeOfDayLabel(mostCommonHour);

      patterns.push({
        type: activityType,
        frequency,
        averageDuration,
        timeOfDay,
        trend: 'stable' // Would calculate based on historical data
      });
    });

    return patterns;
  }

  private detectConcerns(interactions: UserInteraction[]): Concern[] {
    const concerns: Concern[] = [];

    // Check for repeated failures
    const failedInteractions = interactions.filter(i => !i.success);
    if (failedInteractions.length > 5) {
      concerns.push({
        type: ConcernType.REPEATED_FAILURES,
        severity: ConcernSeverity.MEDIUM,
        description: `${failedInteractions.length} failed interactions detected`,
        detectedAt: new Date(),
        resolved: false
      });
    }

    // Check for unusual inactivity
    const lastInteraction = interactions[interactions.length - 1];
    if (lastInteraction && (Date.now() - lastInteraction.timestamp.getTime()) > 24 * 60 * 60 * 1000) {
      concerns.push({
        type: ConcernType.UNUSUAL_INACTIVITY,
        severity: ConcernSeverity.HIGH,
        description: 'No interactions for over 24 hours',
        detectedAt: new Date(),
        resolved: false
      });
    }

    return concerns;
  }

  private async executeAutoActions(alert: EmergencyAlert): Promise<void> {
    const actions: AutoAction[] = [];

    // Send location if available
    if (alert.location) {
      actions.push({
        type: AutoActionType.SEND_LOCATION,
        executedAt: new Date(),
        success: true,
        details: { location: alert.location }
      });
    }

    // Turn on lights for visibility
    actions.push({
      type: AutoActionType.TURN_ON_LIGHTS,
      executedAt: new Date(),
      success: true,
      details: {}
    });

    // For critical emergencies, call emergency services
    if (alert.severity === EmergencySeverity.CRITICAL) {
      actions.push({
        type: AutoActionType.CALL_EMERGENCY_SERVICES,
        executedAt: new Date(),
        success: true, // Would depend on actual implementation
        details: { alertId: alert.id }
      });
    }

    alert.autoActions = actions;
  }

  private async notifyCaregivers(alert: EmergencyAlert): Promise<void> {
    // Would integrate with caregiver registry to get list of caregivers
    // For now, simulate notifications
    const notifications: CaregiverNotification[] = [
      {
        caregiverId: 'caregiver_1',
        method: NotificationMethod.SMS,
        sentAt: new Date(),
        acknowledged: false
      },
      {
        caregiverId: 'caregiver_1',
        method: NotificationMethod.PUSH,
        sentAt: new Date(),
        acknowledged: false
      }
    ];

    alert.caregiverNotifications = notifications;
  }

  private checkRemotePermission(session: RemoteAssistanceSession, actionType: string): boolean {
    const requiredPermissions: Record<string, RemotePermissionType[]> = {
      'change_settings': [RemotePermissionType.ACCESS_SETTINGS],
      'view_screen': [RemotePermissionType.VIEW_SCREEN],
      'control_device': [RemotePermissionType.CONTROL_DEVICE],
      'make_call': [RemotePermissionType.MAKE_CALLS]
    };

    const required = requiredPermissions[actionType] || [];
    return required.some(permType => 
      session.permissions.some(p => 
        p.type === permType && 
        p.granted && 
        (!p.expiresAt || p.expiresAt > new Date())
      )
    );
  }

  private async performRemoteAction(actionType: string, actionData: Record<string, any>): Promise<boolean> {
    // Would integrate with actual device control APIs
    // For now, simulate success
    return true;
  }

  private mapInteractionToActivityType(interactionType: string): ActivityType {
    const mapping: Record<string, ActivityType> = {
      'voice_command': ActivityType.VOICE_COMMANDS,
      'medication': ActivityType.MEDICATION_REMINDERS,
      'emergency': ActivityType.EMERGENCY_CALLS,
      'social': ActivityType.SOCIAL_INTERACTIONS,
      'health': ActivityType.HEALTH_CHECKS,
      'entertainment': ActivityType.ENTERTAINMENT
    };

    return mapping[interactionType] || ActivityType.VOICE_COMMANDS;
  }

  private getMostFrequent<T>(array: T[]): T {
    const frequency: Record<string, number> = {};
    let maxCount = 0;
    let mostFrequent = array[0];

    array.forEach(item => {
      const key = String(item);
      frequency[key] = (frequency[key] || 0) + 1;
      if (frequency[key] > maxCount) {
        maxCount = frequency[key];
        mostFrequent = item;
      }
    });

    return mostFrequent;
  }

  private getTimeOfDayLabel(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  private generateSummaryId(): string {
    return `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting interfaces
export interface UserInteraction {
  id: string;
  type: string;
  timestamp: Date;
  success: boolean;
  duration?: number; // in milliseconds
  details?: Record<string, any>;
}

export interface AccessAuditLogger {
  log(entry: Omit<AccessAuditLog, 'id'>): Promise<void>;
}

export interface EncryptionService {
  encrypt(data: string): Promise<string>;
  decrypt(encryptedData: string): Promise<string>;
}