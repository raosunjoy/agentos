/**
 * On-device pattern recognition system for behavior analysis
 * Implements privacy-preserving pattern detection algorithms
 */

import { EventEmitter } from 'events';

export interface UserBehaviorPattern {
  id: string;
  type: 'routine' | 'preference' | 'interaction' | 'temporal';
  confidence: number;
  frequency: number;
  lastSeen: Date;
  context: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    occurrences: number;
  };
}

export interface BehaviorEvent {
  timestamp: Date;
  type: string;
  context: Record<string, any>;
  userId?: string;
}

export interface PatternRecognitionConfig {
  minConfidence: number;
  minOccurrences: number;
  maxPatterns: number;
  learningRate: number;
  privacyMode: 'strict' | 'balanced' | 'permissive';
}

export class PatternRecognitionEngine extends EventEmitter {
  private patterns: Map<string, UserBehaviorPattern> = new Map();
  private eventHistory: BehaviorEvent[] = [];
  private config: PatternRecognitionConfig;
  private isLearning: boolean = true;

  constructor(config: Partial<PatternRecognitionConfig> = {}) {
    super();
    this.config = {
      minConfidence: 0.7,
      minOccurrences: 3,
      maxPatterns: 100,
      learningRate: 0.1,
      privacyMode: 'balanced',
      ...config
    };
  }

  /**
   * Process a new behavior event and update patterns
   */
  async processEvent(event: BehaviorEvent): Promise<void> {
    if (!this.isLearning) return;

    // Add to event history with privacy filtering
    const filteredEvent = this.applyPrivacyFilter(event);
    this.eventHistory.push(filteredEvent);

    // Limit history size for privacy and performance
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-800);
    }

    // Analyze for new patterns
    await this.analyzePatterns();
  }

  /**
   * Get recognized patterns with optional filtering
   */
  getPatterns(filter?: Partial<UserBehaviorPattern>): UserBehaviorPattern[] {
    let patterns = Array.from(this.patterns.values());

    if (filter) {
      patterns = patterns.filter(pattern => {
        return Object.entries(filter).every(([key, value]) => {
          return pattern[key as keyof UserBehaviorPattern] === value;
        });
      });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get suggestions based on current context
   */
  async getSuggestions(context: Record<string, any>): Promise<string[]> {
    const relevantPatterns = this.findRelevantPatterns(context);
    const suggestions: string[] = [];

    for (const pattern of relevantPatterns) {
      if (pattern.confidence >= this.config.minConfidence) {
        const suggestion = this.generateSuggestion(pattern, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Update pattern based on user feedback
   */
  async updatePatternFeedback(patternId: string, feedback: 'positive' | 'negative' | 'neutral'): Promise<void> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    // Adjust confidence based on feedback
    switch (feedback) {
      case 'positive':
        pattern.confidence = Math.min(1.0, pattern.confidence + this.config.learningRate);
        break;
      case 'negative':
        pattern.confidence = Math.max(0.0, pattern.confidence - this.config.learningRate * 2);
        break;
      case 'neutral':
        // Slight decrease for neutral feedback
        pattern.confidence = Math.max(0.0, pattern.confidence - this.config.learningRate * 0.5);
        break;
    }

    pattern.metadata.updatedAt = new Date();

    // Remove patterns with very low confidence
    if (pattern.confidence < 0.2) {
      this.patterns.delete(patternId);
      this.emit('patternRemoved', patternId);
    } else {
      this.emit('patternUpdated', pattern);
    }
  }

  /**
   * Enable or disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.isLearning = enabled;
    this.emit('learningStateChanged', enabled);
  }

  /**
   * Clear all patterns and history (privacy compliance)
   */
  clearAllData(): void {
    this.patterns.clear();
    this.eventHistory = [];
    this.emit('dataCleared');
  }

  /**
   * Export patterns for backup (anonymized)
   */
  exportPatterns(): any {
    return {
      patterns: Array.from(this.patterns.values()).map(p => ({
        ...p,
        context: this.anonymizeContext(p.context)
      })),
      config: this.config,
      exportedAt: new Date().toISOString()
    };
  }

  private async analyzePatterns(): Promise<void> {
    // Temporal pattern analysis
    await this.analyzeTemporalPatterns();
    
    // Routine pattern analysis
    await this.analyzeRoutinePatterns();
    
    // Interaction pattern analysis
    await this.analyzeInteractionPatterns();
    
    // Preference pattern analysis
    await this.analyzePreferencePatterns();
  }

  private async analyzeTemporalPatterns(): Promise<void> {
    const timeGroups = this.groupEventsByTime();
    
    for (const [timeSlot, events] of timeGroups.entries()) {
      if (events.length >= this.config.minOccurrences) {
        const patternId = `temporal_${timeSlot}`;
        const existing = this.patterns.get(patternId);
        
        if (existing) {
          existing.frequency = events.length;
          existing.confidence = Math.min(1.0, existing.confidence + 0.05);
          existing.lastSeen = new Date();
          existing.metadata.occurrences++;
        } else if (this.patterns.size < this.config.maxPatterns) {
          this.patterns.set(patternId, {
            id: patternId,
            type: 'temporal',
            confidence: 0.6,
            frequency: events.length,
            lastSeen: new Date(),
            context: { timeSlot, commonActions: this.extractCommonActions(events) },
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              occurrences: 1
            }
          });
          this.emit('patternDiscovered', this.patterns.get(patternId));
        }
      }
    }
  }

  private async analyzeRoutinePatterns(): Promise<void> {
    const sequences = this.findActionSequences();
    
    for (const sequence of sequences) {
      if (sequence.occurrences >= this.config.minOccurrences) {
        const patternId = `routine_${sequence.hash}`;
        const existing = this.patterns.get(patternId);
        
        if (existing) {
          existing.frequency = sequence.occurrences;
          existing.confidence = Math.min(1.0, existing.confidence + 0.03);
          existing.lastSeen = new Date();
          existing.metadata.occurrences++;
        } else if (this.patterns.size < this.config.maxPatterns) {
          this.patterns.set(patternId, {
            id: patternId,
            type: 'routine',
            confidence: 0.5,
            frequency: sequence.occurrences,
            lastSeen: new Date(),
            context: { sequence: sequence.actions, duration: sequence.avgDuration },
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              occurrences: 1
            }
          });
          this.emit('patternDiscovered', this.patterns.get(patternId));
        }
      }
    }
  }

  private async analyzeInteractionPatterns(): Promise<void> {
    const interactions = this.groupEventsByType();
    
    for (const [type, events] of interactions.entries()) {
      if (events.length >= this.config.minOccurrences) {
        const patternId = `interaction_${type}`;
        const existing = this.patterns.get(patternId);
        
        const avgSuccessRate = this.calculateSuccessRate(events);
        
        if (existing) {
          existing.frequency = events.length;
          existing.confidence = avgSuccessRate;
          existing.lastSeen = new Date();
          existing.metadata.occurrences++;
        } else if (this.patterns.size < this.config.maxPatterns) {
          this.patterns.set(patternId, {
            id: patternId,
            type: 'interaction',
            confidence: avgSuccessRate,
            frequency: events.length,
            lastSeen: new Date(),
            context: { interactionType: type, commonContexts: this.extractCommonContexts(events) },
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              occurrences: 1
            }
          });
          this.emit('patternDiscovered', this.patterns.get(patternId));
        }
      }
    }
  }

  private async analyzePreferencePatterns(): Promise<void> {
    const preferences = this.extractPreferences();
    
    for (const [preference, data] of preferences.entries()) {
      if (data.occurrences >= this.config.minOccurrences) {
        const patternId = `preference_${preference}`;
        const existing = this.patterns.get(patternId);
        
        if (existing) {
          existing.frequency = data.occurrences;
          existing.confidence = Math.min(1.0, data.strength);
          existing.lastSeen = new Date();
          existing.metadata.occurrences++;
        } else if (this.patterns.size < this.config.maxPatterns) {
          this.patterns.set(patternId, {
            id: patternId,
            type: 'preference',
            confidence: data.strength,
            frequency: data.occurrences,
            lastSeen: new Date(),
            context: { preference, values: data.values },
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              occurrences: 1
            }
          });
          this.emit('patternDiscovered', this.patterns.get(patternId));
        }
      }
    }
  }

  private applyPrivacyFilter(event: BehaviorEvent): BehaviorEvent {
    const filtered = { ...event };
    
    if (this.config.privacyMode === 'strict') {
      // Remove all potentially identifying information
      filtered.context = this.anonymizeContext(filtered.context);
      delete filtered.userId;
    } else if (this.config.privacyMode === 'balanced') {
      // Keep some context but anonymize sensitive data
      filtered.context = this.partiallyAnonymizeContext(filtered.context);
    }
    
    return filtered;
  }

  private anonymizeContext(context: Record<string, any>): Record<string, any> {
    const anonymized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (this.isSensitiveField(key)) {
        anonymized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && this.containsPII(value)) {
        anonymized[key] = '[REDACTED]';
      } else {
        anonymized[key] = value;
      }
    }
    
    return anonymized;
  }

  private partiallyAnonymizeContext(context: Record<string, any>): Record<string, any> {
    const filtered: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (this.isSensitiveField(key)) {
        continue; // Skip sensitive fields
      } else if (typeof value === 'string' && this.containsPII(value)) {
        filtered[key] = this.hashValue(value);
      } else {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }

  private isSensitiveField(field: string): boolean {
    const sensitiveFields = ['name', 'email', 'phone', 'address', 'location', 'contact'];
    return sensitiveFields.some(sensitive => field.toLowerCase().includes(sensitive));
  }

  private containsPII(value: string): boolean {
    // Simple PII detection patterns
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    ];
    
    return piiPatterns.some(pattern => pattern.test(value));
  }

  private hashValue(value: string): string {
    // Simple hash for anonymization (in production, use crypto)
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }

  private groupEventsByTime(): Map<string, BehaviorEvent[]> {
    const groups = new Map<string, BehaviorEvent[]>();
    
    for (const event of this.eventHistory) {
      const hour = event.timestamp.getHours();
      const timeSlot = this.getTimeSlot(hour);
      
      if (!groups.has(timeSlot)) {
        groups.set(timeSlot, []);
      }
      groups.get(timeSlot)!.push(event);
    }
    
    return groups;
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private groupEventsByType(): Map<string, BehaviorEvent[]> {
    const groups = new Map<string, BehaviorEvent[]>();
    
    for (const event of this.eventHistory) {
      if (!groups.has(event.type)) {
        groups.set(event.type, []);
      }
      groups.get(event.type)!.push(event);
    }
    
    return groups;
  }

  private extractCommonActions(events: BehaviorEvent[]): string[] {
    const actionCounts = new Map<string, number>();
    
    for (const event of events) {
      const count = actionCounts.get(event.type) || 0;
      actionCounts.set(event.type, count + 1);
    }
    
    return Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([action]) => action);
  }

  private extractCommonContexts(events: BehaviorEvent[]): Record<string, any> {
    const contexts: Record<string, any> = {};
    
    for (const event of events) {
      for (const [key, value] of Object.entries(event.context)) {
        if (!contexts[key]) {
          contexts[key] = new Map();
        }
        const count = contexts[key].get(value) || 0;
        contexts[key].set(value, count + 1);
      }
    }
    
    // Return most common values for each context key
    const result: Record<string, any> = {};
    for (const [key, valueMap] of Object.entries(contexts)) {
      const sorted = Array.from(valueMap.entries()).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        result[key] = sorted[0][0];
      }
    }
    
    return result;
  }

  private findActionSequences(): Array<{ actions: string[], occurrences: number, avgDuration: number, hash: string }> {
    const sequences: Map<string, { actions: string[], occurrences: number, durations: number[] }> = new Map();
    
    // Look for sequences of 2-4 actions
    for (let seqLength = 2; seqLength <= 4; seqLength++) {
      for (let i = 0; i <= this.eventHistory.length - seqLength; i++) {
        const sequence = this.eventHistory.slice(i, i + seqLength);
        const actions = sequence.map(e => e.type);
        const hash = actions.join('->');
        
        const duration = sequence[sequence.length - 1].timestamp.getTime() - sequence[0].timestamp.getTime();
        
        if (!sequences.has(hash)) {
          sequences.set(hash, { actions, occurrences: 0, durations: [] });
        }
        
        const seq = sequences.get(hash)!;
        seq.occurrences++;
        seq.durations.push(duration);
      }
    }
    
    return Array.from(sequences.entries()).map(([hash, data]) => ({
      hash,
      actions: data.actions,
      occurrences: data.occurrences,
      avgDuration: data.durations.reduce((a, b) => a + b, 0) / data.durations.length
    }));
  }

  private calculateSuccessRate(events: BehaviorEvent[]): number {
    const successEvents = events.filter(e => e.context.success !== false);
    return successEvents.length / events.length;
  }

  private extractPreferences(): Map<string, { occurrences: number, strength: number, values: any[] }> {
    const preferences = new Map<string, { occurrences: number, strength: number, values: any[] }>();
    
    for (const event of this.eventHistory) {
      for (const [key, value] of Object.entries(event.context)) {
        if (key.includes('preference') || key.includes('choice') || key.includes('setting')) {
          if (!preferences.has(key)) {
            preferences.set(key, { occurrences: 0, strength: 0, values: [] });
          }
          
          const pref = preferences.get(key)!;
          pref.occurrences++;
          pref.values.push(value);
          
          // Calculate preference strength based on consistency
          const uniqueValues = new Set(pref.values);
          pref.strength = 1 - (uniqueValues.size / pref.values.length);
        }
      }
    }
    
    return preferences;
  }

  private findRelevantPatterns(context: Record<string, any>): UserBehaviorPattern[] {
    const currentHour = new Date().getHours();
    const currentTimeSlot = this.getTimeSlot(currentHour);
    
    return Array.from(this.patterns.values()).filter(pattern => {
      // Time-based relevance
      if (pattern.type === 'temporal' && pattern.context.timeSlot === currentTimeSlot) {
        return true;
      }
      
      // Context-based relevance
      const contextMatch = Object.entries(context).some(([key, value]) => {
        return pattern.context[key] === value;
      });
      
      return contextMatch;
    });
  }

  private generateSuggestion(pattern: UserBehaviorPattern, context: Record<string, any>): string | null {
    switch (pattern.type) {
      case 'temporal':
        return `Based on your usual ${pattern.context.timeSlot} routine, would you like me to ${pattern.context.commonActions[0]}?`;
      
      case 'routine':
        return `I notice you often do this sequence. Would you like me to help with the next step?`;
      
      case 'interaction':
        return `You frequently use ${pattern.context.interactionType}. Would you like me to set that up?`;
      
      case 'preference':
        return `Based on your preferences, I suggest using ${pattern.context.values[0]}.`;
      
      default:
        return null;
    }
  }
}