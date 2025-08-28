/**
 * Privacy Filter - Filters context data based on privacy settings
 * 
 * Applies privacy controls and data filtering to ensure user
 * privacy preferences are respected when sharing context data.
 */

import {
  UserContext,
  LocationContext,
  ActivityContext,
  ConversationTurn,
  RecentEvent,
  UpcomingEvent
} from './context-types';

export class PrivacyFilter {
  private privacyMode: 'strict' | 'balanced' | 'permissive';

  constructor(privacyMode: 'strict' | 'balanced' | 'permissive' = 'balanced') {
    this.privacyMode = privacyMode;
  }

  /**
   * Filter context data based on privacy settings and requested data types
   */
  async filterContext(
    context: UserContext,
    requestedDataTypes: string[],
    includePrivate: boolean
  ): Promise<Partial<UserContext>> {
    const filtered: Partial<UserContext> = {
      userId: context.userId,
      sessionId: context.sessionId
    };

    // Apply privacy mode restrictions
    const allowedDataTypes = this.getAllowedDataTypes(
      requestedDataTypes,
      context.preferences.privacySettings,
      includePrivate
    );

    // Filter each data type based on permissions
    for (const dataType of allowedDataTypes) {
      switch (dataType) {
        case 'preferences':
          filtered.preferences = this.filterPreferences(context.preferences);
          break;
        
        case 'location':
          filtered.currentLocation = this.filterLocation(context.currentLocation);
          break;
        
        case 'activity':
          filtered.currentActivity = this.filterActivity(context.currentActivity);
          break;
        
        case 'device':
          filtered.deviceState = this.filterDeviceState(context.deviceState);
          break;
        
        case 'conversation':
          filtered.conversationHistory = this.filterConversationHistory(
            context.conversationHistory,
            includePrivate
          );
          break;
        
        case 'temporal':
          filtered.temporalContext = this.filterTemporalContext(
            context.temporalContext,
            includePrivate
          );
          break;
        
        case 'permissions':
          if (includePrivate) {
            filtered.permissions = context.permissions;
          }
          break;
      }
    }

    return filtered;
  }

  /**
   * Anonymize sensitive data in context
   */
  anonymizeContext(context: Partial<UserContext>): Partial<UserContext> {
    const anonymized = { ...context };

    // Remove or hash personally identifiable information
    if (anonymized.userId) {
      anonymized.userId = this.hashUserId(anonymized.userId);
    }

    if (anonymized.currentLocation) {
      anonymized.currentLocation = this.anonymizeLocation(anonymized.currentLocation);
    }

    if (anonymized.conversationHistory) {
      anonymized.conversationHistory = anonymized.conversationHistory.map(turn =>
        this.anonymizeConversationTurn(turn)
      );
    }

    if (anonymized.temporalContext) {
      anonymized.temporalContext = this.anonymizeTemporalContext(anonymized.temporalContext);
    }

    return anonymized;
  }

  /**
   * Check if data type is sensitive
   */
  isSensitiveDataType(dataType: string): boolean {
    const sensitiveTypes = [
      'location',
      'conversation',
      'health',
      'contacts',
      'financial',
      'biometric',
      'permissions'
    ];

    return sensitiveTypes.includes(dataType);
  }

  /**
   * Get privacy level for data type
   */
  getPrivacyLevel(dataType: string): 'public' | 'private' | 'restricted' {
    switch (dataType) {
      case 'preferences':
      case 'device':
        return 'public';
      
      case 'activity':
      case 'temporal':
        return 'private';
      
      case 'location':
      case 'conversation':
      case 'permissions':
        return 'restricted';
      
      default:
        return 'private';
    }
  }

  /**
   * Update privacy mode
   */
  setPrivacyMode(mode: 'strict' | 'balanced' | 'permissive'): void {
    this.privacyMode = mode;
  }

  /**
   * Get allowed data types based on privacy settings
   */
  private getAllowedDataTypes(
    requested: string[],
    privacySettings: any,
    includePrivate: boolean
  ): string[] {
    const allowed: string[] = [];

    for (const dataType of requested) {
      const privacyLevel = this.getPrivacyLevel(dataType);
      
      // Check privacy mode restrictions
      if (this.privacyMode === 'strict' && privacyLevel === 'restricted') {
        continue;
      }

      // Check user privacy settings
      if (privacySettings.dataSharing === 'none' && privacyLevel !== 'public') {
        continue;
      }

      if (privacySettings.dataSharing === 'minimal' && privacyLevel === 'restricted') {
        continue;
      }

      // Check if private data is explicitly requested
      if (privacyLevel === 'restricted' && !includePrivate) {
        continue;
      }

      allowed.push(dataType);
    }

    return allowed;
  }

  /**
   * Filter user preferences
   */
  private filterPreferences(preferences: any): any {
    const filtered = { ...preferences };

    // Remove sensitive preference data in strict mode
    if (this.privacyMode === 'strict') {
      delete filtered.caregiverSettings;
    }

    return filtered;
  }

  /**
   * Filter location context
   */
  private filterLocation(location?: LocationContext): LocationContext | undefined {
    if (!location) return undefined;

    const filtered = { ...location };

    // Remove precise coordinates in strict mode
    if (this.privacyMode === 'strict') {
      delete filtered.latitude;
      delete filtered.longitude;
      
      // Only keep general location type
      filtered.address = undefined;
    } else if (this.privacyMode === 'balanced') {
      // Reduce precision of coordinates
      if (filtered.latitude) {
        filtered.latitude = Math.round(filtered.latitude * 100) / 100;
      }
      if (filtered.longitude) {
        filtered.longitude = Math.round(filtered.longitude * 100) / 100;
      }
    }

    return filtered;
  }

  /**
   * Filter activity context
   */
  private filterActivity(activity?: ActivityContext): ActivityContext | undefined {
    if (!activity) return undefined;

    const filtered = { ...activity };

    // Remove health metrics in strict mode
    if (this.privacyMode === 'strict') {
      delete filtered.healthMetrics;
      delete filtered.relatedApps;
    }

    return filtered;
  }

  /**
   * Filter device state
   */
  private filterDeviceState(deviceState: any): any {
    const filtered = { ...deviceState };

    // Remove detailed device info in strict mode
    if (this.privacyMode === 'strict') {
      delete filtered.availableStorage;
      delete filtered.memoryUsage;
    }

    return filtered;
  }

  /**
   * Filter conversation history
   */
  private filterConversationHistory(
    history: ConversationTurn[],
    includePrivate: boolean
  ): ConversationTurn[] {
    if (!includePrivate && this.privacyMode === 'strict') {
      return [];
    }

    return history.map(turn => ({
      ...turn,
      userInput: this.privacyMode === 'strict' ? '[FILTERED]' : turn.userInput,
      systemResponse: this.privacyMode === 'strict' ? '[FILTERED]' : turn.systemResponse,
      entities: this.privacyMode === 'strict' ? {} : turn.entities
    }));
  }

  /**
   * Filter temporal context
   */
  private filterTemporalContext(
    temporal: any,
    includePrivate: boolean
  ): any {
    const filtered = { ...temporal };

    if (this.privacyMode === 'strict') {
      // Remove detailed event information
      filtered.recentEvents = filtered.recentEvents?.map((event: RecentEvent) => ({
        ...event,
        description: '[FILTERED]',
        participants: undefined,
        location: undefined
      })) || [];

      filtered.upcomingEvents = filtered.upcomingEvents?.map((event: UpcomingEvent) => ({
        ...event,
        description: '[FILTERED]'
      })) || [];

      filtered.routinePatterns = [];
    }

    return filtered;
  }

  /**
   * Hash user ID for anonymization
   */
  private hashUserId(userId: string): string {
    // Simple hash function - in production, use proper cryptographic hash
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `anon_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Anonymize location data
   */
  private anonymizeLocation(location: LocationContext): LocationContext {
    return {
      ...location,
      latitude: undefined,
      longitude: undefined,
      address: undefined,
      locationType: location.locationType,
      confidence: location.confidence,
      timestamp: location.timestamp,
      privacyLevel: 'restricted'
    };
  }

  /**
   * Anonymize conversation turn
   */
  private anonymizeConversationTurn(turn: ConversationTurn): ConversationTurn {
    return {
      ...turn,
      userInput: this.anonymizeText(turn.userInput),
      systemResponse: this.anonymizeText(turn.systemResponse),
      entities: {}
    };
  }

  /**
   * Anonymize temporal context
   */
  private anonymizeTemporalContext(temporal: any): any {
    return {
      ...temporal,
      recentEvents: temporal.recentEvents?.map((event: RecentEvent) => ({
        ...event,
        description: '[ANONYMIZED]',
        participants: undefined,
        location: undefined
      })) || [],
      upcomingEvents: temporal.upcomingEvents?.map((event: UpcomingEvent) => ({
        ...event,
        description: '[ANONYMIZED]'
      })) || []
    };
  }

  /**
   * Anonymize text content
   */
  private anonymizeText(text: string): string {
    // Replace potential PII with placeholders
    return text
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{1,5}\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi, '[ADDRESS]')
      .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]');
  }
}