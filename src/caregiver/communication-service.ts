/**
 * Communication Service for caregiver integration
 * Handles end-to-end encrypted communication channels between users and caregivers
 */

import { EventEmitter } from 'events';
import {
  CaregiverProfile,
  AccessAuditLog,
  AuditAction
} from './types';

export interface CommunicationChannel {
  id: string;
  participants: Participant[];
  type: ChannelType;
  encrypted: boolean;
  createdAt: Date;
  lastActivity: Date;
  status: ChannelStatus;
  metadata?: Record<string, any>;
}

export interface Participant {
  id: string;
  type: ParticipantType;
  role: ParticipantRole;
  joinedAt: Date;
  lastSeen?: Date;
  permissions: CommunicationPermission[];
}

export enum ParticipantType {
  USER = 'user',
  CAREGIVER = 'caregiver',
  EMERGENCY_SERVICE = 'emergency_service',
  SYSTEM = 'system'
}

export enum ParticipantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  OBSERVER = 'observer'
}

export enum ChannelType {
  DIRECT_MESSAGE = 'direct_message',
  GROUP_CHAT = 'group_chat',
  EMERGENCY_CHANNEL = 'emergency_channel',
  VOICE_CALL = 'voice_call',
  VIDEO_CALL = 'video_call',
  SCREEN_SHARE = 'screen_share'
}

export enum ChannelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  EMERGENCY = 'emergency'
}

export interface CommunicationPermission {
  type: CommunicationPermissionType;
  granted: boolean;
  grantedAt?: Date;
  expiresAt?: Date;
}

export enum CommunicationPermissionType {
  SEND_MESSAGES = 'send_messages',
  RECEIVE_MESSAGES = 'receive_messages',
  MAKE_CALLS = 'make_calls',
  RECEIVE_CALLS = 'receive_calls',
  SHARE_SCREEN = 'share_screen',
  VIEW_SCREEN = 'view_screen',
  SEND_FILES = 'send_files',
  ACCESS_HISTORY = 'access_history'
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  type: MessageType;
  content: EncryptedContent;
  timestamp: Date;
  edited: boolean;
  editedAt?: Date;
  reactions: MessageReaction[];
  metadata?: Record<string, any>;
}

export enum MessageType {
  TEXT = 'text',
  VOICE = 'voice',
  IMAGE = 'image',
  FILE = 'file',
  LOCATION = 'location',
  EMERGENCY = 'emergency',
  SYSTEM = 'system',
  HEALTH_DATA = 'health_data'
}

export interface EncryptedContent {
  data: string; // Encrypted content
  iv: string; // Initialization vector
  keyId: string; // Reference to encryption key
}

export interface MessageReaction {
  userId: string;
  emoji: string;
  timestamp: Date;
}

export interface CallSession {
  id: string;
  channelId: string;
  type: CallType;
  initiatorId: string;
  participants: CallParticipant[];
  startedAt: Date;
  endedAt?: Date;
  status: CallStatus;
  quality: CallQuality;
  encrypted: boolean;
}

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
  EMERGENCY = 'emergency'
}

export enum CallStatus {
  INITIATING = 'initiating',
  RINGING = 'ringing',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  ENDED = 'ended',
  FAILED = 'failed'
}

export interface CallParticipant {
  userId: string;
  joinedAt: Date;
  leftAt?: Date;
  muted: boolean;
  videoEnabled: boolean;
}

export interface CallQuality {
  audioQuality: number; // 0-100
  videoQuality: number; // 0-100
  latency: number; // milliseconds
  packetLoss: number; // percentage
}

export interface EmergencyBroadcast {
  id: string;
  userId: string;
  type: EmergencyBroadcastType;
  message: string;
  location?: Location;
  timestamp: Date;
  recipients: string[]; // caregiver IDs
  acknowledged: EmergencyAcknowledgment[];
}

export enum EmergencyBroadcastType {
  MEDICAL_EMERGENCY = 'medical_emergency',
  FALL_DETECTED = 'fall_detected',
  PANIC_BUTTON = 'panic_button',
  NO_RESPONSE = 'no_response',
  DEVICE_MALFUNCTION = 'device_malfunction'
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
}

export interface EmergencyAcknowledgment {
  caregiverId: string;
  acknowledgedAt: Date;
  response: EmergencyResponse;
  estimatedArrival?: Date;
}

export enum EmergencyResponse {
  ON_THE_WAY = 'on_the_way',
  CALLING_SERVICES = 'calling_services',
  MONITORING = 'monitoring',
  UNABLE_TO_RESPOND = 'unable_to_respond'
}

export class CommunicationService extends EventEmitter {
  private channels: Map<string, CommunicationChannel> = new Map();
  private messages: Map<string, Message[]> = new Map(); // channelId -> messages
  private callSessions: Map<string, CallSession> = new Map();
  private emergencyBroadcasts: Map<string, EmergencyBroadcast> = new Map();
  private encryptionService: EncryptionService;
  private auditLogger: AccessAuditLogger;

  constructor(encryptionService: EncryptionService, auditLogger: AccessAuditLogger) {
    super();
    this.encryptionService = encryptionService;
    this.auditLogger = auditLogger;
  }

  /**
   * Create a new communication channel
   */
  async createChannel(
    participants: Omit<Participant, 'joinedAt' | 'permissions'>[],
    type: ChannelType,
    creatorId: string,
    encrypted: boolean = true
  ): Promise<CommunicationChannel> {
    const channel: CommunicationChannel = {
      id: this.generateChannelId(),
      participants: participants.map(p => ({
        ...p,
        joinedAt: new Date(),
        permissions: this.getDefaultPermissions(p.role)
      })),
      type,
      encrypted,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: ChannelStatus.ACTIVE
    };

    this.channels.set(channel.id, channel);
    this.messages.set(channel.id, []);

    // Log channel creation
    await this.auditLogger.log({
      caregiverId: creatorId,
      action: AuditAction.SEND_MESSAGE,
      resource: 'communication_channel',
      timestamp: new Date(),
      success: true,
      details: { 
        channelId: channel.id, 
        type, 
        participantCount: participants.length,
        encrypted 
      }
    });

    this.emit('channelCreated', channel);

    return channel;
  }

  /**
   * Send a message in a channel
   */
  async sendMessage(
    channelId: string,
    senderId: string,
    type: MessageType,
    content: string,
    metadata?: Record<string, any>
  ): Promise<Message> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if sender has permission
    const sender = channel.participants.find(p => p.id === senderId);
    if (!sender || !this.hasPermission(sender, CommunicationPermissionType.SEND_MESSAGES)) {
      throw new Error('Insufficient permissions to send messages');
    }

    // Encrypt content if channel is encrypted
    const encryptedContent = channel.encrypted 
      ? await this.encryptionService.encrypt(content)
      : { data: content, iv: '', keyId: '' };

    const message: Message = {
      id: this.generateMessageId(),
      channelId,
      senderId,
      type,
      content: encryptedContent,
      timestamp: new Date(),
      edited: false,
      reactions: [],
      metadata
    };

    // Store message
    const channelMessages = this.messages.get(channelId) || [];
    channelMessages.push(message);
    this.messages.set(channelId, channelMessages);

    // Update channel last activity
    channel.lastActivity = new Date();
    this.channels.set(channelId, channel);

    // Log message sending
    await this.auditLogger.log({
      caregiverId: senderId,
      action: AuditAction.SEND_MESSAGE,
      resource: 'message',
      timestamp: new Date(),
      success: true,
      details: { 
        channelId, 
        messageId: message.id, 
        type,
        encrypted: channel.encrypted 
      }
    });

    this.emit('messageSent', message);

    return message;
  }

  /**
   * Get messages from a channel
   */
  async getMessages(
    channelId: string,
    requesterId: string,
    limit: number = 50,
    before?: Date
  ): Promise<Message[]> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if requester has permission
    const requester = channel.participants.find(p => p.id === requesterId);
    if (!requester || !this.hasPermission(requester, CommunicationPermissionType.RECEIVE_MESSAGES)) {
      throw new Error('Insufficient permissions to view messages');
    }

    let messages = this.messages.get(channelId) || [];

    // Sort by timestamp (newest first) first
    messages = messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Filter by date if specified
    if (before) {
      messages = messages.filter(m => m.timestamp < before);
    }

    // Apply limit
    messages = messages.slice(0, limit);

    // Decrypt messages if channel is encrypted
    if (channel.encrypted) {
      for (const message of messages) {
        try {
          message.content.data = await this.encryptionService.decrypt(message.content.data);
        } catch (error) {
          // Handle decryption errors gracefully
          message.content.data = '[Encrypted message - decryption failed]';
        }
      }
    }

    // Log message access
    await this.auditLogger.log({
      caregiverId: requesterId,
      action: AuditAction.VIEW_DATA,
      resource: 'messages',
      timestamp: new Date(),
      success: true,
      details: { channelId, messageCount: messages.length }
    });

    return messages;
  }

  /**
   * Start a voice/video call
   */
  async startCall(
    channelId: string,
    initiatorId: string,
    type: CallType,
    participantIds: string[]
  ): Promise<CallSession> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check permissions
    const initiator = channel.participants.find(p => p.id === initiatorId);
    if (!initiator || !this.hasPermission(initiator, CommunicationPermissionType.MAKE_CALLS)) {
      throw new Error('Insufficient permissions to make calls');
    }

    const callSession: CallSession = {
      id: this.generateCallId(),
      channelId,
      type,
      initiatorId,
      participants: [{
        userId: initiatorId,
        joinedAt: new Date(),
        muted: false,
        videoEnabled: type === CallType.VIDEO
      }],
      startedAt: new Date(),
      status: CallStatus.INITIATING,
      quality: {
        audioQuality: 100,
        videoQuality: type === CallType.VIDEO ? 100 : 0,
        latency: 0,
        packetLoss: 0
      },
      encrypted: true // Always encrypt calls for security
    };

    this.callSessions.set(callSession.id, callSession);

    // Notify other participants
    participantIds.forEach(participantId => {
      this.emit('incomingCall', {
        callSession,
        participantId,
        channelId
      });
    });

    // Log call initiation
    await this.auditLogger.log({
      caregiverId: initiatorId,
      action: AuditAction.SEND_MESSAGE,
      resource: 'call_session',
      timestamp: new Date(),
      success: true,
      details: { 
        callId: callSession.id, 
        channelId, 
        type,
        participantCount: participantIds.length 
      }
    });

    this.emit('callStarted', callSession);

    return callSession;
  }

  /**
   * Join a call session
   */
  async joinCall(callId: string, userId: string): Promise<boolean> {
    const callSession = this.callSessions.get(callId);
    if (!callSession || callSession.status === CallStatus.ENDED) {
      return false;
    }

    // Check if user is already in the call
    const existingParticipant = callSession.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      return true;
    }

    // Add participant
    callSession.participants.push({
      userId,
      joinedAt: new Date(),
      muted: false,
      videoEnabled: callSession.type === CallType.VIDEO
    });

    // Update call status
    if (callSession.status === CallStatus.INITIATING) {
      callSession.status = CallStatus.ACTIVE;
    }

    this.callSessions.set(callId, callSession);

    // Log call join
    await this.auditLogger.log({
      caregiverId: userId,
      action: AuditAction.SEND_MESSAGE,
      resource: 'call_join',
      timestamp: new Date(),
      success: true,
      details: { callId, channelId: callSession.channelId }
    });

    this.emit('participantJoined', { callSession, userId });

    return true;
  }

  /**
   * End a call session
   */
  async endCall(callId: string, userId: string): Promise<boolean> {
    const callSession = this.callSessions.get(callId);
    if (!callSession) {
      return false;
    }

    // Only initiator or participants can end the call
    const canEnd = callSession.initiatorId === userId || 
                   callSession.participants.some(p => p.userId === userId);
    
    if (!canEnd) {
      return false;
    }

    callSession.status = CallStatus.ENDED;
    callSession.endedAt = new Date();

    // Mark all participants as left
    callSession.participants.forEach(participant => {
      if (!participant.leftAt) {
        participant.leftAt = new Date();
      }
    });

    this.callSessions.set(callId, callSession);

    // Log call end
    await this.auditLogger.log({
      caregiverId: userId,
      action: AuditAction.SEND_MESSAGE,
      resource: 'call_end',
      timestamp: new Date(),
      success: true,
      details: { 
        callId, 
        channelId: callSession.channelId,
        duration: callSession.endedAt.getTime() - callSession.startedAt.getTime()
      }
    });

    this.emit('callEnded', callSession);

    return true;
  }

  /**
   * Send emergency broadcast to all caregivers
   */
  async sendEmergencyBroadcast(
    userId: string,
    type: EmergencyBroadcastType,
    message: string,
    location?: Location,
    caregiverIds?: string[]
  ): Promise<EmergencyBroadcast> {
    const broadcast: EmergencyBroadcast = {
      id: this.generateBroadcastId(),
      userId,
      type,
      message,
      location,
      timestamp: new Date(),
      recipients: caregiverIds || [], // Would get from caregiver registry
      acknowledged: []
    };

    this.emergencyBroadcasts.set(broadcast.id, broadcast);

    // Send to all recipients
    broadcast.recipients.forEach(caregiverId => {
      this.emit('emergencyBroadcast', {
        broadcast,
        caregiverId
      });
    });

    // Log emergency broadcast
    await this.auditLogger.log({
      caregiverId: 'system',
      action: AuditAction.EMERGENCY_ALERT,
      resource: 'emergency_broadcast',
      timestamp: new Date(),
      success: true,
      details: { 
        broadcastId: broadcast.id, 
        userId, 
        type,
        recipientCount: broadcast.recipients.length,
        hasLocation: !!location
      }
    });

    this.emit('emergencyBroadcastSent', broadcast);

    return broadcast;
  }

  /**
   * Acknowledge emergency broadcast
   */
  async acknowledgeEmergency(
    broadcastId: string,
    caregiverId: string,
    response: EmergencyResponse,
    estimatedArrival?: Date
  ): Promise<boolean> {
    const broadcast = this.emergencyBroadcasts.get(broadcastId);
    if (!broadcast) {
      return false;
    }

    // Check if already acknowledged
    const existingAck = broadcast.acknowledged.find(ack => ack.caregiverId === caregiverId);
    if (existingAck) {
      return false;
    }

    // Add acknowledgment
    broadcast.acknowledged.push({
      caregiverId,
      acknowledgedAt: new Date(),
      response,
      estimatedArrival
    });

    this.emergencyBroadcasts.set(broadcastId, broadcast);

    // Log acknowledgment
    await this.auditLogger.log({
      caregiverId,
      action: AuditAction.EMERGENCY_ALERT,
      resource: 'emergency_acknowledgment',
      timestamp: new Date(),
      success: true,
      details: { broadcastId, response, userId: broadcast.userId }
    });

    this.emit('emergencyAcknowledged', { broadcast, caregiverId, response });

    return true;
  }

  /**
   * Get channels for a user
   */
  getUserChannels(userId: string): CommunicationChannel[] {
    return Array.from(this.channels.values())
      .filter(channel => 
        channel.participants.some(p => p.id === userId) &&
        channel.status === ChannelStatus.ACTIVE
      )
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Get active call sessions for a user
   */
  getUserActiveCalls(userId: string): CallSession[] {
    return Array.from(this.callSessions.values())
      .filter(call => 
        call.participants.some(p => p.userId === userId && !p.leftAt) &&
        call.status === CallStatus.ACTIVE
      );
  }

  private hasPermission(participant: Participant, permissionType: CommunicationPermissionType): boolean {
    return participant.permissions.some(permission => 
      permission.type === permissionType && 
      permission.granted &&
      (!permission.expiresAt || permission.expiresAt > new Date())
    );
  }

  private getDefaultPermissions(role: ParticipantRole): CommunicationPermission[] {
    const basePermissions = [
      CommunicationPermissionType.SEND_MESSAGES,
      CommunicationPermissionType.RECEIVE_MESSAGES,
      CommunicationPermissionType.MAKE_CALLS,
      CommunicationPermissionType.RECEIVE_CALLS
    ];

    const adminPermissions = [
      ...basePermissions,
      CommunicationPermissionType.SHARE_SCREEN,
      CommunicationPermissionType.VIEW_SCREEN,
      CommunicationPermissionType.SEND_FILES,
      CommunicationPermissionType.ACCESS_HISTORY
    ];

    const permissions = role === ParticipantRole.ADMIN || role === ParticipantRole.OWNER 
      ? adminPermissions 
      : basePermissions;

    return permissions.map(type => ({
      type,
      granted: true,
      grantedAt: new Date()
    }));
  }

  private generateChannelId(): string {
    return `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBroadcastId(): string {
    return `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting interfaces
export interface EncryptionService {
  encrypt(data: string): Promise<EncryptedContent>;
  decrypt(encryptedContent: string): Promise<string>;
}

export interface AccessAuditLogger {
  log(entry: Omit<AccessAuditLog, 'id'>): Promise<void>;
}