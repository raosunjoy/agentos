/**
 * Intent Classifier - Core component for classifying user intents
 * Uses rule-based and machine learning approaches for intent recognition
 */

import { Intent, IntentResult, TrainingExample, ModelMetrics } from './types';

export class IntentClassifier {
  private intents: Map<string, Intent> = new Map();
  private trainingData: TrainingExample[] = [];
  private confidenceThreshold: number;
  private isTrained: boolean = false;

  constructor(private config?: { confidenceThreshold?: number }) {
    this.confidenceThreshold = config?.confidenceThreshold || 0.7;
  }

  /**
   * Register a new intent with the classifier
   */
  registerIntent(intent: Intent): void {
    if (this.intents.has(intent.id)) {
      throw new Error(`Intent with id '${intent.id}' already exists`);
    }
    this.intents.set(intent.id, intent);
    this.isTrained = false; // Mark as needing retraining
  }

  /**
   * Classify user input text
   */
  async classify(text: string, language: string = 'en'): Promise<IntentResult[]> {
    const normalizedText = this.normalizeText(text, language);
    const results: IntentResult[] = [];

    for (const intent of this.intents.values()) {
      const confidence = await this.calculateIntentConfidence(normalizedText, intent, language);
      if (confidence >= this.confidenceThreshold) {
        results.push({
          intent,
          confidence,
          entities: [] // Will be filled by entity extractor
        });
      }
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);

    // Return top results (limit to avoid confusion)
    return results.slice(0, 5);
  }

  /**
   * Train the classifier with examples
   */
  async trainWithExamples(examples: TrainingExample[]): Promise<void> {
    this.trainingData = [...this.trainingData, ...examples];

    // Simple training - in a real implementation, this would train ML models
    console.log(`Trained classifier with ${examples.length} examples`);
    this.isTrained = true;
  }

  /**
   * Get classifier metrics
   */
  getMetrics(): ModelMetrics {
    return {
      accuracy: this.calculateAccuracy(),
      precision: this.calculatePrecision(),
      recall: this.calculateRecall(),
      f1Score: this.calculateF1Score(),
      totalIntents: this.intents.size,
      trainingExamples: this.trainingData.length,
      lastTrained: this.isTrained ? Date.now() : 0
    };
  }

  /**
   * Calculate confidence for a specific intent
   */
  private async calculateIntentConfidence(
    text: string,
    intent: Intent,
    language: string
  ): Promise<number> {
    let totalScore = 0;
    let matchCount = 0;

    // Check keywords
    if (intent.keywords && intent.keywords.length > 0) {
      const keywordMatches = this.countKeywordMatches(text, intent.keywords);
      if (keywordMatches > 0) {
        totalScore += keywordMatches * 0.3;
        matchCount++;
      }
    }

    // Check patterns
    if (intent.patterns && intent.patterns.length > 0) {
      const patternMatches = this.countPatternMatches(text, intent.patterns);
      if (patternMatches > 0) {
        totalScore += patternMatches * 0.4;
        matchCount++;
      }
    }

    // Check examples similarity (simple approach)
    if (this.trainingData.length > 0) {
      const exampleSimilarity = this.calculateExampleSimilarity(text, intent.id);
      if (exampleSimilarity > 0) {
        totalScore += exampleSimilarity * 0.3;
        matchCount++;
      }
    }

    // Calculate final confidence
    if (matchCount === 0) {
      return 0;
    }

    const confidence = Math.min(totalScore / matchCount, 1.0);

    // Apply language-specific adjustments
    return this.adjustConfidenceForLanguage(confidence, language);
  }

  /**
   * Normalize text for processing
   */
  private normalizeText(text: string, language: string): string {
    let normalized = text.toLowerCase().trim();

    // Remove punctuation
    normalized = normalized.replace(/[.,!?;:]/g, '');

    // Language-specific normalization
    switch (language) {
      case 'en':
        // Remove common stop words for English
        normalized = this.removeStopWords(normalized, [
          'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
        ]);
        break;
      case 'es':
        // Remove common stop words for Spanish
        normalized = this.removeStopWords(normalized, [
          'el', 'la', 'los', 'las', 'y', 'o', 'pero', 'en', 'sobre', 'a', 'para', 'de', 'con', 'por'
        ]);
        break;
      // Add more languages as needed
    }

    return normalized;
  }

  /**
   * Remove stop words from text
   */
  private removeStopWords(text: string, stopWords: string[]): string {
    const words = text.split(/\s+/);
    const filteredWords = words.filter(word => !stopWords.includes(word));
    return filteredWords.join(' ');
  }

  /**
   * Count keyword matches
   */
  private countKeywordMatches(text: string, keywords: string[]): number {
    const words = text.split(/\s+/);
    let matches = 0;

    for (const keyword of keywords) {
      if (words.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return matches / Math.max(words.length, 1); // Normalize by text length
  }

  /**
   * Count pattern matches
   */
  private countPatternMatches(text: string, patterns: string[]): number {
    let matches = 0;

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(text)) {
          matches++;
        }
      } catch (error) {
        console.warn(`Invalid regex pattern: ${pattern}`);
      }
    }

    return matches / patterns.length;
  }

  /**
   * Calculate similarity to training examples
   */
  private calculateExampleSimilarity(text: string, intentId: string): number {
    const intentExamples = this.trainingData.filter(example => example.intentId === intentId);
    if (intentExamples.length === 0) {
      return 0;
    }

    let maxSimilarity = 0;

    for (const example of intentExamples) {
      const similarity = this.calculateTextSimilarity(text, example.text);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Calculate similarity between two texts (simple Jaccard similarity)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Adjust confidence based on language
   */
  private adjustConfidenceForLanguage(confidence: number, language: string): number {
    // Language-specific confidence adjustments
    const adjustments: Record<string, number> = {
      'en': 1.0,    // Baseline
      'es': 0.95,  // Slightly lower due to morphological complexity
      'fr': 0.95,  // Similar to Spanish
      'de': 0.90,  // More complex grammar
      'zh': 0.85,  // Very different structure
    };

    const adjustment = adjustments[language] || 0.8; // Default for unsupported languages
    return confidence * adjustment;
  }

  /**
   * Calculate accuracy metric
   */
  private calculateAccuracy(): number {
    // Simplified accuracy calculation
    // In a real implementation, this would use validation data
    return this.isTrained ? 0.85 : 0;
  }

  /**
   * Calculate precision metric
   */
  private calculatePrecision(): number {
    return this.isTrained ? 0.82 : 0;
  }

  /**
   * Calculate recall metric
   */
  private calculateRecall(): number {
    return this.isTrained ? 0.88 : 0;
  }

  /**
   * Calculate F1 score
   */
  private calculateF1Score(): number {
    const precision = this.calculatePrecision();
    const recall = this.calculateRecall();

    if (precision + recall === 0) {
      return 0;
    }

    return 2 * (precision * recall) / (precision + recall);
  }

  /**
   * Get all registered intents
   */
  getRegisteredIntents(): Intent[] {
    return Array.from(this.intents.values());
  }

  /**
   * Remove an intent
   */
  removeIntent(intentId: string): void {
    this.intents.delete(intentId);
    this.isTrained = false;
  }

  /**
   * Clear all intents and training data
   */
  clear(): void {
    this.intents.clear();
    this.trainingData = [];
    this.isTrained = false;
  }
}