/**
 * Tests for CommunicationService
 */

import { CommunicationService } from '../communication-service';
import {
  ChannelType,
  ParticipantType,
  ParticipantRole,
  MessageType,
  CallType,
  CallStatus,
  EmergencyBroadcastType,
  EmergencyResponse,
  EncryptionService,
  AccessAuditLogger,
  EncryptedContent
} from '../communication-service';
import { AccessAuditLog } from '../types';

// Mock implementations
class MockEncryptionService implements EncryptionService {
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
}

describe('CommunicationService', () => {
  let communicationService: CommunicationService;
  let mockEncryptionService: MockEncryptionService;
  let mockAuditLogger: MockAuditLogger;

  beforeEach(() => {
    mockEncryptionService = new MockEncryptionService();
    mockAuditLogger = new MockAuditLogger();
    communicationService = new CommunicationService(mockEncryptionService, mockAuditLogger);
  });

  describe('createChannel', () => {
    it('should create a new communication channel', async () => {
      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        },
        {
          id: 'caregiver_456',
          type: ParticipantType.CAREGIVER,
          role: ParticipantRole.MEMBER
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123',
        true
      );

      expect(channel.participants).toHaveLength(2);
      expect(channel.type).toBe(ChannelType.DIRECT_MESSAGE);
      expect(channel.encrypted).toBe(true);
      expect(channel.createdAt).toBeInstanceOf(Date);
      expect(channel.status).toBe('active');
    });

    it('should assign default permissions based on role', async () => {
      const participants = [
        {
          id: 'admin_123',
          type: ParticipantType.CAREGIVER,
          role: ParticipantRole.ADMIN
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.GROUP_CHAT,
        'admin_123'
      );

      const adminParticipant = channel.participants[0];
      expect(adminParticipant.permissions.length).toBeGreaterThan(4); // Admin gets more permissions
      expect(adminParticipant.permissions.some(p => p.type === 'share_screen')).toBe(true);
    });

    it('should log channel creation', async () => {
      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        }
      ];

      await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123'
      );

      expect(mockAuditLogger.logs).toHaveLength(1);
      expect(mockAuditLogger.logs[0].resource).toBe('communication_channel');
      expect(mockAuditLogger.logs[0].caregiverId).toBe('user_123');
    });

    it('should emit channelCreated event', async () => {
      const eventSpy = jest.fn();
      communicationService.on('channelCreated', eventSpy);

      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123'
      );

      expect(eventSpy).toHaveBeenCalledWith(channel);
    });
  });

  describe('sendMessage', () => {
    let channelId: string;

    beforeEach(async () => {
      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        },
        {
          id: 'caregiver_456',
          type: ParticipantType.CAREGIVER,
          role: ParticipantRole.MEMBER
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123',
        true
      );
      channelId = channel.id;
    });

    it('should send message in encrypted channel', async () => {
      const message = await communicationService.sendMessage(
        channelId,
        'user_123',
        MessageType.TEXT,
        'Hello, I need help!'
      );

      expect(message.senderId).toBe('user_123');
      expect(message.type).toBe(MessageType.TEXT);
      expect(message.content.data).toBe('encrypted_Hello, I need help!');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent channel', async () => {
      await expect(
        communicationService.sendMessage(
          'non_existent_channel',
          'user_123',
          MessageType.TEXT,
          'Hello'
        )
      ).rejects.toThrow('Channel not found');
    });

    it('should throw error for insufficient permissions', async () => {
      await expect(
        communicationService.sendMessage(
          channelId,
          'unauthorized_user',
          MessageType.TEXT,
          'Hello'
        )
      ).rejects.toThrow('Insufficient permissions to send messages');
    });

    it('should log message sending', async () => {
      await communicationService.sendMessage(
        channelId,
        'user_123',
        MessageType.TEXT,
        'Test message'
      );

      const messageLog = mockAuditLogger.logs.find(log => 
        log.resource === 'message'
      );
      expect(messageLog).toBeDefined();
      expect(messageLog?.caregiverId).toBe('user_123');
    });

    it('should emit messageSent event', async () => {
      const eventSpy = jest.fn();
      communicationService.on('messageSent', eventSpy);

      const message = await communicationService.sendMessage(
        channelId,
        'user_123',
        MessageType.TEXT,
        'Test message'
      );

      expect(eventSpy).toHaveBeenCalledWith(message);
    });
  });

  describe('getMessages', () => {
    let channelId: string;

    beforeEach(async () => {
      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        },
        {
          id: 'caregiver_456',
          type: ParticipantType.CAREGIVER,
          role: ParticipantRole.MEMBER
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123',
        true
      );
      channelId = channel.id;

      // Send some test messages with small delays to ensure different timestamps
      await communicationService.sendMessage(channelId, 'user_123', MessageType.TEXT, 'Message 1');
      await new Promise(resolve => setTimeout(resolve, 1));
      await communicationService.sendMessage(channelId, 'caregiver_456', MessageType.TEXT, 'Message 2');
      await new Promise(resolve => setTimeout(resolve, 1));
      await communicationService.sendMessage(channelId, 'user_123', MessageType.TEXT, 'Message 3');
    });

    it('should return decrypted messages for authorized user', async () => {
      const messages = await communicationService.getMessages(channelId, 'user_123');

      expect(messages).toHaveLength(3);
      expect(messages[0].content.data).toBe('Message 3'); // Newest first
      expect(messages[1].content.data).toBe('Message 2');
      expect(messages[2].content.data).toBe('Message 1');
    });

    it('should respect limit parameter', async () => {
      const messages = await communicationService.getMessages(channelId, 'user_123', 2);

      expect(messages).toHaveLength(2);
    });

    it('should filter messages by date', async () => {
      const beforeDate = new Date(Date.now() - 1000); // 1 second ago
      const messages = await communicationService.getMessages(
        channelId, 
        'user_123', 
        50, 
        beforeDate
      );

      expect(messages.length).toBeLessThan(3); // Should exclude recent messages
    });

    it('should throw error for unauthorized user', async () => {
      await expect(
        communicationService.getMessages(channelId, 'unauthorized_user')
      ).rejects.toThrow('Insufficient permissions to view messages');
    });

    it('should log message access', async () => {
      await communicationService.getMessages(channelId, 'caregiver_456');

      const accessLog = mockAuditLogger.logs.find(log => 
        log.resource === 'messages' && log.caregiverId === 'caregiver_456'
      );
      expect(accessLog).toBeDefined();
    });
  });

  describe('startCall', () => {
    let channelId: string;

    beforeEach(async () => {
      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        },
        {
          id: 'caregiver_456',
          type: ParticipantType.CAREGIVER,
          role: ParticipantRole.MEMBER
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123'
      );
      channelId = channel.id;
    });

    it('should start a voice call', async () => {
      const callSession = await communicationService.startCall(
        channelId,
        'user_123',
        CallType.VOICE,
        ['caregiver_456']
      );

      expect(callSession.initiatorId).toBe('user_123');
      expect(callSession.type).toBe(CallType.VOICE);
      expect(callSession.status).toBe(CallStatus.INITIATING);
      expect(callSession.participants).toHaveLength(1); // Only initiator initially
      expect(callSession.encrypted).toBe(true); // Calls are always encrypted for security
    });

    it('should start a video call', async () => {
      const callSession = await communicationService.startCall(
        channelId,
        'user_123',
        CallType.VIDEO,
        ['caregiver_456']
      );

      expect(callSession.type).toBe(CallType.VIDEO);
      expect(callSession.participants[0].videoEnabled).toBe(true);
      expect(callSession.quality.videoQuality).toBe(100);
    });

    it('should throw error for insufficient permissions', async () => {
      await expect(
        communicationService.startCall(
          channelId,
          'unauthorized_user',
          CallType.VOICE,
          ['caregiver_456']
        )
      ).rejects.toThrow('Insufficient permissions to make calls');
    });

    it('should emit incomingCall event for participants', async () => {
      const eventSpy = jest.fn();
      communicationService.on('incomingCall', eventSpy);

      await communicationService.startCall(
        channelId,
        'user_123',
        CallType.VOICE,
        ['caregiver_456']
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          participantId: 'caregiver_456',
          channelId
        })
      );
    });

    it('should log call initiation', async () => {
      await communicationService.startCall(
        channelId,
        'user_123',
        CallType.VOICE,
        ['caregiver_456']
      );

      const callLog = mockAuditLogger.logs.find(log => 
        log.resource === 'call_session'
      );
      expect(callLog).toBeDefined();
      expect(callLog?.caregiverId).toBe('user_123');
    });
  });

  describe('joinCall', () => {
    let callId: string;

    beforeEach(async () => {
      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        },
        {
          id: 'caregiver_456',
          type: ParticipantType.CAREGIVER,
          role: ParticipantRole.MEMBER
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123'
      );

      const callSession = await communicationService.startCall(
        channel.id,
        'user_123',
        CallType.VOICE,
        ['caregiver_456']
      );
      callId = callSession.id;
    });

    it('should allow participant to join call', async () => {
      const result = await communicationService.joinCall(callId, 'caregiver_456');

      expect(result).toBe(true);

      // Check that call status changed to active
      const activeCalls = communicationService.getUserActiveCalls('caregiver_456');
      expect(activeCalls).toHaveLength(1);
      expect(activeCalls[0].status).toBe(CallStatus.ACTIVE);
    });

    it('should return false for non-existent call', async () => {
      const result = await communicationService.joinCall('non_existent_call', 'caregiver_456');

      expect(result).toBe(false);
    });

    it('should return true if user already in call', async () => {
      await communicationService.joinCall(callId, 'caregiver_456');
      const result = await communicationService.joinCall(callId, 'caregiver_456');

      expect(result).toBe(true);
    });

    it('should log call join', async () => {
      await communicationService.joinCall(callId, 'caregiver_456');

      const joinLog = mockAuditLogger.logs.find(log => 
        log.resource === 'call_join' && log.caregiverId === 'caregiver_456'
      );
      expect(joinLog).toBeDefined();
    });

    it('should emit participantJoined event', async () => {
      const eventSpy = jest.fn();
      communicationService.on('participantJoined', eventSpy);

      await communicationService.joinCall(callId, 'caregiver_456');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'caregiver_456'
        })
      );
    });
  });

  describe('endCall', () => {
    let callId: string;

    beforeEach(async () => {
      const participants = [
        {
          id: 'user_123',
          type: ParticipantType.USER,
          role: ParticipantRole.OWNER
        },
        {
          id: 'caregiver_456',
          type: ParticipantType.CAREGIVER,
          role: ParticipantRole.MEMBER
        }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123'
      );

      const callSession = await communicationService.startCall(
        channel.id,
        'user_123',
        CallType.VOICE,
        ['caregiver_456']
      );
      callId = callSession.id;

      await communicationService.joinCall(callId, 'caregiver_456');
    });

    it('should end call by initiator', async () => {
      const result = await communicationService.endCall(callId, 'user_123');

      expect(result).toBe(true);

      // Check that no active calls remain
      const activeCalls = communicationService.getUserActiveCalls('user_123');
      expect(activeCalls).toHaveLength(0);
    });

    it('should end call by participant', async () => {
      const result = await communicationService.endCall(callId, 'caregiver_456');

      expect(result).toBe(true);
    });

    it('should return false for unauthorized user', async () => {
      const result = await communicationService.endCall(callId, 'unauthorized_user');

      expect(result).toBe(false);
    });

    it('should log call end', async () => {
      await communicationService.endCall(callId, 'user_123');

      const endLog = mockAuditLogger.logs.find(log => 
        log.resource === 'call_end'
      );
      expect(endLog).toBeDefined();
      expect(endLog?.details?.duration).toBeDefined();
    });

    it('should emit callEnded event', async () => {
      const eventSpy = jest.fn();
      communicationService.on('callEnded', eventSpy);

      await communicationService.endCall(callId, 'user_123');

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('sendEmergencyBroadcast', () => {
    it('should create and send emergency broadcast', async () => {
      const userId = 'user_123';
      const type = EmergencyBroadcastType.FALL_DETECTED;
      const message = 'Fall detected in living room';
      const location = { latitude: 40.7128, longitude: -74.0060 };
      const caregiverIds = ['caregiver_456', 'caregiver_789'];

      const broadcast = await communicationService.sendEmergencyBroadcast(
        userId,
        type,
        message,
        location,
        caregiverIds
      );

      expect(broadcast.userId).toBe(userId);
      expect(broadcast.type).toBe(type);
      expect(broadcast.message).toBe(message);
      expect(broadcast.location).toEqual(location);
      expect(broadcast.recipients).toEqual(caregiverIds);
      expect(broadcast.acknowledged).toHaveLength(0);
    });

    it('should emit emergencyBroadcast event for each recipient', async () => {
      const eventSpy = jest.fn();
      communicationService.on('emergencyBroadcast', eventSpy);

      await communicationService.sendEmergencyBroadcast(
        'user_123',
        EmergencyBroadcastType.PANIC_BUTTON,
        'Panic button pressed',
        undefined,
        ['caregiver_456', 'caregiver_789']
      );

      expect(eventSpy).toHaveBeenCalledTimes(2);
    });

    it('should log emergency broadcast', async () => {
      await communicationService.sendEmergencyBroadcast(
        'user_123',
        EmergencyBroadcastType.MEDICAL_EMERGENCY,
        'Medical emergency detected'
      );

      const broadcastLog = mockAuditLogger.logs.find(log => 
        log.resource === 'emergency_broadcast'
      );
      expect(broadcastLog).toBeDefined();
      expect(broadcastLog?.caregiverId).toBe('system');
    });
  });

  describe('acknowledgeEmergency', () => {
    let broadcastId: string;

    beforeEach(async () => {
      const broadcast = await communicationService.sendEmergencyBroadcast(
        'user_123',
        EmergencyBroadcastType.FALL_DETECTED,
        'Fall detected',
        undefined,
        ['caregiver_456']
      );
      broadcastId = broadcast.id;
    });

    it('should acknowledge emergency broadcast', async () => {
      const result = await communicationService.acknowledgeEmergency(
        broadcastId,
        'caregiver_456',
        EmergencyResponse.ON_THE_WAY,
        new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
      );

      expect(result).toBe(true);
    });

    it('should return false for duplicate acknowledgment', async () => {
      await communicationService.acknowledgeEmergency(
        broadcastId,
        'caregiver_456',
        EmergencyResponse.ON_THE_WAY
      );

      const result = await communicationService.acknowledgeEmergency(
        broadcastId,
        'caregiver_456',
        EmergencyResponse.MONITORING
      );

      expect(result).toBe(false);
    });

    it('should return false for non-existent broadcast', async () => {
      const result = await communicationService.acknowledgeEmergency(
        'non_existent_broadcast',
        'caregiver_456',
        EmergencyResponse.ON_THE_WAY
      );

      expect(result).toBe(false);
    });

    it('should log emergency acknowledgment', async () => {
      await communicationService.acknowledgeEmergency(
        broadcastId,
        'caregiver_456',
        EmergencyResponse.CALLING_SERVICES
      );

      const ackLog = mockAuditLogger.logs.find(log => 
        log.resource === 'emergency_acknowledgment'
      );
      expect(ackLog).toBeDefined();
      expect(ackLog?.caregiverId).toBe('caregiver_456');
    });

    it('should emit emergencyAcknowledged event', async () => {
      const eventSpy = jest.fn();
      communicationService.on('emergencyAcknowledged', eventSpy);

      await communicationService.acknowledgeEmergency(
        broadcastId,
        'caregiver_456',
        EmergencyResponse.ON_THE_WAY
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          caregiverId: 'caregiver_456',
          response: EmergencyResponse.ON_THE_WAY
        })
      );
    });
  });

  describe('getUserChannels', () => {
    beforeEach(async () => {
      // Create multiple channels for user
      const participants1 = [
        { id: 'user_123', type: ParticipantType.USER, role: ParticipantRole.OWNER },
        { id: 'caregiver_456', type: ParticipantType.CAREGIVER, role: ParticipantRole.MEMBER }
      ];

      const participants2 = [
        { id: 'user_123', type: ParticipantType.USER, role: ParticipantRole.MEMBER },
        { id: 'caregiver_789', type: ParticipantType.CAREGIVER, role: ParticipantRole.OWNER }
      ];

      await communicationService.createChannel(participants1, ChannelType.DIRECT_MESSAGE, 'user_123');
      await communicationService.createChannel(participants2, ChannelType.GROUP_CHAT, 'caregiver_789');
    });

    it('should return channels for user', () => {
      const channels = communicationService.getUserChannels('user_123');

      expect(channels).toHaveLength(2);
      expect(channels.every(channel => 
        channel.participants.some(p => p.id === 'user_123')
      )).toBe(true);
    });

    it('should sort channels by last activity', () => {
      const channels = communicationService.getUserChannels('user_123');

      expect(channels[0].lastActivity.getTime()).toBeGreaterThanOrEqual(
        channels[1].lastActivity.getTime()
      );
    });
  });

  describe('getUserActiveCalls', () => {
    beforeEach(async () => {
      const participants = [
        { id: 'user_123', type: ParticipantType.USER, role: ParticipantRole.OWNER },
        { id: 'caregiver_456', type: ParticipantType.CAREGIVER, role: ParticipantRole.MEMBER }
      ];

      const channel = await communicationService.createChannel(
        participants,
        ChannelType.DIRECT_MESSAGE,
        'user_123'
      );

      // Start and join call
      const callSession = await communicationService.startCall(
        channel.id,
        'user_123',
        CallType.VOICE,
        ['caregiver_456']
      );
      await communicationService.joinCall(callSession.id, 'caregiver_456');
    });

    it('should return active calls for user', () => {
      const activeCalls = communicationService.getUserActiveCalls('user_123');

      expect(activeCalls).toHaveLength(1);
      expect(activeCalls[0].status).toBe(CallStatus.ACTIVE);
    });

    it('should not return calls user has left', async () => {
      const activeCalls = communicationService.getUserActiveCalls('user_123');
      await communicationService.endCall(activeCalls[0].id, 'user_123');

      const updatedActiveCalls = communicationService.getUserActiveCalls('user_123');
      expect(updatedActiveCalls).toHaveLength(0);
    });
  });
});