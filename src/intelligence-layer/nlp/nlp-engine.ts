/**
 * NLP Engine - Main orchestrator for natural language processing
 * 
 * Coordinates intent classification, entity extraction, confidence scoring,
 * and language detection to provide comprehensive NLP capabilities.
 */

import { IntentClassifier } from './intent-classifier';
import { EntityExtractor } from './entity-extractor';
import { ConfidenceScorer } from './confidence-scorer';
import { LanguageDetector } from './language-detector';
import { ContextManager } from './context-manager';
import { 
  Intent, 
  ProcessingResult, 
  NLPConfig, 
  TrainingExample,
  ModelMetrics 
} from './types';
import {
  UserContext,
  ContextQuery,
  ContextUpdateRequest,
  ConversationTurn
} from './context-types';

export class NLPEngine {
  private intentClassifier: IntentClassifier;
  private entityExtractor: EntityExtractor;
  private confidenceScorer: ConfidenceScorer;
  private languageDetector: LanguageDetector;
  private contextManager: ContextManager;
  private config: NLPConfig;
  private processingCache: Map<string, ProcessingResult> = new Map();

  constructor(config?: Partial<NLPConfig>) {
    this.config = this.mergeWithDefaultConfig(config);
    
    this.intentClassifier = new IntentClassifier(this.config);
    this.entityExtractor = new EntityExtractor();
    this.confidenceScorer = new ConfidenceScorer(this.config);
    this.languageDetector = new LanguageDetector(this.config);
    this.contextManager = new ContextManager();
  }

  /**
   * Process natural language input with user context awareness
   */
  async processInputWithContext(
    text: string,
    userId: string,
    sessionId: string,
    context?: Record<string, any>
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Get user context for personalized processing
      const userContext = await this.contextManager.getUserContext({
        userId,
        sessionId,
        dataTypes: ['preferences', 'temporal', 'conversation'],
        requesterService: 'nlp-engine'
      });

      // Enhance context with user preferences and history
      const enhancedContext = {
        ...context,
        userPreferences: userContext?.preferences,
        conversationHistory: userContext?.conversationHistory?.slice(-5), // Last 5 turns
        temporalContext: userContext?.temporalContext
      };

      // Process with enhanced context
      const result = await this.processInput(text, enhancedContext);

      // Add conversation turn to context
      if (result.success && result.result) {
        await this.contextManager.addConversationTurn(userId, sessionId, {
          userInput: text,
          processedIntent: result.result.intent.id,
          systemResponse: '', // Would be filled by the response generator
          wasSuccessful: true,
          confidence: result.result.confidence,
          entities: result.result.parameters,
          followUpNeeded: result.needsClarification || false
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Context-aware processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        language: this.config.defaultLanguage,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process natural language input and return structured result
   */
  async processInput(
    text: string, 
    context?: Record<string, any>
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(text, context);
      if (this.processingCache.has(cacheKey)) {
        const cached = this.processingCache.get(cacheKey)!;
        return {
          ...cached,
          processingTime: Date.now() - startTime
        };
      }

      // Detect language
      const language = await this.languageDetector.detectLanguage(text);
      
      // Preprocess text for the detected language
      const processedText = this.languageDetector.preprocessForLanguage(text, language);

      // Classify intent
      const intentResults = await this.intentClassifier.classify(processedText, language);
      
      if (intentResults.length === 0) {
        return {
          success: false,
          error: 'No intents recognized',
          language,
          processingTime: Date.now() - startTime
        };
      }

      // Extract entities for each intent result
      for (const result of intentResults) {
        result.entities = await this.entityExtractor.extractEntities(
          processedText, 
          result.intent.parameters
        );
        
        // Map entities to parameters
        result.parameters = this.mapEntitiesToParameters(result.entities, result.intent.parameters);
      }

      // Score results and handle ambiguity
      const finalResult = await this.confidenceScorer.scoreResults(
        intentResults, 
        processedText, 
        context
      );

      // Cache successful results
      if (finalResult.success && this.processingCache.size < this.config.cacheSize) {
        this.processingCache.set(cacheKey, finalResult);
      }

      return {
        ...finalResult,
        language,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        language: this.config.defaultLanguage,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Register a new intent with the engine
   */
  registerIntent(intent: Intent): void {
    this.intentClassifier.registerIntent(intent);
    this.clearCache(); // Clear cache when intents change
  }

  /**
   * Train the engine with new examples
   */
  async trainWithExamples(examples: TrainingExample[]): Promise<void> {
    await this.intentClassifier.trainWithExamples(examples);
    this.clearCache(); // Clear cache after training
  }

  /**
   * Update user feedback for continuous learning
   */
  updateFeedback(intentId: string, wasCorrect: boolean): void {
    this.confidenceScorer.updateHistoricalAccuracy(intentId, wasCorrect);
  }

  /**
   * Set user's preferred language
   */
  setUserLanguage(languageCode: string): void {
    this.languageDetector.setUserLanguagePreference(languageCode);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return this.languageDetector.getSupportedLanguages().map(lang => lang.code);
  }

  /**
   * Get engine performance metrics
   */
  getMetrics(): {
    intentClassifier: ModelMetrics;
    confidenceScorer: ReturnType<ConfidenceScorer['getSystemMetrics']>;
    contextManager: ReturnType<ContextManager['getMetrics']>;
    cacheHitRate: number;
    averageProcessingTime: number;
  } {
    return {
      intentClassifier: this.intentClassifier.getMetrics(),
      confidenceScorer: this.confidenceScorer.getSystemMetrics(),
      contextManager: this.contextManager.getMetrics(),
      cacheHitRate: this.calculateCacheHitRate(),
      averageProcessingTime: this.calculateAverageProcessingTime()
    };
  }

  /**
   * Clear processing cache
   */
  clearCache(): void {
    this.processingCache.clear();
  }

  /**
   * Update engine configuration
   */
  updateConfig(newConfig: Partial<NLPConfig>): void {
    this.config = this.mergeWithDefaultConfig(newConfig);
    this.clearCache();
  }

  /**
   * Generate clarification prompt for ambiguous results
   */
  generateClarificationPrompt(result: ProcessingResult): string {
    if (result.needsClarification && result.clarificationOptions) {
      return this.confidenceScorer.generateClarificationPrompt(result.clarificationOptions);
    }
    return '';
  }

  /**
   * Get context manager instance for external access
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }

  /**
   * Update user context through NLP engine
   */
  async updateUserContext(request: ContextUpdateRequest): Promise<boolean> {
    return await this.contextManager.updateUserContext(request);
  }

  /**
   * Get user context with privacy filtering
   */
  async getUserContext(query: ContextQuery): Promise<Partial<UserContext> | null> {
    return await this.contextManager.getUserContext(query);
  }

  /**
   * Update user location context
   */
  async updateUserLocation(userId: string, location: any): Promise<void> {
    await this.contextManager.updateLocationContext(userId, location);
  }

  /**
   * Update user activity context
   */
  async updateUserActivity(userId: string, activity: any): Promise<void> {
    await this.contextManager.updateActivityContext(userId, activity);
  }

  /**
   * Update device state
   */
  async updateDeviceState(userId: string, deviceState: any): Promise<void> {
    await this.contextManager.updateDeviceState(userId, deviceState);
  }

  /**
   * Map extracted entities to intent parameters
   */
  private mapEntitiesToParameters(entities: any[], parameters: any[]): Record<string, any> {
    const parameterMap: Record<string, any> = {};

    for (const entity of entities) {
      const parameterName = entity.metadata?.parameterName;
      if (parameterName) {
        // Convert entity value to appropriate type
        const parameter = parameters.find(p => p.name === parameterName);
        if (parameter) {
          parameterMap[parameterName] = this.convertEntityValue(entity.value, parameter.type);
        }
      }
    }

    return parameterMap;
  }

  /**
   * Convert entity value to the expected parameter type
   */
  private convertEntityValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'date':
        return this.parseDate(value);
      default:
        return value;
    }
  }

  /**
   * Parse date from various formats
   */
  private parseDate(value: string): Date | string {
    // Handle relative dates
    const now = new Date();
    const lowerValue = value.toLowerCase();

    if (lowerValue === 'today' || lowerValue === 'now') {
      return now;
    }
    
    if (lowerValue === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (lowerValue === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Try to parse as regular date
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? value : parsed;
  }

  /**
   * Generate cache key for input and context
   */
  private generateCacheKey(text: string, context?: Record<string, any>): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${text.toLowerCase().trim()}|${contextStr}`;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // This would need to be tracked over time in a real implementation
    return 0; // Placeholder
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(): number {
    // This would need to be tracked over time in a real implementation
    return 0; // Placeholder
  }

  /**
   * Merge user config with default configuration
   */
  private mergeWithDefaultConfig(userConfig?: Partial<NLPConfig>): NLPConfig {
    const defaultConfig: NLPConfig = {
      languages: [
        {
          code: 'en',
          name: 'English',
          enabled: true,
          confidenceThreshold: 0.7
        },
        {
          code: 'es',
          name: 'Spanish',
          enabled: true,
          confidenceThreshold: 0.7
        },
        {
          code: 'fr',
          name: 'French',
          enabled: false,
          confidenceThreshold: 0.7
        },
        {
          code: 'de',
          name: 'German',
          enabled: false,
          confidenceThreshold: 0.7
        },
        {
          code: 'zh',
          name: 'Chinese',
          enabled: false,
          confidenceThreshold: 0.7
        }
      ],
      defaultLanguage: 'en',
      confidenceThreshold: 0.7,
      maxAmbiguousResults: 3,
      enableElderlyOptimizations: true,
      cacheSize: 100
    };

    return {
      ...defaultConfig,
      ...userConfig,
      languages: userConfig?.languages || defaultConfig.languages
    };
  }
}