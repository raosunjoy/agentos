/**
 * Context Management Types
 * 
 * Defines types and interfaces for the context management system
 * that handles privacy-aware data storage, session state, and
 * temporal context understanding.
 */

export interface UserContext {
  userId: string;
  sessionId: string;
  preferences: UserPreferences;
  currentLocation?: LocationContext;
  currentActivity?: ActivityContext;
  deviceState: DeviceState;
  conversationHistory: ConversationTurn[];
  temporalContext: TemporalContext;
  permissions: PermissionContext;
}

export interface UserPreferences {
  language: string;
  voiceSettings: {
    speed: number;
    volume: number;
    preferredVoice: string;
  };
  accessibilitySettings: {
    largeText: boolean;
    highContrast: boolean;
    screenReader: boolean;
    slowSpeech: boolean;
  };
  privacySettings: {
    dataSharing: 'none' | 'minimal' | 'full';
    analytics: boolean;
    personalization: boolean;
    locationTracking: boolean;
  };
  caregiverSettings?: {
    enabled: boolean;
    caregiverIds: string[];
    monitoringLevel: 'basic' | 'detailed' | 'emergency-only';
  };
}

export interface LocationContext {
  latitude?: number;
  longitude?: number;
  address?: string;
  locationType: 'home' | 'work' | 'medical' | 'shopping' | 'social' | 'unknown';
  confidence: number;
  timestamp: Date;
  privacyLevel: 'public' | 'private' | 'restricted';
}

export interface ActivityContext {
  currentActivity: 'sleeping' | 'working' | 'commuting' | 'exercising' | 'socializing' | 'medical' | 'idle';
  confidence: number;
  startTime: Date;
  relatedApps: string[];
  healthMetrics?: {
    heartRate?: number;
    steps?: number;
    stressLevel?: 'low' | 'medium' | 'high';
  };
}

export interface DeviceState {
  batteryLevel: number;
  isCharging: boolean;
  networkType: 'wifi' | 'cellular' | 'offline';
  screenBrightness: number;
  volume: number;
  isHeadphonesConnected: boolean;
  availableStorage: number;
  memoryUsage: number;
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userInput: string;
  processedIntent?: string;
  systemResponse: string;
  wasSuccessful: boolean;
  confidence: number;
  entities: Record<string, any>;
  followUpNeeded: boolean;
}

export interface TemporalContext {
  currentTime: Date;
  timeZone: string;
  dayOfWeek: number;
  isWeekend: boolean;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  recentEvents: RecentEvent[];
  upcomingEvents: UpcomingEvent[];
  routinePatterns: RoutinePattern[];
}

export interface RecentEvent {
  id: string;
  type: 'call' | 'message' | 'appointment' | 'medication' | 'activity';
  timestamp: Date;
  description: string;
  participants?: string[];
  location?: string;
  outcome?: 'completed' | 'missed' | 'cancelled';
}

export interface UpcomingEvent {
  id: string;
  type: 'appointment' | 'medication' | 'call' | 'reminder' | 'activity';
  scheduledTime: Date;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reminderSettings: {
    enabled: boolean;
    advanceTime: number; // minutes before event
    reminderType: 'voice' | 'text' | 'both';
  };
}

export interface RoutinePattern {
  id: string;
  name: string;
  timePattern: string; // cron-like pattern
  actions: string[];
  confidence: number;
  lastOccurrence?: Date;
  isActive: boolean;
}

export interface PermissionContext {
  dataAccessPermissions: Map<string, DataPermission>;
  servicePermissions: Map<string, ServicePermission>;
  temporaryGrants: TemporaryPermission[];
  revokedPermissions: RevokedPermission[];
}

export interface DataPermission {
  dataType: string;
  accessLevel: 'read' | 'write' | 'full';
  grantedTo: string; // service or plugin ID
  grantedAt: Date;
  expiresAt?: Date;
  conditions?: PermissionCondition[];
  usageCount: number;
  lastUsed?: Date;
}

export interface ServicePermission {
  serviceId: string;
  permissions: string[];
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  restrictions?: ServiceRestriction[];
}

export interface TemporaryPermission {
  id: string;
  grantedTo: string;
  permissions: string[];
  grantedAt: Date;
  expiresAt: Date;
  context: string; // reason for temporary access
  autoRevoke: boolean;
}

export interface RevokedPermission {
  originalPermissionId: string;
  revokedAt: Date;
  reason: string;
  revokedBy: 'user' | 'system' | 'caregiver';
}

export interface PermissionCondition {
  type: 'location' | 'time' | 'activity' | 'device-state';
  condition: string;
  value: any;
}

export interface ServiceRestriction {
  type: 'rate-limit' | 'time-window' | 'data-limit';
  value: number;
  period?: string; // for rate limits
}

export interface ContextQuery {
  userId: string;
  sessionId?: string;
  dataTypes: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  includePrivate?: boolean;
  requesterService: string;
}

export interface ContextUpdateRequest {
  userId: string;
  sessionId: string;
  updates: Partial<UserContext>;
  source: string;
  timestamp: Date;
  requiresPermission?: boolean;
}

export interface ContextSharingRequest {
  fromUserId: string;
  toService: string;
  dataTypes: string[];
  purpose: string;
  duration?: number; // in minutes
  conditions?: PermissionCondition[];
}

export interface ContextMetrics {
  totalContextSize: number;
  activeContexts: number;
  averageResponseTime: number;
  permissionViolations: number;
  dataAccessCount: number;
  privacyScore: number; // 0-100, higher is more private
}

export interface ContextStorageConfig {
  maxContextAge: number; // days
  maxConversationHistory: number;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  backupEnabled: boolean;
  privacyMode: 'strict' | 'balanced' | 'permissive';
}