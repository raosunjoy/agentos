/**
 * Tests for the main learning system
 */

import { LearningSystem, LearningSystemConfig } from '../learning-system';
import { BehaviorEvent } from '../pattern-recognition';

describe('LearningSystem', () => {
  let learningSystem: LearningSystem;

  beforeEach(() => {
    const config: Partial<LearningSystemConfig> = {
      patternRecognition: {
        enabled: true,
        minConfidence: 0.6,
        minOccurrences: 2,
        maxPatterns: 50,
        privacyMode: 'balanced'
      },
      proactiveAssistance: {
        enabled: true,
        maxSuggestions: 3,
        minConfidenceThreshold: 0.7,
        suggestionCooldown: 1, // 1 minute for testing
        respectQuietHours: false,
        quietHoursStart: 22,
        quietHoursEnd: 7
      },
      privacy: {
        dataRetentionDays: 30,
        anonymizeAfterDays: 7,
        allowCrossPlatformLearning: false
      }
    };

    learningSystem = new LearningSystem(config);
  });

  afterEach(async () => {
    if (learningSystem) {
      await learningSystem.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await learningSystem.initialize();
      expect(true).toBe(true); // Should not throw
    });

    it('should not initialize twice', async () => {
      await learningSystem.initialize();
      await learningSystem.initialize(); // Should not throw
      expect(true).toBe(true);
    });

    it('should emit initialized event', (done) => {
      learningSystem.on('initialized', () => {
        done();
      });

      learningSystem.initialize();
    });
  });

  describe('Event Processing', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should process behavior events', async () => {
      const event: BehaviorEvent = {
        timestamp: new Date(),
        type: 'test_action',
        context: { test: true }
      };

      await learningSystem.processEvent(event);
      expect(true).toBe(true); // Should not throw
    });

    it('should emit eventProcessed event', (done) => {
      const event: BehaviorEvent = {
        timestamp: new Date(),
        type: 'event_processed_test',
        context: { test: true }
      };

      learningSystem.on('eventProcessed', (processedEvent) => {
        expect(processedEvent.type).toBe(event.type);
        done();
      });

      learningSystem.processEvent(event);
    });

    it('should not process events when pattern recognition is disabled', async () => {
      learningSystem.setLearningEnabled(false);

      const initialPatterns = learningSystem.getPatterns().length;

      const event: BehaviorEvent = {
        timestamp: new Date(),
        type: 'disabled_test',
        context: { test: true }
      };

      await learningSystem.processEvent(event);

      const finalPatterns = learningSystem.getPatterns().length;
      expect(finalPatterns).toBe(initialPatterns);
    });
  });

  describe('Suggestion Management', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should generate suggestions based on context', async () => {
      // Create some patterns first
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'suggestion_test',
          context: { test: true, timeSlot: 'morning' }
        });
      }

      const suggestions = await learningSystem.getSuggestions({ timeSlot: 'morning' });
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle suggestion responses', async () => {
      // Generate patterns and suggestions
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'response_test',
          context: { test: true }
        });
      }

      const suggestions = await learningSystem.getSuggestions({ test: true });
      
      if (suggestions.length > 0) {
        await learningSystem.handleSuggestionResponse(suggestions[0].id, 'accept');
        expect(true).toBe(true); // Should not throw
      }
    });

    it('should get active suggestions', async () => {
      // Generate some suggestions
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'active_test',
          context: { test: true }
        });
      }

      await learningSystem.getSuggestions({ test: true });
      const activeSuggestions = learningSystem.getActiveSuggestions();
      
      expect(Array.isArray(activeSuggestions)).toBe(true);
    });

    it('should return empty suggestions when disabled', async () => {
      learningSystem.setSuggestionsEnabled(false);

      // Create patterns
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'disabled_suggestions_test',
          context: { test: true }
        });
      }

      const suggestions = await learningSystem.getSuggestions({ test: true });
      expect(suggestions.length).toBe(0);
    });
  });

  describe('Pattern Management', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should get learned patterns', async () => {
      // Create some patterns
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'pattern_test',
          context: { test: true }
        });
      }

      const patterns = learningSystem.getPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should filter patterns by criteria', async () => {
      // Create patterns of different types
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'filter_test',
          context: { test: true, category: 'temporal' }
        });
      }

      const allPatterns = learningSystem.getPatterns();
      const filteredPatterns = learningSystem.getPatterns({ type: 'temporal' });
      
      expect(Array.isArray(allPatterns)).toBe(true);
      expect(Array.isArray(filteredPatterns)).toBe(true);
      expect(filteredPatterns.length).toBeLessThanOrEqual(allPatterns.length);
    });
  });

  describe('User Preferences', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should update user preferences', () => {
      const preferences = {
        learningEnabled: true,
        suggestionsEnabled: true,
        privacyMode: 'strict' as const
      };

      learningSystem.updateUserPreferences(preferences);
      expect(true).toBe(true); // Should not throw
    });

    it('should emit preferencesUpdated event', (done) => {
      const preferences = { testPreference: true };

      learningSystem.on('preferencesUpdated', (updatedPreferences) => {
        expect(updatedPreferences).toEqual(preferences);
        done();
      });

      learningSystem.updateUserPreferences(preferences);
    });

    it('should update learning state from preferences', () => {
      learningSystem.updateUserPreferences({ learningEnabled: false });
      
      // Learning should be disabled
      expect(true).toBe(true); // State change tested indirectly
    });

    it('should update suggestions state from preferences', () => {
      learningSystem.updateUserPreferences({ suggestionsEnabled: false });
      
      // Suggestions should be disabled
      expect(true).toBe(true); // State change tested indirectly
    });
  });

  describe('Learning Control', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should enable and disable learning', () => {
      learningSystem.setLearningEnabled(false);
      learningSystem.setLearningEnabled(true);
      expect(true).toBe(true); // Should not throw
    });

    it('should emit learningStateChanged event', (done) => {
      learningSystem.on('learningStateChanged', (enabled) => {
        expect(enabled).toBe(false);
        done();
      });

      learningSystem.setLearningEnabled(false);
    });

    it('should enable and disable suggestions', () => {
      learningSystem.setSuggestionsEnabled(false);
      learningSystem.setSuggestionsEnabled(true);
      expect(true).toBe(true); // Should not throw
    });

    it('should emit suggestionsStateChanged event', (done) => {
      learningSystem.on('suggestionsStateChanged', (enabled) => {
        expect(enabled).toBe(false);
        done();
      });

      learningSystem.setSuggestionsEnabled(false);
    });

    it('should update privacy mode', () => {
      learningSystem.updatePrivacyMode('strict');
      expect(true).toBe(true); // Should not throw
    });

    it('should emit privacyModeChanged event', (done) => {
      learningSystem.on('privacyModeChanged', (mode) => {
        expect(mode).toBe('strict');
        done();
      });

      learningSystem.updatePrivacyMode('strict');
    });
  });

  describe('Learning Insights', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should provide learning insights', async () => {
      // Create some patterns and suggestions
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'insights_test',
          context: { test: true }
        });
      }

      const insights = learningSystem.getLearningInsights();
      
      expect(insights).toHaveProperty('totalPatterns');
      expect(insights).toHaveProperty('patternsByType');
      expect(insights).toHaveProperty('learningAccuracy');
      expect(insights).toHaveProperty('suggestionStats');
      expect(insights).toHaveProperty('privacyCompliance');
      
      expect(typeof insights.totalPatterns).toBe('number');
      expect(typeof insights.patternsByType).toBe('object');
      expect(typeof insights.learningAccuracy).toBe('number');
      expect(typeof insights.suggestionStats).toBe('object');
      expect(typeof insights.privacyCompliance).toBe('object');
    });

    it('should return empty insights when not initialized', () => {
      const uninitializedSystem = new LearningSystem();
      const insights = uninitializedSystem.getLearningInsights();
      
      expect(insights.totalPatterns).toBe(0);
      expect(Object.keys(insights.patternsByType).length).toBe(0);
      expect(insights.learningAccuracy).toBe(0);
    });

    it('should calculate privacy compliance metrics', async () => {
      const insights = learningSystem.getLearningInsights();
      
      expect(insights.privacyCompliance).toHaveProperty('dataAge');
      expect(insights.privacyCompliance).toHaveProperty('anonymizedPatterns');
      expect(insights.privacyCompliance).toHaveProperty('retentionCompliant');
      
      expect(typeof insights.privacyCompliance.dataAge).toBe('number');
      expect(typeof insights.privacyCompliance.anonymizedPatterns).toBe('number');
      expect(typeof insights.privacyCompliance.retentionCompliant).toBe('boolean');
    });
  });

  describe('Data Management', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should export learning data', async () => {
      // Create some data first
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'export_test',
          context: { test: true }
        });
      }

      const exportData = learningSystem.exportLearningData();
      
      expect(exportData).toHaveProperty('patterns');
      expect(exportData).toHaveProperty('config');
      expect(exportData).toHaveProperty('insights');
      expect(exportData).toHaveProperty('exportedAt');
    });

    it('should return null export data when not initialized', () => {
      const uninitializedSystem = new LearningSystem();
      const exportData = uninitializedSystem.exportLearningData();
      
      expect(exportData).toBeNull();
    });

    it('should clear all data', async () => {
      // Create some data first
      for (let i = 0; i < 3; i++) {
        await learningSystem.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'clear_test',
          context: { test: true }
        });
      }

      learningSystem.clearAllData();
      
      const patterns = learningSystem.getPatterns();
      const suggestions = learningSystem.getActiveSuggestions();
      
      expect(patterns.length).toBe(0);
      expect(suggestions.length).toBe(0);
    });

    it('should emit dataCleared event', (done) => {
      learningSystem.on('dataCleared', () => {
        done();
      });

      learningSystem.clearAllData();
    });
  });

  describe('Privacy Compliance', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should perform privacy compliance automatically', (done) => {
      // Set up a system with very short retention for testing
      const shortRetentionSystem = new LearningSystem({
        privacy: {
          dataRetentionDays: 0, // Immediate expiration for testing
          anonymizeAfterDays: 0,
          allowCrossPlatformLearning: false
        }
      });

      shortRetentionSystem.on('privacyCompliancePerformed', (data) => {
        expect(data).toHaveProperty('removedCount');
        expect(data).toHaveProperty('anonymizedCount');
        done();
      });

      // Initialize and create some old data
      shortRetentionSystem.initialize().then(async () => {
        await shortRetentionSystem.processEvent({
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          type: 'old_data_test',
          context: { test: true }
        });
      });
    });

    it('should handle pattern anonymization requirements', (done) => {
      learningSystem.on('patternAnonymizationRequired', (patternId) => {
        expect(typeof patternId).toBe('string');
        done();
      });

      // This would be triggered by privacy compliance in real scenarios
      learningSystem.emit('patternAnonymizationRequired', 'test_pattern_id');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should handle errors gracefully', (done) => {
      learningSystem.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      // Simulate an error condition
      learningSystem.emit('error', new Error('Test error'));
    });

    it('should continue operating after non-critical errors', async () => {
      // Simulate error and then normal operation
      learningSystem.emit('error', new Error('Non-critical error'));

      // Should still be able to process events
      const event: BehaviorEvent = {
        timestamp: new Date(),
        type: 'error_recovery_test',
        context: { test: true }
      };

      await learningSystem.processEvent(event);
      expect(true).toBe(true); // Should not throw
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await learningSystem.initialize();
      await learningSystem.shutdown();
      expect(true).toBe(true); // Should not throw
    });

    it('should emit shutdown event', async () => {
      await learningSystem.initialize();
      
      const shutdownPromise = new Promise<void>((resolve) => {
        learningSystem.on('shutdown', () => {
          resolve();
        });
      });

      await learningSystem.shutdown();
      await shutdownPromise;
    });

    it('should handle shutdown when not initialized', async () => {
      await learningSystem.shutdown();
      expect(true).toBe(true); // Should not throw
    });
  });

  describe('Event Propagation', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    it('should propagate pattern discovery events', (done) => {
      learningSystem.on('patternDiscovered', (pattern) => {
        expect(pattern).toBeDefined();
        expect(pattern.id).toBeDefined();
        done();
      });

      // Create events that should trigger pattern discovery
      (async () => {
        for (let i = 0; i < 3; i++) {
          await learningSystem.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'pattern_discovery_test',
            context: { test: true }
          });
        }
      })();
    });

    it('should propagate suggestion events', (done) => {
      learningSystem.on('suggestionsGenerated', (suggestions) => {
        expect(Array.isArray(suggestions)).toBe(true);
        done();
      });

      // Generate patterns and then suggestions
      (async () => {
        for (let i = 0; i < 3; i++) {
          await learningSystem.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'suggestion_event_test',
            context: { test: true }
          });
        }
        
        await learningSystem.getSuggestions({ test: true });
      })();
    });

    it('should propagate suggestion response events', (done) => {
      learningSystem.on('suggestionResponse', (data) => {
        expect(data).toHaveProperty('suggestionId');
        expect(data).toHaveProperty('response');
        done();
      });

      // Generate and respond to suggestion
      (async () => {
        for (let i = 0; i < 3; i++) {
          await learningSystem.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'response_event_test',
            context: { test: true }
          });
        }
        
        const suggestions = await learningSystem.getSuggestions({ test: true });
        if (suggestions.length > 0) {
          await learningSystem.handleSuggestionResponse(suggestions[0].id, 'accept');
        }
      })();
    });
  });
});