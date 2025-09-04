import { EventEmitter } from 'events';
import { VoicePrompt, VoiceSettings } from './types';

export class VoiceFeedback extends EventEmitter {
  private speechSynthesis: SpeechSynthesis;
  private currentUtterance?: SpeechSynthesisUtterance;
  private voiceSettings: VoiceSettings;
  private isEnabled: boolean = true;

  constructor(voiceSettings: VoiceSettings) {
    super();
    this.speechSynthesis = window.speechSynthesis;
    this.voiceSettings = voiceSettings;
  }

  /**
   * Speak text with current voice settings
   */
  public speak(text: string, options?: Partial<VoiceSettings>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isEnabled || !this.speechSynthesis) {
        resolve();
        return;
      }

      // Cancel any current speech
      this.stop();

      const settings = { ...this.voiceSettings, ...options };
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure utterance
      utterance.rate = settings.speed;
      utterance.volume = settings.volume;
      utterance.pitch = settings.pitch;
      utterance.lang = settings.language;

      // Find appropriate voice
      const voices = this.speechSynthesis.getVoices();
      const languageCode = settings.language?.split('-')[0];
      const preferredVoice = languageCode ? voices.find(voice =>
        voice.lang.startsWith(languageCode) &&
        voice.localService
      ) : undefined;
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // Set up event handlers
      utterance.onstart = () => {
        this.emit('speechStart', text);
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        this.emit('speechEnd', text);
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        this.emit('speechError', event.error);
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      utterance.onpause = () => {
        this.emit('speechPause');
      };

      utterance.onresume = () => {
        this.emit('speechResume');
      };

      // Store current utterance and speak
      this.currentUtterance = utterance;
      this.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Speak a voice prompt with appropriate tone and pacing
   */
  public async speakPrompt(prompt: VoicePrompt): Promise<void> {
    let promptText = prompt.text;

    // Add appropriate pacing and tone based on prompt type
    switch (prompt.type) {
      case 'confirmation':
        promptText = `Please confirm: ${promptText}`;
        break;
      case 'clarification':
        promptText = `I need to clarify: ${promptText}`;
        break;
      case 'error':
        promptText = `I'm sorry, there was an issue: ${promptText}`;
        break;
      case 'information':
        // Use text as-is for information
        break;
    }

    // Add options if available
    if (prompt.options && prompt.options.length > 0) {
      promptText += ` Your options are: ${prompt.options.join(', ')}`;
    }

    // Adjust voice settings for elderly users
    const elderlyOptimizedSettings: Partial<VoiceSettings> = {
      speed: Math.max(0.7, this.voiceSettings.speed - 0.2), // Slower for clarity
      pitch: Math.min(1.2, this.voiceSettings.pitch + 0.1), // Slightly higher pitch
    };

    try {
      await this.speak(promptText, elderlyOptimizedSettings);
      this.emit('promptSpoken', prompt);
    } catch (error) {
      this.emit('promptError', { prompt, error });
      throw error;
    }
  }

  /**
   * Provide audio confirmation for user actions
   */
  public async confirmAction(action: string): Promise<void> {
    const confirmationText = `${action} confirmed`;
    
    const confirmationSettings: Partial<VoiceSettings> = {
      pitch: this.voiceSettings.pitch + 0.2, // Higher pitch for positive feedback
      speed: this.voiceSettings.speed + 0.1, // Slightly faster for brevity
    };

    try {
      await this.speak(confirmationText, confirmationSettings);
      this.emit('actionConfirmed', action);
    } catch (error) {
      this.emit('confirmationError', { action, error });
    }
  }

  /**
   * Provide audio feedback for errors
   */
  public async announceError(error: string): Promise<void> {
    const errorText = `Error: ${error}. Please try again.`;
    
    const errorSettings: Partial<VoiceSettings> = {
      pitch: Math.max(0.8, this.voiceSettings.pitch - 0.2), // Lower pitch for errors
      speed: Math.max(0.6, this.voiceSettings.speed - 0.3), // Slower for clarity
    };

    try {
      await this.speak(errorText, errorSettings);
      this.emit('errorAnnounced', error);
    } catch (speechError) {
      this.emit('announcementError', { error, speechError });
    }
  }

  /**
   * Provide status updates during processing
   */
  public async announceStatus(status: string): Promise<void> {
    const statusSettings: Partial<VoiceSettings> = {
      volume: Math.max(0.3, this.voiceSettings.volume - 0.2), // Quieter for status updates
    };

    try {
      await this.speak(status, statusSettings);
      this.emit('statusAnnounced', status);
    } catch (error) {
      this.emit('statusError', { status, error });
    }
  }

  /**
   * Stop current speech
   */
  public stop(): void {
    if (this.speechSynthesis && this.speechSynthesis.speaking) {
      this.speechSynthesis.cancel();
    }
    
    if (this.currentUtterance) {
      this.currentUtterance = null;
      this.emit('speechStopped');
    }
  }

  /**
   * Pause current speech
   */
  public pause(): void {
    if (this.speechSynthesis && this.speechSynthesis.speaking) {
      this.speechSynthesis.pause();
    }
  }

  /**
   * Resume paused speech
   */
  public resume(): void {
    if (this.speechSynthesis && this.speechSynthesis.paused) {
      this.speechSynthesis.resume();
    }
  }

  /**
   * Check if currently speaking
   */
  public isSpeaking(): boolean {
    return this.speechSynthesis ? this.speechSynthesis.speaking : false;
  }

  /**
   * Check if speech is paused
   */
  public isPaused(): boolean {
    return this.speechSynthesis ? this.speechSynthesis.paused : false;
  }

  /**
   * Enable or disable voice feedback
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      this.stop();
    }
    
    this.emit('enabledChanged', enabled);
  }

  /**
   * Update voice settings
   */
  public updateSettings(settings: Partial<VoiceSettings>): void {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
    this.emit('settingsUpdated', this.voiceSettings);
  }

  /**
   * Get available voices
   */
  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.speechSynthesis ? this.speechSynthesis.getVoices() : [];
  }

  /**
   * Get voices for a specific language
   */
  public getVoicesForLanguage(language: string): SpeechSynthesisVoice[] {
    const voices = this.getAvailableVoices();
    const languageCode = language.split('-')[0];

    return voices.filter(voice =>
      voice.lang.startsWith(languageCode || '')
    );
  }

  /**
   * Test voice settings by speaking a sample phrase
   */
  public async testVoice(settings?: Partial<VoiceSettings>): Promise<void> {
    const testPhrase = "This is a test of the voice settings. How does this sound?";
    
    try {
      await this.speak(testPhrase, settings);
      this.emit('voiceTestCompleted', settings);
    } catch (error) {
      this.emit('voiceTestError', { settings, error });
      throw error;
    }
  }

  /**
   * Provide audio cues for navigation
   */
  public async announceNavigation(element: string, action: string): Promise<void> {
    const navigationText = `${action} ${element}`;
    
    const navigationSettings: Partial<VoiceSettings> = {
      volume: Math.max(0.4, this.voiceSettings.volume - 0.3), // Quieter for navigation
      speed: this.voiceSettings.speed + 0.2, // Faster for brevity
    };

    try {
      await this.speak(navigationText, navigationSettings);
      this.emit('navigationAnnounced', { element, action });
    } catch (error) {
      this.emit('navigationError', { element, action, error });
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}