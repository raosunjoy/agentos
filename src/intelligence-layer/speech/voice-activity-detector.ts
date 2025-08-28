/**
 * Voice Activity Detector - Intelligent speech/silence detection
 * 
 * Detects when the user is speaking vs. silence/background noise
 * with optimizations for elderly speech patterns.
 */

import { VoiceActivityResult, AudioConfig, ElderlyOptimizations } from './types';

export class VoiceActivityDetector {
  private config: AudioConfig;
  private elderlyOptimizations: ElderlyOptimizations;
  private energyThreshold: number = 0.02;
  private zeroCrossingThreshold: number = 0.3;
  private spectralCentroidThreshold: number = 1000;
  private hangoverFrames: number = 10;
  private currentHangover: number = 0;
  private isCurrentlyActive: boolean = false;
  private energyHistory: number[] = [];
  private backgroundNoiseLevel: number = 0.01;

  constructor(config: AudioConfig, elderlyOptimizations: ElderlyOptimizations) {
    this.config = config;
    this.elderlyOptimizations = elderlyOptimizations;
    
    // Adjust thresholds for elderly users
    if (elderlyOptimizations.extendedPauseDetection) {
      this.hangoverFrames = 20; // Longer hangover for elderly speech patterns
    }
  }

  /**
   * Detect voice activity in audio frame
   */
  detectVoiceActivity(audioFrame: Float32Array): VoiceActivityResult {
    const timestamp = Date.now();
    
    // Calculate multiple features for robust detection
    const energy = this.calculateEnergy(audioFrame);
    const zeroCrossingRate = this.calculateZeroCrossingRate(audioFrame);
    const spectralCentroid = this.calculateSpectralCentroid(audioFrame);
    const spectralRolloff = this.calculateSpectralRolloff(audioFrame);
    
    // Update background noise estimation
    this.updateBackgroundNoise(energy);
    
    // Apply elderly-specific adjustments
    const adjustedThresholds = this.getAdjustedThresholds();
    
    // Multi-feature voice activity decision
    const energyVote = energy > adjustedThresholds.energy;
    const zcrVote = zeroCrossingRate > adjustedThresholds.zeroCrossing && 
                    zeroCrossingRate < adjustedThresholds.maxZeroCrossing;
    const spectralVote = spectralCentroid > adjustedThresholds.spectralCentroid;
    const rolloffVote = spectralRolloff < adjustedThresholds.spectralRolloff;
    
    // Combine votes with weights
    const voiceScore = this.calculateVoiceScore(energyVote, zcrVote, spectralVote, rolloffVote);
    
    // Apply temporal smoothing and hangover
    const isVoiceActive = this.applyTemporalSmoothing(voiceScore > 0.5);
    
    // Calculate confidence based on feature agreement
    const confidence = this.calculateConfidence(voiceScore, energy, zeroCrossingRate);
    
    return {
      isVoiceActive,
      confidence,
      energyLevel: energy,
      timestamp
    };
  }

  /**
   * Update background noise level estimation
   */
  updateBackgroundNoise(energy: number): void {
    if (!this.isCurrentlyActive) {
      // Exponential moving average for background noise
      const alpha = 0.01;
      this.backgroundNoiseLevel = (1 - alpha) * this.backgroundNoiseLevel + alpha * energy;
      
      // Update energy threshold based on background noise
      this.energyThreshold = Math.max(0.01, this.backgroundNoiseLevel * 3);
    }
  }

  /**
   * Set custom thresholds for specific environments
   */
  setThresholds(thresholds: {
    energy?: number;
    zeroCrossing?: number;
    spectralCentroid?: number;
    hangoverFrames?: number;
  }): void {
    if (thresholds.energy !== undefined) {
      this.energyThreshold = thresholds.energy;
    }
    if (thresholds.zeroCrossing !== undefined) {
      this.zeroCrossingThreshold = thresholds.zeroCrossing;
    }
    if (thresholds.spectralCentroid !== undefined) {
      this.spectralCentroidThreshold = thresholds.spectralCentroid;
    }
    if (thresholds.hangoverFrames !== undefined) {
      this.hangoverFrames = thresholds.hangoverFrames;
    }
  }

  /**
   * Get current detection statistics
   */
  getStatistics(): {
    backgroundNoiseLevel: number;
    currentThresholds: any;
    detectionAccuracy: number;
  } {
    return {
      backgroundNoiseLevel: this.backgroundNoiseLevel,
      currentThresholds: this.getAdjustedThresholds(),
      detectionAccuracy: 0.92 // Mock value - would be calculated from validation data
    };
  }

  /**
   * Calculate energy (RMS) of audio frame
   */
  private calculateEnergy(audioFrame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioFrame.length; i++) {
      sum += audioFrame[i] * audioFrame[i];
    }
    return Math.sqrt(sum / audioFrame.length);
  }

  /**
   * Calculate zero crossing rate
   */
  private calculateZeroCrossingRate(audioFrame: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < audioFrame.length; i++) {
      if ((audioFrame[i] >= 0) !== (audioFrame[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / (audioFrame.length - 1);
  }

  /**
   * Calculate spectral centroid (brightness measure)
   */
  private calculateSpectralCentroid(audioFrame: Float32Array): number {
    const spectrum = this.calculateSpectrum(audioFrame);
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = (i * this.config.sampleRate) / (2 * spectrum.length);
      weightedSum += frequency * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * Calculate spectral rolloff (frequency below which 85% of energy lies)
   */
  private calculateSpectralRolloff(audioFrame: Float32Array): number {
    const spectrum = this.calculateSpectrum(audioFrame);
    const totalEnergy = spectrum.reduce((sum, mag) => sum + mag * mag, 0);
    const threshold = 0.85 * totalEnergy;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= threshold) {
        return (i * this.config.sampleRate) / (2 * spectrum.length);
      }
    }
    
    return this.config.sampleRate / 2; // Nyquist frequency
  }

  /**
   * Calculate magnitude spectrum (simplified)
   */
  private calculateSpectrum(audioFrame: Float32Array): Float32Array {
    // Simplified DFT for spectral analysis
    const N = audioFrame.length;
    const spectrum = new Float32Array(N / 2);
    
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0, imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += audioFrame[n] * Math.cos(angle);
        imag += audioFrame[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Get adjusted thresholds based on elderly optimizations
   */
  private getAdjustedThresholds(): {
    energy: number;
    zeroCrossing: number;
    maxZeroCrossing: number;
    spectralCentroid: number;
    spectralRolloff: number;
  } {
    let energyThreshold = this.energyThreshold;
    let zcrThreshold = this.zeroCrossingThreshold;
    let spectralThreshold = this.spectralCentroidThreshold;
    
    if (this.elderlyOptimizations.slowSpeechTolerance) {
      // Lower thresholds for quieter elderly speech
      energyThreshold *= 0.7;
      zcrThreshold *= 0.8;
    }
    
    if (this.elderlyOptimizations.volumeNormalization) {
      // Adjust for volume variations in elderly speech
      energyThreshold = Math.max(energyThreshold, this.backgroundNoiseLevel * 2);
    }
    
    return {
      energy: energyThreshold,
      zeroCrossing: zcrThreshold,
      maxZeroCrossing: 0.8, // Upper limit to avoid noise
      spectralCentroid: spectralThreshold,
      spectralRolloff: 4000 // Hz
    };
  }

  /**
   * Calculate voice activity score from feature votes
   */
  private calculateVoiceScore(
    energyVote: boolean,
    zcrVote: boolean,
    spectralVote: boolean,
    rolloffVote: boolean
  ): number {
    // Weighted voting system
    const weights = {
      energy: 0.4,
      zcr: 0.2,
      spectral: 0.25,
      rolloff: 0.15
    };
    
    let score = 0;
    if (energyVote) score += weights.energy;
    if (zcrVote) score += weights.zcr;
    if (spectralVote) score += weights.spectral;
    if (rolloffVote) score += weights.rolloff;
    
    return score;
  }

  /**
   * Apply temporal smoothing and hangover mechanism
   */
  private applyTemporalSmoothing(currentDecision: boolean): boolean {
    if (currentDecision) {
      // Voice detected - reset hangover and set active
      this.currentHangover = this.hangoverFrames;
      this.isCurrentlyActive = true;
      return true;
    } else {
      // No voice detected - check hangover
      if (this.currentHangover > 0) {
        this.currentHangover--;
        return true; // Still in hangover period
      } else {
        this.isCurrentlyActive = false;
        return false;
      }
    }
  }

  /**
   * Calculate confidence in voice activity decision
   */
  private calculateConfidence(
    voiceScore: number,
    energy: number,
    zeroCrossingRate: number
  ): number {
    // Base confidence on voice score
    let confidence = voiceScore;
    
    // Boost confidence for clear speech characteristics
    if (energy > this.energyThreshold * 2) {
      confidence = Math.min(1.0, confidence + 0.1);
    }
    
    // Reduce confidence for ambiguous cases
    if (zeroCrossingRate > 0.7) {
      confidence *= 0.8; // Might be noise
    }
    
    // Boost confidence if consistent with recent history
    if (this.energyHistory.length > 0) {
      const avgRecentEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
      if (Math.abs(energy - avgRecentEnergy) < avgRecentEnergy * 0.5) {
        confidence = Math.min(1.0, confidence + 0.05);
      }
    }
    
    // Update energy history
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 10) {
      this.energyHistory.shift();
    }
    
    return Math.max(0.0, Math.min(1.0, confidence));
  }
}