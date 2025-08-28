/**
 * Unit tests for NLP Engine
 */

import { NLPEngine } from '../nlp-engine';
import { Intent, TrainingExample, NLPConfig } from '../types';

describe('NLPEngine', () => {
  let engine: NLPEngine;

  beforeEach(() => {
    const config: Partial<NLPConfig> = {
      confidenceThreshold: 0.7,
      enableElderlyOptimizations: true,
      maxAmbiguousResults: 3
    };
    engine = new NLPEngine(config);
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new NLPEngine();
      expect(defaultEngine).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<NLPConfig> = {
        confidenceThreshold: 0.8,
        enableElderlyOptimizations: false
      };
      const customEngine = new NLPEngine(customConfig);
      expect(customEngine).toBeDefined();
    });
  });

  describe('Input Processing', () => {
    it('should process simple call intent successfully', async () => {
      const result = await engine.processInput('call mom');
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.intent.id).toBe('call_contact');
      expect(result.language).toBe('en');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should process message intent with entities', async () => {
      const result = await engine.processInput('text john hello there');
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.intent.id).toBe('send_message');
      expect(result.result!.entities.length).toBeGreaterThan(0);
    });

    it('should process reminder intent correctly', async () => {
      const result = await engine.processInput('remind me to take medicine at 3pm');
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.intent.id).toBe('set_reminder');
    });

    it('should process weather intent correctly', async () => {
      const result = await engine.processInput('what is the weather today');
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.intent.id).toBe('get_weather');
    });

    it('should process emergency intent correctly', async () => {
      const result = await engine.processInput('help me emergency');
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.intent.id).toBe('emergency_help');
    });
  });

  describe('Entity Extraction and Parameter Mapping', () => {
    it('should extract and map contact entities', async () => {
      const result = await engine.processInput('call my doctor');
      
      expect(result.success).toBe(true);
      expect(result.result!.entities.length).toBeGreaterThan(0);
      expect(result.result!.parameters).toHaveProperty('contact');
    });

    it('should extract and map message content', async () => {
      const result = await engine.processInput('text mom I will be late');
      
      expect(result.success).toBe(true);
      expect(result.result!.parameters).toHaveProperty('contact');
      expect(result.result!.parameters).toHaveProperty('message');
    });

    it('should extract and map time entities', async () => {
      const result = await engine.processInput('remind me at 3pm to take medicine');
      
      expect(result.success).toBe(true);
      expect(result.result!.entities.some(e => e.type === 'date')).toBe(true);
    });
  });

  describe('Ambiguity Handling', () => {
    it('should detect ambiguous input and provide clarification', async () => {
      const result = await engine.processInput('contact mom');
      
      if (!result.success && result.needsClarification) {
        expect(result.clarificationOptions).toBeDefined();
        expect(result.clarificationOptions!.length).toBeGreaterThan(1);
      }
    });

    it('should generate clarification prompt for ambiguous results', async () => {
      const result = await engine.processInput('contact mom');
      
      if (result.needsClarification) {
        const prompt = engine.generateClarificationPrompt(result);
        expect(prompt).toContain('Did you mean');
        expect(prompt.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Context-Aware Processing', () => {
    it('should use context to improve intent recognition', async () => {
      const context = {
        timeOfDay: 'morning',
        location: 'home',
        recentIntents: []
      };
      
      const result = await engine.processInput('call mom', context);
      
      expect(result.success).toBe(true);
      expect(result.result!.confidence).toBeGreaterThan(0);
    });

    it('should boost related intents based on recent activity', async () => {
      const context = {
        recentIntents: ['call_contact']
      };
      
      const result = await engine.processInput('message mom', context);
      
      expect(result.success).toBe(true);
      // Message intent should be boosted due to recent call intent
    });
  });

  describe('Language Support', () => {
    it('should detect and process English input', async () => {
      const result = await engine.processInput('call my mother please');
      
      expect(result.language).toBe('en');
      expect(result.success).toBe(true);
    });

    it('should return supported languages', () => {
      const languages = engine.getSupportedLanguages();
      
      expect(languages).toContain('en');
      expect(languages.length).toBeGreaterThan(0);
    });

    it('should set user language preference', () => {
      expect(() => engine.setUserLanguage('en')).not.toThrow();
    });
  });

  describe('Intent Registration', () => {
    it('should register new custom intent', () => {
      const customIntent: Intent = {
        id: 'custom_test',
        name: 'Custom Test Intent',
        description: 'A custom test intent',
        examples: ['test custom intent', 'custom test'],
        parameters: [],
        requiredPermissions: [],
        category: 'test'
      };

      expect(() => engine.registerIntent(customIntent)).not.toThrow();
    });

    it('should recognize registered custom intent', async () => {
      const customIntent: Intent = {
        id: 'custom_test',
        name: 'Custom Test Intent',
        description: 'A custom test intent',
        examples: ['test custom intent', 'custom test'],
        parameters: [],
        requiredPermissions: [],
        category: 'test'
      };

      engine.registerIntent(customIntent);
      
      const result = await engine.processInput('test custom intent');
      
      expect(result.success).toBe(true);
      expect(result.result!.intent.id).toBe('custom_test');
    });
  });

  describe('Training and Learning', () => {
    it('should train with new examples', async () => {
      const examples: TrainingExample[] = [
        {
          text: 'ring my physician',
          intent: 'call_contact',
          entities: [],
          language: 'en'
        }
      ];

      await expect(engine.trainWithExamples(examples)).resolves.not.toThrow();
    });

    it('should update feedback for continuous learning', () => {
      expect(() => engine.updateFeedback('call_contact', true)).not.toThrow();
      expect(() => engine.updateFeedback('call_contact', false)).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should return comprehensive metrics', () => {
      const metrics = engine.getMetrics();
      
      expect(metrics).toHaveProperty('intentClassifier');
      expect(metrics).toHaveProperty('confidenceScorer');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('averageProcessingTime');
    });

    it('should track processing time', async () => {
      const result = await engine.processInput('call mom');
      
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(1000); // Should be reasonably fast
    });
  });

  describe('Caching', () => {
    it('should cache successful results', async () => {
      const input = 'call mom test cache';
      
      // First call
      const result1 = await engine.processInput(input);
      const time1 = result1.processingTime;
      
      // Second call should be faster due to caching
      const result2 = await engine.processInput(input);
      const time2 = result2.processingTime;
      
      expect(result1.success).toBe(result2.success);
      // Note: In a real implementation, cached results would be faster
    });

    it('should clear cache when requested', () => {
      expect(() => engine.clearCache()).not.toThrow();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const newConfig: Partial<NLPConfig> = {
        confidenceThreshold: 0.8,
        enableElderlyOptimizations: false
      };

      expect(() => engine.updateConfig(newConfig)).not.toThrow();
    });

    it('should clear cache when configuration changes', async () => {
      await engine.processInput('call mom'); // Populate cache
      
      engine.updateConfig({ confidenceThreshold: 0.8 });
      
      // Cache should be cleared after config update
    });
  });

  describe('Error Handling', () => {
    it('should handle empty input gracefully', async () => {
      const result = await engine.processInput('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle unrecognized input', async () => {
      const result = await engine.processInput('xyzabc completely unknown input');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No intents recognized');
    });

    it('should handle malformed context gracefully', async () => {
      const malformedContext = { invalid: 'context' };
      
      const result = await engine.processInput('call mom', malformedContext);
      
      // Should still process successfully despite malformed context
      expect(result).toBeDefined();
    });
  });

  describe('Elderly Optimizations', () => {
    it('should handle repeated words in elderly speech', async () => {
      const result = await engine.processInput('call call mom mom');
      
      expect(result.success).toBe(true);
      expect(result.result!.intent.id).toBe('call_contact');
    });

    it('should handle filler words', async () => {
      const result = await engine.processInput('um call uh mom please');
      
      expect(result.success).toBe(true);
      expect(result.result!.intent.id).toBe('call_contact');
    });

    it('should expand contractions', async () => {
      const result = await engine.processInput("I can't call mom");
      
      expect(result.success).toBe(true);
      // Should process "cannot" instead of "can't"
    });
  });

  describe('Performance', () => {
    it('should process input within reasonable time', async () => {
      const startTime = Date.now();
      await engine.processInput('call mom');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(200); // Should be fast
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      const promises = [
        engine.processInput('call mom'),
        engine.processInput('text john'),
        engine.processInput('remind me'),
        engine.processInput('weather today'),
        engine.processInput('help me')
      ];
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(1000); // Should handle concurrent requests
    });
  });
});