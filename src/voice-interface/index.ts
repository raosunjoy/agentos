/**
 * Voice Interface Module - Main Entry Point
 * Provides comprehensive voice interaction capabilities for AgentOS
 */

import { EventEmitter } from 'events';
import { SpeechToText } from './speech-to-text';
import { TextToSpeech } from './text-to-speech';
import { VoiceActivityDetector } from './voice-activity-detector';
import { ConversationalInterface } from './conversational-interface';
import { AccessibilityManager } from './accessibility-manager';
import { AlternativeInputMethods } from './alternative-input-methods';
import { VoiceFeedback } from './voice-feedback';
import { WCAGCompliance } from './wcag-compliance';
import { voiceLogger, createTimer } from '../core/logging';

export * from './types';
export * from './speech-to-text';
export * from './text-to-speech';
export * from './voice-activity-detector';
export * from './conversational-interface';
export * from './accessibility-manager';
export * from './alternative-input-methods';
export * from './voice-feedback';
export * from './wcag-compliance';

/**
 * Main Voice Interface class that orchestrates all voice components
 */
export class VoiceInterface extends EventEmitter {
  private speechToText: SpeechToText;
  private textToSpeech: TextToSpeech;
  private voiceActivityDetector: VoiceActivityDetector;
  private conversationalInterface: ConversationalInterface;
  private accessibilityManager: AccessibilityManager;
  private alternativeInputMethods: AlternativeInputMethods;
  private voiceFeedback: VoiceFeedback;
  private wcagCompliance: WCAGCompliance;
  private logger = voiceLogger('interface');

  private isInitialized = false;
  private isListening = false;
  private isSpeaking = false;

  constructor() {
    super();

    // Initialize core voice components
    this.speechToText = new SpeechToText();
    this.textToSpeech = new TextToSpeech();
    this.voiceActivityDetector = new VoiceActivityDetector();
    this.conversationalInterface = new ConversationalInterface();
    this.accessibilityManager = new AccessibilityManager();
    this.alternativeInputMethods = new AlternativeInputMethods();
    this.voiceFeedback = new VoiceFeedback();
    this.wcagCompliance = new WCAGCompliance();

    this.setupEventForwarding();
  }

  /**
   * Initialize the voice interface
   */
  async initialize(container?: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const timer = createTimer('voice_interface_initialization');

    try {
      this.logger.info('Initializing Voice Interface...');

      // Initialize all components
      await Promise.all([
        this.speechToText.initialize(),
        this.textToSpeech.initialize(),
        this.voiceActivityDetector.initialize(),
        this.conversationalInterface.initialize(container),
        this.accessibilityManager.initialize(container || document.body),
        this.alternativeInputMethods.initialize(container || document.body),
        this.voiceFeedback.initialize(),
        this.wcagCompliance.initialize(container || document.body)
      ]);

      this.isInitialized = true;
      const duration = timer.end();

      this.emit('initialized');
      this.logger.info('Voice Interface initialized successfully', { duration });

    } catch (error) {
      const duration = timer.end();
      this.logger.error('Failed to initialize Voice Interface', {
        duration,
        error: error instanceof Error ? error.message : String(error)
      }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Start listening for voice input
   */
  async startListening(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Voice Interface not initialized');
    }

    if (this.isListening) {
      return;
    }

    try {
      console.log('Starting voice listening...');

      // Start voice activity detection
      await this.voiceActivityDetector.startDetection();

      // Start speech recognition
      await this.speechToText.startRecognition();

      this.isListening = true;
      this.emit('listeningStarted');

      console.log('Voice listening started');
    } catch (error) {
      console.error('Failed to start voice listening:', error);
      throw error;
    }
  }

  /**
   * Stop listening for voice input
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      console.log('Stopping voice listening...');

      // Stop speech recognition
      await this.speechToText.stopRecognition();

      // Stop voice activity detection
      await this.voiceActivityDetector.stopDetection();

      this.isListening = false;
      this.emit('listeningStopped');

      console.log('Voice listening stopped');
    } catch (error) {
      console.error('Failed to stop voice listening:', error);
      throw error;
    }
  }

  /**
   * Speak text using text-to-speech
   */
  async speak(text: string, options?: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Voice Interface not initialized');
    }

    if (this.isSpeaking) {
      await this.stopSpeaking();
    }

    try {
      console.log('Speaking text:', text.substring(0, 50) + '...');

      this.isSpeaking = true;
      this.emit('speechStarted', text);

      await this.textToSpeech.speak(text, options);

      this.isSpeaking = false;
      this.emit('speechEnded', text);

      console.log('Speech completed');
    } catch (error) {
      this.isSpeaking = false;
      console.error('Failed to speak text:', error);
      this.emit('speechError', error);
      throw error;
    }
  }

  /**
   * Stop current speech
   */
  async stopSpeaking(): Promise<void> {
    if (!this.isSpeaking) {
      return;
    }

    try {
      await this.textToSpeech.stop();
      await this.voiceFeedback.stop();

      this.isSpeaking = false;
      this.emit('speechStopped');
    } catch (error) {
      console.error('Failed to stop speech:', error);
      throw error;
    }
  }

  /**
   * Process voice command and respond
   */
  async processVoiceCommand(audioData: any): Promise<void> {
    try {
      console.log('Processing voice command...');

      // Transcribe speech to text
      const transcription = await this.speechToText.transcribe(audioData);
      this.emit('transcriptionReceived', transcription);

      // Process through conversational interface
      const response = await this.conversationalInterface.processInput(transcription);

      // Speak the response
      if (response) {
        await this.speak(response);
      }

      console.log('Voice command processed successfully');
    } catch (error) {
      console.error('Failed to process voice command:', error);
      this.emit('commandError', error);

      // Provide error feedback
      await this.speak('Sorry, I encountered an error processing your request.');
    }
  }

  /**
   * Provide audio feedback for user actions
   */
  async provideFeedback(type: 'success' | 'error' | 'warning' | 'info', message?: string): Promise<void> {
    try {
      await this.voiceFeedback.provideFeedback(type, message);
    } catch (error) {
      console.error('Failed to provide audio feedback:', error);
    }
  }

  /**
   * Check accessibility compliance
   */
  checkAccessibility(container?: HTMLElement): any {
    return this.wcagCompliance.checkCompliance(container || document.body);
  }

  /**
   * Enable alternative input methods
   */
  enableAlternativeInputs(method: string): void {
    this.alternativeInputMethods.enableMethod(method);
  }

  /**
   * Disable alternative input methods
   */
  disableAlternativeInputs(method: string): void {
    this.alternativeInputMethods.disableMethod(method);
  }

  /**
   * Get current voice interface status
   */
  getStatus(): {
    initialized: boolean;
    listening: boolean;
    speaking: boolean;
    components: Record<string, any>;
  } {
    return {
      initialized: this.isInitialized,
      listening: this.isListening,
      speaking: this.isSpeaking,
      components: {
        speechToText: this.speechToText.getStatus(),
        textToSpeech: this.textToSpeech.getStatus(),
        voiceActivityDetector: this.voiceActivityDetector.getStatus(),
        conversationalInterface: this.conversationalInterface.getStatus(),
        accessibilityManager: this.accessibilityManager.getSettings(),
        alternativeInputMethods: this.alternativeInputMethods.getEnabledMethods(),
        voiceFeedback: this.voiceFeedback.getStatus(),
        wcagCompliance: this.wcagCompliance.getStatus()
      }
    };
  }

  /**
   * Cleanup and destroy the voice interface
   */
  async destroy(): Promise<void> {
    try {
      console.log('Destroying Voice Interface...');

      // Stop all active operations
      await this.stopListening();
      await this.stopSpeaking();

      // Destroy all components
      await Promise.all([
        this.speechToText.destroy(),
        this.textToSpeech.destroy(),
        this.voiceActivityDetector.destroy(),
        this.conversationalInterface.destroy(),
        this.accessibilityManager.destroy(),
        this.alternativeInputMethods.destroy(),
        this.voiceFeedback.destroy(),
        this.wcagCompliance.destroy()
      ]);

      this.isInitialized = false;
      this.emit('destroyed');

      console.log('Voice Interface destroyed');
    } catch (error) {
      console.error('Failed to destroy Voice Interface:', error);
      throw error;
    }
  }

  /**
   * Setup event forwarding from components
   */
  private setupEventForwarding(): void {
    // Forward speech-to-text events
    this.speechToText.on('transcription', (text) => this.emit('transcription', text));
    this.speechToText.on('error', (error) => this.emit('sttError', error));

    // Forward text-to-speech events
    this.textToSpeech.on('started', (text) => this.emit('ttsStarted', text));
    this.textToSpeech.on('ended', (text) => this.emit('ttsEnded', text));
    this.textToSpeech.on('error', (error) => this.emit('ttsError', error));

    // Forward voice activity detection events
    this.voiceActivityDetector.on('activityDetected', (data) => this.emit('voiceActivity', data));
    this.voiceActivityDetector.on('silenceDetected', () => this.emit('silenceDetected'));

    // Forward conversational interface events
    this.conversationalInterface.on('inputProcessed', (result) => this.emit('inputProcessed', result));
    this.conversationalInterface.on('responseGenerated', (response) => this.emit('responseGenerated', response));

    // Forward accessibility events
    this.accessibilityManager.on('accessibilityChanged', (settings) => this.emit('accessibilityChanged', settings));
    this.accessibilityManager.on('alternativeInputUsed', (method) => this.emit('alternativeInputUsed', method));

    // Forward alternative input events
    this.alternativeInputMethods.on('gestureDetected', (gesture) => this.emit('gestureDetected', gesture));
    this.alternativeInputMethods.on('switchActivated', (element) => this.emit('switchActivated', element));

    // Forward feedback events
    this.voiceFeedback.on('feedbackProvided', (data) => this.emit('feedbackProvided', data));
  }
}

/**
 * Convenience function to create and initialize voice interface
 */
export async function createVoiceInterface(container?: HTMLElement): Promise<VoiceInterface> {
  const voiceInterface = new VoiceInterface();
  await voiceInterface.initialize(container);
  return voiceInterface;
}

/**
 * Default export
 */
export default VoiceInterface;