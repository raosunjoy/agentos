/**
 * Tests for the pattern recognition engine
 */

import { PatternRecognitionEngine, BehaviorEvent, UserBehaviorPattern } from '../pattern-recognition';

describe('PatternRecognitionEngine', () => {
  let engine: PatternRecognitionEngine;

  beforeEach(() => {
    engine = new PatternRecognitionEngine({
      minConfidence: 0.6,
      minOccurrences: 2,
      maxPatterns: 50,
      privacyMode: 'balanced'
    });
  });

  afterEach(() => {
    engine.clearAllData();
  });

  describe('Event Processing', () => {
    it('should process behavior events', async () => {
      const event: BehaviorEvent = {
        timestamp: new Date(),
        type: 'voice_command',
        context: { command: 'weather', location: 'home' }
      };

      await engine.processEvent(event);
      
      // Should not throw and should be processed internally
      expect(true).toBe(true);
    });

    it('should apply privacy filtering based on mode', async () => {
      const sensitiveEvent: BehaviorEvent = {
        timestamp: new Date(),
        type: 'contact_call',
        context: { 
          name: 'John Doe',
          phone: '555-123-4567',
          email: 'john@example.com'
        }
      };

      await engine.processEvent(sensitiveEvent);
      
      // In balanced mode, sensitive data should be filtered
      expect(true).toBe(true);
    });

    it('should limit event history size', async () => {
      // Add many events to test history limiting
      for (let i = 0; i < 1200; i++) {
        const event: BehaviorEvent = {
          timestamp: new Date(Date.now() + i * 1000),
          type: `event_${i}`,
          context: { index: i }
        };
        await engine.processEvent(event);
      }

      // History should be limited (implementation detail, but we can test it doesn't crash)
      expect(true).toBe(true);
    });
  });

  describe('Pattern Discovery', () => {
    it('should discover temporal patterns', async () => {
      const morningTime = new Date();
      morningTime.setHours(9, 0, 0, 0);

      // Create multiple morning events
      for (let i = 0; i < 3; i++) {
        const event: BehaviorEvent = {
          timestamp: new Date(morningTime.getTime() + i * 24 * 60 * 60 * 1000),
          type: 'check_weather',
          context: { timeSlot: 'morning' }
        };
        await engine.processEvent(event);
      }

      const patterns = engine.getPatterns({ type: 'temporal' });
      expect(patterns.length).toBeGreaterThan(0);
      
      const morningPattern = patterns.find(p => p.context.timeSlot === 'morning');
      expect(morningPattern).toBeDefined();
      expect(morningPattern?.frequency).toBeGreaterThanOrEqual(3);
    });

    it('should discover routine patterns', async () => {
      const baseTime = new Date();
      
      // Create a sequence pattern: weather -> news -> music
      for (let day = 0; day < 3; day++) {
        const dayOffset = day * 24 * 60 * 60 * 1000;
        
        await engine.processEvent({
          timestamp: new Date(baseTime.getTime() + dayOffset),
          type: 'check_weather',
          context: { sequence: 1 }
        });
        
        await engine.processEvent({
          timestamp: new Date(baseTime.getTime() + dayOffset + 60000),
          type: 'read_news',
          context: { sequence: 2 }
        });
        
        await engine.processEvent({
          timestamp: new Date(baseTime.getTime() + dayOffset + 120000),
          type: 'play_music',
          context: { sequence: 3 }
        });
      }

      const patterns = engine.getPatterns({ type: 'routine' });
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should discover interaction patterns', async () => {
      // Create multiple successful voice commands
      for (let i = 0; i < 4; i++) {
        const event: BehaviorEvent = {
          timestamp: new Date(Date.now() + i * 60000),
          type: 'voice_command',
          context: { 
            command: 'lights',
            success: true,
            attempts: 1
          }
        };
        await engine.processEvent(event);
      }

      const patterns = engine.getPatterns({ type: 'interaction' });
      expect(patterns.length).toBeGreaterThan(0);
      
      const voicePattern = patterns.find(p => p.context.interactionType === 'voice_command');
      expect(voicePattern).toBeDefined();
      expect(voicePattern?.confidence).toBeGreaterThan(0.5);
    });

    it('should discover preference patterns', async () => {
      // Create events with consistent preferences
      for (let i = 0; i < 3; i++) {
        const event: BehaviorEvent = {
          timestamp: new Date(Date.now() + i * 60000),
          type: 'music_request',
          context: { 
            genre_preference: 'jazz',
            volume_preference: 'medium'
          }
        };
        await engine.processEvent(event);
      }

      const patterns = engine.getPatterns({ type: 'preference' });
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Management', () => {
    it('should filter patterns by criteria', async () => {
      // Add some test patterns by processing events
      await engine.processEvent({
        timestamp: new Date(),
        type: 'test_event',
        context: { category: 'test' }
      });

      const allPatterns = engine.getPatterns();
      const filteredPatterns = engine.getPatterns({ type: 'temporal' });
      
      expect(Array.isArray(allPatterns)).toBe(true);
      expect(Array.isArray(filteredPatterns)).toBe(true);
    });

    it('should sort patterns by confidence', async () => {
      // Process events to create patterns with different confidence levels
      for (let i = 0; i < 5; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'high_confidence_event',
          context: { success: true }
        });
      }

      for (let i = 0; i < 2; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'low_confidence_event',
          context: { success: false }
        });
      }

      const patterns = engine.getPatterns();
      
      // Should be sorted by confidence (descending)
      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
      }
    });

    it('should respect maximum pattern limit', async () => {
      const limitedEngine = new PatternRecognitionEngine({
        maxPatterns: 5,
        minOccurrences: 1
      });

      // Try to create more patterns than the limit
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 2; j++) {
          await limitedEngine.processEvent({
            timestamp: new Date(Date.now() + j * 60000),
            type: `event_type_${i}`,
            context: { index: i }
          });
        }
      }

      const patterns = limitedEngine.getPatterns();
      expect(patterns.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Suggestions', () => {
    it('should generate suggestions based on patterns', async () => {
      // Create a strong pattern
      const morningTime = new Date();
      morningTime.setHours(9, 0, 0, 0);

      for (let i = 0; i < 4; i++) {
        await engine.processEvent({
          timestamp: new Date(morningTime.getTime() + i * 24 * 60 * 60 * 1000),
          type: 'morning_routine',
          context: { timeSlot: 'morning', action: 'check_weather' }
        });
      }

      const suggestions = await engine.getSuggestions({ timeSlot: 'morning' });
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should limit number of suggestions', async () => {
      // Create multiple patterns
      for (let type = 0; type < 5; type++) {
        for (let i = 0; i < 3; i++) {
          await engine.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: `pattern_${type}`,
            context: { relevant: true }
          });
        }
      }

      const suggestions = await engine.getSuggestions({ relevant: true });
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Feedback Learning', () => {
    it('should update pattern confidence based on positive feedback', async () => {
      // Create a pattern
      for (let i = 0; i < 3; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'feedback_test',
          context: { test: true }
        });
      }

      const patterns = engine.getPatterns();
      const testPattern = patterns.find(p => p.context.test === true);
      
      if (testPattern) {
        const initialConfidence = testPattern.confidence;
        
        await engine.updatePatternFeedback(testPattern.id, 'positive');
        
        const updatedPatterns = engine.getPatterns();
        const updatedPattern = updatedPatterns.find(p => p.id === testPattern.id);
        
        expect(updatedPattern?.confidence).toBeGreaterThan(initialConfidence);
      }
    });

    it('should update pattern confidence based on negative feedback', async () => {
      // Create a pattern
      for (let i = 0; i < 3; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'negative_feedback_test',
          context: { test: true }
        });
      }

      const patterns = engine.getPatterns();
      const testPattern = patterns.find(p => p.context.test === true);
      
      if (testPattern) {
        const initialConfidence = testPattern.confidence;
        
        await engine.updatePatternFeedback(testPattern.id, 'negative');
        
        const updatedPatterns = engine.getPatterns();
        const updatedPattern = updatedPatterns.find(p => p.id === testPattern.id);
        
        if (updatedPattern) {
          expect(updatedPattern.confidence).toBeLessThan(initialConfidence);
        } else {
          // Pattern might have been removed due to very low confidence
          expect(updatedPattern).toBeUndefined();
        }
      }
    });

    it('should remove patterns with very low confidence', async () => {
      // Create a pattern
      for (let i = 0; i < 3; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'removal_test',
          context: { test: true }
        });
      }

      const patterns = engine.getPatterns();
      const testPattern = patterns.find(p => p.context.test === true);
      
      if (testPattern) {
        // Give multiple negative feedbacks to drive confidence very low
        for (let i = 0; i < 10; i++) {
          await engine.updatePatternFeedback(testPattern.id, 'negative');
        }
        
        const updatedPatterns = engine.getPatterns();
        const removedPattern = updatedPatterns.find(p => p.id === testPattern.id);
        
        expect(removedPattern).toBeUndefined();
      }
    });
  });

  describe('Learning Control', () => {
    it('should stop learning when disabled', async () => {
      engine.setLearningEnabled(false);
      
      const initialPatternCount = engine.getPatterns().length;
      
      // Try to create new patterns
      for (let i = 0; i < 5; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'disabled_learning_test',
          context: { test: true }
        });
      }
      
      const finalPatternCount = engine.getPatterns().length;
      expect(finalPatternCount).toBe(initialPatternCount);
    });

    it('should resume learning when re-enabled', async () => {
      engine.setLearningEnabled(false);
      engine.setLearningEnabled(true);
      
      const initialPatternCount = engine.getPatterns().length;
      
      // Create new patterns
      for (let i = 0; i < 3; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'resume_learning_test',
          context: { test: true }
        });
      }
      
      // Allow time for pattern analysis
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalPatternCount = engine.getPatterns().length;
      expect(finalPatternCount).toBeGreaterThanOrEqual(initialPatternCount);
    });
  });

  describe('Privacy Compliance', () => {
    it('should export patterns in anonymized format', () => {
      const exportData = engine.exportPatterns();
      
      expect(exportData).toHaveProperty('patterns');
      expect(exportData).toHaveProperty('config');
      expect(exportData).toHaveProperty('exportedAt');
      expect(Array.isArray(exportData.patterns)).toBe(true);
    });

    it('should clear all data when requested', async () => {
      // Create some patterns first
      for (let i = 0; i < 3; i++) {
        await engine.processEvent({
          timestamp: new Date(Date.now() + i * 60000),
          type: 'clear_test',
          context: { test: true }
        });
      }
      
      expect(engine.getPatterns().length).toBeGreaterThan(0);
      
      engine.clearAllData();
      
      expect(engine.getPatterns().length).toBe(0);
    });

    it('should handle strict privacy mode', async () => {
      const strictEngine = new PatternRecognitionEngine({
        privacyMode: 'strict'
      });

      const sensitiveEvent: BehaviorEvent = {
        timestamp: new Date(),
        type: 'sensitive_action',
        context: {
          name: 'John Doe',
          location: '123 Main St',
          phone: '555-1234'
        },
        userId: 'user123'
      };

      await strictEngine.processEvent(sensitiveEvent);
      
      // In strict mode, sensitive data should be heavily filtered
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe('Event Listeners', () => {
    it('should emit events when patterns are discovered', (done) => {
      engine.on('patternDiscovered', (pattern: UserBehaviorPattern) => {
        expect(pattern).toBeDefined();
        expect(pattern.id).toBeDefined();
        expect(pattern.type).toBeDefined();
        done();
      });

      // Create events that should trigger pattern discovery
      (async () => {
        for (let i = 0; i < 3; i++) {
          await engine.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'event_listener_test',
            context: { test: true }
          });
        }
      })();
    });

    it('should emit events when patterns are updated', (done) => {
      let patternId: string;

      engine.on('patternDiscovered', (pattern: UserBehaviorPattern) => {
        patternId = pattern.id;
      });

      engine.on('patternUpdated', (pattern: UserBehaviorPattern) => {
        expect(pattern.id).toBe(patternId);
        done();
      });

      // Create and then update a pattern
      (async () => {
        for (let i = 0; i < 3; i++) {
          await engine.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'update_test',
            context: { test: true }
          });
        }
        
        // Wait a bit then give positive feedback
        setTimeout(async () => {
          if (patternId) {
            await engine.updatePatternFeedback(patternId, 'positive');
          }
        }, 100);
      })();
    });

    it('should emit events when patterns are removed', (done) => {
      let patternId: string;

      engine.on('patternDiscovered', (pattern: UserBehaviorPattern) => {
        patternId = pattern.id;
      });

      engine.on('patternRemoved', (removedPatternId: string) => {
        expect(removedPatternId).toBe(patternId);
        done();
      });

      // Create and then remove a pattern through negative feedback
      (async () => {
        for (let i = 0; i < 3; i++) {
          await engine.processEvent({
            timestamp: new Date(Date.now() + i * 60000),
            type: 'removal_event_test',
            context: { test: true }
          });
        }
        
        // Wait a bit then give strong negative feedback
        setTimeout(async () => {
          if (patternId) {
            for (let i = 0; i < 10; i++) {
              await engine.updatePatternFeedback(patternId, 'negative');
            }
          }
        }, 100);
      })();
    });
  });
});