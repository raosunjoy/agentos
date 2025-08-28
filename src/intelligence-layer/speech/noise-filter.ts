/**
 * Noise Filter - Advanced noise reduction for speech processing
 * 
 * Implements sophisticated noise filtering algorithms to improve
 * speech recognition accuracy in various acoustic environments.
 */

import { NoiseFilterResult, AudioConfig } from './types';

export class NoiseFilter {
  private config: AudioConfig;
  private noiseProfile: Float32Array | null = null;
  private adaptiveThreshold: number = 0.02;
  private spectralSubtractionAlpha: number = 2.0;
  private spectralSubtractionBeta: number = 0.01;

  constructor(config: AudioConfig) {
    this.config = config;
  }

  /**
   * Apply comprehensive noise filtering to audio
   */
  async filterNoise(audioData: Float32Array): Promise<NoiseFilterResult> {
    const startTime = Date.now();

    // Calculate initial noise level
    const initialNoiseLevel = this.calculateNoiseLevel(audioData);

    // Apply multiple filtering stages
    let filtered = new Float32Array(audioData);

    // Stage 1: Adaptive noise gate
    filtered = this.applyAdaptiveNoiseGate(filtered);

    // Stage 2: Spectral subtraction
    filtered = await this.applySpectralSubtraction(filtered);

    // Stage 3: Wiener filtering
    filtered = this.applyWienerFilter(filtered);

    // Stage 4: High-pass filter for speech clarity
    filtered = this.applyHighPassFilter(filtered);

    // Calculate final noise level and SNR
    const finalNoiseLevel = this.calculateNoiseLevel(filtered);
    const signalLevel = this.calculateSignalLevel(filtered);
    const snr = signalLevel > 0 ? 20 * Math.log10(signalLevel / Math.max(finalNoiseLevel, 0.001)) : 0;

    return {
      filteredAudio: filtered,
      noiseLevel: finalNoiseLevel,
      signalToNoiseRatio: snr
    };
  }

  /**
   * Learn noise profile from background audio
   */
  async learnNoiseProfile(backgroundAudio: Float32Array): Promise<void> {
    // Calculate noise characteristics
    this.noiseProfile = this.calculateNoiseSpectrum(backgroundAudio);
    
    // Update adaptive threshold based on noise level
    const noiseLevel = this.calculateNoiseLevel(backgroundAudio);
    this.adaptiveThreshold = Math.max(0.01, noiseLevel * 1.5);
  }

  /**
   * Update noise profile continuously during operation
   */
  updateNoiseProfile(audioData: Float32Array, isVoiceActive: boolean): void {
    if (isVoiceActive) {
      return; // Don't update during speech
    }

    // Update noise profile with new background audio
    const newNoiseSpectrum = this.calculateNoiseSpectrum(audioData);
    
    if (this.noiseProfile) {
      // Exponential moving average for noise profile adaptation
      const alpha = 0.1;
      for (let i = 0; i < this.noiseProfile.length; i++) {
        this.noiseProfile[i] = (1 - alpha) * this.noiseProfile[i] + alpha * newNoiseSpectrum[i];
      }
    } else {
      this.noiseProfile = newNoiseSpectrum;
    }
  }

  /**
   * Apply adaptive noise gate
   */
  private applyAdaptiveNoiseGate(audioData: Float32Array): Float32Array {
    const filtered = new Float32Array(audioData.length);
    const windowSize = Math.floor(this.config.sampleRate * 0.02); // 20ms window
    
    for (let i = 0; i < audioData.length; i++) {
      const windowStart = Math.max(0, i - windowSize / 2);
      const windowEnd = Math.min(audioData.length, i + windowSize / 2);
      
      // Calculate local energy
      let energy = 0;
      for (let j = windowStart; j < windowEnd; j++) {
        energy += audioData[j] * audioData[j];
      }
      energy = Math.sqrt(energy / (windowEnd - windowStart));
      
      // Apply adaptive gating
      if (energy > this.adaptiveThreshold) {
        filtered[i] = audioData[i];
      } else {
        // Soft gating to avoid artifacts
        const gateRatio = energy / this.adaptiveThreshold;
        filtered[i] = audioData[i] * Math.min(1, gateRatio * gateRatio);
      }
    }
    
    return filtered;
  }

  /**
   * Apply spectral subtraction for noise reduction
   */
  private async applySpectralSubtraction(audioData: Float32Array): Promise<Float32Array> {
    if (!this.noiseProfile) {
      return audioData; // No noise profile available
    }

    const frameSize = 1024;
    const hopSize = frameSize / 2;
    const filtered = new Float32Array(audioData.length);

    // Process audio in overlapping frames
    for (let frameStart = 0; frameStart < audioData.length - frameSize; frameStart += hopSize) {
      const frame = audioData.slice(frameStart, frameStart + frameSize);
      
      // Apply FFT (mock implementation)
      const spectrum = this.fft(frame);
      
      // Apply spectral subtraction
      const cleanSpectrum = this.spectralSubtract(spectrum, this.noiseProfile);
      
      // Apply inverse FFT (mock implementation)
      const cleanFrame = this.ifft(cleanSpectrum);
      
      // Overlap-add reconstruction
      for (let i = 0; i < cleanFrame.length; i++) {
        if (frameStart + i < filtered.length) {
          filtered[frameStart + i] += cleanFrame[i] * this.getWindow(i, frameSize);
        }
      }
    }

    return filtered;
  }

  /**
   * Apply Wiener filter for additional noise reduction
   */
  private applyWienerFilter(audioData: Float32Array): Float32Array {
    const filtered = new Float32Array(audioData.length);
    const windowSize = 64;
    
    for (let i = 0; i < audioData.length; i++) {
      const windowStart = Math.max(0, i - windowSize / 2);
      const windowEnd = Math.min(audioData.length, i + windowSize / 2);
      
      // Estimate signal and noise power
      let signalPower = 0;
      let noisePower = this.adaptiveThreshold * this.adaptiveThreshold;
      
      for (let j = windowStart; j < windowEnd; j++) {
        signalPower += audioData[j] * audioData[j];
      }
      signalPower /= (windowEnd - windowStart);
      
      // Calculate Wiener filter coefficient
      const wienerCoeff = Math.max(0.1, signalPower / (signalPower + noisePower));
      filtered[i] = audioData[i] * wienerCoeff;
    }
    
    return filtered;
  }

  /**
   * Apply high-pass filter to enhance speech clarity
   */
  private applyHighPassFilter(audioData: Float32Array): Float32Array {
    const filtered = new Float32Array(audioData.length);
    const cutoffFreq = 80; // Hz - remove low-frequency noise
    const nyquist = this.config.sampleRate / 2;
    const normalizedCutoff = cutoffFreq / nyquist;
    
    // Simple IIR high-pass filter
    const alpha = Math.exp(-2 * Math.PI * normalizedCutoff);
    
    filtered[0] = audioData[0];
    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + audioData[i] - audioData[i - 1]);
    }
    
    return filtered;
  }

  /**
   * Calculate noise level in audio
   */
  private calculateNoiseLevel(audioData: Float32Array): number {
    // Use lower percentile as noise estimate
    const sorted = Array.from(audioData).map(Math.abs).sort((a, b) => a - b);
    const percentile25 = sorted[Math.floor(sorted.length * 0.25)];
    return percentile25;
  }

  /**
   * Calculate signal level in audio
   */
  private calculateSignalLevel(audioData: Float32Array): number {
    // Use RMS as signal level estimate
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Calculate noise spectrum for spectral subtraction
   */
  private calculateNoiseSpectrum(audioData: Float32Array): Float32Array {
    const frameSize = 1024;
    const numFrames = Math.floor(audioData.length / frameSize);
    const spectrum = new Float32Array(frameSize / 2);
    
    // Average spectrum across multiple frames
    for (let frame = 0; frame < numFrames; frame++) {
      const frameStart = frame * frameSize;
      const frameData = audioData.slice(frameStart, frameStart + frameSize);
      const frameSpectrum = this.fft(frameData);
      
      for (let i = 0; i < spectrum.length; i++) {
        spectrum[i] += frameSpectrum[i] / numFrames;
      }
    }
    
    return spectrum;
  }

  /**
   * Perform spectral subtraction
   */
  private spectralSubtract(signalSpectrum: Float32Array, noiseSpectrum: Float32Array): Float32Array {
    const result = new Float32Array(signalSpectrum.length);
    
    for (let i = 0; i < signalSpectrum.length; i++) {
      const signalMag = Math.abs(signalSpectrum[i]);
      const noiseMag = Math.abs(noiseSpectrum[i]);
      
      // Spectral subtraction formula
      const subtractedMag = signalMag - this.spectralSubtractionAlpha * noiseMag;
      const finalMag = Math.max(this.spectralSubtractionBeta * signalMag, subtractedMag);
      
      // Preserve phase
      const phase = Math.atan2(signalSpectrum[i], signalSpectrum[i]);
      result[i] = finalMag * Math.cos(phase);
    }
    
    return result;
  }

  /**
   * Mock FFT implementation (in real system, use proper FFT library)
   */
  private fft(audioData: Float32Array): Float32Array {
    // Simplified mock - return magnitude spectrum
    const spectrum = new Float32Array(audioData.length / 2);
    
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0, imag = 0;
      
      for (let n = 0; n < audioData.length; n++) {
        const angle = -2 * Math.PI * k * n / audioData.length;
        real += audioData[n] * Math.cos(angle);
        imag += audioData[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Mock inverse FFT implementation
   */
  private ifft(spectrum: Float32Array): Float32Array {
    // Simplified mock - return time domain signal
    const audioData = new Float32Array(spectrum.length * 2);
    
    for (let n = 0; n < audioData.length; n++) {
      let sum = 0;
      
      for (let k = 0; k < spectrum.length; k++) {
        const angle = 2 * Math.PI * k * n / audioData.length;
        sum += spectrum[k] * Math.cos(angle);
      }
      
      audioData[n] = sum / audioData.length;
    }
    
    return audioData;
  }

  /**
   * Get windowing function for overlap-add processing
   */
  private getWindow(index: number, size: number): number {
    // Hann window
    return 0.5 * (1 - Math.cos(2 * Math.PI * index / (size - 1)));
  }
}