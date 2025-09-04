/**
 * Voice Activity Detection (VAD) Module
 * Detects presence of speech in audio stream using advanced algorithms
 */

import { EventEmitter } from 'events';
import { VoiceActivityData, VADSettings } from './types';

export class VoiceActivityDetector extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  private isInitialized = false;
  private isActive = false;
  private settings: VADSettings;
  private detectionInterval: NodeJS.Timeout | null = null;

  // VAD state
  private voiceDetected = false;
  private silenceCounter = 0;
  private voiceCounter = 0;
  private lastActivityTimestamp = 0;

  // Audio processing
  private bufferSize = 1024;
  private sampleRate = 44100;
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;

  // VAD parameters
  private readonly VOICE_THRESHOLD = 15; // dB
  private readonly SILENCE_THRESHOLD = 10; // dB
  private readonly MIN_VOICE_DURATION = 3; // frames
  private readonly MIN_SILENCE_DURATION = 10; // frames
  private readonly ACTIVITY_TIMEOUT = 2000; // ms

  constructor(settings?: Partial<VADSettings>) {
    super();

    this.settings = {
      threshold: 0.3,
      sampleRate: 44100,
      frameSize: 1024,
      sensitivity: 'medium',
      ...settings
    };

    this.adjustSensitivity();
  }

  /**
   * Adjust VAD parameters based on sensitivity setting
   */
  private adjustSensitivity(): void {
    switch (this.settings.sensitivity) {
      case 'low':
        this.voiceCounter = 2;
        this.silenceCounter = 15;
        break;
      case 'high':
        this.voiceCounter = 5;
        this.silenceCounter = 5;
        break;
      case 'medium':
      default:
        this.voiceCounter = 3;
        this.silenceCounter = 10;
        break;
    }
  }

  /**
   * Initialize the voice activity detector
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing Voice Activity Detector...');

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.settings.frameSize;
      this.analyser.smoothingTimeConstant = 0.3;

      // Initialize data arrays
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);

      this.isInitialized = true;
      console.log('Voice Activity Detector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Voice Activity Detector:', error);
      throw error;
    }
  }

  /**
   * Start voice activity detection
   */
  async startDetection(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Voice Activity Detector not initialized');
    }

    if (this.isActive) {
      return;
    }

    try {
      console.log('Starting voice activity detection...');

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.settings.sampleRate
        }
      });

      // Create microphone source
      this.microphone = this.audioContext!.createMediaStreamSource(this.stream);

      // Create script processor for real-time analysis
      this.processor = this.audioContext!.createScriptProcessor(
        this.bufferSize,
        1, // input channels
        1  // output channels
      );

      // Connect audio nodes
      this.microphone.connect(this.analyser!);
      this.analyser!.connect(this.processor);
      this.processor.connect(this.audioContext!.destination);

      // Setup audio processing
      this.processor.onaudioprocess = this.processAudio.bind(this);

      // Start detection loop
      this.startDetectionLoop();

      this.isActive = true;
      this.emit('started');
      console.log('Voice activity detection started');
    } catch (error) {
      console.error('Failed to start voice activity detection:', error);

      if (error.name === 'NotAllowedError') {
        this.emit('permissionDenied');
      } else if (error.name === 'NotFoundError') {
        this.emit('noMicrophone');
      }

      throw error;
    }
  }

  /**
   * Stop voice activity detection
   */
  async stopDetection(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    try {
      console.log('Stopping voice activity detection...');

      // Stop detection loop
      if (this.detectionInterval) {
        clearInterval(this.detectionInterval);
        this.detectionInterval = null;
      }

      // Disconnect audio nodes
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }

      if (this.microphone) {
        this.microphone.disconnect();
        this.microphone = null;
      }

      // Stop microphone stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      this.isActive = false;
      this.voiceDetected = false;
      this.emit('stopped');
      console.log('Voice activity detection stopped');
    } catch (error) {
      console.error('Failed to stop voice activity detection:', error);
      throw error;
    }
  }

  /**
   * Process audio data in real-time
   */
  private processAudio(event: AudioProcessingEvent): void {
    if (!this.analyser || !this.frequencyData || !this.timeData) return;

    // Get frequency and time domain data
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeData);

    // Calculate audio features
    const rms = this.calculateRMS(this.timeData);
    const energy = this.calculateEnergy(this.frequencyData);
    const zeroCrossings = this.calculateZeroCrossings(this.timeData);
    const spectralCentroid = this.calculateSpectralCentroid(this.frequencyData);

    // Voice activity detection logic
    const isVoice = this.detectVoiceActivity(rms, energy, zeroCrossings, spectralCentroid);

    if (isVoice) {
      if (!this.voiceDetected) {
        this.voiceDetected = true;
        this.lastActivityTimestamp = Date.now();

        const activityData: VoiceActivityData = {
          isActive: true,
          confidence: this.calculateConfidence(rms, energy),
          timestamp: new Date(),
          duration: 0,
          amplitude: rms
        };

        this.emit('activityDetected', activityData);
      }
    } else {
      if (this.voiceDetected) {
        const timeSinceLastActivity = Date.now() - this.lastActivityTimestamp;

        if (timeSinceLastActivity > this.ACTIVITY_TIMEOUT) {
          this.voiceDetected = false;
          this.emit('silenceDetected');
        }
      }
    }
  }

  /**
   * Calculate Root Mean Square (RMS) of audio signal
   */
  private calculateRMS(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const sample = (data[i] - 128) / 128; // Convert to -1 to 1 range
      sum += sample * sample;
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Calculate energy of frequency spectrum
   */
  private calculateEnergy(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return sum / data.length;
  }

  /**
   * Calculate zero crossings rate
   */
  private calculateZeroCrossings(data: Uint8Array): number {
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] > 128 && data[i - 1] <= 128) || (data[i] <= 128 && data[i - 1] > 128)) {
        crossings++;
      }
    }
    return crossings / data.length;
  }

  /**
   * Calculate spectral centroid
   */
  private calculateSpectralCentroid(data: Uint8Array): number {
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < data.length; i++) {
      const frequency = (i * this.sampleRate) / (2 * data.length);
      numerator += frequency * data[i];
      denominator += data[i];
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Detect voice activity based on audio features
   */
  private detectVoiceActivity(
    rms: number,
    energy: number,
    zeroCrossings: number,
    spectralCentroid: number
  ): boolean {
    // Convert RMS to dB
    const rmsDb = 20 * Math.log10(rms + 0.0001);

    // Basic voice detection heuristics
    const hasEnergy = energy > this.settings.threshold * 255;
    const hasVoiceFrequency = spectralCentroid > 1000 && spectralCentroid < 8000; // Voice frequency range
    const hasVoicePattern = zeroCrossings > 0.1 && zeroCrossings < 0.5; // Voice zero crossing pattern
    const hasAmplitude = rmsDb > this.VOICE_THRESHOLD;

    // Combine detection criteria
    return hasEnergy && hasVoiceFrequency && hasVoicePattern && hasAmplitude;
  }

  /**
   * Calculate confidence score for voice detection
   */
  private calculateConfidence(rms: number, energy: number): number {
    // Normalize confidence between 0 and 1
    const rmsConfidence = Math.min(rms * 10, 1);
    const energyConfidence = Math.min(energy / 255, 1);

    return (rmsConfidence + energyConfidence) / 2;
  }

  /**
   * Start periodic detection status updates
   */
  private startDetectionLoop(): void {
    this.detectionInterval = setInterval(() => {
      if (!this.isActive) return;

      const status = {
        isActive: this.voiceDetected,
        lastActivity: this.lastActivityTimestamp,
        microphoneActive: this.stream !== null,
        audioContextState: this.audioContext?.state || 'unknown'
      };

      this.emit('statusUpdate', status);
    }, 1000);
  }

  /**
   * Update detection settings
   */
  updateSettings(newSettings: Partial<VADSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.adjustSensitivity();

    if (this.analyser) {
      this.analyser.fftSize = this.settings.frameSize;
    }

    this.emit('settingsUpdated', this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): VADSettings {
    return { ...this.settings };
  }

  /**
   * Get current status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      active: this.isActive,
      voiceDetected: this.voiceDetected,
      lastActivity: this.lastActivityTimestamp,
      microphoneAccess: this.stream !== null,
      audioContextState: this.audioContext?.state || 'unknown',
      sampleRate: this.sampleRate,
      bufferSize: this.bufferSize
    };
  }

  /**
   * Check if voice activity detection is supported
   */
  isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || (window as any).webkitAudioContext)
    );
  }

  /**
   * Get microphone permission status
   */
  async getMicrophonePermission(): Promise<PermissionState> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state;
    } catch (error) {
      console.warn('Could not check microphone permission:', error);
      return 'prompt';
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      await this.stopDetection();

      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.analyser = null;
      this.frequencyData = null;
      this.timeData = null;
      this.isInitialized = false;

      console.log('Voice Activity Detector destroyed');
    } catch (error) {
      console.error('Failed to destroy Voice Activity Detector:', error);
      throw error;
    }
  }
}
