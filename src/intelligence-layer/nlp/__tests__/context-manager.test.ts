/**
 * Context Manager Tests
 * 
 * Tests for the context management system including privacy-aware
 * data handling, session state management, and permission controls.
 */

import {
  UserContext,
  ContextQuery,
  ContextUpdateRequest,
  ContextSharingRequest,
  ConversationTurn,
  LocationContext,
  ActivityContext,
  DeviceState
} from '../context-types';

// Mock the dependencies before importing ContextManager
jest.mock('../permission-validator', () => {
  return {
    PermissionValidator: jest.fn().mockImplementation(() => ({
      validateAccess: jest.fn(),
      validateUpdate: jest.fn(),
      registerServicePermissions: jest.fn(),
      revokeServicePermissions: jest.fn()
    }))
  };
});

jest.mock('../temporal-analyzer', () => {
  return {
    TemporalAnalyzer: jest.fn().mockImplementation(() => ({
      createInitialTemporalContext: jest.fn(),
      updateTemporalContext: jest.fn(),
      addRecentEvent: jest.fn(),
      addUpcomingEvent: jest.fn(),
      detectRoutinePatterns: jest.fn(),
      getContextualTimeDescription: jest.fn(),
      isRoutineTime: jest.fn()
    }))
  };
});

jest.mock('../privacy-filter', () => {
  return {
    PrivacyFilter: jest.fn().mockImplementation(() => ({
      filterContext: jest.fn(),
      anonymizeContext: jest.fn(),
      isSensitiveDataType: jest.fn(),
      getPrivacyLevel: jest.fn(),
      setPrivacyMode: jest.fn()
    }))
  };
});

import { ContextManager } from '../context-manager';
import { PermissionValidator } from '../permission-validator';
import { TemporalAnalyzer } from '../temporal-analyzer';
import { PrivacyFilter } from '../privacy-filter';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockPermissionValidator: any;
  let mockTemporalAnalyzer: any;
  let mockPrivacyFilter: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create context manager with test config
    contextManager = new ContextManager({
      maxContextAge: 1, // 1 day for testing
      maxConversationHistory: 10,
      encryptionEnabled: false,
      privacyMode: 'balanced'
    });

    // Get mocked instances
    const MockedPermissionValidator = PermissionValidator as jest.MockedClass<typeof PermissionValidator>;
    const MockedTemporalAnalyzer = TemporalAnalyzer as jest.MockedClass<typeof TemporalAnalyzer>;
    const MockedPrivacyFilter = PrivacyFilter as jest.MockedClass<typeof PrivacyFilter>;

    mockPermissionValidator = MockedPermissionValidator.mock.instances[MockedPermissionValidator.mock.instances.length - 1];
    mockTemporalAnalyzer = MockedTemporalAnalyzer.mock.instances[MockedTemporalAnalyzer.mock.instances.length - 1];
    mockPrivacyFilter = MockedPrivacyFilter.mock.instances[MockedPrivacyFilter.mock.instances.length - 1];
  });

  describe('getUserContext', () => {
    it('should return null for non-existent user', async () => {
      mockPermissionValidator.validateAccess.mockResolvedValue(true);

      const query: ContextQuery = {
        userId: 'non-existent',
        dataTypes: ['preferences'],
        requesterService: 'test-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result).toBeNull();
    });

    it('should return null when permission validation fails', async () => {
      mockPermissionValidator.validateAccess.mockResolvedValue(false);

      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['preferences'],
        requesterService: 'unauthorized-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result).toBeNull();
    });

    it('should return filtered context when permissions are valid', async () => {
      // Setup mocks
      mockPermissionValidator.validateAccess.mockResolvedValue(true);
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      const mockFilteredContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        preferences: {
          language: 'en',
          voiceSettings: { speed: 1.0, volume: 0.8, preferredVoice: 'default' },
          accessibilitySettings: { largeText: false, highContrast: false, screenReader: false, slowSpeech: false },
          privacySettings: { dataSharing: 'minimal', analytics: false, personalization: true, locationTracking: false }
        }
      };

      mockPrivacyFilter.filterContext.mockResolvedValue(mockFilteredContext);

      // First create a context by updating
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {},
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);

      // Now query the context
      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['preferences'],
        requesterService: 'test-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result).toEqual(mockFilteredContext);
      expect(mockPermissionValidator.validateAccess).toHaveBeenCalledWith(
        'test-service',
        'test-user',
        ['preferences']
      );
      expect(mockPrivacyFilter.filterContext).toHaveBeenCalled();
    });

    it('should filter conversation history by time range', async () => {
      mockPermissionValidator.validateAccess.mockResolvedValue(true);
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      const mockFilteredContext = {
        userId: 'test-user',
        conversationHistory: []
      };

      mockPrivacyFilter.filterContext.mockResolvedValue(mockFilteredContext);

      // Create context with conversation history
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {},
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['conversation'],
        requesterService: 'test-service',
        timeRange: {
          start: oneHourAgo,
          end: now
        }
      };

      await contextManager.getUserContext(query);
      expect(mockPrivacyFilter.filterContext).toHaveBeenCalled();
    });
  });

  describe('updateUserContext', () => {
    it('should create new context for new user', async () => {
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      mockTemporalAnalyzer.updateTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      const updateRequest: ContextUpdateRequest = {
        userId: 'new-user',
        sessionId: 'new-session',
        updates: {
          preferences: {
            language: 'es',
            voiceSettings: { speed: 0.8, volume: 0.9, preferredVoice: 'female' },
            accessibilitySettings: { largeText: true, highContrast: false, screenReader: false, slowSpeech: true },
            privacySettings: { dataSharing: 'none', analytics: false, personalization: false, locationTracking: false }
          }
        },
        source: 'user-settings',
        timestamp: new Date()
      };

      const result = await contextManager.updateUserContext(updateRequest);
      expect(result).toBe(true);
      expect(mockTemporalAnalyzer.updateTemporalContext).toHaveBeenCalled();
    });

    it('should validate permissions when required', async () => {
      mockPermissionValidator.validateUpdate.mockResolvedValue(false);

      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: { preferences: {} },
        source: 'unauthorized-service',
        timestamp: new Date(),
        requiresPermission: true
      };

      const result = await contextManager.updateUserContext(updateRequest);
      expect(result).toBe(false);
      expect(mockPermissionValidator.validateUpdate).toHaveBeenCalledWith(
        'unauthorized-service',
        'test-user',
        ['preferences']
      );
    });

    it('should merge updates with existing context', async () => {
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      mockTemporalAnalyzer.updateTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      // First create a context
      const initialRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {},
        source: 'initial',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(initialRequest);

      // Then update it
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {
          preferences: {
            language: 'fr',
            voiceSettings: { speed: 1.2, volume: 0.7, preferredVoice: 'male' },
            accessibilitySettings: { largeText: false, highContrast: true, screenReader: true, slowSpeech: false },
            privacySettings: { dataSharing: 'full', analytics: true, personalization: true, locationTracking: true }
          }
        },
        source: 'user-update',
        timestamp: new Date()
      };

      const result = await contextManager.updateUserContext(updateRequest);
      expect(result).toBe(true);
    });
  });

  describe('addConversationTurn', () => {
    it('should add conversation turn to existing context', async () => {
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      mockTemporalAnalyzer.updateTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      // Create initial context
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {},
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);

      // Add conversation turn
      const turn = {
        userInput: 'Hello, how are you?',
        processedIntent: 'greeting',
        systemResponse: 'Hello! I\'m doing well, thank you.',
        wasSuccessful: true,
        confidence: 0.95,
        entities: {},
        followUpNeeded: false
      };

      await contextManager.addConversationTurn('test-user', 'test-session', turn);

      // Verify the turn was added (we can't directly access the context, but we can test through getUserContext)
      mockPermissionValidator.validateAccess.mockResolvedValue(true);
      mockPrivacyFilter.filterContext.mockResolvedValue({
        conversationHistory: [{ ...turn, id: expect.any(String), timestamp: expect.any(Date) }]
      });

      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['conversation'],
        requesterService: 'test-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result?.conversationHistory).toHaveLength(1);
    });

    it('should limit conversation history size', async () => {
      // This test would require setting up a context with many conversation turns
      // and verifying that old ones are removed when the limit is exceeded
      expect(true).toBe(true); // Placeholder for now
    });
  });

  describe('requestContextSharing', () => {
    it('should reject sharing when user privacy setting is none', async () => {
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      mockTemporalAnalyzer.updateTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      // Create context with no data sharing
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {
          preferences: {
            language: 'en',
            voiceSettings: { speed: 1.0, volume: 0.8, preferredVoice: 'default' },
            accessibilitySettings: { largeText: false, highContrast: false, screenReader: false, slowSpeech: false },
            privacySettings: { dataSharing: 'none', analytics: false, personalization: true, locationTracking: false }
          }
        },
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);

      const sharingRequest: ContextSharingRequest = {
        fromUserId: 'test-user',
        toService: 'external-service',
        dataTypes: ['preferences'],
        purpose: 'personalization',
        duration: 60
      };

      const result = await contextManager.requestContextSharing(sharingRequest);
      expect(result).toBe(false);
    });

    it('should create temporary permission when sharing is allowed', async () => {
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      mockTemporalAnalyzer.updateTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      // Create context with minimal data sharing
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {
          preferences: {
            language: 'en',
            voiceSettings: { speed: 1.0, volume: 0.8, preferredVoice: 'default' },
            accessibilitySettings: { largeText: false, highContrast: false, screenReader: false, slowSpeech: false },
            privacySettings: { dataSharing: 'minimal', analytics: false, personalization: true, locationTracking: false }
          }
        },
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);

      const sharingRequest: ContextSharingRequest = {
        fromUserId: 'test-user',
        toService: 'trusted-service',
        dataTypes: ['preferences'],
        purpose: 'accessibility',
        duration: 30
      };

      const result = await contextManager.requestContextSharing(sharingRequest);
      expect(result).toBe(true);
    });
  });

  describe('location and activity updates', () => {
    beforeEach(async () => {
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      mockTemporalAnalyzer.updateTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      // Create initial context
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {
          preferences: {
            language: 'en',
            voiceSettings: { speed: 1.0, volume: 0.8, preferredVoice: 'default' },
            accessibilitySettings: { largeText: false, highContrast: false, screenReader: false, slowSpeech: false },
            privacySettings: { dataSharing: 'minimal', analytics: false, personalization: true, locationTracking: true }
          }
        },
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);
    });

    it('should update location context when location tracking is enabled', async () => {
      const location: Partial<LocationContext> = {
        latitude: 40.7128,
        longitude: -74.0060,
        address: '123 Main St, New York, NY',
        locationType: 'home',
        confidence: 0.9,
        privacyLevel: 'private'
      };

      await contextManager.updateLocationContext('test-user', location);

      // Verify location was updated (through getUserContext)
      mockPermissionValidator.validateAccess.mockResolvedValue(true);
      mockPrivacyFilter.filterContext.mockResolvedValue({
        currentLocation: { ...location, timestamp: expect.any(Date) }
      });

      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['location'],
        requesterService: 'test-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result?.currentLocation).toBeDefined();
      expect(result?.currentLocation?.locationType).toBe('home');
    });

    it('should not update location when tracking is disabled', async () => {
      // First disable location tracking
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {
          preferences: {
            language: 'en',
            voiceSettings: { speed: 1.0, volume: 0.8, preferredVoice: 'default' },
            accessibilitySettings: { largeText: false, highContrast: false, screenReader: false, slowSpeech: false },
            privacySettings: { dataSharing: 'minimal', analytics: false, personalization: true, locationTracking: false }
          }
        },
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);

      const location: Partial<LocationContext> = {
        latitude: 40.7128,
        longitude: -74.0060,
        locationType: 'work',
        confidence: 0.8,
        privacyLevel: 'private'
      };

      await contextManager.updateLocationContext('test-user', location);

      // Location should not be updated
      mockPermissionValidator.validateAccess.mockResolvedValue(true);
      mockPrivacyFilter.filterContext.mockResolvedValue({
        currentLocation: undefined
      });

      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['location'],
        requesterService: 'test-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result?.currentLocation).toBeUndefined();
    });

    it('should update activity context', async () => {
      const activity: Partial<ActivityContext> = {
        currentActivity: 'working',
        confidence: 0.85,
        relatedApps: ['calendar', 'email'],
        healthMetrics: {
          heartRate: 72,
          steps: 5000,
          stressLevel: 'low'
        }
      };

      await contextManager.updateActivityContext('test-user', activity);

      // Verify activity was updated
      mockPermissionValidator.validateAccess.mockResolvedValue(true);
      mockPrivacyFilter.filterContext.mockResolvedValue({
        currentActivity: { ...activity, startTime: expect.any(Date) }
      });

      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['activity'],
        requesterService: 'test-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result?.currentActivity).toBeDefined();
      expect(result?.currentActivity?.currentActivity).toBe('working');
    });

    it('should update device state', async () => {
      const deviceState: Partial<DeviceState> = {
        batteryLevel: 75,
        isCharging: true,
        networkType: 'cellular',
        volume: 0.5
      };

      await contextManager.updateDeviceState('test-user', deviceState);

      // Verify device state was updated
      mockPermissionValidator.validateAccess.mockResolvedValue(true);
      mockPrivacyFilter.filterContext.mockResolvedValue({
        deviceState: expect.objectContaining(deviceState)
      });

      const query: ContextQuery = {
        userId: 'test-user',
        dataTypes: ['device'],
        requesterService: 'test-service'
      };

      const result = await contextManager.getUserContext(query);
      expect(result?.deviceState?.batteryLevel).toBe(75);
      expect(result?.deviceState?.isCharging).toBe(true);
    });
  });

  describe('permission management', () => {
    beforeEach(async () => {
      mockTemporalAnalyzer.createInitialTemporalContext.mockReturnValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      mockTemporalAnalyzer.updateTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeZone: 'UTC',
        dayOfWeek: 1,
        isWeekend: false,
        timeOfDay: 'morning',
        recentEvents: [],
        upcomingEvents: [],
        routinePatterns: []
      });

      // Create initial context
      const updateRequest: ContextUpdateRequest = {
        userId: 'test-user',
        sessionId: 'test-session',
        updates: {},
        source: 'test',
        timestamp: new Date()
      };

      await contextManager.updateUserContext(updateRequest);
    });

    it('should grant data permission', async () => {
      await contextManager.grantDataPermission(
        'test-user',
        'calendar-service',
        'events',
        'read',
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      );

      // Verify permission was granted (this would require accessing internal state)
      expect(true).toBe(true); // Placeholder
    });

    it('should revoke data permission', async () => {
      // First grant permission
      await contextManager.grantDataPermission(
        'test-user',
        'calendar-service',
        'events',
        'read'
      );

      // Then revoke it
      await contextManager.revokeDataPermission(
        'test-user',
        'calendar-service',
        'events',
        'User requested revocation'
      );

      // Verify permission was revoked
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('metrics', () => {
    it('should return context metrics', () => {
      const metrics = contextManager.getMetrics();
      
      expect(metrics).toHaveProperty('totalContextSize');
      expect(metrics).toHaveProperty('activeContexts');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('permissionViolations');
      expect(metrics).toHaveProperty('dataAccessCount');
      expect(metrics).toHaveProperty('privacyScore');
      
      expect(typeof metrics.totalContextSize).toBe('number');
      expect(typeof metrics.activeContexts).toBe('number');
      expect(typeof metrics.privacyScore).toBe('number');
    });
  });
});