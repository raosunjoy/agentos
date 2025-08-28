/**
 * Type definitions for the Speech Processing Pipeline
 */

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize: number;
}

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
  isFinal: boolean;
  processingTime: number;
  language: string;
}

export interface VoiceActivityResult {
  isVoiceActive: boolean;
  confidence: number;
  energyLevel: number;
  timestamp: number;
}

export interface NoiseFilterResult {
  filteredAudio: Float32Array;
  noiseLevel: number;
  signalToNoiseRatio: number;
}

export interface SpeechSynthesisOptions {
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  language: string;
  elderlyOptimized: boolean;
}

export interface SpeechSynthesisResult {
  audioBuffer: ArrayBuffer;
  duration: number;
  sampleRate: number;
  success: boolean;
  error?: string;
}

export interface UserVoiceProfile {
  userId: string;
  voiceCharacteristics: {
    fundamentalFrequency: number;
    speechRate: number;
    pauseDuration: number;
    volumeLevel: number;
  };
  adaptationData: {
    commonMispronunciations: Map<string, string>;
    speechPatterns: string[];
    preferredPace: number;
    backgroundNoiseProfile: Float32Array;
  };
  lastUpdated: Date;
}

export interface SpeechProcessingConfig {
  audioConfig: AudioConfig;
  enableNoiseReduction: boolean;
  enableVoiceActivityDetection: boolean;
  enableElderlyOptimizations: boolean;
  enableAdaptiveLearning: boolean;
  confidenceThreshold: number;
  maxSilenceDuration: number;
  maxSpeechDuration: number;
  language: string;
  voiceProfile?: UserVoiceProfile;
}

export interface ElderlyOptimizations {
  extendedPauseDetection: boolean;
  slowSpeechTolerance: boolean;
  repeatWordHandling: boolean;
  fillerWordRemoval: boolean;
  volumeNormalization: boolean;
  clarityEnhancement: boolean;
}

export interface SpeechMetrics {
  recognitionAccuracy: number;
  averageProcessingTime: number;
  noiseReductionEffectiveness: number;
  voiceActivityAccuracy: number;
  userSatisfactionScore: number;
  adaptationProgress: number;
}