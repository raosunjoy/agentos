/**
 * Intent Classifier - Lightweight ML-based intent recognition
 * 
 * Implements intent classification using lightweight models optimized
 * for on-device processing with support for elderly users.
 */

import { Intent, IntentResult, TrainingExample, ModelMetrics, NLPConfig } from './types';

export class IntentClassifier {
  private intents: Map<string, Intent> = new Map();
  private modelWeights: Map<string, number[]> = new Map();
  private vocabulary: Map<string, number> = new Map();
  private config: NLPConfig;
  private metrics: ModelMetrics;

  constructor(config: NLPConfig) {
    this.config = config;
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      confusionMatrix: [],
      lastUpdated: new Date()
    };
    this.initializeDefaultIntents();
  }

  /**
   * Register a new intent with the classifier
   */
  registerIntent(intent: Intent): void {
    this.intents.set(intent.id, intent);
    // Don't train here, will be done in initialization
  }

  /**
   * Classify user input and return intent with confidence score
   */
  async classify(text: string, language: string = 'en'): Promise<IntentResult[]> {
    const startTime = Date.now();
    
    // Return empty for empty or very short input
    if (!text || text.trim().length < 2) {
      return [];
    }
    
    // Preprocess text for elderly-optimized recognition
    const processedText = this.preprocessText(text, language);
    
    // Return empty if no meaningful words after preprocessing
    const words = processedText.split(' ').filter(word => word.length > 0);
    if (words.length === 0) {
      return [];
    }
    
    // Extract features from text
    const features = this.extractFeatures(processedText);
    
    // Calculate confidence scores for all intents
    const scores: Array<{ intent: Intent; confidence: number }> = [];
    
    for (const [intentId, intent] of this.intents) {
      const confidence = this.calculateIntentConfidence(features, intentId);
      // Lower threshold for initial classification, will be filtered later
      if (confidence > 0.1) {
        scores.push({ intent, confidence });
      }
    }

    // Sort by confidence and return top results
    scores.sort((a, b) => b.confidence - a.confidence);
    
    const results: IntentResult[] = scores.slice(0, this.config.maxAmbiguousResults).map(score => ({
      intent: score.intent,
      confidence: score.confidence,
      entities: [], // Will be populated by EntityExtractor
      parameters: {},
      ambiguousIntents: scores.length > 1 ? scores.slice(1, 3).map(s => ({
        intent: s.intent,
        confidence: s.confidence,
        entities: [],
        parameters: {}
      })) : undefined
    }));

    return results;
  }

  /**
   * Train the model with new examples
   */
  async trainWithExamples(examples: TrainingExample[]): Promise<void> {
    for (const example of examples) {
      const features = this.extractFeatures(example.text);
      this.updateModelWeights(example.intent, features, 1.0);
    }
    
    // Update metrics after training
    await this.evaluateModel(examples);
  }

  /**
   * Get current model performance metrics
   */
  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  /**
   * Preprocess text with elderly-optimized handling
   */
  private preprocessText(text: string, language: string): string {
    let processed = text.toLowerCase().trim();
    
    // Handle common elderly speech patterns
    if (this.config.enableElderlyOptimizations) {
      // Expand contractions
      processed = processed
        .replace(/won't/g, 'will not')
        .replace(/can't/g, 'cannot')
        .replace(/n't/g, ' not')
        .replace(/'ll/g, ' will')
        .replace(/'re/g, ' are')
        .replace(/'ve/g, ' have')
        .replace(/'d/g, ' would');
      
      // Handle repeated words (common in elderly speech)
      processed = processed.replace(/\b(\w+)\s+\1\b/g, '$1');
      
      // Handle filler words
      processed = processed.replace(/\b(um|uh|er|ah)\b/g, '');
    }
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    return processed;
  }

  /**
   * Extract features from preprocessed text
   */
  private extractFeatures(text: string): number[] {
    const words = text.split(' ').filter(word => word.length > 0);
    const features: number[] = new Array(this.vocabulary.size).fill(0);
    
    // Simple binary features (word presence)
    const uniqueWords = new Set(words);
    
    for (const word of uniqueWords) {
      const vocabIndex = this.vocabulary.get(word);
      if (vocabIndex !== undefined) {
        features[vocabIndex] = 1.0; // Binary feature
      }
    }
    
    return features;
  }

  /**
   * Calculate confidence score for a specific intent
   */
  private calculateIntentConfidence(features: number[], intentId: string): number {
    const weights = this.modelWeights.get(intentId);
    if (!weights || weights.length !== features.length) {
      return 0;
    }
    
    // Check if any features are active (non-zero)
    const hasActiveFeatures = features.some(f => f > 0);
    if (!hasActiveFeatures) {
      return 0;
    }
    
    // Simple dot product for linear classification
    let score = 0;
    for (let i = 0; i < features.length; i++) {
      score += features[i] * weights[i];
    }
    
    // Apply sigmoid activation for probability
    return 1 / (1 + Math.exp(-score));
  }

  /**
   * Update model weights using simple gradient descent
   */
  private updateModelWeights(intentId: string, features: number[], target: number): void {
    let weights = this.modelWeights.get(intentId);
    if (!weights || weights.length !== features.length) {
      weights = new Array(features.length).fill(0);
      this.modelWeights.set(intentId, weights);
    }
    
    const prediction = this.calculateIntentConfidence(features, intentId);
    const error = target - prediction;
    const learningRate = 0.1; // Increased learning rate for faster convergence
    
    // Update weights
    for (let i = 0; i < weights.length && i < features.length; i++) {
      weights[i] += learningRate * error * features[i];
    }
  }

  /**
   * Train model for a specific intent using its examples
   */
  private trainIntentModel(intent: Intent): void {
    // Build vocabulary from intent examples first
    intent.examples.forEach(example => {
      const words = this.preprocessText(example, 'en').split(' ').filter(word => word.length > 0);
      words.forEach(word => {
        if (!this.vocabulary.has(word)) {
          this.vocabulary.set(word, this.vocabulary.size);
        }
      });
    });
    
    // Initialize weights if needed
    if (!this.modelWeights.has(intent.id)) {
      this.modelWeights.set(intent.id, new Array(this.vocabulary.size).fill(0));
    }
    
    // Train with positive examples
    intent.examples.forEach(example => {
      const features = this.extractFeatures(this.preprocessText(example, 'en'));
      this.updateModelWeights(intent.id, features, 1.0);
    });
  }

  /**
   * Train intent with both positive and negative examples
   */
  private trainIntentWithNegativeExamples(intent: Intent, allIntents: Intent[]): void {
    // Train with positive examples multiple times
    for (let i = 0; i < 3; i++) {
      intent.examples.forEach(example => {
        const features = this.extractFeatures(this.preprocessText(example, 'en'));
        this.updateModelWeights(intent.id, features, 1.0);
      });
    }

    // Train with negative examples from other intents
    allIntents.forEach(otherIntent => {
      if (otherIntent.id !== intent.id) {
        otherIntent.examples.forEach(example => {
          const features = this.extractFeatures(this.preprocessText(example, 'en'));
          this.updateModelWeights(intent.id, features, 0.0);
        });
      }
    });
  }

  /**
   * Get document frequency for a word across all intents
   */
  private getWordDocumentFrequency(word: string): number {
    let count = 0;
    for (const intent of this.intents.values()) {
      const hasWord = intent.examples.some(example => 
        this.preprocessText(example, 'en').includes(word)
      );
      if (hasWord) count++;
    }
    return count;
  }

  /**
   * Evaluate model performance on test examples
   */
  private async evaluateModel(examples: TrainingExample[]): Promise<void> {
    let correct = 0;
    const confusionMatrix: number[][] = [];
    
    for (const example of examples) {
      const results = await this.classify(example.text);
      if (results.length > 0 && results[0].intent.id === example.intent) {
        correct++;
      }
    }
    
    this.metrics = {
      accuracy: examples.length > 0 ? correct / examples.length : 0,
      precision: 0, // TODO: Implement detailed precision/recall calculation
      recall: 0,
      f1Score: 0,
      confusionMatrix,
      lastUpdated: new Date()
    };
  }

  /**
   * Initialize default intents for common AgentOS operations
   */
  private initializeDefaultIntents(): void {
    const defaultIntents: Intent[] = [
      {
        id: 'call_contact',
        name: 'Call Contact',
        description: 'Make a phone call to a contact',
        examples: [
          'call mom',
          'phone john',
          'ring sarah',
          'dial doctor smith',
          'call my daughter'
        ],
        parameters: [
          {
            name: 'contact',
            type: 'contact',
            required: true,
            description: 'The contact to call'
          }
        ],
        requiredPermissions: ['phone', 'contacts'],
        category: 'communication'
      },
      {
        id: 'send_message',
        name: 'Send Message',
        description: 'Send a text message to a contact',
        examples: [
          'text mom I love you',
          'send message to john',
          'message sarah hello',
          'text my son'
        ],
        parameters: [
          {
            name: 'contact',
            type: 'contact',
            required: true,
            description: 'The contact to message'
          },
          {
            name: 'message',
            type: 'string',
            required: false,
            description: 'The message content'
          }
        ],
        requiredPermissions: ['sms', 'contacts'],
        category: 'communication'
      },
      {
        id: 'set_reminder',
        name: 'Set Reminder',
        description: 'Create a reminder for a specific time',
        examples: [
          'remind me to take medicine at 3pm',
          'set reminder for doctor appointment',
          'remind me about lunch',
          'set alarm for 8am'
        ],
        parameters: [
          {
            name: 'task',
            type: 'string',
            required: true,
            description: 'What to be reminded about'
          },
          {
            name: 'time',
            type: 'date',
            required: false,
            description: 'When to be reminded'
          }
        ],
        requiredPermissions: ['calendar'],
        category: 'productivity'
      },
      {
        id: 'get_weather',
        name: 'Get Weather',
        description: 'Get weather information',
        examples: [
          'what is the weather',
          'how is it outside',
          'weather forecast',
          'will it rain today'
        ],
        parameters: [
          {
            name: 'location',
            type: 'location',
            required: false,
            description: 'Location for weather info'
          },
          {
            name: 'date',
            type: 'date',
            required: false,
            description: 'Date for weather forecast'
          }
        ],
        requiredPermissions: ['location'],
        category: 'information'
      },
      {
        id: 'emergency_help',
        name: 'Emergency Help',
        description: 'Request emergency assistance',
        examples: [
          'help me',
          'emergency',
          'call 911',
          'I need help',
          'something is wrong'
        ],
        parameters: [],
        requiredPermissions: ['phone', 'location'],
        category: 'emergency'
      }
    ];

    // Build vocabulary from all intents first
    defaultIntents.forEach(intent => {
      intent.examples.forEach(example => {
        const words = this.preprocessText(example, 'en').split(' ').filter(word => word.length > 0);
        words.forEach(word => {
          if (!this.vocabulary.has(word)) {
            this.vocabulary.set(word, this.vocabulary.size);
          }
        });
      });
    });

    // Register all intents first
    defaultIntents.forEach(intent => {
      this.registerIntent(intent);
    });

    // Then train with both positive and negative examples
    defaultIntents.forEach(intent => {
      this.trainIntentWithNegativeExamples(intent, defaultIntents);
    });
  }
}