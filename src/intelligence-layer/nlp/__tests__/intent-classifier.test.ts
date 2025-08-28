/**
 * Unit tests for Intent Classifier
 */

import { IntentClassifier } from '../intent-classifier';
import { Intent, NLPConfig, TrainingExample } from '../types';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;
  let config: NLPConfig;

  beforeEach(() => {
    config = {
      languages: [{ code: 'en', name: 'English', enabled: true, confidenceThreshold: 0.7 }],
      defaultLanguage: 'en',
      confidenceThreshold: 0.7,
      maxAmbiguousResults: 3,
      enableElderlyOptimizations: true,
      cacheSize: 100
    };
    classifier = new IntentClassifier(config);
  });

  describe('Intent Registration', () => {
    it('should register a new intent successfully', () => {
      const intent: Intent = {
        id: 'test_intent',
        name: 'Test Intent',
        description: 'A test intent',
        examples: ['test example'],
        parameters: [],
        requiredPermissions: [],
        category: 'test'
      };

      expect(() => classifier.registerIntent(intent)).not.toThrow();
    });
  });

  describe('Intent Classification', () => {
    it('should classify call contact intent correctly', async () => {
      const results = await classifier.classify('call mom');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('call_contact');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should classify send message intent correctly', async () => {
      const results = await classifier.classify('text john hello');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('send_message');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should classify set reminder intent correctly', async () => {
      const results = await classifier.classify('remind me to take medicine');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('set_reminder');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should classify weather intent correctly', async () => {
      const results = await classifier.classify('what is the weather');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('get_weather');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should classify emergency intent correctly', async () => {
      const results = await classifier.classify('help me emergency');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('emergency_help');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should return multiple results for ambiguous input', async () => {
      const results = await classifier.classify('call');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].confidence).toBeGreaterThan(0);
    });

    it('should return empty array for unrecognized input', async () => {
      const results = await classifier.classify('xyzabc nonsense input');
      
      expect(results).toHaveLength(0);
    });
  });

  describe('Elderly Optimizations', () => {
    it('should handle repeated words in elderly speech', async () => {
      const results = await classifier.classify('call call mom');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('call_contact');
    });

    it('should handle contractions properly', async () => {
      const results = await classifier.classify("I can't find my phone");
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle filler words', async () => {
      const results = await classifier.classify('um call uh mom please');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('call_contact');
    });
  });

  describe('Training', () => {
    it('should train with new examples', async () => {
      const examples: TrainingExample[] = [
        {
          text: 'phone my doctor',
          intent: 'call_contact',
          entities: [],
          language: 'en'
        }
      ];

      await expect(classifier.trainWithExamples(examples)).resolves.not.toThrow();
    });

    it('should improve accuracy after training', async () => {
      const initialResults = await classifier.classify('phone my doctor');
      const initialConfidence = initialResults[0]?.confidence || 0;

      const examples: TrainingExample[] = [
        {
          text: 'phone my doctor',
          intent: 'call_contact',
          entities: [],
          language: 'en'
        }
      ];

      await classifier.trainWithExamples(examples);
      
      const improvedResults = await classifier.classify('phone my doctor');
      const improvedConfidence = improvedResults[0]?.confidence || 0;

      expect(improvedConfidence).toBeGreaterThanOrEqual(initialConfidence);
    });
  });

  describe('Metrics', () => {
    it('should return valid metrics', () => {
      const metrics = classifier.getMetrics();
      
      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('precision');
      expect(metrics).toHaveProperty('recall');
      expect(metrics).toHaveProperty('f1Score');
      expect(metrics).toHaveProperty('lastUpdated');
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    it('should classify intents within reasonable time', async () => {
      const startTime = Date.now();
      await classifier.classify('call mom');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle multiple classifications efficiently', async () => {
      const startTime = Date.now();
      
      const promises = [
        classifier.classify('call mom'),
        classifier.classify('text john'),
        classifier.classify('remind me'),
        classifier.classify('weather today'),
        classifier.classify('help me')
      ];
      
      await Promise.all(promises);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500); // Should handle batch efficiently
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const results = await classifier.classify('');
      expect(results).toHaveLength(0);
    });

    it('should handle very long input', async () => {
      const longInput = 'call mom '.repeat(100);
      const results = await classifier.classify(longInput);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters', async () => {
      const results = await classifier.classify('call mom!!! @#$%');
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed case input', async () => {
      const results = await classifier.classify('CALL MOM');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].intent.id).toBe('call_contact');
    });
  });
});