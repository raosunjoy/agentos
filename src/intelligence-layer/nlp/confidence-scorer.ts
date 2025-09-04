/**
 * Confidence Scorer - Evaluates and ranks intent classification results
 * Handles ambiguity resolution and confidence calculation
 */

import { IntentResult, ProcessingResult, ClarificationOptions } from './types';

export interface ConfidenceConfig {
  minimumConfidence: number;
  ambiguityThreshold: number;
  maxResults: number;
  enableAmbiguityResolution: boolean;
  historicalAccuracyWeight: number;
}

export class ConfidenceScorer {
  private config: ConfidenceConfig;
  private historicalAccuracy: Map<string, number> = new Map();
  private intentAccuracyHistory: Map<string, number[]> = new Map();

  constructor(config?: Partial<ConfidenceConfig>) {
    this.config = {
      minimumConfidence: 0.3,
      ambiguityThreshold: 0.1,
      maxResults: 3,
      enableAmbiguityResolution: true,
      historicalAccuracyWeight: 0.3,
      ...config
    };
  }

  /**
   * Score and rank intent results
   */
  async scoreResults(
    intentResults: IntentResult[],
    originalText: string,
    context?: Record<string, any>
  ): Promise<ProcessingResult> {
    if (intentResults.length === 0) {
      return {
        success: false,
        error: 'No intent results to score',
        language: 'en',
        processingTime: 0
      };
    }

    // Apply context-based adjustments
    const adjustedResults = this.applyContextAdjustments(intentResults, context);

    // Calculate final confidence scores
    const scoredResults = this.calculateFinalConfidence(adjustedResults);

    // Sort by confidence (highest first)
    scoredResults.sort((a, b) => b.confidence - a.confidence);

    // Take top results
    const topResults = scoredResults.slice(0, this.config.maxResults);

    // Check for ambiguity
    const isAmbiguous = this.isAmbiguous(topResults);
    const needsClarification = isAmbiguous && this.config.enableAmbiguityResolution;

    // Prepare final result
    const topResult = topResults[0];
    if (!topResult || topResult.confidence < this.config.minimumConfidence) {
      return {
        success: false,
        error: 'Confidence too low for all results',
        language: 'en',
        processingTime: 0,
        needsClarification,
        clarificationOptions: needsClarification ? this.generateClarificationOptions(topResults) : undefined
      };
    }

    return {
      success: true,
      result: topResult,
      alternatives: topResults.slice(1),
      language: 'en',
      processingTime: 0,
      needsClarification,
      clarificationOptions: needsClarification ? this.generateClarificationOptions(topResults) : undefined
    };
  }

  /**
   * Apply context-based adjustments to confidence scores
   */
  private applyContextAdjustments(
    results: IntentResult[],
    context?: Record<string, any>
  ): IntentResult[] {
    if (!context) {
      return results;
    }

    return results.map(result => {
      let adjustedConfidence = result.confidence;

      // Time-based context
      if (context.timeOfDay) {
        adjustedConfidence = this.adjustForTimeOfDay(result, context.timeOfDay, adjustedConfidence);
      }

      // Location-based context
      if (context.location) {
        adjustedConfidence = this.adjustForLocation(result, context.location, adjustedConfidence);
      }

      // User preferences
      if (context.userPreferences) {
        adjustedConfidence = this.adjustForUserPreferences(result, context.userPreferences, adjustedConfidence);
      }

      // Recent conversation context
      if (context.recentIntents) {
        adjustedConfidence = this.adjustForConversationContext(result, context.recentIntents, adjustedConfidence);
      }

      return {
        ...result,
        confidence: Math.max(0, Math.min(1, adjustedConfidence))
      };
    });
  }

  /**
   * Adjust confidence based on time of day
   */
  private adjustForTimeOfDay(
    result: IntentResult,
    timeOfDay: string,
    confidence: number
  ): number {
    const intentId = result.intent.id;
    const hour = new Date().getHours();

    // Morning intents (6-12)
    if (hour >= 6 && hour < 12) {
      if (intentId.includes('breakfast') || intentId.includes('morning') || intentId.includes('wake')) {
        return confidence * 1.2;
      }
    }

    // Evening intents (18-22)
    if (hour >= 18 && hour < 22) {
      if (intentId.includes('dinner') || intentId.includes('evening') || intentId.includes('sleep')) {
        return confidence * 1.2;
      }
    }

    // Work hours (9-17)
    if (hour >= 9 && hour < 17) {
      if (intentId.includes('work') || intentId.includes('meeting') || intentId.includes('schedule')) {
        return confidence * 1.1;
      }
    }

    return confidence;
  }

  /**
   * Adjust confidence based on user location
   */
  private adjustForLocation(
    result: IntentResult,
    location: any,
    confidence: number
  ): number {
    const intentId = result.intent.id;

    // Location-based intent adjustments
    if (intentId.includes('restaurant') || intentId.includes('food')) {
      // Could boost confidence if near restaurants
      return confidence * 1.1;
    }

    if (intentId.includes('transport') || intentId.includes('directions')) {
      // Could boost confidence for navigation intents
      return confidence * 1.1;
    }

    return confidence;
  }

  /**
   * Adjust confidence based on user preferences
   */
  private adjustForUserPreferences(
    result: IntentResult,
    preferences: any,
    confidence: number
  ): number {
    const intentId = result.intent.id;

    // Check if this intent matches user's preferred interaction style
    if (preferences.preferredIntents && preferences.preferredIntents.includes(intentId)) {
      return confidence * 1.15;
    }

    // Check if this intent type matches user's preferences
    if (preferences.disabledIntentTypes) {
      const intentType = intentId.split('_')[0]; // Extract intent category
      if (preferences.disabledIntentTypes.includes(intentType)) {
        return confidence * 0.5; // Reduce confidence for disabled types
      }
    }

    return confidence;
  }

  /**
   * Adjust confidence based on recent conversation context
   */
  private adjustForConversationContext(
    result: IntentResult,
    recentIntents: string[],
    confidence: number
  ): number {
    const intentId = result.intent.id;

    // Check for follow-up intents
    const recentIntentCategories = recentIntents.map(intent => intent.split('_')[0]);

    if (recentIntentCategories.includes(intentId.split('_')[0])) {
      // Boost confidence for intents in the same category as recent ones
      return confidence * 1.1;
    }

    // Check for related intents
    const relatedIntents = this.getRelatedIntents(intentId);
    const hasRelatedRecent = relatedIntents.some(related =>
      recentIntents.some(recent => recent.includes(related))
    );

    if (hasRelatedRecent) {
      return confidence * 1.05;
    }

    return confidence;
  }

  /**
   * Calculate final confidence incorporating historical accuracy
   */
  private calculateFinalConfidence(results: IntentResult[]): IntentResult[] {
    return results.map(result => {
      const intentId = result.intent.id;
      const historicalAccuracy = this.historicalAccuracy.get(intentId) || 0.5;
      const baseConfidence = result.confidence;

      // Combine base confidence with historical accuracy
      const finalConfidence = (baseConfidence * (1 - this.config.historicalAccuracyWeight)) +
                             (historicalAccuracy * this.config.historicalAccuracyWeight);

      return {
        ...result,
        confidence: Math.max(0, Math.min(1, finalConfidence))
      };
    });
  }

  /**
   * Check if results are ambiguous
   */
  private isAmbiguous(results: IntentResult[]): boolean {
    if (results.length < 2) {
      return false;
    }

    const topConfidence = results[0].confidence;
    const secondConfidence = results[1].confidence;

    // Consider ambiguous if the confidence difference is small
    return (topConfidence - secondConfidence) < this.config.ambiguityThreshold;
  }

  /**
   * Generate clarification options for ambiguous results
   */
  private generateClarificationOptions(results: IntentResult[]): ClarificationOptions {
    const options = results.slice(0, 3).map(result => ({
      intentId: result.intent.id,
      description: result.intent.description || result.intent.name,
      confidence: result.confidence
    }));

    return {
      message: "I found multiple possible interpretations. Could you clarify what you mean?",
      options,
      timeoutMs: 30000
    };
  }

  /**
   * Generate a clarification prompt for user
   */
  generateClarificationPrompt(options: ClarificationOptions): string {
    let prompt = options.message + "\n\n";

    options.options.forEach((option, index) => {
      prompt += `${index + 1}. ${option.description} (${Math.round(option.confidence * 100)}% confidence)\n`;
    });

    prompt += "\nYou can say 'option 1', 'option 2', etc., or rephrase your request.";

    return prompt;
  }

  /**
   * Update historical accuracy for an intent
   */
  updateHistoricalAccuracy(intentId: string, wasCorrect: boolean): void {
    // Update accuracy history
    if (!this.intentAccuracyHistory.has(intentId)) {
      this.intentAccuracyHistory.set(intentId, []);
    }

    const history = this.intentAccuracyHistory.get(intentId)!;
    history.push(wasCorrect ? 1 : 0);

    // Keep only last 100 predictions
    if (history.length > 100) {
      history.shift();
    }

    // Calculate rolling accuracy
    const correctPredictions = history.reduce((sum, val) => sum + val, 0);
    const accuracy = correctPredictions / history.length;

    this.historicalAccuracy.set(intentId, accuracy);
  }

  /**
   * Get system metrics for monitoring
   */
  getSystemMetrics(): {
    averageHistoricalAccuracy: number;
    totalIntentHistory: number;
    intentsWithHistory: number;
    clarificationRate: number;
  } {
    const accuracies = Array.from(this.historicalAccuracy.values());
    const averageAccuracy = accuracies.length > 0
      ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
      : 0;

    const totalHistory = Array.from(this.intentAccuracyHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    return {
      averageHistoricalAccuracy: averageAccuracy,
      totalIntentHistory: totalHistory,
      intentsWithHistory: this.historicalAccuracy.size,
      clarificationRate: 0 // Would need to track clarification events
    };
  }

  /**
   * Get related intents for context adjustment
   */
  private getRelatedIntents(intentId: string): string[] {
    // Simple relatedness mapping - in a real system, this would use semantic similarity
    const relatedMap: Record<string, string[]> = {
      'schedule_meeting': ['calendar', 'time', 'availability'],
      'book_restaurant': ['food', 'location', 'reservation'],
      'send_message': ['communication', 'contact', 'text'],
      'play_music': ['entertainment', 'audio', 'song'],
      'get_weather': ['forecast', 'location', 'temperature'],
      'set_reminder': ['calendar', 'time', 'notification']
    };

    const category = intentId.split('_')[0];
    return relatedMap[intentId] || relatedMap[category] || [];
  }

  /**
   * Reset scorer state
   */
  reset(): void {
    this.historicalAccuracy.clear();
    this.intentAccuracyHistory.clear();
  }

  /**
   * Update scorer configuration
   */
  updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}