import { VoiceFeedback } from '../voice-feedback';
import { VoiceSettings, VoicePrompt } from '../types';

// Mock SpeechSynthesis API
const mockUtterance = {
  text: '',
  rate: 1,
  volume: 1,
  pitch: 1,
  lang: 'en-US',
  voice: null,
  onstart: null as any,
  onend: null as any,
  onerror: null as any,
  onpause: null as any,
  onresume: null as any
};

const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => [
    { name: 'Test Voice 1', lang: 'en-US', localService: true },
    { name: 'Test Voice 2', lang: 'es-ES', localService: true },
    { name: 'Test Voice 3', lang: 'fr-FR', localService: false }
  ]),
  speaking: false,
  paused: false
};

Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: mockSpeechSynthesis
});

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  writable: true,
  value: jest.fn().mockImplementation((text) => ({
    ...mockUtterance,
    text
  }))
});

describe('VoiceFeedback', () => {
  let voiceFeedback: VoiceFeedback;
  let defaultSettings: VoiceSettings;

  beforeEach(() => {
    defaultSettings = {
      speed: 1.0,
      volume: 0.8,
      pitch: 1.0,
      language: 'en-US'
    };
    
    voiceFeedback = new VoiceFeedback(defaultSettings);
    jest.clearAllMocks();
  });

  afterEach(() => {
    voiceFeedback.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with provided voice settings', () => {
      const customSettings: VoiceSettings = {
        speed: 0.8,
        volume: 0.9,
        pitch: 1.2,
        language: 'es-ES'
      };

      const customVoiceFeedback = new VoiceFeedback(customSettings);
      
      expect(customVoiceFeedback).toBeDefined();
      customVoiceFeedback.destroy();
    });

    test('should have access to speech synthesis API', () => {
      expect(mockSpeechSynthesis.speak).toBeDefined();
      expect(mockSpeechSynthesis.getVoices).toBeDefined();
    });
  });

  describe('Basic Speech', () => {
    test('should speak text with default settings', async () => {
      const speakPromise = voiceFeedback.speak('Hello world');
      
      // Simulate successful speech
      const utteranceCall = (window.SpeechSynthesisUtterance as jest.Mock).mock.calls[0];
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      
      expect(utteranceCall[0]).toBe('Hello world');
      expect(utterance.rate).toBe(defaultSettings.speed);
      expect(utterance.volume).toBe(defaultSettings.volume);
      expect(utterance.pitch).toBe(defaultSettings.pitch);
      expect(utterance.lang).toBe(defaultSettings.language);

      // Simulate speech completion
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledWith(utterance);
    });

    test('should speak with custom settings override', async () => {
      const customSettings: Partial<VoiceSettings> = {
        speed: 0.5,
        volume: 1.0,
        language: 'es-ES'
      };

      const speakPromise = voiceFeedback.speak('Hola mundo', customSettings);
      
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      
      expect(utterance.rate).toBe(0.5);
      expect(utterance.volume).toBe(1.0);
      expect(utterance.lang).toBe('es-ES');
      expect(utterance.pitch).toBe(defaultSettings.pitch); // Should use default for unspecified

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
    });

    test('should emit speech events', async () => {
      const speechStartHandler = jest.fn();
      const speechEndHandler = jest.fn();

      voiceFeedback.on('speechStart', speechStartHandler);
      voiceFeedback.on('speechEnd', speechEndHandler);

      const speakPromise = voiceFeedback.speak('Test message');
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      // Simulate speech start
      if (utterance.onstart) {
        utterance.onstart();
      }

      expect(speechStartHandler).toHaveBeenCalledWith('Test message');

      // Simulate speech end
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
      expect(speechEndHandler).toHaveBeenCalledWith('Test message');
    });

    test('should handle speech errors', async () => {
      const speechErrorHandler = jest.fn();
      voiceFeedback.on('speechError', speechErrorHandler);

      const speakPromise = voiceFeedback.speak('Error test');
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      // Simulate speech error
      const errorEvent = { error: 'synthesis-failed' };
      if (utterance.onerror) {
        utterance.onerror(errorEvent);
      }

      await expect(speakPromise).rejects.toThrow('Speech synthesis error: synthesis-failed');
      expect(speechErrorHandler).toHaveBeenCalledWith('synthesis-failed');
    });
  });

  describe('Voice Prompts', () => {
    test('should speak confirmation prompts with appropriate formatting', async () => {
      const prompt: VoicePrompt = {
        id: 'confirm-action',
        text: 'Delete this file?',
        type: 'confirmation',
        options: ['Yes', 'No']
      };

      const promptSpokenHandler = jest.fn();
      voiceFeedback.on('promptSpoken', promptSpokenHandler);

      const speakPromise = voiceFeedback.speakPrompt(prompt);
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.text).toContain('Please confirm: Delete this file?');
      expect(utterance.text).toContain('Your options are: Yes, No');

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
      expect(promptSpokenHandler).toHaveBeenCalledWith(prompt);
    });

    test('should speak clarification prompts', async () => {
      const prompt: VoicePrompt = {
        id: 'clarify-intent',
        text: 'Did you mean to call John or Jane?',
        type: 'clarification'
      };

      const speakPromise = voiceFeedback.speakPrompt(prompt);
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.text).toContain('I need to clarify: Did you mean to call John or Jane?');

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
    });

    test('should speak error prompts with appropriate tone', async () => {
      const prompt: VoicePrompt = {
        id: 'error-occurred',
        text: 'Unable to connect to the service',
        type: 'error'
      };

      const speakPromise = voiceFeedback.speakPrompt(prompt);
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.text).toContain("I'm sorry, there was an issue: Unable to connect to the service");

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
    });

    test('should use elderly-optimized settings for prompts', async () => {
      const prompt: VoicePrompt = {
        id: 'test-prompt',
        text: 'Test message',
        type: 'information'
      };

      const speakPromise = voiceFeedback.speakPrompt(prompt);
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      // Should be slower and slightly higher pitch for elderly users
      expect(utterance.rate).toBeLessThan(defaultSettings.speed);
      expect(utterance.pitch).toBeGreaterThan(defaultSettings.pitch);

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
    });

    test('should handle prompt errors', async () => {
      const prompt: VoicePrompt = {
        id: 'error-prompt',
        text: 'Test error',
        type: 'information'
      };

      const promptErrorHandler = jest.fn();
      voiceFeedback.on('promptError', promptErrorHandler);

      const speakPromise = voiceFeedback.speakPrompt(prompt);
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      // Simulate error
      const errorEvent = { error: 'network-error' };
      if (utterance.onerror) {
        utterance.onerror(errorEvent);
      }

      await expect(speakPromise).rejects.toThrow();
      expect(promptErrorHandler).toHaveBeenCalledWith({
        prompt,
        error: expect.any(Error)
      });
    });
  });

  describe('Action Confirmations', () => {
    test('should confirm actions with positive feedback', async () => {
      const actionConfirmedHandler = jest.fn();
      voiceFeedback.on('actionConfirmed', actionConfirmedHandler);

      const confirmPromise = voiceFeedback.confirmAction('Message sent');
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.text).toBe('Message sent confirmed');
      expect(utterance.pitch).toBeGreaterThan(defaultSettings.pitch); // Higher pitch for positive feedback

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await confirmPromise;
      expect(actionConfirmedHandler).toHaveBeenCalledWith('Message sent');
    });

    test('should handle confirmation errors gracefully', async () => {
      const confirmationErrorHandler = jest.fn();
      voiceFeedback.on('confirmationError', confirmationErrorHandler);

      const confirmPromise = voiceFeedback.confirmAction('Test action');
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      // Simulate error
      const errorEvent = { error: 'synthesis-unavailable' };
      if (utterance.onerror) {
        utterance.onerror(errorEvent);
      }

      // Should not throw, just handle gracefully
      await confirmPromise;
      expect(confirmationErrorHandler).toHaveBeenCalledWith({
        action: 'Test action',
        error: expect.any(Error)
      });
    });
  });

  describe('Error Announcements', () => {
    test('should announce errors with appropriate tone', async () => {
      const errorAnnouncedHandler = jest.fn();
      voiceFeedback.on('errorAnnounced', errorAnnouncedHandler);

      const announcePromise = voiceFeedback.announceError('Connection failed');
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.text).toBe('Error: Connection failed. Please try again.');
      expect(utterance.pitch).toBeLessThan(defaultSettings.pitch); // Lower pitch for errors
      expect(utterance.rate).toBeLessThan(defaultSettings.speed); // Slower for clarity

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await announcePromise;
      expect(errorAnnouncedHandler).toHaveBeenCalledWith('Connection failed');
    });
  });

  describe('Status Announcements', () => {
    test('should announce status updates quietly', async () => {
      const statusAnnouncedHandler = jest.fn();
      voiceFeedback.on('statusAnnounced', statusAnnouncedHandler);

      const announcePromise = voiceFeedback.announceStatus('Processing your request');
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.text).toBe('Processing your request');
      expect(utterance.volume).toBeLessThan(defaultSettings.volume); // Quieter for status

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await announcePromise;
      expect(statusAnnouncedHandler).toHaveBeenCalledWith('Processing your request');
    });
  });

  describe('Navigation Announcements', () => {
    test('should announce navigation actions', async () => {
      const navigationAnnouncedHandler = jest.fn();
      voiceFeedback.on('navigationAnnounced', navigationAnnouncedHandler);

      const announcePromise = voiceFeedback.announceNavigation('Settings menu', 'Opened');
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.text).toBe('Opened Settings menu');
      expect(utterance.volume).toBeLessThan(defaultSettings.volume); // Quieter for navigation
      expect(utterance.rate).toBeGreaterThan(defaultSettings.speed); // Faster for brevity

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await announcePromise;
      expect(navigationAnnouncedHandler).toHaveBeenCalledWith({
        element: 'Settings menu',
        action: 'Opened'
      });
    });
  });

  describe('Speech Control', () => {
    test('should stop current speech', () => {
      voiceFeedback.speak('Test message');
      voiceFeedback.stop();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    test('should pause and resume speech', () => {
      mockSpeechSynthesis.speaking = true;
      voiceFeedback.pause();
      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();

      mockSpeechSynthesis.paused = true;
      voiceFeedback.resume();
      expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
    });

    test('should report speaking status', () => {
      mockSpeechSynthesis.speaking = true;
      expect(voiceFeedback.isSpeaking()).toBe(true);

      mockSpeechSynthesis.speaking = false;
      expect(voiceFeedback.isSpeaking()).toBe(false);
    });

    test('should report paused status', () => {
      mockSpeechSynthesis.paused = true;
      expect(voiceFeedback.isPaused()).toBe(true);

      mockSpeechSynthesis.paused = false;
      expect(voiceFeedback.isPaused()).toBe(false);
    });
  });

  describe('Voice Management', () => {
    test('should get available voices', () => {
      const voices = voiceFeedback.getAvailableVoices();
      expect(voices).toHaveLength(3);
      expect(voices[0].name).toBe('Test Voice 1');
    });

    test('should filter voices by language', () => {
      const englishVoices = voiceFeedback.getVoicesForLanguage('en-US');
      expect(englishVoices).toHaveLength(1);
      expect(englishVoices[0].lang).toBe('en-US');

      const spanishVoices = voiceFeedback.getVoicesForLanguage('es-ES');
      expect(spanishVoices).toHaveLength(1);
      expect(spanishVoices[0].lang).toBe('es-ES');
    });

    test('should select appropriate voice for language', async () => {
      const speakPromise = voiceFeedback.speak('Test', { language: 'es-ES' });
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      expect(utterance.voice?.lang).toBe('es-ES');

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await speakPromise;
    });
  });

  describe('Settings Management', () => {
    test('should update voice settings', () => {
      const settingsUpdatedHandler = jest.fn();
      voiceFeedback.on('settingsUpdated', settingsUpdatedHandler);

      const newSettings: Partial<VoiceSettings> = {
        speed: 0.7,
        volume: 0.9
      };

      voiceFeedback.updateSettings(newSettings);

      expect(settingsUpdatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 0.7,
          volume: 0.9,
          pitch: defaultSettings.pitch, // Should retain original
          language: defaultSettings.language // Should retain original
        })
      );
    });

    test('should test voice settings', async () => {
      const voiceTestCompletedHandler = jest.fn();
      voiceFeedback.on('voiceTestCompleted', voiceTestCompletedHandler);

      const testSettings: Partial<VoiceSettings> = { speed: 0.5 };
      const testPromise = voiceFeedback.testVoice(testSettings);
      
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.text).toContain('This is a test of the voice settings');
      expect(utterance.rate).toBe(0.5);

      // Simulate completion
      if (utterance.onend) {
        utterance.onend();
      }

      await testPromise;
      expect(voiceTestCompletedHandler).toHaveBeenCalledWith(testSettings);
    });

    test('should handle voice test errors', async () => {
      const voiceTestErrorHandler = jest.fn();
      voiceFeedback.on('voiceTestError', voiceTestErrorHandler);

      const testSettings: Partial<VoiceSettings> = { speed: 0.5 };
      const testPromise = voiceFeedback.testVoice(testSettings);
      
      const utterance = (window.SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      // Simulate error
      const errorEvent = { error: 'test-failed' };
      if (utterance.onerror) {
        utterance.onerror(errorEvent);
      }

      await expect(testPromise).rejects.toThrow();
      expect(voiceTestErrorHandler).toHaveBeenCalledWith({
        settings: testSettings,
        error: expect.any(Error)
      });
    });
  });

  describe('Enable/Disable Functionality', () => {
    test('should enable and disable voice feedback', () => {
      const enabledChangedHandler = jest.fn();
      voiceFeedback.on('enabledChanged', enabledChangedHandler);

      voiceFeedback.setEnabled(false);
      expect(enabledChangedHandler).toHaveBeenCalledWith(false);

      voiceFeedback.setEnabled(true);
      expect(enabledChangedHandler).toHaveBeenCalledWith(true);
    });

    test('should not speak when disabled', async () => {
      voiceFeedback.setEnabled(false);
      
      await voiceFeedback.speak('This should not be spoken');
      
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });

    test('should stop current speech when disabled', () => {
      voiceFeedback.speak('Test message');
      voiceFeedback.setEnabled(false);

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing speech synthesis API', async () => {
      // Temporarily remove speech synthesis
      const originalSpeechSynthesis = window.speechSynthesis;
      (window as any).speechSynthesis = undefined;

      const voiceFeedbackWithoutAPI = new VoiceFeedback(defaultSettings);
      
      // Should not throw
      await expect(voiceFeedbackWithoutAPI.speak('Test')).resolves.toBeUndefined();

      // Restore API
      (window as any).speechSynthesis = originalSpeechSynthesis;
      voiceFeedbackWithoutAPI.destroy();
    });

    test('should handle empty voice list', () => {
      mockSpeechSynthesis.getVoices.mockReturnValue([]);
      
      const voices = voiceFeedback.getAvailableVoices();
      expect(voices).toHaveLength(0);
      
      const englishVoices = voiceFeedback.getVoicesForLanguage('en-US');
      expect(englishVoices).toHaveLength(0);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly when destroyed', () => {
      voiceFeedback.speak('Test message');
      
      const listenerCount = voiceFeedback.listenerCount('speechStart');
      voiceFeedback.destroy();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
      expect(voiceFeedback.listenerCount('speechStart')).toBe(0);
    });
  });
});