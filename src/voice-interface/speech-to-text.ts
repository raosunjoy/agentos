/**
 * Speech-to-Text Module
 * Handles speech recognition using Web Speech API with enhanced features
 */

import { EventEmitter } from 'events';
import { SpeechRecognitionSettings, SpeechProcessingResult } from './types';
import { VoiceError, ErrorCode, ErrorContext } from '../core/errors/error-types';
import { handleError, createErrorHandler } from '../core/errors/error-handler';
import { voiceLogger, createTimer } from '../core/logging';

export class SpeechToText extends EventEmitter {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private isInitialized = false;
  private settings: SpeechRecognitionSettings;
  private currentResult: SpeechProcessingResult | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private logger = voiceLogger('speech-to-text');
  private errorHandler = createErrorHandler({
    component: 'speech-to-text',
    operation: 'recognition'
  });

  constructor(settings?: Partial<SpeechRecognitionSettings>) {
    super();

    this.settings = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      confidenceThreshold: 0.7,
      ...settings
    };

    this.checkBrowserSupport();
  }

  /**
   * Check if browser supports speech recognition
   */
  private checkBrowserSupport(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new VoiceError(
        'Speech recognition is not supported in this browser',
        ErrorCode.SPEECH_RECOGNITION_FAILED,
        undefined,
        { operation: 'browser_support_check' }
      );
    }
  }

  /**
   * Initialize the speech recognition
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug('Speech-to-Text already initialized');
      return;
    }

    const timer = createTimer('speech_to_text_initialization');

    try {
      this.logger.info('Initializing Speech-to-Text...', {
        language: this.settings.language,
        continuous: this.settings.continuous
      });

      // Create speech recognition instance
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();

      this.configureRecognition();
      this.setupEventHandlers();

      this.isInitialized = true;
      const duration = timer.end();

      this.logger.info('Speech-to-Text initialized successfully', { duration });

    } catch (error) {
      const duration = timer.end();
      await handleError(error, {
        component: 'speech-to-text',
        operation: 'initialization',
        duration
      });
      throw error;
    }
  }

  /**
   * Configure speech recognition settings
   */
  private configureRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = this.settings.continuous;
    this.recognition.interimResults = this.settings.interimResults;
    this.recognition.lang = this.settings.language;
    this.recognition.maxAlternatives = this.settings.maxAlternatives;
  }

  /**
   * Setup event handlers for speech recognition
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;

    // Result handler
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleRecognitionResult(event);
    };

    // Error handler
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.handleRecognitionError(event);
    };

    // Start handler
    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.emit('started');
    };

    // End handler
    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      this.emit('ended');

      // Auto-restart if continuous mode is enabled and no error occurred
      if (this.settings.continuous && this.retryCount < this.maxRetries) {
        setTimeout(() => {
          if (this.isInitialized && !this.isListening) {
            this.startRecognition().catch(error => {
              console.error('Failed to restart speech recognition:', error);
            });
          }
        }, 1000);
      }
    };

    // Audio start handler
    this.recognition.onaudiostart = () => {
      this.emit('audioStart');
    };

    // Audio end handler
    this.recognition.onaudioend = () => {
      this.emit('audioEnd');
    };

    // Sound start handler
    this.recognition.onsoundstart = () => {
      this.emit('soundStart');
    };

    // Sound end handler
    this.recognition.onsoundend = () => {
      this.emit('soundEnd');
    };

    // Speech start handler
    this.recognition.onspeechstart = () => {
      this.emit('speechStart');
    };

    // Speech end handler
    this.recognition.onspeechend = () => {
      this.emit('speechEnd');
    };

    // No match handler
    this.recognition.onnomatch = () => {
      this.emit('noMatch');
    };
  }

  /**
   * Handle speech recognition results
   */
  private handleRecognitionResult(event: SpeechRecognitionEvent): void {
    const results = Array.from(event.results);
    const lastResult = results[results.length - 1];

    if (!lastResult) return;

    const transcript = lastResult[0].transcript;
    const confidence = lastResult[0].confidence;
    const isFinal = lastResult.isFinal;

    // Create processing result
    const result: SpeechProcessingResult = {
      text: transcript,
      confidence,
      timestamp: new Date(),
      language: this.settings.language,
      isFinal,
      alternatives: this.extractAlternatives(lastResult),
      metadata: {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length
      }
    };

    this.currentResult = result;

    // Emit appropriate events
    if (isFinal) {
      // Check confidence threshold
      if (confidence >= this.settings.confidenceThreshold) {
        this.emit('transcription', result);
        console.log('Final transcription:', transcript, `(${Math.round(confidence * 100)}% confidence)`);
      } else {
        console.warn('Low confidence transcription:', transcript, `(${Math.round(confidence * 100)}% confidence)`);
        this.emit('lowConfidence', result);
      }
    } else {
      this.emit('interimResult', result);
    }
  }

  /**
   * Extract alternative transcriptions
   */
  private extractAlternatives(result: SpeechRecognitionResult): SpeechProcessingResult['alternatives'] {
    if (result.length <= 1) return undefined;

    const alternatives = [];
    for (let i = 1; i < result.length; i++) {
      alternatives.push({
        text: result[i].transcript,
        confidence: result[i].confidence
      });
    }

    return alternatives;
  }

  /**
   * Handle speech recognition errors
   */
  private handleRecognitionError(event: SpeechRecognitionErrorEvent): void {
    console.error('Speech recognition error:', event.error, event.message);

    const error = new SpeechRecognitionError(
      `Speech recognition error: ${event.error}`,
      event
    );

    this.emit('error', error);
    this.retryCount++;

    // Handle specific error types
    switch (event.error) {
      case 'network':
        console.warn('Network error during speech recognition');
        // Auto-retry for network errors
        if (this.retryCount < this.maxRetries) {
          setTimeout(() => {
            this.startRecognition().catch(retryError => {
              console.error('Failed to retry speech recognition:', retryError);
            });
          }, 2000);
        }
        break;

      case 'not-allowed':
        console.error('Microphone access denied');
        this.emit('permissionDenied');
        break;

      case 'no-speech':
        console.log('No speech detected');
        this.emit('noSpeech');
        break;

      case 'aborted':
        console.log('Speech recognition aborted');
        break;

      case 'audio-capture':
        console.error('Audio capture failed');
        break;

      case 'service-not-allowed':
        console.error('Speech recognition service not allowed');
        break;

      default:
        console.error('Unknown speech recognition error:', event.error);
    }
  }

  /**
   * Start speech recognition
   */
  async startRecognition(): Promise<void> {
    if (!this.isInitialized) {
      throw new VoiceError(
        'Speech-to-Text not initialized',
        ErrorCode.SPEECH_RECOGNITION_FAILED,
        undefined,
        { operation: 'start_recognition' }
      );
    }

    if (this.isListening) {
      this.logger.debug('Speech recognition already listening');
      return;
    }

    if (!this.recognition) {
      throw new VoiceError(
        'Speech recognition instance not available',
        ErrorCode.SPEECH_RECOGNITION_FAILED,
        undefined,
        { operation: 'start_recognition' }
      );
    }

    const timer = createTimer('speech_recognition_start');

    try {
      this.logger.info('Starting speech recognition', {
        language: this.settings.language,
        continuous: this.settings.continuous
      });

      this.recognition.start();
      this.retryCount = 0; // Reset retry count on successful start

      const duration = timer.end();
      this.logger.debug('Speech recognition started successfully', { duration });

    } catch (error) {
      const duration = timer.end();
      await handleError(error, {
        component: 'speech-to-text',
        operation: 'start_recognition',
        duration
      });
      throw error;
    }
  }

  /**
   * Stop speech recognition
   */
  async stopRecognition(): Promise<void> {
    if (!this.isListening || !this.recognition) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
      throw new SpeechRecognitionError('Failed to stop speech recognition', error);
    }
  }

  /**
   * Abort speech recognition immediately
   */
  async abortRecognition(): Promise<void> {
    if (!this.recognition) {
      return;
    }

    try {
      this.recognition.abort();
    } catch (error) {
      console.error('Failed to abort speech recognition:', error);
      throw new SpeechRecognitionError('Failed to abort speech recognition', error);
    }
  }

  /**
   * Transcribe audio data (for file-based processing)
   */
  async transcribe(audioData: any): Promise<SpeechProcessingResult> {
    // This would integrate with a more advanced speech recognition service
    // For now, return mock data
    console.log('Transcribing audio data...');

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          const result: SpeechProcessingResult = {
            text: 'This is a mock transcription from audio data',
            confidence: 0.85,
            timestamp: new Date(),
            language: this.settings.language,
            isFinal: true
          };
          resolve(result);
        } else {
          reject(new SpeechRecognitionError('Failed to transcribe audio data'));
        }
      }, 1000);
    });
  }

  /**
   * Update speech recognition settings
   */
  updateSettings(newSettings: Partial<SpeechRecognitionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    if (this.recognition) {
      this.configureRecognition();
    }

    this.emit('settingsUpdated', this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): SpeechRecognitionSettings {
    return { ...this.settings };
  }

  /**
   * Get current status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      listening: this.isListening,
      language: this.settings.language,
      continuous: this.settings.continuous,
      lastResult: this.currentResult
    };
  }

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Get available languages
   */
  getSupportedLanguages(): string[] {
    // In a real implementation, this would query the browser's supported languages
    return [
      'en-US', 'en-GB', 'en-AU', 'en-CA',
      'es-ES', 'es-MX', 'fr-FR', 'de-DE',
      'it-IT', 'pt-BR', 'ja-JP', 'ko-KR',
      'zh-CN', 'zh-TW', 'ru-RU', 'ar-SA'
    ];
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      await this.abortRecognition();
      this.recognition = null;
      this.isInitialized = false;
      this.isListening = false;
      this.currentResult = null;
      console.log('Speech-to-Text destroyed');
    } catch (error) {
      console.error('Failed to destroy Speech-to-Text:', error);
      throw error;
    }
  }
}

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
