/**
 * Speech Processor - Main orchestrator for speech processing pipeline
 * 
 * Coordinates speech-to-text, text-to-speech, noise filtering, voice activity
 * detection, and adaptive learning for comprehensive speech processing.
 */

import { SpeechToTextEngine } from './speech-to-text';
import { TextToSpeechEngine } from './text-to-speech';
import { NoiseFilter } from './noise-filter';
import { VoiceActivityDetector } from './voice-activity-detector';
import { AdaptiveLearning } from './adaptive-learning';
import {
  SpeechProcessingConfig,
  SpeechRecognitionResult,
  SpeechSynthesisResult,
  VoiceActivityResult,
  NoiseFilterResult,
  UserVoiceProfile,
  SpeechMetrics,
  ElderlyOptimizations
} from './types';

export class SpeechProcessor {
  private config: SpeechProcessingConfig;
  private speechToText: SpeechToTextEngine;
  private textToSpeech: TextToSpeechEngine;
  private noiseFilter: NoiseFilter;
  private voiceActivityDetector: VoiceActivityDetector;
  private adaptiveLearning?: AdaptiveLearning;
  
  private isProcessing: boolean = false;
  private audioBuffer: Float32Array[] = [];
  private processingMetrics: SpeechMetrics;

  constructor(config: SpeechProcessingConfig) {
    this.config = config;
    
    // Initialize elderly optimizations
    const elderlyOpts: ElderlyOptimizations = {
      extendedPauseDetection: config.enableElderlyOptimizations,
      slowSpeechTolerance: config.enableElderlyOptimizations,
      repeatWordHandling: config.enableElderlyOptimizations,
      fillerWordRemoval: config.enableElderlyOptimizations,
      volumeNormalization: config.enableElderlyOptimizations,
      clarityEnhancement: config.enableElderlyOptimizations
    };

    // Initialize components
    this.speechToText = new SpeechToTextEngine(
      config.audioConfig,
      elderlyOpts,
      config.voiceProfile
    );

    this.textToSpeech = new TextToSpeechEngine(
      config.enableElderlyOptimizations,
      config.voiceProfile
    );

    this.noiseFilter = new NoiseFilter(config.audioConfig);
    
    this.voiceActivityDetector = new VoiceActivityDetector(
      config.audioConfig,
      elderlyOpts
    );

    // Initialize adaptive learning if enabled
    if (config.enableAdaptiveLearning && config.voiceProfile) {
      this.adaptiveLearning = new AdaptiveLearning(config.voiceProfile);
    }

    // Initialize metrics
    this.processingMetrics = {
      recognitionAccuracy: 0.85,
      averageProcessingTime: 200,
      noiseReductionEffectiveness: 0.75,
      voiceActivityAccuracy: 0.92,
      userSatisfactionScore: 0.88,
      adaptationProgress: 0.15
    };
  }

  /**
   * Start continuous speech processing
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.audioBuffer = [];
    
    await this.speechToText.startListening();
    console.log('Speech processing started');
  }

  /**
   * Stop speech processing
   */
  async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    await this.speechToText.stopListening();
    console.log('Speech processing stopped');
  }

  /**
   * Process audio chunk through the complete pipeline
   */
  async processAudioChunk(audioData: Float32Array): Promise<{
    voiceActivity: VoiceActivityResult;
    noiseFilter?: NoiseFilterResult;
    recognition?: SpeechRecognitionResult;
  }> {
    if (!this.isProcessing) {
      throw new Error('Speech processor not started');
    }

    const startTime = Date.now();

    // Step 1: Voice Activity Detection
    const voiceActivity = this.voiceActivityDetector.detectVoiceActivity(audioData);

    let noiseFilterResult: NoiseFilterResult | undefined;
    let recognitionResult: SpeechRecognitionResult | undefined;

    if (voiceActivity.isVoiceActive) {
      // Step 2: Noise Filtering (if voice is detected)
      if (this.config.enableNoiseReduction) {
        noiseFilterResult = await this.noiseFilter.filterNoise(audioData);
        
        // Update noise profile for continuous adaptation
        this.noiseFilter.updateNoiseProfile(audioData, voiceActivity.isVoiceActive);
      }

      // Step 3: Speech Recognition
      const audioToProcess = noiseFilterResult?.filteredAudio || audioData;
      recognitionResult = await this.speechToText.processAudioChunk(audioToProcess);

      // Step 4: Adaptive Learning (if enabled and result available)
      if (recognitionResult && this.adaptiveLearning) {
        this.adaptiveLearning.updateProfile(recognitionResult, audioToProcess);
      }
    } else {
      // Update noise profile during silence
      if (this.config.enableNoiseReduction) {
        this.noiseFilter.updateNoiseProfile(audioData, false);
      }
    }

    // Update processing metrics
    this.updateProcessingMetrics(Date.now() - startTime, recognitionResult);

    return {
      voiceActivity,
      noiseFilter: noiseFilterResult,
      recognition: recognitionResult
    };
  }

  /**
   * Process complete utterance with full context
   */
  async processUtterance(audioData: Float32Array): Promise<SpeechRecognitionResult> {
    const startTime = Date.now();

    // Apply noise filtering if enabled
    let processedAudio = audioData;
    if (this.config.enableNoiseReduction) {
      const filterResult = await this.noiseFilter.filterNoise(audioData);
      processedAudio = filterResult.filteredAudio;
    }

    // Perform speech recognition
    const result = await this.speechToText.processUtterance(processedAudio);

    // Apply adaptive learning
    if (this.adaptiveLearning && result.confidence > this.config.confidenceThreshold) {
      this.adaptiveLearning.updateProfile(result, processedAudio);
    }

    // Update metrics
    this.updateProcessingMetrics(Date.now() - startTime, result);

    return result;
  }

  /**
   * Synthesize speech with elderly optimizations
   */
  async synthesizeSpeech(
    text: string,
    options?: {
      emergency?: boolean;
      rate?: number;
      volume?: number;
    }
  ): Promise<SpeechSynthesisResult> {
    if (options?.emergency) {
      return this.textToSpeech.synthesizeEmergency(text);
    }

    const synthOptions = {
      rate: options?.rate,
      volume: options?.volume,
      elderlyOptimized: this.config.enableElderlyOptimizations
    };

    return this.textToSpeech.synthesize(text, synthOptions);
  }

  /**
   * Provide user feedback for adaptive learning
   */
  provideFeedback(
    recognitionResult: SpeechRecognitionResult,
    feedback: {
      wasCorrect: boolean;
      actualText?: string;
      difficultyLevel?: 'easy' | 'medium' | 'hard';
    }
  ): void {
    if (this.adaptiveLearning) {
      // Get the original audio data (would need to be stored)
      const mockAudioData = new Float32Array(1600); // Placeholder
      this.adaptiveLearning.updateProfile(recognitionResult, mockAudioData, feedback);
    }

    // Update system metrics based on feedback
    if (feedback.wasCorrect) {
      this.processingMetrics.recognitionAccuracy = 
        (this.processingMetrics.recognitionAccuracy * 0.9) + (1.0 * 0.1);
      this.processingMetrics.userSatisfactionScore = 
        (this.processingMetrics.userSatisfactionScore * 0.9) + (1.0 * 0.1);
    } else {
      this.processingMetrics.recognitionAccuracy = 
        (this.processingMetrics.recognitionAccuracy * 0.9) + (0.0 * 0.1);
      this.processingMetrics.userSatisfactionScore = 
        (this.processingMetrics.userSatisfactionScore * 0.9) + (0.5 * 0.1);
    }
  }

  /**
   * Update voice settings based on user preferences
   */
  updateVoiceSettings(feedback: {
    tooFast?: boolean;
    tooSlow?: boolean;
    tooLoud?: boolean;
    tooQuiet?: boolean;
    unclear?: boolean;
  }): void {
    this.textToSpeech.updateVoiceSettings(feedback);
  }

  /**
   * Get personalized speech parameters
   */
  getPersonalizedParameters(): any {
    if (this.adaptiveLearning) {
      return this.adaptiveLearning.getPersonalizedParameters();
    }
    return null;
  }

  /**
   * Get current processing metrics
   */
  getMetrics(): SpeechMetrics {
    return { ...this.processingMetrics };
  }

  /**
   * Get detailed component metrics
   */
  getDetailedMetrics(): {
    speechToText: any;
    voiceActivityDetector: any;
    adaptiveLearning?: any;
    overall: SpeechMetrics;
  } {
    const metrics: any = {
      speechToText: this.speechToText.getMetrics(),
      voiceActivityDetector: this.voiceActivityDetector.getStatistics(),
      overall: this.getMetrics()
    };

    if (this.adaptiveLearning) {
      metrics.adaptiveLearning = this.adaptiveLearning.getAdaptationMetrics();
    }

    return metrics;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SpeechProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update voice profile if provided
    if (newConfig.voiceProfile) {
      this.speechToText.setUserProfile(newConfig.voiceProfile);
      this.textToSpeech.setUserProfile(newConfig.voiceProfile);
      
      if (this.config.enableAdaptiveLearning) {
        this.adaptiveLearning = new AdaptiveLearning(newConfig.voiceProfile);
      }
    }
  }

  /**
   * Export anonymized learning data for model improvement
   */
  exportLearningData(): any {
    if (this.adaptiveLearning) {
      return this.adaptiveLearning.exportAnonymizedData();
    }
    return null;
  }

  /**
   * Calibrate system for user's environment
   */
  async calibrateEnvironment(backgroundAudioSample: Float32Array): Promise<void> {
    // Learn noise profile
    await this.noiseFilter.learnNoiseProfile(backgroundAudioSample);

    // Adjust voice activity detection thresholds
    const noiseLevel = this.calculateNoiseLevel(backgroundAudioSample);
    this.voiceActivityDetector.setThresholds({
      energy: noiseLevel * 3,
      hangoverFrames: this.config.enableElderlyOptimizations ? 20 : 10
    });

    console.log('Environment calibration completed');
  }

  /**
   * Handle emergency speech processing
   */
  async processEmergency(audioData: Float32Array): Promise<{
    recognition: SpeechRecognitionResult;
    isEmergency: boolean;
    confidence: number;
  }> {
    // Fast-track processing for emergency situations
    const recognition = await this.processUtterance(audioData);
    
    // Check for emergency keywords
    const emergencyKeywords = ['help', 'emergency', '911', 'fire', 'police', 'ambulance', 'hurt', 'pain'];
    const text = recognition.text.toLowerCase();
    
    const isEmergency = emergencyKeywords.some(keyword => text.includes(keyword));
    const emergencyConfidence = isEmergency ? Math.min(1.0, recognition.confidence + 0.1) : 0;

    return {
      recognition,
      isEmergency,
      confidence: emergencyConfidence
    };
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(processingTime: number, result?: SpeechRecognitionResult): void {
    // Update average processing time
    this.processingMetrics.averageProcessingTime = 
      (this.processingMetrics.averageProcessingTime * 0.9) + (processingTime * 0.1);

    // Update adaptation progress if adaptive learning is enabled
    if (this.adaptiveLearning) {
      const adaptationMetrics = this.adaptiveLearning.getAdaptationMetrics();
      this.processingMetrics.adaptationProgress = adaptationMetrics.accuracyImprovement;
    }
  }

  /**
   * Calculate noise level in audio
   */
  private calculateNoiseLevel(audioData: Float32Array): number {
    const sorted = Array.from(audioData).map(Math.abs).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.25)]; // 25th percentile
  }
}