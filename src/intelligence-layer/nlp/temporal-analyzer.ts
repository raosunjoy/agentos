/**
 * Temporal Analyzer - Analyzes and manages temporal context
 * 
 * Handles time-based context understanding, routine pattern detection,
 * and temporal event management.
 */

import {
  TemporalContext,
  RecentEvent,
  UpcomingEvent,
  RoutinePattern
} from './context-types';

export class TemporalAnalyzer {
  private routinePatterns: Map<string, RoutinePattern[]> = new Map();
  private eventHistory: Map<string, RecentEvent[]> = new Map();

  /**
   * Create initial temporal context
   */
  createInitialTemporalContext(): TemporalContext {
    const now = new Date();
    
    return {
      currentTime: now,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      timeOfDay: this.getTimeOfDay(now),
      recentEvents: [],
      upcomingEvents: [],
      routinePatterns: []
    };
  }

  /**
   * Update temporal context with current time and events
   */
  async updateTemporalContext(
    existing: TemporalContext,
    timestamp: Date
  ): Promise<TemporalContext> {
    const updated: TemporalContext = {
      ...existing,
      currentTime: timestamp,
      dayOfWeek: timestamp.getDay(),
      isWeekend: timestamp.getDay() === 0 || timestamp.getDay() === 6,
      timeOfDay: this.getTimeOfDay(timestamp)
    };

    // Update recent events (keep last 24 hours)
    const oneDayAgo = new Date(timestamp.getTime() - 24 * 60 * 60 * 1000);
    updated.recentEvents = updated.recentEvents.filter(
      event => event.timestamp > oneDayAgo
    );

    // Update upcoming events (remove past events)
    updated.upcomingEvents = updated.upcomingEvents.filter(
      event => event.scheduledTime > timestamp
    );

    // Update routine patterns
    updated.routinePatterns = await this.updateRoutinePatterns(
      updated.routinePatterns,
      timestamp
    );

    return updated;
  }

  /**
   * Add recent event to temporal context
   */
  addRecentEvent(userId: string, event: Omit<RecentEvent, 'id'>): RecentEvent {
    const recentEvent: RecentEvent = {
      ...event,
      id: this.generateEventId()
    };

    let userEvents = this.eventHistory.get(userId) || [];
    userEvents.push(recentEvent);

    // Keep only last 50 events
    if (userEvents.length > 50) {
      userEvents = userEvents.slice(-50);
    }

    this.eventHistory.set(userId, userEvents);
    return recentEvent;
  }

  /**
   * Add upcoming event
   */
  addUpcomingEvent(event: Omit<UpcomingEvent, 'id'>): UpcomingEvent {
    return {
      ...event,
      id: this.generateEventId()
    };
  }

  /**
   * Detect routine patterns from event history
   */
  async detectRoutinePatterns(userId: string): Promise<RoutinePattern[]> {
    const events = this.eventHistory.get(userId) || [];
    const patterns: RoutinePattern[] = [];

    // Group events by type and time patterns
    const eventGroups = this.groupEventsByPattern(events);

    for (const [pattern, groupEvents] of eventGroups.entries()) {
      if (groupEvents.length >= 3) { // Need at least 3 occurrences
        const confidence = this.calculatePatternConfidence(groupEvents);
        
        if (confidence > 0.6) {
          patterns.push({
            id: this.generatePatternId(),
            name: this.generatePatternName(pattern, groupEvents),
            timePattern: pattern,
            actions: this.extractActionsFromEvents(groupEvents),
            confidence,
            lastOccurrence: groupEvents[groupEvents.length - 1].timestamp,
            isActive: true
          });
        }
      }
    }

    this.routinePatterns.set(userId, patterns);
    return patterns;
  }

  /**
   * Get contextual time description
   */
  getContextualTimeDescription(timestamp: Date): string {
    const now = new Date();
    const diffMs = timestamp.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (Math.abs(diffMinutes) < 5) {
      return 'now';
    } else if (Math.abs(diffMinutes) < 60) {
      return diffMinutes > 0 ? `in ${diffMinutes} minutes` : `${Math.abs(diffMinutes)} minutes ago`;
    } else if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `in ${diffHours} hours` : `${Math.abs(diffHours)} hours ago`;
    } else if (Math.abs(diffDays) < 7) {
      return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }

  /**
   * Check if current time matches routine pattern
   */
  isRoutineTime(patterns: RoutinePattern[], currentTime: Date): RoutinePattern | null {
    for (const pattern of patterns) {
      if (pattern.isActive && this.matchesTimePattern(pattern.timePattern, currentTime)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Get time of day category
   */
  private getTimeOfDay(date: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = date.getHours();
    
    if (hour >= 5 && hour < 12) {
      return 'morning';
    } else if (hour >= 12 && hour < 17) {
      return 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      return 'evening';
    } else {
      return 'night';
    }
  }

  /**
   * Update routine patterns based on recent activity
   */
  private async updateRoutinePatterns(
    patterns: RoutinePattern[],
    timestamp: Date
  ): Promise<RoutinePattern[]> {
    return patterns.map(pattern => {
      // Check if pattern should still be active
      const daysSinceLastOccurrence = pattern.lastOccurrence
        ? (timestamp.getTime() - pattern.lastOccurrence.getTime()) / (1000 * 60 * 60 * 24)
        : 0;

      // Deactivate patterns that haven't occurred in 14 days
      if (daysSinceLastOccurrence > 14) {
        pattern.isActive = false;
        pattern.confidence = Math.max(pattern.confidence - 0.1, 0);
      }

      return pattern;
    });
  }

  /**
   * Group events by time patterns
   */
  private groupEventsByPattern(events: RecentEvent[]): Map<string, RecentEvent[]> {
    const groups = new Map<string, RecentEvent[]>();

    for (const event of events) {
      const pattern = this.extractTimePattern(event);
      
      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      
      groups.get(pattern)!.push(event);
    }

    return groups;
  }

  /**
   * Extract time pattern from event
   */
  private extractTimePattern(event: RecentEvent): string {
    const date = event.timestamp;
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    
    // Create pattern like "weekday-morning" or "weekend-evening"
    const dayType = dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'weekday';
    const timeOfDay = this.getTimeOfDay(date);
    
    return `${dayType}-${timeOfDay}-${event.type}`;
  }

  /**
   * Calculate confidence score for pattern
   */
  private calculatePatternConfidence(events: RecentEvent[]): number {
    if (events.length < 2) return 0;

    // Calculate consistency in timing
    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const interval = events[i].timestamp.getTime() - events[i - 1].timestamp.getTime();
      intervals.push(interval);
    }

    // Calculate variance in intervals
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower variance = higher confidence
    const consistencyScore = Math.max(0, 1 - (standardDeviation / avgInterval));
    
    // Factor in frequency (more occurrences = higher confidence)
    const frequencyScore = Math.min(events.length / 10, 1);

    return (consistencyScore * 0.7) + (frequencyScore * 0.3);
  }

  /**
   * Generate pattern name from events
   */
  private generatePatternName(pattern: string, events: RecentEvent[]): string {
    const [dayType, timeOfDay, eventType] = pattern.split('-');
    return `${eventType} on ${dayType} ${timeOfDay}`;
  }

  /**
   * Extract actions from events
   */
  private extractActionsFromEvents(events: RecentEvent[]): string[] {
    const actions = new Set<string>();
    
    for (const event of events) {
      actions.add(event.description);
    }

    return Array.from(actions);
  }

  /**
   * Check if current time matches pattern
   */
  private matchesTimePattern(pattern: string, currentTime: Date): boolean {
    const [dayType, timeOfDay, eventType] = pattern.split('-');
    
    const currentDayType = (currentTime.getDay() === 0 || currentTime.getDay() === 6) ? 'weekend' : 'weekday';
    const currentTimeOfDay = this.getTimeOfDay(currentTime);

    return dayType === currentDayType && timeOfDay === currentTimeOfDay;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique pattern ID
   */
  private generatePatternId(): string {
    return `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}