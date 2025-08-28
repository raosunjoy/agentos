/**
 * Speech-to-Text Engine - On-device speech recognition
 * 
 * Provides real-time speech recognition with elderly optimizations,
 * adaptive learning, and noise robustness.
 */

import { 
  SpeechRecognitionResult, 
  AudioConfig, 
  UserVoiceProfile,
  ElderlyOptimizations 
} from './types';

export class SpeechToTextEngine {
  private config: AudioConfig;
  private elderlyOptimizations: ElderlyOptimizations;
  private userProfile?: UserVoiceProfile;
  private isListening: boolean = false;
  private recognitionBuffer: Float32Array[] = [];
  private silenceTimer?: NodeJS.Timeout;

  constructor(
    config: AudioConfig,
    elderlyOptimizations: ElderlyOptimizations,
    userProfile?: UserVoiceProfile
  ) {
    this.config = config;
    this.elderlyOptimizations = elderlyOptimizations;
    this.userProfile = userProfile;
  }

  /**
   * Start continuous speech recognition
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    this.recognitionBuffer = [];
    
    // Initialize audio capture (mock implementation for now)
    console.log('Starting speech recognition...');
  }

  /**
   * Stop speech recognition
   */
  async stopListening(): Promise<void> {
    this.isListening = false;
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = undefined;
    }
    
    console.log('Stopped speech recognition');
  }

  /**
   * Process audio chunk and return recognition result
   */
  async processAudioChunk(audioData: Float32Array): Promise<SpeechRecognitionResult | null> {
    const startTime = Date.now();

    if (!this.isListening) {
      return null;
    }

    // Add to buffer
    this.recognitionBuffer.push(audioData);

    // Apply elderly optimizations
    const processedAudio = this.applyElderlyOptimizations(audioData);

    // Perform speech recognition (mock implementation)
    const recognitionResult = await this.performRecognition(processedAudio);

    if (recognitionResult) {
      recognitionResult.processingTime = Date.now() - startTime;
      
      // Apply post-processing for elderly users
      if (this.elderlyOptimizations.repeatWordHandling) {
        recognitionResult.text = this.handleRepeatedWords(recognitionResult.text);
      }
      
      if (this.elderlyOptimizations.fillerWordRemoval) {
        recognitionResult.text = this.removeFillerWords(recognitionResult.text);
      }
    }

    return recognitionResult;
  }

  /**
   * Process complete utterance with full context
   */
  async processUtterance(audioBuffer: Float32Array): Promise<SpeechRecognitionResult> {
    const startTime = Date.now();

    // Apply preprocessing
    const processedAudio = this.preprocessAudio(audioBuffer);

    // Perform recognition with full context
    const result = await this.performRecognition(processedAudio);

    if (result) {
      result.processingTime = Date.now() - startTime;
      
      // Apply elderly-specific post-processing
      result.text = this.postProcessForElderly(result.text);
      
      // Update user profile if adaptive learning is enabled
      if (this.userProfile) {
        this.updateUserProfile(result, audioBuffer);
      }
    }

    return result || {
      text: '',
      confidence: 0,
      isFinal: true,
      processingTime: Date.now() - startTime,
      language: 'en'
    };
  }

  /**
   * Set user voice profile for adaptive recognition
   */
  setUserProfile(profile: UserVoiceProfile): void {
    this.userProfile = profile;
  }

  /**
   * Get current recognition metrics
   */
  getMetrics(): {
    averageConfidence: number;
    averageProcessingTime: number;
    recognitionAccuracy: number;
  } {
    // Mock metrics - in real implementation, these would be tracked
    return {
      averageConfidence: 0.85,
      averageProcessingTime: 150,
      recognitionAccuracy: 0.92
    };
  }

  /**
   * Apply elderly-specific audio optimizations
   */
  private applyElderlyOptimizations(audioData: Float32Array): Float32Array {
    let processed = new Float32Array(audioData);

    if (this.elderlyOptimizations.volumeNormalization) {
      processed = this.normalizeVolume(processed);
    }

    if (this.elderlyOptimizations.clarityEnhancement) {
      processed = this.enhanceClarity(processed);
    }

    return processed;
  }

  /**
   * Preprocess audio for better recognition
   */
  private preprocessAudio(audioBuffer: Float32Array): Float32Array {
    let processed = new Float32Array(audioBuffer);

    // Apply noise reduction
    processed = this.reduceNoise(processed);

    // Normalize audio levels
    processed = this.normalizeAudio(processed);

    // Apply user-specific adaptations
    if (this.userProfile) {
      processed = this.applyUserAdaptations(processed);
    }

    return processed;
  }

  /**
   * Perform actual speech recognition (mock implementation)
   */
  private async performRecognition(audioData: Float32Array): Promise<SpeechRecognitionResult | null> {
    // Mock implementation - in real system, this would use actual STT engine
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Mock recognition based on audio characteristics
    const energy = this.calculateAudioEnergy(audioData);
    
    if (energy < 0.01 || audioData.length === 0) {
      return null; // Too quiet, likely silence, or empty audio
    }

    // Mock text generation based on audio patterns
    const mockTexts = [
      'call mom',
      'text john hello',
      'remind me to take medicine',
      'what is the weather',
      'help me please',
      'turn on the lights',
      'play some music'
    ];

    const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
    const confidence = Math.min(0.95, 0.6 + (energy * 10));

    return {
      text: randomText,
      confidence,
      alternatives: [
        { text: randomText, confidence },
        { text: mockTexts[(mockTexts.indexOf(randomText) + 1) % mockTexts.length], confidence: confidence * 0.8 }
      ],
      isFinal: true,
      processingTime: 0, // Will be set by caller
      language: 'en'
    };
  }

  /**
   * Handle repeated words common in elderly speech
   */
  private handleRepeatedWords(text: string): string {
    // Remove consecutive duplicate words
    return text.replace(/\b(\w+)\s+\1\b/gi, '$1');
  }

  /**
   * Remove filler words
   */
  private removeFillerWords(text: string): string {
    const fillerWords = ['um', 'uh', 'er', 'ah', 'like', 'you know'];
    const pattern = new RegExp(`\\b(${fillerWords.join('|')})\\b`, 'gi');
    return text.replace(pattern, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Apply comprehensive elderly-specific post-processing
   */
  private postProcessForElderly(text: string): string {
    let processed = text;

    if (this.elderlyOptimizations.repeatWordHandling) {
      processed = this.handleRepeatedWords(processed);
    }

    if (this.elderlyOptimizations.fillerWordRemoval) {
      processed = this.removeFillerWords(processed);
    }

    // Handle common elderly speech patterns
    processed = this.correctCommonMispronunciations(processed);
    processed = this.handleSlowSpeechArtifacts(processed);

    return processed;
  }

  /**
   * Correct common mispronunciations based on user profile
   */
  private correctCommonMispronunciations(text: string): string {
    if (!this.userProfile?.adaptationData.commonMispronunciations) {
      return text;
    }

    let corrected = text;
    for (const [mispronounced, correct] of this.userProfile.adaptationData.commonMispronunciations) {
      const regex = new RegExp(`\\b${mispronounced}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    }

    return corrected;
  }

  /**
   * Handle artifacts from slow speech
   */
  private handleSlowSpeechArtifacts(text: string): string {
    // Remove extra spaces and normalize
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Update user profile based on recognition results
   */
  private updateUserProfile(result: SpeechRecognitionResult, audioBuffer: Float32Array): void {
    if (!this.userProfile) return;

    // Update speech characteristics
    const speechRate = this.calculateSpeechRate(result.text, audioBuffer.length);
    this.userProfile.voiceCharacteristics.speechRate = 
      (this.userProfile.voiceCharacteristics.speechRate + speechRate) / 2;

    // Update last modified timestamp
    this.userProfile.lastUpdated = new Date();
  }

  /**
   * Calculate speech rate (words per minute)
   */
  private calculateSpeechRate(text: string, audioSamples: number): number {
    const words = text.split(' ').length;
    const durationSeconds = audioSamples / this.config.sampleRate;
    const durationMinutes = durationSeconds / 60;
    return words / durationMinutes;
  }

  /**
   * Calculate audio energy level
   */
  private calculateAudioEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Normalize audio volume
   */
  private normalizeVolume(audioData: Float32Array): Float32Array {
    if (audioData.length === 0) return audioData;
    
    // Handle large arrays efficiently to avoid stack overflow
    let maxAmplitude = 0;
    for (let i = 0; i < audioData.length; i++) {
      const abs = Math.abs(audioData[i]);
      if (abs > maxAmplitude) {
        maxAmplitude = abs;
      }
    }
    
    if (maxAmplitude === 0) return audioData;

    const targetAmplitude = 0.7;
    const scaleFactor = targetAmplitude / maxAmplitude;

    const normalized = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      normalized[i] = audioData[i] * scaleFactor;
    }
    
    return normalized;
  }

  /**
   * Enhance audio clarity
   */
  private enhanceClarity(audioData: Float32Array): Float32Array {
    // Simple high-pass filter to enhance clarity
    const filtered = new Float32Array(audioData.length);
    const alpha = 0.95; // High-pass filter coefficient

    filtered[0] = audioData[0];
    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + audioData[i] - audioData[i - 1]);
    }

    return filtered;
  }

  /**
   * Reduce background noise
   */
  private reduceNoise(audioData: Float32Array): Float32Array {
    // Simple noise gate
    const threshold = 0.02;
    return audioData.map(sample => Math.abs(sample) < threshold ? 0 : sample);
  }

  /**
   * Normalize audio levels
   */
  private normalizeAudio(audioData: Float32Array): Float32Array {
    return this.normalizeVolume(audioData);
  }

  /**
   * Apply user-specific adaptations
   */
  private applyUserAdaptations(audioData: Float32Array): Float32Array {
    if (!this.userProfile) return audioData;

    // Apply user-specific noise profile compensation
    let adapted = new Float32Array(audioData);

    // Adjust for user's typical volume level
    const volumeAdjustment = 0.8 / this.userProfile.voiceCharacteristics.volumeLevel;
    adapted = adapted.map(sample => sample * volumeAdjustment);

    return adapted;
  }
}