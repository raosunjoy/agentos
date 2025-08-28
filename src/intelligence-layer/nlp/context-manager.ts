/**
 * Context Manager - Privacy-aware context storage and management
 * 
 * Handles session state management, temporal context understanding,
 * and context sharing with granular permission controls.
 */

import {
  UserContext,
  ContextQuery,
  ContextUpdateRequest,
  ContextSharingRequest,
  ContextMetrics,
  ContextStorageConfig,
  ConversationTurn,
  TemporalContext,
  PermissionContext,
  DataPermission,
  TemporaryPermission,
  LocationContext,
  ActivityContext,
  DeviceState,
  UserPreferences
} from './context-types';
import { PermissionValidator } from './permission-validator';
import { TemporalAnalyzer } from './temporal-analyzer';
import { PrivacyFilter } from './privacy-filter';

export class ContextManager {
  private contexts: Map<string, UserContext> = new Map();
  private sessionContexts: Map<string, Partial<UserContext>> = new Map();
  private config: ContextStorageConfig;
  private encryptionKey?: string;
  private permissionValidator: PermissionValidator;
  private temporalAnalyzer: TemporalAnalyzer;
  private privacyFilter: PrivacyFilter;

  constructor(config?: Partial<ContextStorageConfig>) {
    this.config = this.mergeWithDefaultConfig(config);
    this.permissionValidator = new PermissionValidator();
    this.temporalAnalyzer = new TemporalAnalyzer();
    this.privacyFilter = new PrivacyFilter(this.config.privacyMode);
    
    // Initialize encryption if enabled
    if (this.config.encryptionEnabled) {
      this.initializeEncryption();
    }

    // Start cleanup routine
    this.startCleanupRoutine();
  }

  /**
   * Get user context with privacy filtering
   */
  async getUserContext(query: ContextQuery): Promise<Partial<UserContext> | null> {
    try {
      // Validate permissions
      const hasPermission = await this.permissionValidator.validateAccess(
        query.requesterService,
        query.userId,
        query.dataTypes
      );

      if (!hasPermission) {
        throw new Error('Insufficient permissions to access context data');
      }

      const context = this.contexts.get(query.userId);
      if (!context) {
        return null;
      }

      // Apply privacy filtering
      const filteredContext = await this.privacyFilter.filterContext(
        context,
        query.dataTypes,
        query.includePrivate || false
      );

      // Apply time range filtering if specified
      if (query.timeRange) {
        filteredContext.conversationHistory = this.filterConversationByTime(
          filteredContext.conversationHistory || [],
          query.timeRange.start,
          query.timeRange.end
        );
      }

      return filteredContext;
    } catch (error) {
      console.error('Error retrieving user context:', error);
      return null;
    }
  }

  /**
   * Update user context with validation
   */
  async updateUserContext(request: ContextUpdateRequest): Promise<boolean> {
    try {
      // Validate update permissions if required
      if (request.requiresPermission) {
        const hasPermission = await this.permissionValidator.validateUpdate(
          request.source,
          request.userId,
          Object.keys(request.updates)
        );

        if (!hasPermission) {
          throw new Error('Insufficient permissions to update context');
        }
      }

      let context = this.contexts.get(request.userId);
      if (!context) {
        context = this.createDefaultContext(request.userId, request.sessionId);
      }

      // Merge updates with existing context
      const updatedContext = this.mergeContextUpdates(context, request.updates);
      
      // Update temporal context
      updatedContext.temporalContext = await this.temporalAnalyzer.updateTemporalContext(
        updatedContext.temporalContext,
        request.timestamp
      );

      // Store updated context
      this.contexts.set(request.userId, updatedContext);

      // Update session context if different session
      if (request.sessionId !== context.sessionId) {
        this.sessionContexts.set(request.sessionId, {
          sessionId: request.sessionId,
          conversationHistory: updatedContext.conversationHistory
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating user context:', error);
      return false;
    }
  }

  /**
   * Add conversation turn to context
   */
  async addConversationTurn(
    userId: string,
    sessionId: string,
    turn: Omit<ConversationTurn, 'id' | 'timestamp'>
  ): Promise<void> {
    const context = this.contexts.get(userId);
    if (!context) {
      return;
    }

    const conversationTurn: ConversationTurn = {
      ...turn,
      id: this.generateId(),
      timestamp: new Date()
    };

    context.conversationHistory.push(conversationTurn);

    // Limit conversation history size
    if (context.conversationHistory.length > this.config.maxConversationHistory) {
      context.conversationHistory = context.conversationHistory.slice(-this.config.maxConversationHistory);
    }

    // Update context
    this.contexts.set(userId, context);
  }

  /**
   * Request context sharing between services
   */
  async requestContextSharing(request: ContextSharingRequest): Promise<boolean> {
    try {
      const context = this.contexts.get(request.fromUserId);
      if (!context) {
        return false;
      }

      // Check if user allows data sharing
      if (context.preferences.privacySettings.dataSharing === 'none') {
        return false;
      }

      // Create temporary permission
      const permission: TemporaryPermission = {
        id: this.generateId(),
        grantedTo: request.toService,
        permissions: request.dataTypes,
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + (request.duration || 60) * 60 * 1000),
        context: request.purpose,
        autoRevoke: true
      };

      context.permissions.temporaryGrants.push(permission);
      this.contexts.set(request.fromUserId, context);

      return true;
    } catch (error) {
      console.error('Error processing context sharing request:', error);
      return false;
    }
  }

  /**
   * Update location context
   */
  async updateLocationContext(
    userId: string,
    location: Partial<LocationContext>
  ): Promise<void> {
    const context = this.contexts.get(userId);
    if (!context) {
      return;
    }

    // Check location tracking permission
    if (!context.preferences.privacySettings.locationTracking) {
      return;
    }

    context.currentLocation = {
      ...context.currentLocation,
      ...location,
      timestamp: new Date()
    };

    this.contexts.set(userId, context);
  }

  /**
   * Update activity context
   */
  async updateActivityContext(
    userId: string,
    activity: Partial<ActivityContext>
  ): Promise<void> {
    const context = this.contexts.get(userId);
    if (!context) {
      return;
    }

    context.currentActivity = {
      ...context.currentActivity,
      ...activity,
      startTime: activity.startTime || new Date()
    };

    this.contexts.set(userId, context);
  }

  /**
   * Update device state
   */
  async updateDeviceState(
    userId: string,
    deviceState: Partial<DeviceState>
  ): Promise<void> {
    const context = this.contexts.get(userId);
    if (!context) {
      return;
    }

    context.deviceState = {
      ...context.deviceState,
      ...deviceState
    };

    this.contexts.set(userId, context);
  }

  /**
   * Grant data permission
   */
  async grantDataPermission(
    userId: string,
    serviceId: string,
    dataType: string,
    accessLevel: 'read' | 'write' | 'full',
    expiresAt?: Date
  ): Promise<void> {
    const context = this.contexts.get(userId);
    if (!context) {
      return;
    }

    const permission: DataPermission = {
      dataType,
      accessLevel,
      grantedTo: serviceId,
      grantedAt: new Date(),
      expiresAt,
      usageCount: 0
    };

    context.permissions.dataAccessPermissions.set(
      `${serviceId}:${dataType}`,
      permission
    );

    this.contexts.set(userId, context);
  }

  /**
   * Revoke data permission
   */
  async revokeDataPermission(
    userId: string,
    serviceId: string,
    dataType: string,
    reason: string
  ): Promise<void> {
    const context = this.contexts.get(userId);
    if (!context) {
      return;
    }

    const permissionKey = `${serviceId}:${dataType}`;
    const permission = context.permissions.dataAccessPermissions.get(permissionKey);

    if (permission) {
      context.permissions.dataAccessPermissions.delete(permissionKey);
      
      context.permissions.revokedPermissions.push({
        originalPermissionId: permissionKey,
        revokedAt: new Date(),
        reason,
        revokedBy: 'user'
      });

      this.contexts.set(userId, context);
    }
  }

  /**
   * Get context metrics
   */
  getMetrics(): ContextMetrics {
    const totalSize = Array.from(this.contexts.values())
      .reduce((sum, context) => sum + this.calculateContextSize(context), 0);

    const activeContexts = this.contexts.size;
    
    const permissionViolations = Array.from(this.contexts.values())
      .reduce((sum, context) => sum + context.permissions.revokedPermissions.length, 0);

    const dataAccessCount = Array.from(this.contexts.values())
      .reduce((sum, context) => {
        return sum + Array.from(context.permissions.dataAccessPermissions.values())
          .reduce((accessSum, permission) => accessSum + permission.usageCount, 0);
      }, 0);

    return {
      totalContextSize: totalSize,
      activeContexts,
      averageResponseTime: 0, // Would be tracked in real implementation
      permissionViolations,
      dataAccessCount,
      privacyScore: this.calculatePrivacyScore()
    };
  }

  /**
   * Clear expired contexts and permissions
   */
  private async cleanupExpiredData(): Promise<void> {
    const now = new Date();
    const maxAge = this.config.maxContextAge * 24 * 60 * 60 * 1000; // Convert days to ms

    for (const [userId, context] of this.contexts.entries()) {
      // Remove expired temporary permissions
      context.permissions.temporaryGrants = context.permissions.temporaryGrants
        .filter(grant => grant.expiresAt > now);

      // Remove expired data permissions
      for (const [key, permission] of context.permissions.dataAccessPermissions.entries()) {
        if (permission.expiresAt && permission.expiresAt < now) {
          context.permissions.dataAccessPermissions.delete(key);
        }
      }

      // Remove old conversation history
      const cutoffTime = new Date(now.getTime() - maxAge);
      context.conversationHistory = context.conversationHistory
        .filter(turn => turn.timestamp > cutoffTime);

      this.contexts.set(userId, context);
    }
  }

  /**
   * Create default context for new user
   */
  private createDefaultContext(userId: string, sessionId: string): UserContext {
    return {
      userId,
      sessionId,
      preferences: this.createDefaultPreferences(),
      deviceState: this.createDefaultDeviceState(),
      conversationHistory: [],
      temporalContext: this.temporalAnalyzer.createInitialTemporalContext(),
      permissions: {
        dataAccessPermissions: new Map(),
        servicePermissions: new Map(),
        temporaryGrants: [],
        revokedPermissions: []
      }
    };
  }

  /**
   * Create default user preferences
   */
  private createDefaultPreferences(): UserPreferences {
    return {
      language: 'en',
      voiceSettings: {
        speed: 1.0,
        volume: 0.8,
        preferredVoice: 'default'
      },
      accessibilitySettings: {
        largeText: false,
        highContrast: false,
        screenReader: false,
        slowSpeech: false
      },
      privacySettings: {
        dataSharing: 'minimal',
        analytics: false,
        personalization: true,
        locationTracking: false
      }
    };
  }

  /**
   * Create default device state
   */
  private createDefaultDeviceState(): DeviceState {
    return {
      batteryLevel: 100,
      isCharging: false,
      networkType: 'wifi',
      screenBrightness: 0.5,
      volume: 0.7,
      isHeadphonesConnected: false,
      availableStorage: 1000000000, // 1GB in bytes
      memoryUsage: 0.3
    };
  }

  /**
   * Merge context updates with existing context
   */
  private mergeContextUpdates(
    existing: UserContext,
    updates: Partial<UserContext>
  ): UserContext {
    return {
      ...existing,
      ...updates,
      preferences: updates.preferences 
        ? { ...existing.preferences, ...updates.preferences }
        : existing.preferences,
      deviceState: updates.deviceState
        ? { ...existing.deviceState, ...updates.deviceState }
        : existing.deviceState,
      permissions: updates.permissions
        ? { ...existing.permissions, ...updates.permissions }
        : existing.permissions
    };
  }

  /**
   * Filter conversation history by time range
   */
  private filterConversationByTime(
    history: ConversationTurn[],
    start: Date,
    end: Date
  ): ConversationTurn[] {
    return history.filter(turn => 
      turn.timestamp >= start && turn.timestamp <= end
    );
  }

  /**
   * Calculate context size for metrics
   */
  private calculateContextSize(context: UserContext): number {
    return JSON.stringify(context).length;
  }

  /**
   * Calculate privacy score based on settings and permissions
   */
  private calculatePrivacyScore(): number {
    let totalScore = 0;
    let contextCount = 0;

    for (const context of this.contexts.values()) {
      let score = 100; // Start with perfect privacy score

      // Deduct points for data sharing
      if (context.preferences.privacySettings.dataSharing === 'full') {
        score -= 30;
      } else if (context.preferences.privacySettings.dataSharing === 'minimal') {
        score -= 10;
      }

      // Deduct points for analytics
      if (context.preferences.privacySettings.analytics) {
        score -= 15;
      }

      // Deduct points for location tracking
      if (context.preferences.privacySettings.locationTracking) {
        score -= 20;
      }

      // Deduct points for active permissions
      const activePermissions = context.permissions.dataAccessPermissions.size;
      score -= Math.min(activePermissions * 2, 25);

      totalScore += Math.max(score, 0);
      contextCount++;
    }

    return contextCount > 0 ? totalScore / contextCount : 100;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize encryption system
   */
  private initializeEncryption(): void {
    // In a real implementation, this would set up proper encryption
    this.encryptionKey = 'default_key';
  }

  /**
   * Start cleanup routine
   */
  private startCleanupRoutine(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60 * 60 * 1000);
  }

  /**
   * Merge with default configuration
   */
  private mergeWithDefaultConfig(userConfig?: Partial<ContextStorageConfig>): ContextStorageConfig {
    const defaultConfig: ContextStorageConfig = {
      maxContextAge: 30, // 30 days
      maxConversationHistory: 100,
      encryptionEnabled: true,
      compressionEnabled: false,
      backupEnabled: true,
      privacyMode: 'balanced'
    };

    return {
      ...defaultConfig,
      ...userConfig
    };
  }
}