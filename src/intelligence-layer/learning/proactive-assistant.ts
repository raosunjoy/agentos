/**
 * Proactive assistance system that provides contextual suggestions
 * Based on learned patterns and user preferences
 */

import { EventEmitter } from 'events';
import { PatternRecognitionEngine, UserBehaviorPattern } from './pattern-recognition';

export interface ProactiveSuggestion {
  id: string;
  type: 'action' | 'reminder' | 'optimization' | 'assistance';
  title: string;
  description: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  context: Record<string, any>;
  actions: SuggestionAction[];
  expiresAt?: Date;
  metadata: {
    createdAt: Date;
    basedOnPatterns: string[];
    userFeedback?: 'accepted' | 'modified' | 'dismissed';
  };
}

export interface SuggestionAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'dismiss';
  payload: Record<string, any>;
}

export interface ProactiveAssistantConfig {
  enabled: boolean;
  maxSuggestions: number;
  minConfidenceThreshold: number;
  suggestionCooldown: number; // minutes
  contextualTiming: boolean;
  respectQuietHours: boolean;
  quietHoursStart: number; // hour (0-23)
  quietHoursEnd: number; // hour (0-23)
}

export class ProactiveAssistant extends EventEmitter {
  private patternEngine: PatternRecognitionEngine;
  private config: ProactiveAssistantConfig;
  private activeSuggestions: Map<string, ProactiveSuggestion> = new Map();
  private suggestionHistory: ProactiveSuggestion[] = [];
  private lastSuggestionTime: Date | null = null;
  private userPreferences: Map<string, any> = new Map();

  constructor(
    patternEngine: PatternRecognitionEngine,
    config: Partial<ProactiveAssistantConfig> = {}
  ) {
    super();
    this.patternEngine = patternEngine;
    this.config = {
      enabled: true,
      maxSuggestions: 3,
      minConfidenceThreshold: 0.7,
      suggestionCooldown: 30,
      contextualTiming: true,
      respectQuietHours: true,
      quietHoursStart: 22,
      quietHoursEnd: 7,
      ...config
    };

    this.setupPatternEngineListeners();
  }

  /**
   * Generate proactive suggestions based on current context
   */
  async generateSuggestions(context: Record<string, any>): Promise<ProactiveSuggestion[]> {
    if (!this.config.enabled || !this.shouldGenerateSuggestions()) {
      return [];
    }

    const patterns = this.patternEngine.getPatterns();
    const relevantPatterns = this.findRelevantPatterns(patterns, context);
    const suggestions: ProactiveSuggestion[] = [];

    // Generate different types of suggestions
    suggestions.push(...await this.generateRoutineSuggestions(relevantPatterns, context));
    suggestions.push(...await this.generateOptimizationSuggestions(relevantPatterns, context));
    suggestions.push(...await this.generateReminderSuggestions(relevantPatterns, context));
    suggestions.push(...await this.generateAssistanceSuggestions(relevantPatterns, context));

    // Filter and rank suggestions
    const filteredSuggestions = this.filterAndRankSuggestions(suggestions);
    
    // Store active suggestions
    for (const suggestion of filteredSuggestions) {
      this.activeSuggestions.set(suggestion.id, suggestion);
    }

    this.lastSuggestionTime = new Date();
    this.emit('suggestionsGenerated', filteredSuggestions);

    return filteredSuggestions;
  }

  /**
   * Handle user response to a suggestion
   */
  async handleSuggestionResponse(
    suggestionId: string,
    response: 'accept' | 'modify' | 'dismiss',
    modifications?: Record<string, any>
  ): Promise<void> {
    const suggestion = this.activeSuggestions.get(suggestionId);
    if (!suggestion) return;

    suggestion.metadata.userFeedback = response;

    // Update pattern engine with feedback
    for (const patternId of suggestion.metadata.basedOnPatterns) {
      const feedbackType = response === 'accept' ? 'positive' : 
                          response === 'dismiss' ? 'negative' : 'neutral';
      await this.patternEngine.updatePatternFeedback(patternId, feedbackType);
    }

    // Learn from user modifications
    if (response === 'modify' && modifications) {
      await this.learnFromModifications(suggestion, modifications);
    }

    // Move to history and remove from active
    this.suggestionHistory.push(suggestion);
    this.activeSuggestions.delete(suggestionId);

    // Limit history size
    if (this.suggestionHistory.length > 100) {
      this.suggestionHistory = this.suggestionHistory.slice(-80);
    }

    this.emit('suggestionResponse', { suggestion, response, modifications });
  }

  /**
   * Get current active suggestions
   */
  getActiveSuggestions(): ProactiveSuggestion[] {
    // Remove expired suggestions
    const now = new Date();
    for (const [id, suggestion] of this.activeSuggestions.entries()) {
      if (suggestion.expiresAt && suggestion.expiresAt < now) {
        this.activeSuggestions.delete(id);
      }
    }

    return Array.from(this.activeSuggestions.values())
      .sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));
  }

  /**
   * Update user preferences for suggestions
   */
  updateUserPreferences(preferences: Record<string, any>): void {
    for (const [key, value] of Object.entries(preferences)) {
      this.userPreferences.set(key, value);
    }
    this.emit('preferencesUpdated', preferences);
  }

  /**
   * Enable or disable proactive suggestions
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.activeSuggestions.clear();
    }
    this.emit('enabledStateChanged', enabled);
  }

  /**
   * Get suggestion statistics for user insights
   */
  getSuggestionStats(): {
    totalGenerated: number;
    acceptanceRate: number;
    dismissalRate: number;
    modificationRate: number;
    topSuggestionTypes: Array<{ type: string; count: number }>;
  } {
    const total = this.suggestionHistory.length;
    const accepted = this.suggestionHistory.filter(s => s.metadata.userFeedback === 'accepted').length;
    const dismissed = this.suggestionHistory.filter(s => s.metadata.userFeedback === 'dismissed').length;
    const modified = this.suggestionHistory.filter(s => s.metadata.userFeedback === 'modified').length;

    const typeCounts = new Map<string, number>();
    for (const suggestion of this.suggestionHistory) {
      const count = typeCounts.get(suggestion.type) || 0;
      typeCounts.set(suggestion.type, count + 1);
    }

    const topTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      totalGenerated: total,
      acceptanceRate: total > 0 ? accepted / total : 0,
      dismissalRate: total > 0 ? dismissed / total : 0,
      modificationRate: total > 0 ? modified / total : 0,
      topSuggestionTypes: topTypes
    };
  }

  private setupPatternEngineListeners(): void {
    this.patternEngine.on('patternDiscovered', (pattern: UserBehaviorPattern) => {
      // Generate suggestions when new patterns are discovered
      if (pattern.confidence >= this.config.minConfidenceThreshold) {
        this.generateSuggestionsFromPattern(pattern);
      }
    });
  }

  private shouldGenerateSuggestions(): boolean {
    // Check if suggestions are enabled
    if (!this.config.enabled) return false;

    // Check cooldown period
    if (this.lastSuggestionTime) {
      const timeSinceLastSuggestion = Date.now() - this.lastSuggestionTime.getTime();
      const cooldownMs = this.config.suggestionCooldown * 60 * 1000;
      if (timeSinceLastSuggestion < cooldownMs) return false;
    }

    // Check quiet hours
    if (this.config.respectQuietHours) {
      const currentHour = new Date().getHours();
      if (this.isQuietHour(currentHour)) return false;
    }

    // Check if we have too many active suggestions
    if (this.activeSuggestions.size >= this.config.maxSuggestions) return false;

    return true;
  }

  private isQuietHour(hour: number): boolean {
    const { quietHoursStart, quietHoursEnd } = this.config;
    
    if (quietHoursStart < quietHoursEnd) {
      return hour >= quietHoursStart && hour < quietHoursEnd;
    } else {
      // Quiet hours span midnight
      return hour >= quietHoursStart || hour < quietHoursEnd;
    }
  }

  private findRelevantPatterns(patterns: UserBehaviorPattern[], context: Record<string, any>): UserBehaviorPattern[] {
    const currentHour = new Date().getHours();
    const timeSlot = this.getTimeSlot(currentHour);

    return patterns.filter(pattern => {
      // Confidence threshold
      if (pattern.confidence < this.config.minConfidenceThreshold) return false;

      // Time relevance
      if (pattern.type === 'temporal' && pattern.context.timeSlot === timeSlot) return true;

      // Context relevance
      const contextMatch = Object.entries(context).some(([key, value]) => {
        return pattern.context[key] === value;
      });

      return contextMatch;
    });
  }

  private async generateRoutineSuggestions(
    patterns: UserBehaviorPattern[],
    context: Record<string, any>
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    const routinePatterns = patterns.filter(p => p.type === 'routine');

    for (const pattern of routinePatterns) {
      const suggestion: ProactiveSuggestion = {
        id: `routine_${pattern.id}_${Date.now()}`,
        type: 'action',
        title: 'Continue Your Routine',
        description: `Based on your usual pattern, would you like me to help with the next step?`,
        confidence: pattern.confidence,
        priority: 'medium',
        context: { ...context, pattern: pattern.id },
        actions: [
          {
            id: 'accept',
            label: 'Yes, help me',
            type: 'primary',
            payload: { action: 'continue_routine', patternId: pattern.id }
          },
          {
            id: 'modify',
            label: 'Modify',
            type: 'secondary',
            payload: { action: 'modify_routine', patternId: pattern.id }
          },
          {
            id: 'dismiss',
            label: 'Not now',
            type: 'dismiss',
            payload: { action: 'dismiss' }
          }
        ],
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        metadata: {
          createdAt: new Date(),
          basedOnPatterns: [pattern.id]
        }
      };

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  private async generateOptimizationSuggestions(
    patterns: UserBehaviorPattern[],
    context: Record<string, any>
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    // Look for inefficient patterns or opportunities for improvement
    const inefficientPatterns = patterns.filter(p => 
      p.type === 'interaction' && p.confidence < 0.8
    );

    for (const pattern of inefficientPatterns) {
      const suggestion: ProactiveSuggestion = {
        id: `optimization_${pattern.id}_${Date.now()}`,
        type: 'optimization',
        title: 'Optimize Your Workflow',
        description: `I noticed you sometimes have trouble with ${pattern.context.interactionType}. Would you like me to suggest improvements?`,
        confidence: 1 - pattern.confidence, // Higher confidence for more problematic patterns
        priority: 'low',
        context: { ...context, pattern: pattern.id },
        actions: [
          {
            id: 'accept',
            label: 'Show suggestions',
            type: 'primary',
            payload: { action: 'show_optimization', patternId: pattern.id }
          },
          {
            id: 'dismiss',
            label: 'No thanks',
            type: 'dismiss',
            payload: { action: 'dismiss' }
          }
        ],
        metadata: {
          createdAt: new Date(),
          basedOnPatterns: [pattern.id]
        }
      };

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  private async generateReminderSuggestions(
    patterns: UserBehaviorPattern[],
    context: Record<string, any>
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    const temporalPatterns = patterns.filter(p => p.type === 'temporal');

    for (const pattern of temporalPatterns) {
      // Check if user usually does something at this time but hasn't today
      const hasPerformedToday = this.hasPerformedActionToday(pattern);
      
      if (!hasPerformedToday && pattern.frequency > 5) {
        const suggestion: ProactiveSuggestion = {
          id: `reminder_${pattern.id}_${Date.now()}`,
          type: 'reminder',
          title: 'Daily Reminder',
          description: `You usually ${pattern.context.commonActions[0]} around this time. Would you like a reminder?`,
          confidence: pattern.confidence,
          priority: 'medium',
          context: { ...context, pattern: pattern.id },
          actions: [
            {
              id: 'accept',
              label: 'Remind me',
              type: 'primary',
              payload: { action: 'set_reminder', patternId: pattern.id }
            },
            {
              id: 'done',
              label: 'Already done',
              type: 'secondary',
              payload: { action: 'mark_done', patternId: pattern.id }
            },
            {
              id: 'dismiss',
              label: 'Skip today',
              type: 'dismiss',
              payload: { action: 'dismiss' }
            }
          ],
          metadata: {
            createdAt: new Date(),
            basedOnPatterns: [pattern.id]
          }
        };

        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  private async generateAssistanceSuggestions(
    patterns: UserBehaviorPattern[],
    context: Record<string, any>
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    // Generate assistance based on user preferences and context
    const preferencePatterns = patterns.filter(p => p.type === 'preference');

    for (const pattern of preferencePatterns) {
      if (this.shouldOfferAssistance(pattern, context)) {
        const suggestion: ProactiveSuggestion = {
          id: `assistance_${pattern.id}_${Date.now()}`,
          type: 'assistance',
          title: 'Let Me Help',
          description: `Based on your preferences, I can help set up ${pattern.context.preference} for you.`,
          confidence: pattern.confidence,
          priority: 'low',
          context: { ...context, pattern: pattern.id },
          actions: [
            {
              id: 'accept',
              label: 'Yes, please',
              type: 'primary',
              payload: { action: 'provide_assistance', patternId: pattern.id }
            },
            {
              id: 'later',
              label: 'Maybe later',
              type: 'secondary',
              payload: { action: 'remind_later', patternId: pattern.id }
            },
            {
              id: 'dismiss',
              label: 'No thanks',
              type: 'dismiss',
              payload: { action: 'dismiss' }
            }
          ],
          metadata: {
            createdAt: new Date(),
            basedOnPatterns: [pattern.id]
          }
        };

        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  private filterAndRankSuggestions(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
    // Remove duplicates and low-confidence suggestions
    const filtered = suggestions.filter(s => 
      s.confidence >= this.config.minConfidenceThreshold &&
      !this.isDuplicateSuggestion(s)
    );

    // Sort by priority and confidence
    filtered.sort((a, b) => {
      const priorityDiff = this.getPriorityScore(b) - this.getPriorityScore(a);
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    // Limit to max suggestions
    return filtered.slice(0, this.config.maxSuggestions);
  }

  private getPriorityScore(suggestion: ProactiveSuggestion): number {
    const priorityScores = { high: 3, medium: 2, low: 1 };
    return priorityScores[suggestion.priority];
  }

  private isDuplicateSuggestion(suggestion: ProactiveSuggestion): boolean {
    // Check if we already have a similar active suggestion
    for (const active of this.activeSuggestions.values()) {
      if (active.type === suggestion.type && 
          active.metadata.basedOnPatterns.some(p => 
            suggestion.metadata.basedOnPatterns.includes(p)
          )) {
        return true;
      }
    }
    return false;
  }

  private async learnFromModifications(
    suggestion: ProactiveSuggestion,
    modifications: Record<string, any>
  ): Promise<void> {
    // Store user modifications to improve future suggestions
    const modificationPattern = {
      suggestionType: suggestion.type,
      originalContext: suggestion.context,
      modifications,
      timestamp: new Date()
    };

    // This could be stored and used to improve future suggestion generation
    this.emit('modificationLearned', modificationPattern);
  }

  private async generateSuggestionsFromPattern(pattern: UserBehaviorPattern): Promise<void> {
    // Generate immediate suggestions when new high-confidence patterns are discovered
    if (this.shouldGenerateSuggestions()) {
      const context = { newPattern: true };
      const suggestions = await this.generateSuggestions(context);
      
      if (suggestions.length > 0) {
        this.emit('immediatesuggestion', suggestions[0]);
      }
    }
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private hasPerformedActionToday(pattern: UserBehaviorPattern): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return pattern.lastSeen >= today;
  }

  private shouldOfferAssistance(pattern: UserBehaviorPattern, context: Record<string, any>): boolean {
    // Check user preferences for assistance offers
    const assistancePreference = this.userPreferences.get('proactive_assistance');
    if (assistancePreference === false) return false;

    // Check if context suggests user might need help
    const contextIndicatesNeed = context.struggling || context.repeated_attempts || context.error_occurred;
    
    return contextIndicatesNeed || pattern.confidence > 0.9;
  }
}