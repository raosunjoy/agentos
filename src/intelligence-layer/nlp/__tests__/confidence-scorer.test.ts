/**
 * Unit tests for Confidence Scorer
 */

import { ConfidenceScorer } from '../confidence-scorer';
import { IntentResult, NLPConfig } from '../types';

describe('ConfidenceScorer', () => {
  let scorer: ConfidenceScorer;
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
    scorer = new ConfidenceScorer(config);
  });

  const createMockIntentResult = (intentId: string, confidence: number): IntentResult => ({
    intent: {
      id: intentId,
      name: `${intentId} Intent`,
      description: `Description for ${intentId}`,
      examples: [],
      parameters: [],
      requiredPermissions: [],
      category: 'test'
    },
    confidence,
    entities: [],
    parameters: {}
  });

  describe('High Confidence Results', () => {
    it('should return success for high confidence single result', async () => {
      const results = [createMockIntentResult('call_contact', 0.9)];
      
      const processedResult = await scorer.scoreResults(results, 'call mom');
      
      expect(processedResult.success).toBe(true);
      expect(processedResult.result).toBeDefined();
      expect(processedResult.result!.confidence).toBeGreaterThan(0.7);
    });

    it('should return success when top result significantly higher than second', async () => {
      const results = [
        createMockIntentResult('call_contact', 0.8),
        createMockIntentResult('send_message', 0.4)
      ];
      
      const processedResult = await scorer.scoreResults(results, 'call mom');
      
      expect(processedResult.success).toBe(true);
      expect(processedResult.result!.intent.id).toBe('call_contact');
    });
  });

  describe('Ambiguous Results', () => {
    it('should detect ambiguous results when confidence scores are close', async () => {
      const results = [
        createMockIntentResult('call_contact', 0.75),
        createMockIntentResult('send_message', 0.73)
      ];
      
      const processedResult = await scorer.scoreResults(results, 'contact mom');
      
      expect(processedResult.success).toBe(false);
      expect(processedResult.needsClarification).toBe(true);
      expect(processedResult.clarificationOptions).toHaveLength(2);
    });

    it('should provide clarification options for ambiguous results', async () => {
      const results = [
        createMockIntentResult('call_contact', 0.75),
        createMockIntentResult('send_message', 0.73),
        createMockIntentResult('set_reminder', 0.71)
      ];
      
      const processedResult = await scorer.scoreResults(results, 'contact mom');
      
      expect(processedResult.clarificationOptions).toHaveLength(3);
    });
  });

  describe('Low Confidence Results', () => {
    it('should return error for low confidence results', async () => {
      const results = [createMockIntentResult('call_contact', 0.5)];
      
      const processedResult = await scorer.scoreResults(results, 'unclear input');
      
      expect(processedResult.success).toBe(false);
      expect(processedResult.error).toContain('Low confidence');
    });
  });

  describe('No Results', () => {
    it('should return error when no results provided', async () => {
      const processedResult = await scorer.scoreResults([], 'unknown input');
      
      expect(processedResult.success).toBe(false);
      expect(processedResult.error).toContain('No intents recognized');
    });
  });

  describe('Contextual Scoring', () => {
    it('should boost confidence based on time context', async () => {
      const results = [createMockIntentResult('call_contact', 0.6)];
      const context = { timeOfDay: 'morning' };
      
      const processedResult = await scorer.scoreResults(results, 'call mom', context);
      
      // Should boost call_contact in morning
      expect(processedResult.result?.confidence).toBeGreaterThan(0.6);
    });

    it('should boost confidence based on location context', async () => {
      const results = [createMockIntentResult('call_contact', 0.6)];
      const context = { location: 'home' };
      
      const processedResult = await scorer.scoreResults(results, 'call mom', context);
      
      // Should boost call_contact at home
      expect(processedResult.result?.confidence).toBeGreaterThan(0.6);
    });

    it('should consider recent activity context', async () => {
      const results = [createMockIntentResult('send_message', 0.6)];
      const context = { recentIntents: ['call_contact'] };
      
      const processedResult = await scorer.scoreResults(results, 'message mom', context);
      
      // Should boost related intents
      expect(processedResult.result?.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Elderly Optimizations', () => {
    it('should boost essential intents for elderly users', async () => {
      const results = [createMockIntentResult('emergency_help', 0.6)];
      
      const processedResult = await scorer.scoreResults(results, 'help me');
      
      // Emergency help should get elderly boost
      expect(processedResult.result?.confidence).toBeGreaterThan(0.6);
    });

    it('should boost intents with simpler parameters', async () => {
      const simpleIntent = createMockIntentResult('call_contact', 0.6);
      simpleIntent.intent.parameters = []; // No required parameters
      
      const results = [simpleIntent];
      
      const processedResult = await scorer.scoreResults(results, 'call mom');
      
      expect(processedResult.result?.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Historical Accuracy', () => {
    it('should update historical accuracy correctly', () => {
      scorer.updateHistoricalAccuracy('call_contact', true);
      scorer.updateHistoricalAccuracy('call_contact', true);
      scorer.updateHistoricalAccuracy('call_contact', false);
      
      const metrics = scorer.getSystemMetrics();
      const accuracy = metrics.accuracyByIntent.get('call_contact');
      
      expect(accuracy).toBeDefined();
      expect(accuracy).toBeGreaterThan(0.5); // Should be above baseline after mostly correct
    });

    it('should apply historical accuracy to confidence scoring', async () => {
      // Set high historical accuracy
      scorer.updateHistoricalAccuracy('call_contact', true);
      scorer.updateHistoricalAccuracy('call_contact', true);
      scorer.updateHistoricalAccuracy('call_contact', true);
      
      const results = [createMockIntentResult('call_contact', 0.6)];
      
      const processedResult = await scorer.scoreResults(results, 'call mom');
      
      // Should boost confidence based on historical accuracy
      expect(processedResult.result?.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Parameter Completeness', () => {
    it('should boost confidence when all required parameters are found', async () => {
      const result = createMockIntentResult('call_contact', 0.6);
      result.intent.parameters = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact to call' }
      ];
      result.entities = [
        {
          type: 'contact',
          value: 'mom',
          confidence: 0.9,
          startIndex: 0,
          endIndex: 3,
          metadata: { parameterName: 'contact' }
        }
      ];
      
      const processedResult = await scorer.scoreResults([result], 'call mom');
      
      // Should boost confidence when required parameters are found
      expect(processedResult.result?.confidence).toBeGreaterThan(0.6);
    });

    it('should not boost confidence when required parameters are missing', async () => {
      const result = createMockIntentResult('call_contact', 0.6);
      result.intent.parameters = [
        { name: 'contact', type: 'contact', required: true, description: 'Contact to call' }
      ];
      result.entities = []; // No entities found
      
      const processedResult = await scorer.scoreResults([result], 'call');
      
      // Should not boost confidence when required parameters missing
      expect(processedResult.result?.confidence).toBeLessThanOrEqual(0.6);
    });
  });

  describe('Clarification Prompts', () => {
    it('should generate appropriate clarification prompt', () => {
      const results = [
        createMockIntentResult('call_contact', 0.75),
        createMockIntentResult('send_message', 0.73)
      ];
      
      const prompt = scorer.generateClarificationPrompt(results);
      
      expect(prompt).toContain('1.');
      expect(prompt).toContain('2.');
      expect(prompt).toContain('call_contact Intent');
      expect(prompt).toContain('send_message Intent');
    });

    it('should return empty string for single result', () => {
      const results = [createMockIntentResult('call_contact', 0.9)];
      
      const prompt = scorer.generateClarificationPrompt(results);
      
      expect(prompt).toBe('');
    });
  });

  describe('Confidence Thresholds', () => {
    it('should return appropriate threshold for emergency category', () => {
      const threshold = scorer.getConfidenceThreshold('emergency');
      expect(threshold).toBe(0.6); // Lower threshold for emergency
    });

    it('should return appropriate threshold for communication category', () => {
      const threshold = scorer.getConfidenceThreshold('communication');
      expect(threshold).toBe(0.7); // Standard threshold
    });

    it('should return default threshold for unknown category', () => {
      const threshold = scorer.getConfidenceThreshold('unknown');
      expect(threshold).toBe(0.7); // Default threshold
    });
  });

  describe('System Metrics', () => {
    it('should return valid system metrics', () => {
      const metrics = scorer.getSystemMetrics();
      
      expect(metrics).toHaveProperty('averageConfidence');
      expect(metrics).toHaveProperty('ambiguityRate');
      expect(metrics).toHaveProperty('accuracyByIntent');
      expect(metrics.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.averageConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Processing Time', () => {
    it('should include processing time in results', async () => {
      const results = [createMockIntentResult('call_contact', 0.9)];
      
      const processedResult = await scorer.scoreResults(results, 'call mom');
      
      expect(processedResult.processingTime).toBeGreaterThan(0);
      expect(processedResult.processingTime).toBeLessThan(100); // Should be fast
    });
  });
});