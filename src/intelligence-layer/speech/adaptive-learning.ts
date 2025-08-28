/**
 * Adaptive Learning - Personalized speech recognition improvement
 * 
 * Learns from user speech patterns to improve recognition accuracy
 * over time while maintaining privacy.
 */

import { UserVoiceProfile, SpeechRecognitionResult } from './types';

export class AdaptiveLearning {
  private userProfile: UserVoiceProfile;
  private learningRate: number = 0.1;
  private minConfidenceForLearning: number = 0.8;
  private maxProfileSize: number = 1000;

  constructor(userProfile: UserVoiceProfile) {
    this.userProfile = userProfile;
  }

  /**
   * Update user profile based on recognition results and feedback
   */
  updateProfile(
    recognitionResult: SpeechRecognitionResult,
    audioData: Float32Array,
    userFeedback?: {
      wasCorrect: boolean;
      actualText?: string;
      difficultyLevel?: 'easy' | 'medium' | 'hard';
    }
  ): void {
    // Only learn from high-confidence results or explicit feedback
    if (recognitionResult.confidence < this.minConfidenceForLearning && !userFeedback?.wasCorrect) {
      return;
    }

    // Update voice characteristics
    this.updateVoiceCharacteristics(audioData, recognitionResult);

    // Update speech patterns
    this.updateSpeechPatterns(recognitionResult.text);

    // Handle user corrections
    if (userFeedback && !userFeedback.wasCorrect && userFeedback.actualText) {
      this.learnFromCorrection(recognitionResult.text, userFeedback.actualText);
    }

    // Update adaptation data
    this.updateAdaptationData(recognitionResult, audioData);

    // Update timestamp
    this.userProfile.lastUpdated = new Date();
  }

  /**
   * Get personalized recognition parameters
   */
  getPersonalizedParameters(): {
    speechRateAdjustment: number;
    volumeAdjustment: number;
    pauseToleranceMultiplier: number;
    customVocabulary: string[];
    commonPhrases: string[];
  } {
    return {
      speechRateAdjustment: this.calculateSpeechRateAdjustment(),
      volumeAdjustment: this.calculateVolumeAdjustment(),
      pauseToleranceMultiplier: this.calculatePauseToleranceMultiplier(),
      customVocabulary: this.extractCustomVocabulary(),
      commonPhrases: this.userProfile.adaptationData.speechPatterns.slice(0, 20)
    };
  }

  /**
   * Predict likely next words based on user patterns
   */
  predictNextWords(partialText: string, maxSuggestions: number = 3): string[] {
    const words = partialText.toLowerCase().split(' ');
    const lastWord = words[words.length - 1];
    const context = words.slice(-3).join(' '); // Last 3 words as context

    const suggestions: Array<{ word: string; score: number }> = [];

    // Analyze speech patterns for predictions
    for (const pattern of this.userProfile.adaptationData.speechPatterns) {
      const patternWords = pattern.toLowerCase().split(' ');
      
      // Look for matching contexts
      for (let i = 0; i < patternWords.length - 1; i++) {
        const patternContext = patternWords.slice(Math.max(0, i - 2), i + 1).join(' ');
        
        if (patternContext.includes(context) || context.includes(patternContext)) {
          const nextWord = patternWords[i + 1];
          if (nextWord && nextWord.startsWith(lastWord)) {
            const existingSuggestion = suggestions.find(s => s.word === nextWord);
            if (existingSuggestion) {
              existingSuggestion.score += 1;
            } else {
              suggestions.push({ word: nextWord, score: 1 });
            }
          }
        }
      }
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
      .map(s => s.word);
  }

  /**
   * Get adaptation progress metrics
   */
  getAdaptationMetrics(): {
    totalInteractions: number;
    accuracyImprovement: number;
    vocabularySize: number;
    patternCount: number;
    lastUpdateDays: number;
  } {
    const daysSinceUpdate = Math.floor(
      (Date.now() - this.userProfile.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalInteractions: this.userProfile.adaptationData.speechPatterns.length,
      accuracyImprovement: this.calculateAccuracyImprovement(),
      vocabularySize: this.userProfile.adaptationData.commonMispronunciations.size,
      patternCount: this.userProfile.adaptationData.speechPatterns.length,
      lastUpdateDays: daysSinceUpdate
    };
  }

  /**
   * Export anonymized learning data for model improvement
   */
  exportAnonymizedData(): {
    speechPatterns: string[];
    commonErrors: Array<{ pattern: string; frequency: number }>;
    voiceCharacteristics: {
      speechRateCategory: 'slow' | 'normal' | 'fast';
      volumeCategory: 'quiet' | 'normal' | 'loud';
      pauseCategory: 'short' | 'normal' | 'long';
    };
  } {
    // Anonymize and aggregate data
    const anonymizedPatterns = this.userProfile.adaptationData.speechPatterns
      .map(pattern => this.anonymizePattern(pattern))
      .filter(pattern => pattern.length > 0);

    const errorPatterns = Array.from(this.userProfile.adaptationData.commonMispronunciations.entries())
      .map(([error, correction]) => ({
        pattern: `${this.anonymizeWord(error)} -> ${this.anonymizeWord(correction)}`,
        frequency: 1 // In real implementation, track frequency
      }));

    return {
      speechPatterns: anonymizedPatterns,
      commonErrors: errorPatterns,
      voiceCharacteristics: {
        speechRateCategory: this.categorizeSpeechRate(),
        volumeCategory: this.categorizeVolume(),
        pauseCategory: this.categorizePauseDuration()
      }
    };
  }

  /**
   * Update voice characteristics from audio analysis
   */
  private updateVoiceCharacteristics(audioData: Float32Array, result: SpeechRecognitionResult): void {
    const sampleRate = 16000; // Assume 16kHz sample rate
    
    // Calculate fundamental frequency (pitch)
    const fundamentalFreq = this.estimateFundamentalFrequency(audioData, sampleRate);
    if (fundamentalFreq > 0) {
      this.userProfile.voiceCharacteristics.fundamentalFrequency = 
        this.exponentialMovingAverage(
          this.userProfile.voiceCharacteristics.fundamentalFrequency,
          fundamentalFreq,
          this.learningRate
        );
    }

    // Calculate speech rate
    const wordCount = result.text.split(' ').length;
    const durationSeconds = audioData.length / sampleRate;
    const speechRate = (wordCount / durationSeconds) * 60; // words per minute
    
    this.userProfile.voiceCharacteristics.speechRate = 
      this.exponentialMovingAverage(
        this.userProfile.voiceCharacteristics.speechRate,
        speechRate,
        this.learningRate
      );

    // Calculate volume level
    const rmsVolume = Math.sqrt(
      audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length
    );
    
    this.userProfile.voiceCharacteristics.volumeLevel = 
      this.exponentialMovingAverage(
        this.userProfile.voiceCharacteristics.volumeLevel,
        rmsVolume,
        this.learningRate
      );
  }

  /**
   * Update speech patterns from recognized text
   */
  private updateSpeechPatterns(text: string): void {
    const normalizedText = text.toLowerCase().trim();
    
    if (normalizedText.length > 0) {
      // Add to speech patterns if not already present
      if (!this.userProfile.adaptationData.speechPatterns.includes(normalizedText)) {
        this.userProfile.adaptationData.speechPatterns.push(normalizedText);
        
        // Limit pattern storage to prevent unbounded growth
        if (this.userProfile.adaptationData.speechPatterns.length > this.maxProfileSize) {
          this.userProfile.adaptationData.speechPatterns.shift();
        }
      }
    }
  }

  /**
   * Learn from user corrections
   */
  private learnFromCorrection(recognizedText: string, actualText: string): void {
    const recognizedWords = recognizedText.toLowerCase().split(' ');
    const actualWords = actualText.toLowerCase().split(' ');

    // Simple word-level alignment and mispronunciation detection
    for (let i = 0; i < Math.min(recognizedWords.length, actualWords.length); i++) {
      if (recognizedWords[i] !== actualWords[i]) {
        // Store mispronunciation pattern
        this.userProfile.adaptationData.commonMispronunciations.set(
          recognizedWords[i],
          actualWords[i]
        );
      }
    }

    // Add corrected text to speech patterns
    this.updateSpeechPatterns(actualText);
  }

  /**
   * Update adaptation data with new information
   */
  private updateAdaptationData(result: SpeechRecognitionResult, audioData: Float32Array): void {
    // Update preferred pace based on recognition confidence
    if (result.confidence > 0.9) {
      const currentPace = this.calculateCurrentPace(audioData);
      this.userProfile.adaptationData.preferredPace = 
        this.exponentialMovingAverage(
          this.userProfile.adaptationData.preferredPace,
          currentPace,
          this.learningRate * 0.5 // Slower adaptation for pace
        );
    }
  }

  /**
   * Calculate speech rate adjustment factor
   */
  private calculateSpeechRateAdjustment(): number {
    const normalSpeechRate = 150; // words per minute
    const userRate = this.userProfile.voiceCharacteristics.speechRate;
    
    if (userRate < normalSpeechRate * 0.7) {
      return 0.8; // Slow speaker - increase tolerance
    } else if (userRate > normalSpeechRate * 1.3) {
      return 1.2; // Fast speaker - decrease tolerance
    }
    
    return 1.0; // Normal rate
  }

  /**
   * Calculate volume adjustment factor
   */
  private calculateVolumeAdjustment(): number {
    const normalVolume = 0.1; // Typical RMS level
    const userVolume = this.userProfile.voiceCharacteristics.volumeLevel;
    
    return Math.max(0.5, Math.min(2.0, normalVolume / userVolume));
  }

  /**
   * Calculate pause tolerance multiplier
   */
  private calculatePauseToleranceMultiplier(): number {
    const normalPause = 0.5; // seconds
    const userPause = this.userProfile.voiceCharacteristics.pauseDuration;
    
    return Math.max(1.0, userPause / normalPause);
  }

  /**
   * Extract custom vocabulary from speech patterns
   */
  private extractCustomVocabulary(): string[] {
    const wordFrequency = new Map<string, number>();
    
    // Count word frequencies across all patterns
    for (const pattern of this.userProfile.adaptationData.speechPatterns) {
      const words = pattern.split(' ');
      for (const word of words) {
        if (word.length > 2) { // Ignore very short words
          wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
        }
      }
    }
    
    // Return most frequent words
    return Array.from(wordFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([word]) => word);
  }

  /**
   * Calculate accuracy improvement over time
   */
  private calculateAccuracyImprovement(): number {
    // Mock calculation - in real implementation, track accuracy over time
    const interactionCount = this.userProfile.adaptationData.speechPatterns.length;
    const improvementRate = Math.min(0.3, interactionCount * 0.001);
    return improvementRate;
  }

  /**
   * Estimate fundamental frequency from audio
   */
  private estimateFundamentalFrequency(audioData: Float32Array, sampleRate: number): number {
    // Simplified autocorrelation-based pitch detection
    const minPeriod = Math.floor(sampleRate / 500); // 500 Hz max
    const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz min
    
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < audioData.length - period; i++) {
        correlation += audioData[i] * audioData[i + period];
        count++;
      }
      
      correlation /= count;
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  /**
   * Calculate current pace from audio
   */
  private calculateCurrentPace(audioData: Float32Array): number {
    // Simplified pace calculation based on energy variations
    const frameSize = 160; // 10ms frames at 16kHz
    let energyVariations = 0;
    
    for (let i = frameSize; i < audioData.length; i += frameSize) {
      const currentEnergy = this.calculateFrameEnergy(audioData.slice(i - frameSize, i));
      const previousEnergy = this.calculateFrameEnergy(audioData.slice(i - 2 * frameSize, i - frameSize));
      
      energyVariations += Math.abs(currentEnergy - previousEnergy);
    }
    
    return energyVariations / (audioData.length / frameSize);
  }

  /**
   * Calculate energy of audio frame
   */
  private calculateFrameEnergy(frame: Float32Array): number {
    return Math.sqrt(frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length);
  }

  /**
   * Exponential moving average for smooth updates
   */
  private exponentialMovingAverage(current: number, newValue: number, alpha: number): number {
    return (1 - alpha) * current + alpha * newValue;
  }

  /**
   * Anonymize speech pattern for privacy
   */
  private anonymizePattern(pattern: string): string {
    // Replace specific names and personal information with generic placeholders
    return pattern
      .replace(/\b[A-Z][a-z]+\b/g, '[NAME]') // Proper names
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]') // Phone numbers
      .replace(/\b\d+\s+(street|avenue|road|lane)\b/gi, '[ADDRESS]'); // Addresses
  }

  /**
   * Anonymize individual word
   */
  private anonymizeWord(word: string): string {
    if (word.match(/^[A-Z][a-z]+$/)) {
      return '[NAME]';
    }
    if (word.match(/^\d+$/)) {
      return '[NUMBER]';
    }
    return word;
  }

  /**
   * Categorize speech rate
   */
  private categorizeSpeechRate(): 'slow' | 'normal' | 'fast' {
    const rate = this.userProfile.voiceCharacteristics.speechRate;
    if (rate < 120) return 'slow';
    if (rate > 180) return 'fast';
    return 'normal';
  }

  /**
   * Categorize volume level
   */
  private categorizeVolume(): 'quiet' | 'normal' | 'loud' {
    const volume = this.userProfile.voiceCharacteristics.volumeLevel;
    if (volume < 0.05) return 'quiet';
    if (volume > 0.15) return 'loud';
    return 'normal';
  }

  /**
   * Categorize pause duration
   */
  private categorizePauseDuration(): 'short' | 'normal' | 'long' {
    const pause = this.userProfile.voiceCharacteristics.pauseDuration;
    if (pause < 0.3) return 'short';
    if (pause > 0.8) return 'long';
    return 'normal';
  }
}