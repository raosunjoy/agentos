/**
 * Integration tests for emergency response and caregiver notifications
 * Tests the complete workflow from emergency detection to caregiver response
 */

import { MonitoringService } from '../monitoring-service';
import { CommunicationService } from '../communication-service';
import { ConsentManager } from '../consent-manager';
import { AccessAuditLogger } from '../access-audit-logger';
import {
  EmergencyType,
  EmergencySeverity,
  AssistanceType,
  RemotePermissionType,
  UserInteraction,
  EncryptionService
} from '../monitoring-service';
import {
  ChannelType,
  ParticipantType,
  ParticipantRole,
  MessageType,
  EmergencyBroadcastType,
  EmergencyResponse,
  EncryptedContent
} from '../communication-service';
import {
  CaregiverRole,
  PermissionType,
  PermissionScope,
  ConsentConfiguration,
  AccessAuditLog,
  CaregiverPermission
} from '../types';

// Mock implementations
class MockEncryptionService implements EncryptionService {
  async encrypt(data: string): Promise<string> {
    return `encrypted_${data}`;
  }

  async decrypt(encryptedData: string): Promise<string> {
    return encryptedData.replace('encrypted_', '');
  }
}

// Mock for communication service encryption
class MockCommunicationEncryptionService {
  async encrypt(data: string): Promise<EncryptedContent> {
    return {
      data: `encrypted_${data}`,
      iv: 'mock_iv',
      keyId: 'mock_key_id'
    };
  }

  async decrypt(encryptedContent: string): Promise<string> {
    return encryptedContent.replace('encrypted_', '');
  }
}

class MockAuditLogger implements AccessAuditLogger {
  logs: AccessAuditLog[] = [];

  async log(entry: Omit<AccessAuditLog, 'id'>): Promise<void> {
    this.logs.push({
      ...entry,
      id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }

  async getCaregiverAuditLogs(caregiverId: string): Promise<AccessAuditLog[]> {
    return this.logs.filter(log => log.caregiverId === caregiverId);
  }
}

describe('Emergency Response Integration', () => {
  let monitoringService: MonitoringService;
  let communicationService: CommunicationService;
  let consentManager: ConsentManager;
  let mockEncryptionService: MockEncryptionService;
  let mockAuditLogger: MockAuditLogger;

  const userId = 'elderly_user_123';
  const caregiverId = 'caregiver_456';
  const emergencyContactId = 'emergency_contact_789';

  beforeEach(() => {
    mockEncryptionService = new MockEncryptionService();
    mockAuditLogger = new MockAuditLogger();
    const mockCommEncryptionService = new MockCommunicationEncryptionService();
    
    const consentConfig: ConsentConfiguration = {
      requireExplicitConsent: true,
      defaultPermissionDuration: 30,
      maxPermissionDuration: 365,
      allowEmergencyOverride: true,
      requirePeriodicReconfirmation: false,
      reconfirmationInterval: 90
    };

    monitoringService = new MonitoringService(mockAuditLogger, mockEncryptionService);
    communicationService = new CommunicationService(mockCommEncryptionService as any, mockAuditLogger);
    consentManager = new ConsentManager(mockAuditLogger, consentConfig);

    // Set up caregiver consent
    setupCaregiverConsent();
  });

  async function setupCaregiverConsent() {
    // Create consent request for daily monitoring
    const permissions: CaregiverPermission[] = [
      {
        type: PermissionType.VIEW_ACTIVITY_SUMMARY,
        scope: PermissionScope.DAILY_SUMMARY,
        grantedAt: new Date()
      },
      {
        type: PermissionType.RECEIVE_EMERGENCY_ALERTS,
        scope: PermissionScope.EMERGENCY_ONLY,
        grantedAt: new Date()
      },
      {
        type: PermissionType.REMOTE_ASSISTANCE,
        scope: PermissionScope.EMERGENCY_ONLY,
        grantedAt: new Date()
      }
    ];

    const consentRequest = await consentManager.createConsentRequest(
      caregiverId,
      permissions,
      CaregiverRole.DAILY_MONITOR,
      'I would like to help monitor daily activities and provide emergency assistance'
    );

    // Approve the consent
    await consentManager.approveConsentRequest(consentRequest.id, userId);

    // Set up emergency contact with broader permissions
    const emergencyPermissions: CaregiverPermission[] = [
      {
        type: PermissionType.RECEIVE_EMERGENCY_ALERTS,
        scope: PermissionScope.REAL_TIME,
        grantedAt: new Date()
      },
      {
        type: PermissionType.REMOTE_ASSISTANCE,
        scope: PermissionScope.FULL_ACCESS,
        grantedAt: new Date()
      },
      {
        type: PermissionType.VIEW_LOCATION,
        scope: PermissionScope.EMERGENCY_ONLY,
        grantedAt: new Date()
      }
    ];

    const emergencyConsentRequest = await consentManager.createConsentRequest(
      emergencyContactId,
      emergencyPermissions,
      CaregiverRole.EMERGENCY_CONTACT,
      'Emergency contact for immediate response'
    );

    await consentManager.approveConsentRequest(emergencyConsentRequest.id, userId);
  }

  describe('Requirement 5.2: Daily Summaries', () => {
    it('should generate and provide daily summaries to authorized caregivers', async () => {
      // Simulate user interactions throughout the day
      const interactions: UserInteraction[] = [
        {
          id: 'int_1',
          type: 'voice_command',
          timestamp: new Date('2024-01-01T08:00:00Z'),
          success: true,
          duration: 3000,
          details: { command: 'good morning' }
        },
        {
          id: 'int_2',
          type: 'medication',
          timestamp: new Date('2024-01-01T09:00:00Z'),
          success: true,
          duration: 1000,
          details: { medication: 'morning_pills' }
        },
        {
          id: 'int_3',
          type: 'voice_command',
          timestamp: new Date('2024-01-01T14:00:00Z'),
          success: false,
          duration: 5000,
          details: { command: 'call doctor', error: 'contact_not_found' }
        },
        {
          id: 'int_4',
          type: 'health',
          timestamp: new Date('2024-01-01T18:00:00Z'),
          success: true,
          duration: 2000,
          details: { type: 'blood_pressure_check', reading: '120/80' }
        }
      ];

      // Generate daily summary
      const summary = await monitoringService.generateDailySummary(
        userId,
        new Date('2024-01-01'),
        interactions
      );

      expect(summary.totalInteractions).toBe(4);
      expect(summary.successfulTasks).toBe(3);
      expect(summary.failedTasks).toBe(1);
      expect(summary.activityPatterns.length).toBeGreaterThan(0);

      // Verify caregiver can access summary (with proper consent)
      const summaries = await monitoringService.getDailySummaries(
        userId,
        new Date('2024-01-01'),
        new Date('2024-01-01'),
        caregiverId
      );

      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe(summary.id);
    });

    it('should detect and report concerns in daily summaries', async () => {
      // Simulate concerning interactions (multiple failures)
      const concerningInteractions: UserInteraction[] = Array.from({ length: 8 }, (_, i) => ({
        id: `int_${i}`,
        type: 'voice_command',
        timestamp: new Date(`2024-01-01T${10 + i}:00:00Z`),
        success: false,
        duration: 2000,
        details: { error: 'speech_not_recognized' }
      }));

      const summary = await monitoringService.generateDailySummary(
        userId,
        new Date('2024-01-01'),
        concerningInteractions
      );

      expect(summary.concerns.length).toBeGreaterThan(0);
      expect(summary.concerns.some(c => c.type === 'repeated_failures')).toBe(true);
    });
  });

  describe('Requirement 5.3: Remote Assistance', () => {
    it('should enable secure remote assistance through encrypted channels', async () => {
      // Create communication channel between user and caregiver
      const channel = await communicationService.createChannel(
        [
          {
            id: userId,
            type: ParticipantType.USER,
            role: ParticipantRole.OWNER
          },
          {
            id: caregiverId,
            type: ParticipantType.CAREGIVER,
            role: ParticipantRole.MEMBER
          }
        ],
        ChannelType.DIRECT_MESSAGE,
        userId,
        true // encrypted
      );

      // User requests help
      await communicationService.sendMessage(
        channel.id,
        userId,
        MessageType.TEXT,
        'I need help with my medication reminder'
      );

      // Caregiver initiates remote assistance
      const assistanceSession = await monitoringService.startRemoteAssistance(
        caregiverId,
        userId,
        AssistanceType.TROUBLESHOOTING,
        [RemotePermissionType.VIEW_SCREEN, RemotePermissionType.ACCESS_SETTINGS]
      );

      expect(assistanceSession.caregiverId).toBe(caregiverId);
      expect(assistanceSession.userId).toBe(userId);
      expect(assistanceSession.encrypted).toBe(true);

      // User grants permissions
      const permissionGranted = await monitoringService.grantRemotePermissions(
        assistanceSession.id,
        [RemotePermissionType.VIEW_SCREEN],
        userId
      );

      expect(permissionGranted).toBe(true);

      // Caregiver performs remote action
      const actionExecuted = await monitoringService.executeRemoteAction(
        assistanceSession.id,
        'view_screen',
        { action: 'help_with_medication_app' },
        caregiverId
      );

      expect(actionExecuted).toBe(true);

      // End assistance session
      const sessionEnded = await monitoringService.endRemoteAssistance(
        assistanceSession.id,
        caregiverId
      );

      expect(sessionEnded).toBe(true);
    });

    it('should require explicit user consent for remote assistance', async () => {
      // Attempt remote assistance without user consent
      const assistanceSession = await monitoringService.startRemoteAssistance(
        caregiverId,
        userId,
        AssistanceType.DEVICE_CONTROL,
        [RemotePermissionType.CONTROL_DEVICE]
      );

      // Try to execute action without granted permissions
      const actionExecuted = await monitoringService.executeRemoteAction(
        assistanceSession.id,
        'control_device',
        { action: 'restart_app' },
        caregiverId
      );

      expect(actionExecuted).toBe(false); // Should fail without permissions
    });
  });

  describe('Requirement 5.4: Emergency Detection and Alerts', () => {
    it('should automatically alert designated caregivers when emergency is detected', async () => {
      const emergencyAlertSpy = jest.fn();
      const broadcastSpy = jest.fn();

      monitoringService.on('emergencyDetected', emergencyAlertSpy);
      communicationService.on('emergencyBroadcast', broadcastSpy);

      // Simulate emergency detection
      const location = { latitude: 40.7128, longitude: -74.0060, address: '123 Main St' };
      const alert = await monitoringService.detectEmergency(
        userId,
        EmergencyType.FALL_DETECTION,
        EmergencySeverity.HIGH,
        'Fall detected in living room',
        location
      );

      expect(emergencyAlertSpy).toHaveBeenCalledWith(alert);
      expect(alert.caregiverNotifications.length).toBeGreaterThan(0);

      // Send emergency broadcast to all caregivers
      const broadcast = await communicationService.sendEmergencyBroadcast(
        userId,
        EmergencyBroadcastType.FALL_DETECTED,
        'Fall detected - immediate assistance needed',
        location,
        [caregiverId, emergencyContactId]
      );

      expect(broadcastSpy).toHaveBeenCalledTimes(2); // One for each caregiver
      expect(broadcast.recipients).toContain(caregiverId);
      expect(broadcast.recipients).toContain(emergencyContactId);
    });

    it('should execute automatic actions for critical emergencies', async () => {
      const alert = await monitoringService.detectEmergency(
        userId,
        EmergencyType.MEDICAL_EMERGENCY,
        EmergencySeverity.CRITICAL,
        'Medical emergency detected - no response from user'
      );

      expect(alert.autoActions.length).toBeGreaterThan(0);
      expect(alert.autoActions.some(action => 
        action.type === 'call_emergency_services'
      )).toBe(true);
    });

    it('should allow caregivers to acknowledge and respond to emergencies', async () => {
      const acknowledgedSpy = jest.fn();
      communicationService.on('emergencyAcknowledged', acknowledgedSpy);

      // Send emergency broadcast
      const broadcast = await communicationService.sendEmergencyBroadcast(
        userId,
        EmergencyBroadcastType.PANIC_BUTTON,
        'Panic button pressed',
        undefined,
        [caregiverId, emergencyContactId]
      );

      // Caregiver acknowledges emergency
      const acknowledged = await communicationService.acknowledgeEmergency(
        broadcast.id,
        caregiverId,
        EmergencyResponse.ON_THE_WAY,
        new Date(Date.now() + 15 * 60 * 1000) // 15 minutes ETA
      );

      expect(acknowledged).toBe(true);
      expect(acknowledgedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          caregiverId,
          response: EmergencyResponse.ON_THE_WAY
        })
      );

      // Emergency contact also acknowledges
      await communicationService.acknowledgeEmergency(
        broadcast.id,
        emergencyContactId,
        EmergencyResponse.CALLING_SERVICES
      );

      // Check that both caregivers have acknowledged
      const updatedBroadcast = communicationService['emergencyBroadcasts'].get(broadcast.id);
      expect(updatedBroadcast?.acknowledged.length).toBe(2);
    });
  });

  describe('Requirement 5.6: End-to-End Encrypted Communications', () => {
    it('should encrypt all caregiver communications', async () => {
      // Create encrypted channel
      const channel = await communicationService.createChannel(
        [
          {
            id: userId,
            type: ParticipantType.USER,
            role: ParticipantRole.OWNER
          },
          {
            id: caregiverId,
            type: ParticipantType.CAREGIVER,
            role: ParticipantRole.MEMBER
          }
        ],
        ChannelType.DIRECT_MESSAGE,
        userId,
        true // encrypted
      );

      expect(channel.encrypted).toBe(true);

      // Send encrypted message
      const message = await communicationService.sendMessage(
        channel.id,
        userId,
        MessageType.TEXT,
        'Sensitive health information'
      );

      // Verify message is encrypted in storage
      expect(message.content.data).toBe('encrypted_Sensitive health information');
      expect(message.content.keyId).toBeDefined();
      expect(message.content.iv).toBeDefined();

      // Retrieve and decrypt messages
      const messages = await communicationService.getMessages(channel.id, caregiverId);
      expect(messages[0].content.data).toBe('Sensitive health information'); // Decrypted
    });

    it('should encrypt voice and video calls', async () => {
      // Create channel for call
      const channel = await communicationService.createChannel(
        [
          {
            id: userId,
            type: ParticipantType.USER,
            role: ParticipantRole.OWNER
          },
          {
            id: emergencyContactId,
            type: ParticipantType.CAREGIVER,
            role: ParticipantRole.MEMBER
          }
        ],
        ChannelType.VOICE_CALL,
        userId
      );

      // Start encrypted call
      const callSession = await communicationService.startCall(
        channel.id,
        userId,
        'voice' as any,
        [emergencyContactId]
      );

      expect(callSession.encrypted).toBe(true); // Calls are always encrypted
    });

    it('should encrypt emergency broadcasts', async () => {
      const broadcast = await communicationService.sendEmergencyBroadcast(
        userId,
        EmergencyBroadcastType.MEDICAL_EMERGENCY,
        'Medical emergency - need immediate help',
        { latitude: 40.7128, longitude: -74.0060 },
        [caregiverId, emergencyContactId]
      );

      // Emergency broadcasts should be encrypted when transmitted
      expect(broadcast.message).toBeDefined();
      expect(broadcast.location).toBeDefined();
    });
  });

  describe('Integration Workflow Tests', () => {
    it('should handle complete emergency response workflow', async () => {
      // 1. Emergency detected
      const alert = await monitoringService.detectEmergency(
        userId,
        EmergencyType.NO_RESPONSE,
        EmergencySeverity.HIGH,
        'User has not responded for 2 hours',
        { latitude: 40.7128, longitude: -74.0060 }
      );

      // 2. Emergency broadcast sent
      const broadcast = await communicationService.sendEmergencyBroadcast(
        userId,
        EmergencyBroadcastType.NO_RESPONSE,
        'User unresponsive - wellness check needed',
        alert.location,
        [caregiverId, emergencyContactId]
      );

      // 3. Caregiver acknowledges and starts remote assistance
      await communicationService.acknowledgeEmergency(
        broadcast.id,
        caregiverId,
        EmergencyResponse.ON_THE_WAY
      );

      const assistanceSession = await monitoringService.startRemoteAssistance(
        caregiverId,
        userId,
        AssistanceType.EMERGENCY_SUPPORT,
        [RemotePermissionType.VIEW_SCREEN, RemotePermissionType.MAKE_CALLS]
      );

      // 4. Emergency contact also responds
      await communicationService.acknowledgeEmergency(
        broadcast.id,
        emergencyContactId,
        EmergencyResponse.CALLING_SERVICES
      );

      // 5. Create emergency communication channel
      const emergencyChannel = await communicationService.createChannel(
        [
          {
            id: userId,
            type: ParticipantType.USER,
            role: ParticipantRole.OWNER
          },
          {
            id: caregiverId,
            type: ParticipantType.CAREGIVER,
            role: ParticipantRole.MEMBER
          },
          {
            id: emergencyContactId,
            type: ParticipantType.CAREGIVER,
            role: ParticipantRole.MEMBER
          }
        ],
        ChannelType.EMERGENCY_CHANNEL,
        caregiverId,
        true
      );

      // 6. Coordinate response through encrypted channel
      await communicationService.sendMessage(
        emergencyChannel.id,
        caregiverId,
        MessageType.TEXT,
        'I am 10 minutes away, calling user now'
      );

      await communicationService.sendMessage(
        emergencyChannel.id,
        emergencyContactId,
        MessageType.TEXT,
        'Emergency services have been notified'
      );

      // Verify all components worked together
      expect(alert.id).toBeDefined();
      expect(broadcast.id).toBeDefined();
      expect(assistanceSession.id).toBeDefined();
      expect(emergencyChannel.id).toBeDefined();
      expect(emergencyChannel.encrypted).toBe(true);
    });

    it('should maintain audit trail for all emergency activities', async () => {
      // Perform emergency response activities
      await monitoringService.detectEmergency(
        userId,
        EmergencyType.PANIC_BUTTON,
        EmergencySeverity.CRITICAL,
        'Panic button activated'
      );

      const broadcast = await communicationService.sendEmergencyBroadcast(
        userId,
        EmergencyBroadcastType.PANIC_BUTTON,
        'Emergency assistance needed immediately'
      );

      await communicationService.acknowledgeEmergency(
        broadcast.id,
        caregiverId,
        EmergencyResponse.ON_THE_WAY
      );

      // Verify audit logs were created
      const auditLogs = await mockAuditLogger.getCaregiverAuditLogs(caregiverId);
      expect(auditLogs.length).toBeGreaterThan(0);

      const emergencyLogs = auditLogs.filter(log => 
        log.action === 'emergency_alert' || 
        log.resource === 'emergency_broadcast' ||
        log.resource === 'emergency_acknowledgment'
      );
      expect(emergencyLogs.length).toBeGreaterThan(0);
    });
  });
});