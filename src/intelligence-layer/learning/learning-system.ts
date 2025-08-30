/**
 * Main learning system that coordinates pattern recognition and proactive assistance
 * Provides a unified interface for the on-device learning capabilities
 */

import { EventEmitter } from 'events';
import { PatternRecognitionEngine, BehaviorEvent, UserBehaviorPattern } from './pattern-recognition';
import { ProactiveAssistant, ProactiveSuggestion } from './proactive-assistant';

export interface LearningSystemConfig {
  patternRecognition: {
    enabled: boolean;
    minConfidence: number;
    minOccurrences: number;
    maxPatterns: number;
    privacyMode: 'strict' | 'balanced' | 'permissive';
  };
  proactiveAssistance: {
    enabled: boolean;
    maxSuggestions: number;
    minConfidenceThreshold: number;
    suggestionCooldown: number;
    respectQuietHours: boolean;
    quietHoursStart: number;
    quietHoursEnd: number;
  };
  privacy: {
    dataRetentionDays: number;
    anonymizeAfterDays: number;
    allowCrossPlatformLearning: boolean;
  };
}

export interface LearningInsights {
  totalPatterns: number;
  patternsByType: Record<string, number>;
  learningAccuracy: number;
  suggestionStats: {
    totalGenerated: number;
    acceptanceRate: number;
    dismissalRate: number;
  };
  privacyCompliance: {
    dataAge: number;
    anonymizedPatterns: number;
    retentionCompliant: boolean;
  };
}

export class LearningSystem extends EventEmitter {
  private patternEngine: PatternRecognitionEngine;
  private proactiveAssistant: ProactiveAssistant;
  private config: LearningSystemConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<LearningSystemConfig> = {}) {
    super();
    
    this.config = {
      patternRecognition: {
        enabled: true,
        minConfidence: 0.7,
        minOccurrences: 3,
        maxPatterns: 100,
        privacyMode: 'balanced',
        ...config.patternRecognition
      },
      proactiveAssistance: {
        enabled: true,
        maxSuggestions: 3,
        minConfidenceThreshold: 0.7,
        suggestionCooldown: 30,
        respectQuietHours: true,
        quietHoursStart: 22,
        quietHoursEnd: 7,
        ...config.proactiveAssistance
      },
      privacy: {
        dataRetentionDays: 90,
        anonymizeAfterDays: 30,
        allowCrossPlatformLearning: false,
        ...config.privacy
      }
    };

    this.initializeComponents();
  }

  /**
   * Initialize the learning system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Set up event listeners
      this.setupEventListeners();

      // Start privacy compliance monitoring
      this.startPrivacyCompliance();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process a user behavior event
   */
  async processEvent(event: BehaviorEvent): Promise<void> {
    if (!this.isInitialized || !this.config.patternRecognition.enabled) return;

    try {
      await this.patternEngine.processEvent(event);
      this.emit('eventProcessed', event);
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Get proactive suggestions for current context
   */
  async getSuggestions(context: Record<string, any>): Promise<ProactiveSuggestion[]> {
    if (!this.isInitialized || !this.config.proactiveAssistance.enabled) return [];

    try {
      const suggestions = await this.proactiveAssistant.generateSuggestions(context);
      this.emit('suggestionsGenerated', suggestions);
      return suggestions;
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Handle user response to a suggestion
   */
  async handleSuggestionResponse(
    suggestionId: string,
    response: 'accept' | 'modify' | 'dismiss',
    modifications?: Record<string, any>
  ): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.proactiveAssistant.handleSuggestionResponse(suggestionId, response, modifications);
      this.emit('suggestionResponse', { suggestionId, response, modifications });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Get current active suggestions
   */
  getActiveSuggestions(): ProactiveSuggestion[] {
    if (!this.isInitialized) return [];
    return this.proactiveAssistant.getActiveSuggestions();
  }

  /**
   * Get learned patterns
   */
  getPatterns(filter?: Partial<UserBehaviorPattern>): UserBehaviorPattern[] {
    if (!this.isInitialized) return [];
    return this.patternEngine.getPatterns(filter);
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(preferences: Record<string, any>): void {
    if (!this.isInitialized) return;

    // Update proactive assistant preferences
    this.proactiveAssistant.updateUserPreferences(preferences);

    // Update learning system preferences
    if (preferences.learningEnabled !== undefined) {
      this.setLearningEnabled(preferences.learningEnabled);
    }

    if (preferences.suggestionsEnabled !== undefined) {
      this.setSuggestionsEnabled(preferences.suggestionsEnabled);
    }

    if (preferences.privacyMode) {
      this.updatePrivacyMode(preferences.privacyMode);
    }

    this.emit('preferencesUpdated', preferences);
  }

  /**
   * Enable or disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.config.patternRecognition.enabled = enabled;
    if (this.patternEngine) {
      this.patternEngine.setLearningEnabled(enabled);
    }
    this.emit('learningStateChanged', enabled);
  }

  /**
   * Enable or disable proactive suggestions
   */
  setSuggestionsEnabled(enabled: boolean): void {
    this.config.proactiveAssistance.enabled = enabled;
    if (this.proactiveAssistant) {
      this.proactiveAssistant.setEnabled(enabled);
    }
    this.emit('suggestionsStateChanged', enabled);
  }

  /**
   * Update privacy mode
   */
  updatePrivacyMode(mode: 'strict' | 'balanced' | 'permissive'): void {
    this.config.patternRecognition.privacyMode = mode;
    // Reinitialize pattern engine with new privacy mode
    this.initializeComponents();
    this.emit('privacyModeChanged', mode);
  }

  /**
   * Get learning insights and statistics
   */
  getLearningInsights(): LearningInsights {
    if (!this.isInitialized) {
      return this.getEmptyInsights();
    }

    const patterns = this.patternEngine.getPatterns();
    const suggestionStats = this.proactiveAssistant.getSuggestionStats();

    const patternsByType = patterns.reduce((acc, pattern) => {
      acc[pattern.type] = (acc[pattern.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgConfidence = patterns.length > 0 
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length 
      : 0;

    return {
      totalPatterns: patterns.length,
      patternsByType,
      learningAccuracy: avgConfidence,
      suggestionStats: {
        totalGenerated: suggestionStats.totalGenerated,
        acceptanceRate: suggestionStats.acceptanceRate,
        dismissalRate: suggestionStats.dismissalRate
      },
      privacyCompliance: {
        dataAge: this.calculateDataAge(),
        anonymizedPatterns: this.countAnonymizedPatterns(),
        retentionCompliant: this.isRetentionCompliant()
      }
    };
  }

  /**
   * Export learning data for backup (privacy-compliant)
   */
  exportLearningData(): any {
    if (!this.isInitialized) return null;

    return {
      patterns: this.patternEngine.exportPatterns(),
      config: this.config,
      insights: this.getLearningInsights(),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Clear all learning data (privacy compliance)
   */
  clearAllData(): void {
    if (!this.isInitialized) return;

    this.patternEngine.clearAllData();
    this.proactiveAssistant.getActiveSuggestions().forEach(suggestion => {
      this.proactiveAssistant.handleSuggestionResponse(suggestion.id, 'dismiss');
    });

    this.emit('dataCleared');
  }

  /**
   * Shutdown the learning system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop privacy compliance monitoring
      this.stopPrivacyCompliance();

      // Clear event listeners
      this.removeAllListeners();

      this.isInitialized = false;
      this.emit('shutdown');
    } catch (error) {
      this.emit('error', error);
    }
  }

  private initializeComponents(): void {
    // Initialize pattern recognition engine
    this.patternEngine = new PatternRecognitionEngine({
      minConfidence: this.config.patternRecognition.minConfidence,
      minOccurrences: this.config.patternRecognition.minOccurrences,
      maxPatterns: this.config.patternRecognition.maxPatterns,
      privacyMode: this.config.patternRecognition.privacyMode
    });

    // Initialize proactive assistant
    this.proactiveAssistant = new ProactiveAssistant(this.patternEngine, {
      enabled: this.config.proactiveAssistance.enabled,
      maxSuggestions: this.config.proactiveAssistance.maxSuggestions,
      minConfidenceThreshold: this.config.proactiveAssistance.minConfidenceThreshold,
      suggestionCooldown: this.config.proactiveAssistance.suggestionCooldown,
      respectQuietHours: this.config.proactiveAssistance.respectQuietHours,
      quietHoursStart: this.config.proactiveAssistance.quietHoursStart,
      quietHoursEnd: this.config.proactiveAssistance.quietHoursEnd
    });
  }

  private setupEventListeners(): void {
    // Pattern engine events
    this.patternEngine.on('patternDiscovered', (pattern) => {
      this.emit('patternDiscovered', pattern);
    });

    this.patternEngine.on('patternUpdated', (pattern) => {
      this.emit('patternUpdated', pattern);
    });

    this.patternEngine.on('patternRemoved', (patternId) => {
      this.emit('patternRemoved', patternId);
    });

    // Proactive assistant events
    this.proactiveAssistant.on('suggestionsGenerated', (suggestions) => {
      this.emit('suggestionsGenerated', suggestions);
    });

    this.proactiveAssistant.on('suggestionResponse', (data) => {
      this.emit('suggestionResponse', data);
    });

    this.proactiveAssistant.on('immediatesuggestion', (suggestion) => {
      this.emit('immediatesuggestion', suggestion);
    });
  }

  private privacyComplianceInterval?: NodeJS.Timeout;

  private startPrivacyCompliance(): void {
    // Run privacy compliance check every hour
    this.privacyComplianceInterval = setInterval(() => {
      this.performPrivacyCompliance();
    }, 60 * 60 * 1000);

    // Run initial check
    this.performPrivacyCompliance();
  }

  private stopPrivacyCompliance(): void {
    if (this.privacyComplianceInterval) {
      clearInterval(this.privacyComplianceInterval);
      this.privacyComplianceInterval = undefined;
    }
  }

  private performPrivacyCompliance(): void {
    const now = new Date();
    const retentionMs = this.config.privacy.dataRetentionDays * 24 * 60 * 60 * 1000;
    const anonymizeMs = this.config.privacy.anonymizeAfterDays * 24 * 60 * 60 * 1000;

    const patterns = this.patternEngine.getPatterns();
    let removedCount = 0;
    let anonymizedCount = 0;

    for (const pattern of patterns) {
      const age = now.getTime() - pattern.metadata.createdAt.getTime();

      // Remove old patterns
      if (age > retentionMs) {
        this.patternEngine.updatePatternFeedback(pattern.id, 'negative'); // This will remove low confidence patterns
        removedCount++;
      }
      // Anonymize patterns after specified time
      else if (age > anonymizeMs && !this.isPatternAnonymized(pattern)) {
        this.anonymizePattern(pattern);
        anonymizedCount++;
      }
    }

    if (removedCount > 0 || anonymizedCount > 0) {
      this.emit('privacyCompliancePerformed', { removedCount, anonymizedCount });
    }
  }

  private isPatternAnonymized(pattern: UserBehaviorPattern): boolean {
    // Check if pattern context contains anonymized data
    return Object.values(pattern.context).some(value => 
      typeof value === 'string' && value.includes('[REDACTED]')
    );
  }

  private anonymizePattern(pattern: UserBehaviorPattern): void {
    // This would need to be implemented in the pattern engine
    // For now, we'll emit an event that the pattern should be anonymized
    this.emit('patternAnonymizationRequired', pattern.id);
  }

  private calculateDataAge(): number {
    const patterns = this.patternEngine.getPatterns();
    if (patterns.length === 0) return 0;

    const oldestPattern = patterns.reduce((oldest, pattern) => 
      pattern.metadata.createdAt < oldest.metadata.createdAt ? pattern : oldest
    );

    return Math.floor((Date.now() - oldestPattern.metadata.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  }

  private countAnonymizedPatterns(): number {
    const patterns = this.patternEngine.getPatterns();
    return patterns.filter(pattern => this.isPatternAnonymized(pattern)).length;
  }

  private isRetentionCompliant(): boolean {
    const maxAge = this.config.privacy.dataRetentionDays;
    const dataAge = this.calculateDataAge();
    return dataAge <= maxAge;
  }

  private getEmptyInsights(): LearningInsights {
    return {
      totalPatterns: 0,
      patternsByType: {},
      learningAccuracy: 0,
      suggestionStats: {
        totalGenerated: 0,
        acceptanceRate: 0,
        dismissalRate: 0
      },
      privacyCompliance: {
        dataAge: 0,
        anonymizedPatterns: 0,
        retentionCompliant: true
      }
    };
  }
}