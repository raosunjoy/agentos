/**
 * Text-to-Speech Module
 * Handles speech synthesis using Web Speech API with enhanced features
 */

import { EventEmitter } from 'events';
import { SpeechSynthesisSettings, VoiceInterfaceError } from './types';

export class TextToSpeech extends EventEmitter {
  private synthesis: SpeechSynthesis | null = null;
  private isInitialized = false;
  private isSpeaking = false;
  private settings: SpeechSynthesisSettings;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voiceCache: Map<string, SpeechSynthesisVoice> = new Map();
  private speechQueue: Array<{ text: string; options?: any }> = [];
  private isProcessingQueue = false;

  constructor(settings?: Partial<SpeechSynthesisSettings>) {
    super();

    this.settings = {
      voice: '',
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      language: 'en-US',
      ...settings
    };

    this.checkBrowserSupport();
  }

  /**
   * Check if browser supports speech synthesis
   */
  private checkBrowserSupport(): void {
    if (!('speechSynthesis' in window)) {
      throw new VoiceInterfaceError(
        'Speech synthesis is not supported in this browser',
        'BROWSER_NOT_SUPPORTED',
        'text-to-speech',
        false
      );
    }
  }

  /**
   * Initialize the text-to-speech system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing Text-to-Speech...');

      this.synthesis = window.speechSynthesis;
      await this.loadVoices();
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log('Text-to-Speech initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Text-to-Speech:', error);
      throw new VoiceInterfaceError(
        'Failed to initialize text-to-speech',
        'INITIALIZATION_FAILED',
        'text-to-speech',
        false
      );
    }
  }

  /**
   * Load available voices
   */
  private async loadVoices(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synthesis) {
        resolve();
        return;
      }

      const voices = this.synthesis.getVoices();

      if (voices.length > 0) {
        this.cacheVoices(voices);
        resolve();
      } else {
        // Wait for voices to load
        this.synthesis.onvoiceschanged = () => {
          const loadedVoices = this.synthesis!.getVoices();
          this.cacheVoices(loadedVoices);
          resolve();
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          console.warn('Voice loading timeout, using default voices');
          resolve();
        }, 5000);
      }
    });
  }

  /**
   * Cache voices for quick access
   */
  private cacheVoices(voices: SpeechSynthesisVoice[]): void {
    this.voiceCache.clear();

    voices.forEach(voice => {
      const key = `${voice.name} (${voice.lang})`;
      this.voiceCache.set(key, voice);

      // Set default voice if none specified
      if (!this.settings.voice && voice.default) {
        this.settings.voice = key;
      }
    });

    console.log(`Loaded ${voices.length} voices`);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.synthesis) return;

    // Handle global speech synthesis events if available
    if ('onvoiceschanged' in this.synthesis) {
      this.synthesis.onvoiceschanged = () => {
        const voices = this.synthesis!.getVoices();
        this.cacheVoices(voices);
        this.emit('voicesChanged', voices);
      };
    }
  }

  /**
   * Speak text with optional settings
   */
  async speak(text: string, options?: Partial<SpeechSynthesisSettings>): Promise<void> {
    if (!this.isInitialized) {
      throw new VoiceInterfaceError(
        'Text-to-Speech not initialized',
        'NOT_INITIALIZED',
        'text-to-speech',
        false
      );
    }

    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided to speak');
      return;
    }

    // Add to queue for processing
    this.speechQueue.push({ text: text.trim(), options });

    if (!this.isProcessingQueue) {
      await this.processSpeechQueue();
    }
  }

  /**
   * Process the speech queue
   */
  private async processSpeechQueue(): Promise<void> {
    if (this.isProcessingQueue || this.speechQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.speechQueue.length > 0 && this.isInitialized) {
      const item = this.speechQueue.shift();
      if (item) {
        await this.speakText(item.text, item.options);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Speak text directly
   */
  private async speakText(text: string, options?: Partial<SpeechSynthesisSettings>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new VoiceInterfaceError(
          'Speech synthesis not available',
          'SYNTHESIS_UNAVAILABLE',
          'text-to-speech',
          false
        ));
        return;
      }

      try {
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);

        // Apply settings
        const effectiveSettings = { ...this.settings, ...options };
        this.applySettingsToUtterance(utterance, effectiveSettings);

        // Setup event handlers
        utterance.onstart = () => {
          this.isSpeaking = true;
          this.currentUtterance = utterance;
          this.emit('started', text);
          console.log('Speech started:', text.substring(0, 50) + '...');
        };

        utterance.onend = () => {
          this.isSpeaking = false;
          this.currentUtterance = null;
          this.emit('ended', text);
          console.log('Speech ended');
          resolve();
        };

        utterance.onerror = (event) => {
          this.isSpeaking = false;
          this.currentUtterance = null;

          const error = new VoiceInterfaceError(
            `Speech synthesis error: ${event.error}`,
            'SYNTHESIS_ERROR',
            'text-to-speech',
            true
          );

          this.emit('error', error);
          console.error('Speech synthesis error:', event.error);
          reject(error);
        };

        utterance.onpause = () => {
          this.emit('paused');
        };

        utterance.onresume = () => {
          this.emit('resumed');
        };

        utterance.onmark = (event) => {
          this.emit('mark', event.charIndex);
        };

        utterance.onboundary = (event) => {
          this.emit('boundary', {
            name: event.name,
            charIndex: event.charIndex,
            charLength: event.charLength
          });
        };

        // Start speaking
        this.synthesis.speak(utterance);

      } catch (error) {
        console.error('Failed to create speech utterance:', error);
        reject(new VoiceInterfaceError(
          'Failed to create speech utterance',
          'UTTERANCE_CREATION_FAILED',
          'text-to-speech',
          false
        ));
      }
    });
  }

  /**
   * Apply settings to utterance
   */
  private applySettingsToUtterance(
    utterance: SpeechSynthesisUtterance,
    settings: SpeechSynthesisSettings
  ): void {
    // Apply voice
    if (settings.voice) {
      const voice = this.voiceCache.get(settings.voice);
      if (voice) {
        utterance.voice = voice;
      } else {
        console.warn('Requested voice not found:', settings.voice);
      }
    }

    // Apply other settings
    utterance.pitch = Math.max(0, Math.min(2, settings.pitch));
    utterance.rate = Math.max(0.1, Math.min(10, settings.rate));
    utterance.volume = Math.max(0, Math.min(1, settings.volume));
    utterance.lang = settings.language;

    // Apply voice URI if available (for consistency)
    if (utterance.voice) {
      utterance.voiceURI = utterance.voice.voiceURI;
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    if (!this.synthesis) return;

    try {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.speechQueue.length = 0; // Clear queue
      this.emit('stopped');
      console.log('Speech stopped');
    } catch (error) {
      console.error('Failed to stop speech:', error);
      throw new VoiceInterfaceError(
        'Failed to stop speech',
        'STOP_FAILED',
        'text-to-speech',
        true
      );
    }
  }

  /**
   * Pause current speech
   */
  async pause(): Promise<void> {
    if (!this.synthesis || !this.isSpeaking) return;

    try {
      this.synthesis.pause();
      this.emit('paused');
    } catch (error) {
      console.error('Failed to pause speech:', error);
      throw new VoiceInterfaceError(
        'Failed to pause speech',
        'PAUSE_FAILED',
        'text-to-speech',
        true
      );
    }
  }

  /**
   * Resume paused speech
   */
  async resume(): Promise<void> {
    if (!this.synthesis) return;

    try {
      this.synthesis.resume();
      this.emit('resumed');
    } catch (error) {
      console.error('Failed to resume speech:', error);
      throw new VoiceInterfaceError(
        'Failed to resume speech',
        'RESUME_FAILED',
        'text-to-speech',
        true
      );
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];

    return this.synthesis.getVoices();
  }

  /**
   * Get voices for a specific language
   */
  getVoicesForLanguage(language: string): SpeechSynthesisVoice[] {
    const voices = this.getAvailableVoices();
    const languageCode = language.split('-')[0];

    return voices.filter(voice =>
      voice.lang && voice.lang.startsWith(languageCode)
    );
  }

  /**
   * Set voice by name
   */
  setVoice(voiceName: string): boolean {
    const voice = this.voiceCache.get(voiceName);
    if (voice) {
      this.settings.voice = voiceName;
      return true;
    }
    return false;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<SpeechSynthesisSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): SpeechSynthesisSettings {
    return { ...this.settings };
  }

  /**
   * Get current status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      speaking: this.isSpeaking,
      pending: this.speechQueue.length,
      currentVoice: this.settings.voice,
      availableVoices: this.voiceCache.size,
      speaking: this.synthesis?.speaking || false,
      paused: this.synthesis?.paused || false
    };
  }

  /**
   * Check if speech synthesis is supported
   */
  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    const voices = this.getAvailableVoices();
    const languages = new Set<string>();

    voices.forEach(voice => {
      if (voice.lang) {
        languages.add(voice.lang);
      }
    });

    return Array.from(languages).sort();
  }

  /**
   * Test voice settings
   */
  async testVoice(text: string = 'Hello, this is a test of the text-to-speech system.'): Promise<void> {
    await this.speak(text);
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      await this.stop();
      this.voiceCache.clear();
      this.speechQueue.length = 0;
      this.isInitialized = false;
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.log('Text-to-Speech destroyed');
    } catch (error) {
      console.error('Failed to destroy Text-to-Speech:', error);
      throw error;
    }
  }
}
