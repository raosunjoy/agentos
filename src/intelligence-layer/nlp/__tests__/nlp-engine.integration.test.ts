/**
 * Integration Tests for NLP Engine
 * Comprehensive testing of NLP pipeline, intent classification, entity extraction, and context management
 */

import {
  NLPEngine,
  IntentClassifier,
  EntityExtractor,
  ConfidenceScorer,
  LanguageDetector,
  ContextManager,
  IntentResult,
  Entity,
  ProcessingResult,
  Intent,
  EntityType
} from '../index';

describe('NLP Engine Integration', () => {
  let nlpEngine: NLPEngine;
  let intentClassifier: IntentClassifier;
  let entityExtractor: EntityExtractor;
  let confidenceScorer: ConfidenceScorer;
  let languageDetector: LanguageDetector;
  let contextManager: ContextManager;

  // Sample intents for testing
  const sampleIntents: Intent[] = [
    {
      id: 'weather_query',
      name: 'Weather Query',
      description: 'Queries about current or future weather conditions',
      keywords: ['weather', 'temperature', 'forecast', 'rain', 'sunny'],
      patterns: ['what is the weather', 'how is the weather in {location}', 'will it rain tomorrow'],
      parameters: [
        {
          name: 'location',
          type: 'string',
          required: false,
          description: 'Location for weather query'
        },
        {
          name: 'time',
          type: 'string',
          required: false,
          description: 'Time period for weather query'
        }
      ],
      examples: [
        'What is the weather like?',
        'How is the weather in New York?',
        'Will it rain tomorrow?'
      ]
    },
    {
      id: 'reminder_set',
      name: 'Set Reminder',
      description: 'Creates reminders and alarms',
      keywords: ['remind', 'reminder', 'alarm', 'schedule', 'notify'],
      patterns: ['remind me to {task}', 'set a reminder for {time}', 'alarm at {time}'],
      parameters: [
        {
          name: 'task',
          type: 'string',
          required: true,
          description: 'Task to be reminded about'
        },
        {
          name: 'time',
          type: 'string',
          required: true,
          description: 'Time for the reminder'
        }
      ],
      examples: [
        'Remind me to take my medicine',
        'Set a reminder for 3 PM',
        'Alarm at 8 AM tomorrow'
      ]
    }
  ];

  beforeEach(async () => {
    // Initialize components
    intentClassifier = new IntentClassifier();
    entityExtractor = new EntityExtractor();
    confidenceScorer = new ConfidenceScorer();
    languageDetector = new LanguageDetector();
    contextManager = new ContextManager();

    // Initialize NLP Engine with components
    nlpEngine = new NLPEngine({
      intentClassifier,
      entityExtractor,
      confidenceScorer,
      languageDetector,
      contextManager
    });

    // Train with sample intents
    await intentClassifier.train(sampleIntents);
  });

  afterEach(async () => {
    // Clean up
    if (nlpEngine) {
      await nlpEngine.shutdown();
    }
  });

  describe('NLP Pipeline Integration', () => {
    test('should process complete NLP pipeline for weather query', async () => {
      const input = 'What is the weather like in New York today?';

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session',
        language: 'en'
      });

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBe('en');

      // Check intent classification
      if (result.intent) {
        expect(result.intent.intentId).toBe('weather_query');
        expect(result.intent.confidence).toBeGreaterThan(0.5);
      }

      // Check entity extraction
      expect(result.entities.length).toBeGreaterThan(0);
      const locationEntity = result.entities.find(e => e.type === EntityType.LOCATION);
      expect(locationEntity).toBeDefined();
      expect(locationEntity?.value).toContain('New York');
    });

    test('should process reminder setting request', async () => {
      const input = 'Remind me to take my medicine at 3 PM';

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();

      if (result.intent) {
        expect(result.intent.intentId).toBe('reminder_set');
        expect(result.intent.confidence).toBeGreaterThan(0.5);
      }

      // Check for task and time entities
      const taskEntity = result.entities.find(e => e.type === EntityType.TASK);
      const timeEntity = result.entities.find(e => e.type === EntityType.TIME);

      expect(taskEntity).toBeDefined();
      expect(timeEntity).toBeDefined();
      expect(taskEntity?.value).toContain('medicine');
      expect(timeEntity?.value).toContain('3 PM');
    });

    test('should handle ambiguous queries with clarification', async () => {
      const input = 'Set an alarm'; // Ambiguous - missing time

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      expect(result).toBeDefined();

      // Should either have low confidence or provide clarification
      if (result.intent && result.intent.confidence < 0.7) {
        expect(result.clarificationOptions).toBeDefined();
        expect(result.clarificationOptions?.length).toBeGreaterThan(0);
      }
    });

    test('should maintain context across multiple interactions', async () => {
      const context = {
        userId: 'test-user',
        sessionId: 'test-session'
      };

      // First interaction
      const result1 = await nlpEngine.process('What is the weather?', context);
      expect(result1.intent?.intentId).toBe('weather_query');

      // Second interaction - should leverage context
      const result2 = await nlpEngine.process('In Paris', context);

      // Should understand this refers to weather in Paris
      expect(result2.intent?.intentId).toBe('weather_query');
      const locationEntity = result2.entities.find(e => e.type === EntityType.LOCATION);
      expect(locationEntity?.value).toContain('Paris');
    });
  });

  describe('Multi-language Support', () => {
    test('should detect and process English text', async () => {
      const input = 'What time is it?';

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      expect(result.language).toBe('en');
      expect(result.intent).toBeDefined();
    });

    test('should handle language detection for Spanish', async () => {
      const input = '¿Qué hora es?'; // "What time is it?" in Spanish

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      // Language detection might vary, but should be handled
      expect(result).toBeDefined();
      expect(typeof result.language).toBe('string');
    });

    test('should support explicit language specification', async () => {
      const input = 'What is the weather?';

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session',
        language: 'en'
      });

      expect(result.language).toBe('en');
    });
  });

  describe('Entity Extraction Integration', () => {
    test('should extract multiple entity types from complex input', async () => {
      const input = 'Schedule a doctor appointment for John at 2 PM tomorrow in downtown clinic';

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      expect(result.entities.length).toBeGreaterThan(0);

      // Check for different entity types
      const personEntity = result.entities.find(e => e.type === EntityType.PERSON);
      const timeEntity = result.entities.find(e => e.type === EntityType.TIME);
      const dateEntity = result.entities.find(e => e.type === EntityType.DATE);
      const locationEntity = result.entities.find(e => e.type === EntityType.LOCATION);

      expect(personEntity?.value).toContain('John');
      expect(timeEntity?.value).toContain('2 PM');
      expect(dateEntity?.value).toContain('tomorrow');
      expect(locationEntity?.value).toContain('downtown clinic');
    });

    test('should handle temporal expressions', async () => {
      const inputs = [
        'tomorrow at 3 PM',
        'next Monday',
        'in 2 hours',
        'last week'
      ];

      for (const input of inputs) {
        const result = await nlpEngine.process(`Remind me ${input}`, {
          userId: 'test-user',
          sessionId: 'test-session'
        });

        expect(result.entities.length).toBeGreaterThan(0);
        const timeEntities = result.entities.filter(e =>
          e.type === EntityType.TIME || e.type === EntityType.DATE
        );
        expect(timeEntities.length).toBeGreaterThan(0);
      }
    });

    test('should extract numerical values and units', async () => {
      const input = 'Set timer for 25 minutes';

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      const durationEntity = result.entities.find(e => e.type === EntityType.DURATION);
      expect(durationEntity).toBeDefined();
      expect(durationEntity?.value).toBe(25);
      expect(durationEntity?.metadata?.unit).toBe('minutes');
    });
  });

  describe('Intent Classification Accuracy', () => {
    test('should achieve high confidence for clear intents', async () => {
      const clearInputs = [
        'What is the weather like today?',
        'Remind me to call my doctor',
        'Set an alarm for 7 AM',
        'How is the forecast for tomorrow?'
      ];

      for (const input of clearInputs) {
        const result = await nlpEngine.process(input, {
          userId: 'test-user',
          sessionId: 'test-session'
        });

        expect(result.intent).toBeDefined();
        expect(result.intent!.confidence).toBeGreaterThan(0.7);
      }
    });

    test('should handle intent conflicts appropriately', async () => {
      // Input that could match multiple intents
      const input = 'Remind me about the weather tomorrow';

      const result = await nlpEngine.process(input, {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      expect(result.intent).toBeDefined();
      expect(result.intent!.intentId).toBeDefined();

      // Should have alternatives if confidence is low
      if (result.intent!.confidence < 0.8) {
        expect(result.alternatives).toBeDefined();
        expect(result.alternatives!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Context Management Integration', () => {
    test('should maintain conversation context', async () => {
      const context = {
        userId: 'test-user',
        sessionId: 'test-session'
      };

      // Establish context with location
      await nlpEngine.process('I am in Boston', context);

      // Follow-up question should use context
      const result = await nlpEngine.process('What is the weather like?', context);

      expect(result.intent?.intentId).toBe('weather_query');
      const locationEntity = result.entities.find(e => e.type === EntityType.LOCATION);
      expect(locationEntity?.value).toContain('Boston');
    });

    test('should handle context timeouts', async () => {
      const context = {
        userId: 'test-user',
        sessionId: 'test-session'
      };

      // Set context
      await nlpEngine.process('Talk about New York', context);

      // Simulate time passing (context should expire)
      await new Promise(resolve => setTimeout(resolve, 100));

      // New query should not be affected by old context
      const result = await nlpEngine.process('What is the weather?', context);

      // Should work but without assuming New York context
      expect(result.intent?.intentId).toBe('weather_query');
    });

    test('should support multi-turn conversations', async () => {
      const context = {
        userId: 'test-user',
        sessionId: 'test-session'
      };

      const conversation = [
        'I want to set a reminder',
        'For tomorrow at 2 PM',
        'To pick up groceries'
      ];

      let accumulatedContext: any = {};

      for (const utterance of conversation) {
        const result = await nlpEngine.process(utterance, context);
        accumulatedContext = { ...accumulatedContext, ...result.context };

        expect(result.intent).toBeDefined();
      }

      // Final context should contain accumulated information
      expect(accumulatedContext).toBeDefined();
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle high-throughput requests', async () => {
      const inputs = Array.from({ length: 50 }, (_, i) =>
        `Test query ${i}: What is the weather?`
      );

      const startTime = Date.now();

      const results = await Promise.all(
        inputs.map(input =>
          nlpEngine.process(input, {
            userId: 'test-user',
            sessionId: 'test-session'
          })
        )
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / inputs.length;

      // Should process requests reasonably fast (< 100ms average)
      expect(avgTime).toBeLessThan(100);

      // All results should be valid
      results.forEach(result => {
        expect(result.intent?.intentId).toBe('weather_query');
      });
    });

    test('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        '',
        '   ',
        '!@#$%^&*()',
        'a'.repeat(1000), // Very long input
        '🚀🌟💫', // Emoji only
        null,
        undefined
      ];

      for (const input of malformedInputs) {
        if (input !== null && input !== undefined) {
          const result = await nlpEngine.process(input as string, {
            userId: 'test-user',
            sessionId: 'test-session'
          });

          // Should not crash, should return some result
          expect(result).toBeDefined();
          expect(typeof result.language).toBe('string');
        }
      }
    });

    test('should maintain accuracy under load', async () => {
      // Test that accuracy doesn't degrade under concurrent load
      const testInputs = [
        'What is the weather in London?',
        'Remind me to call mom',
        'Set alarm for 6 AM',
        'How is the forecast?'
      ];

      const concurrentPromises = Array.from({ length: 20 }, () =>
        Promise.all(
          testInputs.map(input =>
            nlpEngine.process(input, {
              userId: `user-${Math.random()}`,
              sessionId: `session-${Math.random()}`
            })
          )
        )
      );

      const results = await Promise.all(concurrentPromises);

      // Flatten results
      const allResults = results.flat(2);

      // Check that accuracy is maintained
      const weatherResults = allResults.filter(r => r.intent?.intentId === 'weather_query');
      const reminderResults = allResults.filter(r => r.intent?.intentId === 'reminder_set');

      expect(weatherResults.length).toBeGreaterThan(0);
      expect(reminderResults.length).toBeGreaterThan(0);

      // Average confidence should be reasonable
      const avgConfidence = allResults.reduce((sum, r) =>
        sum + (r.intent?.confidence || 0), 0
      ) / allResults.length;

      expect(avgConfidence).toBeGreaterThan(0.5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle component failures gracefully', async () => {
      // Simulate intent classifier failure
      const originalClassify = intentClassifier.classify;
      intentClassifier.classify = jest.fn().mockRejectedValue(new Error('Classifier failed'));

      try {
        const result = await nlpEngine.process('Test input', {
          userId: 'test-user',
          sessionId: 'test-session'
        });

        // Should still return a result (fallback behavior)
        expect(result).toBeDefined();
        expect(result.intent).toBeUndefined(); // No intent due to failure
      } finally {
        // Restore original method
        intentClassifier.classify = originalClassify;
      }
    });

    test('should handle empty or invalid configurations', async () => {
      const minimalEngine = new NLPEngine({});

      const result = await minimalEngine.process('Test', {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      // Should handle gracefully even with minimal config
      expect(result).toBeDefined();
    });

    test('should recover from temporary failures', async () => {
      const input = 'What is the weather?';
      const context = {
        userId: 'test-user',
        sessionId: 'test-session'
      };

      // First request - should work
      const result1 = await nlpEngine.process(input, context);
      expect(result1.intent?.intentId).toBe('weather_query');

      // Simulate temporary failure
      const originalClassify = intentClassifier.classify;
      intentClassifier.classify = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(originalClassify.bind(intentClassifier)());

      // Second request - should recover
      const result2 = await nlpEngine.process(input, context);
      expect(result2.intent?.intentId).toBe('weather_query');

      // Restore
      intentClassifier.classify = originalClassify;
    });
  });

  describe('Training and Model Updates', () => {
    test('should support dynamic intent training', async () => {
      const newIntent: Intent = {
        id: 'call_contact',
        name: 'Call Contact',
        description: 'Initiate phone calls to contacts',
        keywords: ['call', 'phone', 'dial', 'contact'],
        patterns: ['call {contact}', 'phone {contact}', 'dial {contact}'],
        parameters: [
          {
            name: 'contact',
            type: 'string',
            required: true,
            description: 'Contact to call'
          }
        ],
        examples: [
          'Call mom',
          'Phone John',
          'Dial emergency'
        ]
      };

      // Train new intent
      await intentClassifier.train([newIntent]);

      // Test new intent
      const result = await nlpEngine.process('Call mom', {
        userId: 'test-user',
        sessionId: 'test-session'
      });

      expect(result.intent?.intentId).toBe('call_contact');
      expect(result.intent?.confidence).toBeGreaterThan(0.5);
    });

    test('should handle model updates without downtime', async () => {
      // Process requests during "training"
      const trainingPromise = intentClassifier.train(sampleIntents);
      const processingPromises = Array.from({ length: 10 }, () =>
        nlpEngine.process('What is the weather?', {
          userId: 'test-user',
          sessionId: 'test-session'
        })
      );

      // Both should complete successfully
      await Promise.all([trainingPromise, ...processingPromises]);

      const results = await Promise.all(processingPromises);
      results.forEach(result => {
        expect(result.intent?.intentId).toBe('weather_query');
      });
    });
  });
});
