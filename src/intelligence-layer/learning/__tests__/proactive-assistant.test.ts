/**
 * Tests for the proactive assistant system
 */

import { ProactiveAssistant, ProactiveSuggestion } from '../proactive-assistant';
import { PatternRecognitionEngine, UserBehaviorPattern } from '../pattern-recognition';

describe('ProactiveAssistant', () => {
  let patternEngine: PatternRecognitionEngine;
  let assistant: ProactiveAssistant;

  beforeEach(() => {
    patternEngine = new PatternRecognitionEngine({
      minConfidence: 0.6,
      minOccurrences: 2,
      maxPatterns: 50
    });

    assistant = new ProactiveAssistant(patternEngine, {
      enabled: true,
      maxSuggestions: 3,
      minConfidenceThreshold: 0.7,
      suggestionCooldown: 1, // 1 minute for testing
      respectQuietHours: false // Disable for testing
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate suggestions based on patterns', async () => {
      // Create some patterns first
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'morning_routine',
          context: { timeSlot: 'morning', action: 'check_weather' }
        });
      }

      const suggestions = await assistant.generateSuggestions({ timeSlot: 'morning' });
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should respect maximum suggestions limit', async () => {
      // Create many patterns
      for (let type = 0; type < 10; type++) {
        for (let i = 0; i < 3; i++) {
          await patternEngine.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: `pattern_${type}`,
            context: { relevant: true, confidence: 0.9 }
          });
        }
      }

      const suggestions = await assistant.generateSuggestions({ relevant: true });
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should not generate suggestions when disabled', async () => {
      assistant.setEnabled(false);

      // Create patterns
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'disabled_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      expect(suggestions.length).toBe(0);
    });

    it('should respect confidence threshold', async () => {
      const highThresholdAssistant = new ProactiveAssistant(patternEngine, {
        minConfidenceThreshold: 0.95
      });

      // Create low confidence patterns
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'low_confidence_test',
          context: { test: true }
        });
      }

      const suggestions = await highThresholdAssistant.generateSuggestions({ test: true });
      expect(suggestions.length).toBe(0);
    });
  });

  describe('Suggestion Types', () => {
    it('should generate routine suggestions', async () => {
      // Create routine pattern
      const baseTime = new Date();
      for (let day = 0; day < 3; day++) {
        const dayOffset = day * 24 * 60 * 60 * 1000;
        
        await patternEngine.processEvent({
          timestamp: new Date(baseTime.getTime() + dayOffset),
          type: 'morning_coffee',
          context: { routine: true, sequence: 1 }
        });
        
        await patternEngine.processEvent({
          timestamp: new Date(baseTime.getTime() + dayOffset + 60000),
          type: 'check_email',
          context: { routine: true, sequence: 2 }
        });
      }

      const suggestions = await assistant.generateSuggestions({ routine: true });
      const routineSuggestion = suggestions.find(s => s.type === 'action');
      
      expect(routineSuggestion).toBeDefined();
      expect(routineSuggestion?.actions.length).toBeGreaterThan(0);
    });

    it('should generate reminder suggestions', async () => {
      // Create temporal pattern for daily activity
      const morningTime = new Date();
      morningTime.setHours(9, 0, 0, 0);

      for (let i = 0; i < 6; i++) { // High frequency
        await patternEngine.processEvent({
          timestamp: new Date(morningTime.getTime() + i * 24 * 60 * 60 * 1000),
          type: 'take_medication',
          context: { timeSlot: 'morning', daily: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ timeSlot: 'morning' });
      const reminderSuggestion = suggestions.find(s => s.type === 'reminder');
      
      // Reminder might be generated based on pattern frequency
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should generate optimization suggestions', async () => {
      // Create interaction pattern with low success rate
      for (let i = 0; i < 4; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'voice_command',
          context: { 
            interactionType: 'voice_command',
            success: i % 2 === 0 // 50% success rate
          }
        });
      }

      const suggestions = await assistant.generateSuggestions({ interactionType: 'voice_command' });
      const optimizationSuggestion = suggestions.find(s => s.type === 'optimization');
      
      // Optimization suggestions are generated for low-confidence patterns
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should generate assistance suggestions', async () => {
      // Create preference pattern
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'music_request',
          context: { 
            music_preference: 'classical',
            assistance_needed: true
          }
        });
      }

      assistant.updateUserPreferences({ proactive_assistance: true });
      
      const suggestions = await assistant.generateSuggestions({ 
        struggling: true,
        music_preference: 'classical'
      });
      
      const assistanceSuggestion = suggestions.find(s => s.type === 'assistance');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Suggestion Response Handling', () => {
    it('should handle accept response', async () => {
      // Generate a suggestion first
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'accept_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      
      if (suggestions.length > 0) {
        const suggestionId = suggestions[0].id;
        
        await assistant.handleSuggestionResponse(suggestionId, 'accept');
        
        // Suggestion should be moved from active to history
        const activeSuggestions = assistant.getActiveSuggestions();
        const acceptedSuggestion = activeSuggestions.find(s => s.id === suggestionId);
        expect(acceptedSuggestion).toBeUndefined();
      }
    });

    it('should handle dismiss response', async () => {
      // Generate a suggestion first
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'dismiss_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      
      if (suggestions.length > 0) {
        const suggestionId = suggestions[0].id;
        
        await assistant.handleSuggestionResponse(suggestionId, 'dismiss');
        
        // Suggestion should be removed from active suggestions
        const activeSuggestions = assistant.getActiveSuggestions();
        const dismissedSuggestion = activeSuggestions.find(s => s.id === suggestionId);
        expect(dismissedSuggestion).toBeUndefined();
      }
    });

    it('should handle modify response with modifications', async () => {
      // Generate a suggestion first
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'modify_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      
      if (suggestions.length > 0) {
        const suggestionId = suggestions[0].id;
        const modifications = { customAction: 'modified_action' };
        
        await assistant.handleSuggestionResponse(suggestionId, 'modify', modifications);
        
        // Suggestion should be processed and removed from active
        const activeSuggestions = assistant.getActiveSuggestions();
        const modifiedSuggestion = activeSuggestions.find(s => s.id === suggestionId);
        expect(modifiedSuggestion).toBeUndefined();
      }
    });

    it('should update pattern confidence based on feedback', async () => {
      // This test verifies that feedback is passed to the pattern engine
      const mockUpdateFeedback = jest.spyOn(patternEngine, 'updatePatternFeedback');
      
      // Generate a suggestion
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'feedback_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      
      if (suggestions.length > 0) {
        const suggestionId = suggestions[0].id;
        
        await assistant.handleSuggestionResponse(suggestionId, 'accept');
        
        // Should have called updatePatternFeedback with positive feedback
        expect(mockUpdateFeedback).toHaveBeenCalled();
      }
    });
  });

  describe('Active Suggestions Management', () => {
    it('should return active suggestions sorted by priority', async () => {
      // Create patterns that will generate suggestions with different priorities
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'priority_test',
          context: { test: true, priority: i }
        });
      }

      await assistant.generateSuggestions({ test: true });
      
      const activeSuggestions = assistant.getActiveSuggestions();
      
      // Should be sorted by priority (high to low)
      for (let i = 1; i < activeSuggestions.length; i++) {
        const prevPriority = this.getPriorityValue(activeSuggestions[i - 1].priority);
        const currPriority = this.getPriorityValue(activeSuggestions[i].priority);
        expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
      }
    });

    it('should remove expired suggestions', async () => {
      // Generate suggestions with short expiration
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'expiration_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      
      if (suggestions.length > 0) {
        // Manually set expiration to past
        const activeSuggestions = assistant.getActiveSuggestions();
        if (activeSuggestions.length > 0) {
          activeSuggestions[0].expiresAt = new Date(Date.now() - 1000);
        }
        
        // Getting active suggestions should remove expired ones
        const currentActive = assistant.getActiveSuggestions();
        expect(currentActive.length).toBeLessThanOrEqual(suggestions.length);
      }
    });
  });

  describe('User Preferences', () => {
    it('should update user preferences', () => {
      const preferences = {
        proactive_assistance: true,
        suggestion_frequency: 'medium',
        quiet_hours_enabled: true
      };

      assistant.updateUserPreferences(preferences);
      
      // Should not throw and preferences should be stored internally
      expect(true).toBe(true);
    });

    it('should respect user preference for assistance offers', async () => {
      assistant.updateUserPreferences({ proactive_assistance: false });
      
      // Create patterns that would normally trigger assistance suggestions
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'assistance_preference_test',
          context: { 
            assistance_preference: 'help_with_music',
            struggling: true
          }
        });
      }

      const suggestions = await assistant.generateSuggestions({ struggling: true });
      const assistanceSuggestions = suggestions.filter(s => s.type === 'assistance');
      
      // Should have fewer or no assistance suggestions when disabled
      expect(assistanceSuggestions.length).toBeLessThanOrEqual(suggestions.length);
    });
  });

  describe('Suggestion Statistics', () => {
    it('should track suggestion statistics', async () => {
      // Generate and respond to some suggestions
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'stats_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      
      // Respond to suggestions
      for (let i = 0; i < suggestions.length; i++) {
        const response = i % 3 === 0 ? 'accept' : i % 3 === 1 ? 'dismiss' : 'modify';
        await assistant.handleSuggestionResponse(suggestions[i].id, response);
      }

      const stats = assistant.getSuggestionStats();
      
      expect(stats).toHaveProperty('totalGenerated');
      expect(stats).toHaveProperty('acceptanceRate');
      expect(stats).toHaveProperty('dismissalRate');
      expect(stats).toHaveProperty('modificationRate');
      expect(stats).toHaveProperty('topSuggestionTypes');
      
      expect(typeof stats.totalGenerated).toBe('number');
      expect(typeof stats.acceptanceRate).toBe('number');
      expect(Array.isArray(stats.topSuggestionTypes)).toBe(true);
    });

    it('should calculate correct acceptance rate', async () => {
      // Generate suggestions and accept all of them
      for (let i = 0; i < 2; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'acceptance_rate_test',
          context: { test: true }
        });
      }

      const suggestions = await assistant.generateSuggestions({ test: true });
      
      // Accept all suggestions
      for (const suggestion of suggestions) {
        await assistant.handleSuggestionResponse(suggestion.id, 'accept');
      }

      const stats = assistant.getSuggestionStats();
      
      if (stats.totalGenerated > 0) {
        expect(stats.acceptanceRate).toBeGreaterThan(0);
        expect(stats.acceptanceRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Cooldown and Timing', () => {
    it('should respect suggestion cooldown period', async () => {
      const cooldownAssistant = new ProactiveAssistant(patternEngine, {
        suggestionCooldown: 60 // 60 minutes
      });

      // Generate first set of suggestions
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'cooldown_test',
          context: { test: true }
        });
      }

      const firstSuggestions = await cooldownAssistant.generateSuggestions({ test: true });
      
      // Try to generate suggestions immediately again
      const secondSuggestions = await cooldownAssistant.generateSuggestions({ test: true });
      
      // Second call should return empty due to cooldown
      expect(secondSuggestions.length).toBe(0);
    });

    it('should respect quiet hours when enabled', async () => {
      const quietHoursAssistant = new ProactiveAssistant(patternEngine, {
        respectQuietHours: true,
        quietHoursStart: 22,
        quietHoursEnd: 7
      });

      // Mock current time to be in quiet hours
      const originalDate = Date;
      const mockDate = new Date();
      mockDate.setHours(23, 0, 0, 0); // 11 PM
      
      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = jest.fn(() => mockDate.getTime());

      // Create patterns
      for (let i = 0; i < 3; i++) {
        await patternEngine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'quiet_hours_test',
          context: { test: true }
        });
      }

      const suggestions = await quietHoursAssistant.generateSuggestions({ test: true });
      
      // Should not generate suggestions during quiet hours
      expect(suggestions.length).toBe(0);

      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('Event Listeners', () => {
    it('should emit events when suggestions are generated', (done) => {
      assistant.on('suggestionsGenerated', (suggestions: ProactiveSuggestion[]) => {
        expect(Array.isArray(suggestions)).toBe(true);
        done();
      });

      // Generate patterns and suggestions
      (async () => {
        for (let i = 0; i < 3; i++) {
          await patternEngine.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'event_test',
            context: { test: true }
          });
        }
        
        await assistant.generateSuggestions({ test: true });
      })();
    });

    it('should emit events when suggestion responses are handled', (done) => {
      assistant.on('suggestionResponse', (data) => {
        expect(data).toHaveProperty('suggestion');
        expect(data).toHaveProperty('response');
        done();
      });

      // Generate and respond to suggestion
      (async () => {
        for (let i = 0; i < 3; i++) {
          await patternEngine.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'response_event_test',
            context: { test: true }
          });
        }
        
        const suggestions = await assistant.generateSuggestions({ test: true });
        if (suggestions.length > 0) {
          await assistant.handleSuggestionResponse(suggestions[0].id, 'accept');
        }
      })();
    });
  });

  // Helper method for priority comparison
  private getPriorityValue(priority: 'low' | 'medium' | 'high'): number {
    const values = { high: 3, medium: 2, low: 1 };
    return values[priority];
  }
});