/**
 * Tests for MonitoringService
 */

import { MonitoringService, InteractionSummary, EmergencyAlert, RemoteAssistanceSession } from '../monitoring-service';
import {
  ActivityType,
  ConcernType,
  ConcernSeverity,
  EmergencyType,
  EmergencySeverity,
  AssistanceType,
  SessionStatus,
  RemotePermissionType,
  UserInteraction,
  AccessAuditLogger,
  EncryptionService
} from '../monitoring-service';
import { AccessAuditLog } from '../types';

// Mock implementations
class MockAuditLogger implements AccessAuditLogger {
  logs: AccessAuditLog[] = [];

  async log(entry: Omit<AccessAuditLog, 'id'>): Promise<void> {
    this.logs.push({
      ...entry,
      id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }
}

class MockEncryptionService implements EncryptionService {
  async encrypt(data: string): Promise<string> {
    return `encrypted_${data}`;
  }

  async decrypt(encryptedData: string): Promise<string> {
    return encryptedData.replace('encrypted_', '');
  }
}

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockAuditLogger: MockAuditLogger;
  let mockEncryptionService: MockEncryptionService;

  beforeEach(() => {
    mockAuditLogger = new MockAuditLogger();
    mockEncryptionService = new MockEncryptionService();
    monitoringService = new MonitoringService(mockAuditLogger, mockEncryptionService);
  });

  describe('generateDailySummary', () => {
    it('should generate a comprehensive daily summary', async () => {
      const userId = 'user_123';
      const date = new Date('2024-01-01');
      const interactions: UserInteraction[] = [
        {
          id: 'int_1',
          type: 'voice_command',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          success: true,
          duration: 5000
        },
        {
          id: 'int_2',
          type: 'voice_command',
          timestamp: new Date('2024-01-01T14:00:00Z'),
          success: false,
          duration: 3000
        },
        {
          id: 'int_3',
          type: 'medication',
          timestamp: new Date('2024-01-01T18:00:00Z'),
          success: true,
          duration: 2000
        }
      ];

      const summary = await monitoringService.generateDailySummary(userId, date, interactions);

      expect(summary.userId).toBe(userId);
      expect(summary.date).toBe(date);
      expect(summary.totalInteractions).toBe(3);
      expect(summary.voiceCommands).toBe(2);
      expect(summary.successfulTasks).toBe(2);
      expect(summary.failedTasks).toBe(1);
      expect(summary.activityPatterns).toHaveLength(2); // voice_commands and medication
      expect(summary.generatedAt).toBeInstanceOf(Date);
    });

    it('should detect concerns in interactions', async () => {
      const userId = 'user_123';
      const date = new Date('2024-01-01');
      const interactions: UserInteraction[] = Array.from({ length: 10 }, (_, i) => ({
        id: `int_${i}`,
        type: 'voice_command',
        timestamp: new Date(`2024-01-01T${10 + i}:00:00Z`),
        success: false, // All failed
        duration: 1000
      }));

      const summary = await monitoringService.generateDailySummary(userId, date, interactions);

      expect(summary.concerns.length).toBeGreaterThanOrEqual(1);
      const repeatedFailuresConcern = summary.concerns.find(c => c.type === ConcernType.REPEATED_FAILURES);
      expect(repeatedFailuresConcern).toBeDefined();
      expect(repeatedFailuresConcern?.severity).toBe(ConcernSeverity.MEDIUM);
    });

    it('should log summary generation', async () => {
      const userId = 'user_123';
      const date = new Date('2024-01-01');
      const interactions: UserInteraction[] = [];

      await monitoringService.generateDailySummary(userId, date, interactions);

      expect(mockAuditLogger.logs).toHaveLength(1);
      expect(mockAuditLogger.logs[0].resource).toBe('daily_summary');
      expect(mockAuditLogger.logs[0].details?.userId).toBe(userId);
    });

    it('should emit summaryGenerated event', async () => {
      const eventSpy = jest.fn();
      monitoringService.on('summaryGenerated', eventSpy);

      const userId = 'user_123';
      const date = new Date('2024-01-01');
      const interactions: UserInteraction[] = [];

      const summary = await monitoringService.generateDailySummary(userId, date, interactions);

      expect(eventSpy).toHaveBeenCalledWith(summary);
    });
  });

  describe('getDailySummaries', () => {
    beforeEach(async () => {
      // Generate some test summaries
      const userId = 'user_123';
      const interactions: UserInteraction[] = [];

      await monitoringService.generateDailySummary(userId, new Date('2024-01-01'), interactions);
      await monitoringService.generateDailySummary(userId, new Date('2024-01-02'), interactions);
      await monitoringService.generateDailySummary(userId, new Date('2024-01-03'), interactions);
    });

    it('should return summaries within date range', async () => {
      const userId = 'user_123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      const summaries = await monitoringService.getDailySummaries(userId, startDate, endDate);

      expect(summaries).toHaveLength(2);
      expect(summaries.every(s => s.date >= startDate && s.date <= endDate)).toBe(true);
    });

    it('should log access when caregiver requests summaries', async () => {
      const userId = 'user_123';
      const caregiverId = 'caregiver_456';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');

      await monitoringService.getDailySummaries(userId, startDate, endDate, caregiverId);

      const accessLog = mockAuditLogger.logs.find(log => 
        log.resource === 'daily_summaries' && log.caregiverId === caregiverId
      );
      expect(accessLog).toBeDefined();
      expect(accessLog?.details?.userId).toBe(userId);
    });
  });

  describe('detectEmergency', () => {
    it('should create and store emergency alert', async () => {
      const userId = 'user_123';
      const type = EmergencyType.FALL_DETECTION;
      const severity = EmergencySeverity.HIGH;
      const description = 'Fall detected in living room';
      const location = { latitude: 40.7128, longitude: -74.0060 };

      const alert = await monitoringService.detectEmergency(
        userId,
        type,
        severity,
        description,
        location
      );

      expect(alert.userId).toBe(userId);
      expect(alert.type).toBe(type);
      expect(alert.severity).toBe(severity);
      expect(alert.description).toBe(description);
      expect(alert.location).toEqual(location);
      expect(alert.detectedAt).toBeInstanceOf(Date);
      expect(alert.caregiverNotifications).toHaveLength(2); // SMS and PUSH
    });

    it('should execute auto actions for critical emergencies', async () => {
      const userId = 'user_123';
      const alert = await monitoringService.detectEmergency(
        userId,
        EmergencyType.MEDICAL_EMERGENCY,
        EmergencySeverity.CRITICAL,
        'Medical emergency detected'
      );

      expect(alert.autoActions.length).toBeGreaterThan(0);
      expect(alert.autoActions.some(action => 
        action.type === 'call_emergency_services'
      )).toBe(true);
    });

    it('should log emergency detection', async () => {
      const userId = 'user_123';
      await monitoringService.detectEmergency(
        userId,
        EmergencyType.PANIC_BUTTON,
        EmergencySeverity.HIGH,
        'Panic button pressed'
      );

      const emergencyLog = mockAuditLogger.logs.find(log => 
        log.resource === 'emergency_detection'
      );
      expect(emergencyLog).toBeDefined();
      expect(emergencyLog?.details?.userId).toBe(userId);
    });

    it('should emit emergencyDetected event', async () => {
      const eventSpy = jest.fn();
      monitoringService.on('emergencyDetected', eventSpy);

      const userId = 'user_123';
      const alert = await monitoringService.detectEmergency(
        userId,
        EmergencyType.NO_RESPONSE,
        EmergencySeverity.MEDIUM,
        'No response for 2 hours'
      );

      expect(eventSpy).toHaveBeenCalledWith(alert);
    });
  });

  describe('startRemoteAssistance', () => {
    it('should create remote assistance session', async () => {
      const caregiverId = 'caregiver_123';
      const userId = 'user_456';
      const type = AssistanceType.SCREEN_SHARING;
      const permissions = [RemotePermissionType.VIEW_SCREEN, RemotePermissionType.CONTROL_DEVICE];

      const session = await monitoringService.startRemoteAssistance(
        caregiverId,
        userId,
        type,
        permissions
      );

      expect(session.caregiverId).toBe(caregiverId);
      expect(session.userId).toBe(userId);
      expect(session.type).toBe(type);
      expect(session.status).toBe(SessionStatus.REQUESTED);
      expect(session.permissions).toHaveLength(2);
      expect(session.encrypted).toBe(true);
    });

    it('should log session creation', async () => {
      const caregiverId = 'caregiver_123';
      const userId = 'user_456';

      await monitoringService.startRemoteAssistance(
        caregiverId,
        userId,
        AssistanceType.TROUBLESHOOTING,
        [RemotePermissionType.VIEW_SCREEN]
      );

      const sessionLog = mockAuditLogger.logs.find(log => 
        log.resource === 'assistance_session'
      );
      expect(sessionLog).toBeDefined();
      expect(sessionLog?.caregiverId).toBe(caregiverId);
    });

    it('should emit remoteAssistanceRequested event', async () => {
      const eventSpy = jest.fn();
      monitoringService.on('remoteAssistanceRequested', eventSpy);

      const caregiverId = 'caregiver_123';
      const userId = 'user_456';

      await monitoringService.startRemoteAssistance(
        caregiverId,
        userId,
        AssistanceType.VOICE_CALL,
        []
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          caregiverId,
          userId
        })
      );
    });
  });

  describe('grantRemotePermissions', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await monitoringService.startRemoteAssistance(
        'caregiver_123',
        'user_456',
        AssistanceType.DEVICE_CONTROL,
        [RemotePermissionType.VIEW_SCREEN, RemotePermissionType.CONTROL_DEVICE]
      );
      sessionId = session.id;
    });

    it('should grant permissions and activate session', async () => {
      const grantedPermissions = [RemotePermissionType.VIEW_SCREEN];
      const userId = 'user_456';

      const result = await monitoringService.grantRemotePermissions(
        sessionId,
        grantedPermissions,
        userId
      );

      expect(result).toBe(true);

      // Check that session is now active
      const activeSessions = monitoringService.getActiveAssistanceSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].status).toBe(SessionStatus.ACTIVE);
    });

    it('should reject session if no permissions granted', async () => {
      const eventSpy = jest.fn();
      monitoringService.on('remoteAssistanceRejected', eventSpy);

      const result = await monitoringService.grantRemotePermissions(
        sessionId,
        [], // No permissions granted
        'user_456'
      );

      expect(result).toBe(true);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should log permission grant', async () => {
      await monitoringService.grantRemotePermissions(
        sessionId,
        [RemotePermissionType.VIEW_SCREEN],
        'user_456'
      );

      const permissionLog = mockAuditLogger.logs.find(log => 
        log.resource === 'remote_permissions'
      );
      expect(permissionLog).toBeDefined();
    });
  });

  describe('executeRemoteAction', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await monitoringService.startRemoteAssistance(
        'caregiver_123',
        'user_456',
        AssistanceType.DEVICE_CONTROL,
        [RemotePermissionType.CONTROL_DEVICE]
      );
      sessionId = session.id;

      // Grant permissions and activate session
      await monitoringService.grantRemotePermissions(
        sessionId,
        [RemotePermissionType.CONTROL_DEVICE],
        'user_456'
      );
    });

    it('should execute action with proper permissions', async () => {
      const result = await monitoringService.executeRemoteAction(
        sessionId,
        'control_device',
        { action: 'restart_app' },
        'caregiver_123'
      );

      expect(result).toBe(true);
    });

    it('should reject action without proper permissions', async () => {
      const result = await monitoringService.executeRemoteAction(
        sessionId,
        'view_screen', // Not granted
        { action: 'take_screenshot' },
        'caregiver_123'
      );

      expect(result).toBe(false);
    });

    it('should log remote actions', async () => {
      await monitoringService.executeRemoteAction(
        sessionId,
        'control_device',
        { action: 'restart_app' },
        'caregiver_123'
      );

      const actionLog = mockAuditLogger.logs.find(log => 
        log.resource === 'remote_action' && log.success === true
      );
      expect(actionLog).toBeDefined();
    });

    it('should emit remoteActionExecuted event', async () => {
      const eventSpy = jest.fn();
      monitoringService.on('remoteActionExecuted', eventSpy);

      await monitoringService.executeRemoteAction(
        sessionId,
        'control_device',
        { action: 'restart_app' },
        'caregiver_123'
      );

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('endRemoteAssistance', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await monitoringService.startRemoteAssistance(
        'caregiver_123',
        'user_456',
        AssistanceType.TROUBLESHOOTING,
        []
      );
      sessionId = session.id;
    });

    it('should end assistance session', async () => {
      const result = await monitoringService.endRemoteAssistance(sessionId, 'caregiver_123');

      expect(result).toBe(true);

      // Check that session is no longer active
      const activeSessions = monitoringService.getActiveAssistanceSessions();
      expect(activeSessions).toHaveLength(0);
    });

    it('should log session end', async () => {
      await monitoringService.endRemoteAssistance(sessionId, 'caregiver_123');

      const endLog = mockAuditLogger.logs.find(log => 
        log.resource === 'assistance_session_end'
      );
      expect(endLog).toBeDefined();
    });

    it('should emit remoteAssistanceEnded event', async () => {
      const eventSpy = jest.fn();
      monitoringService.on('remoteAssistanceEnded', eventSpy);

      await monitoringService.endRemoteAssistance(sessionId, 'caregiver_123');

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getEmergencyAlerts', () => {
    beforeEach(async () => {
      // Create some test alerts
      await monitoringService.detectEmergency(
        'user_123',
        EmergencyType.FALL_DETECTION,
        EmergencySeverity.HIGH,
        'Fall detected'
      );
      await monitoringService.detectEmergency(
        'user_123',
        EmergencyType.PANIC_BUTTON,
        EmergencySeverity.CRITICAL,
        'Panic button pressed'
      );
      await monitoringService.detectEmergency(
        'user_456', // Different user
        EmergencyType.NO_RESPONSE,
        EmergencySeverity.MEDIUM,
        'No response'
      );
    });

    it('should return alerts for specific user', () => {
      const alerts = monitoringService.getEmergencyAlerts('user_123');

      expect(alerts).toHaveLength(2);
      expect(alerts.every(alert => alert.userId === 'user_123')).toBe(true);
    });

    it('should sort alerts by timestamp (newest first)', () => {
      const alerts = monitoringService.getEmergencyAlerts('user_123');

      expect(alerts[0].detectedAt.getTime()).toBeGreaterThanOrEqual(
        alerts[1].detectedAt.getTime()
      );
    });

    it('should respect limit parameter', () => {
      const alerts = monitoringService.getEmergencyAlerts('user_123', 1);

      expect(alerts).toHaveLength(1);
    });
  });

  describe('getActiveAssistanceSessions', () => {
    beforeEach(async () => {
      // Create active session
      const session1 = await monitoringService.startRemoteAssistance(
        'caregiver_123',
        'user_456',
        AssistanceType.SCREEN_SHARING,
        [RemotePermissionType.VIEW_SCREEN]
      );
      await monitoringService.grantRemotePermissions(
        session1.id,
        [RemotePermissionType.VIEW_SCREEN],
        'user_456'
      );

      // Create ended session
      const session2 = await monitoringService.startRemoteAssistance(
        'caregiver_456',
        'user_789',
        AssistanceType.VOICE_CALL,
        []
      );
      await monitoringService.endRemoteAssistance(session2.id, 'caregiver_456');
    });

    it('should return only active sessions', () => {
      const activeSessions = monitoringService.getActiveAssistanceSessions();

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].status).toBe(SessionStatus.ACTIVE);
    });

    it('should filter by caregiver when specified', () => {
      const caregiverSessions = monitoringService.getActiveAssistanceSessions('caregiver_123');

      expect(caregiverSessions).toHaveLength(1);
      expect(caregiverSessions[0].caregiverId).toBe('caregiver_123');
    });
  });
});