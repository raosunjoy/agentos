import { ConversationalInterface } from '../conversational-interface';
import { VoicePrompt, AccessibilitySettings, VoiceSettings } from '../types';

// Mock DOM methods
Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
    speaking: false,
    paused: false
  }
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ConversationalInterface', () => {
  let conversationalInterface: ConversationalInterface;
  let container: HTMLElement;

  beforeEach(() => {
    // Create a mock container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    conversationalInterface = new ConversationalInterface();
  });

  afterEach(() => {
    conversationalInterface.destroy();
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default settings', () => {
      const voiceSettings = conversationalInterface.getVoiceSettings();
      const accessibilitySettings = conversationalInterface.getAccessibilitySettings();

      expect(voiceSettings.speed).toBe(1.0);
      expect(voiceSettings.volume).toBe(0.8);
      expect(voiceSettings.language).toBe('en-US');
      expect(accessibilitySettings.fontSize).toBe('large');
      expect(accessibilitySettings.voiceNavigation).toBe(true);
    });

    test('should create proper DOM structure when initialized', () => {
      conversationalInterface.initialize(container);

      expect(container.querySelector('.conversation-interface')).toBeTruthy();
      expect(container.querySelector('.welcome-message')).toBeTruthy();
      expect(container.querySelector('#voice-button')).toBeTruthy();
      expect(container.querySelector('.quick-actions')).toBeTruthy();
      expect(container.querySelector('#settings-button')).toBeTruthy();
    });

    test('should setup accessibility attributes', () => {
      conversationalInterface.initialize(container);

      const voiceButton = container.querySelector('#voice-button');
      expect(voiceButton?.getAttribute('aria-label')).toBe('Start voice input');
      expect(voiceButton?.getAttribute('role')).toBe('button');

      const conversationArea = container.querySelector('.conversation-area');
      expect(conversationArea?.getAttribute('role')).toBe('log');
      expect(conversationArea?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Voice Interaction', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should start listening when voice button is clicked', () => {
      const voiceButton = container.querySelector('#voice-button') as HTMLButtonElement;
      const startListeningSpy = jest.spyOn(conversationalInterface, 'startListening');

      voiceButton.click();

      expect(startListeningSpy).toHaveBeenCalled();
    });

    test('should update UI when listening starts', () => {
      conversationalInterface.startListening();

      const voiceButton = container.querySelector('#voice-button') as HTMLButtonElement;
      expect(voiceButton.classList.contains('listening')).toBe(true);
      expect(voiceButton.querySelector('.voice-text')?.textContent).toBe('Listening...');
    });

    test('should stop listening and process input', () => {
      conversationalInterface.startListening();
      conversationalInterface.stopListening();

      const voiceButton = container.querySelector('#voice-button') as HTMLButtonElement;
      expect(voiceButton.classList.contains('listening')).toBe(false);
      expect(voiceButton.querySelector('.voice-text')?.textContent).toBe('Tap to speak');
    });

    test('should emit events for voice interactions', () => {
      const startListeningHandler = jest.fn();
      const stopListeningHandler = jest.fn();

      conversationalInterface.on('startListening', startListeningHandler);
      conversationalInterface.on('stopListening', stopListeningHandler);

      conversationalInterface.startListening();
      conversationalInterface.stopListening();

      expect(startListeningHandler).toHaveBeenCalled();
      expect(stopListeningHandler).toHaveBeenCalled();
    });
  });

  describe('Text Input Alternative', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should toggle text input visibility', () => {
      const textInputButton = container.querySelector('#text-input-button') as HTMLButtonElement;
      const textInput = container.querySelector('#text-input') as HTMLTextAreaElement;

      expect(textInput.classList.contains('hidden')).toBe(true);

      textInputButton.click();

      expect(textInput.classList.contains('hidden')).toBe(false);
      expect(document.activeElement).toBe(textInput);
    });

    test('should process text input when submitted', () => {
      const userInputHandler = jest.fn();
      conversationalInterface.on('userInput', userInputHandler);

      const textInput = container.querySelector('#text-input') as HTMLTextAreaElement;
      const sendButton = container.querySelector('#send-text-button') as HTMLButtonElement;

      textInput.value = 'Test message';
      sendButton.click();

      expect(userInputHandler).toHaveBeenCalledWith({
        input: 'Test message',
        method: 'text'
      });
      expect(textInput.value).toBe('');
    });

    test('should submit text input on Enter key', () => {
      const userInputHandler = jest.fn();
      conversationalInterface.on('userInput', userInputHandler);

      const textInput = container.querySelector('#text-input') as HTMLTextAreaElement;
      textInput.value = 'Test message';

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      textInput.dispatchEvent(enterEvent);

      expect(userInputHandler).toHaveBeenCalledWith({
        input: 'Test message',
        method: 'text'
      });
    });
  });

  describe('Quick Actions', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should handle quick action clicks', () => {
      const quickActionHandler = jest.fn();
      conversationalInterface.on('quickAction', quickActionHandler);

      const emergencyButton = container.querySelector('[data-intent="emergency"]') as HTMLButtonElement;
      emergencyButton.click();

      expect(quickActionHandler).toHaveBeenCalledWith({
        intent: 'emergency'
      });
    });

    test('should add conversation turn for quick actions', () => {
      const emergencyButton = container.querySelector('[data-intent="emergency"]') as HTMLButtonElement;
      emergencyButton.click();

      const conversationHistory = container.querySelector('#conversation-history');
      expect(conversationHistory?.children.length).toBe(1);
    });
  });

  describe('Conversation Management', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should add conversation turns to history', () => {
      conversationalInterface.addConversationTurn(
        'Hello',
        'Hi there! How can I help you?',
        'greeting',
        0.95
      );

      const state = conversationalInterface.getConversationState();
      expect(state.conversationHistory).toHaveLength(1);
      expect(state.conversationHistory[0].userInput).toBe('Hello');
      expect(state.conversationHistory[0].systemResponse).toBe('Hi there! How can I help you?');
      expect(state.conversationHistory[0].confidence).toBe(0.95);
    });

    test('should render conversation turns in DOM', () => {
      conversationalInterface.addConversationTurn('Test input', 'Test response');

      const conversationHistory = container.querySelector('#conversation-history');
      const turnElement = conversationHistory?.querySelector('.conversation-turn');
      
      expect(turnElement).toBeTruthy();
      expect(turnElement?.querySelector('.user-message')?.textContent).toContain('Test input');
      expect(turnElement?.querySelector('.system-message')?.textContent).toContain('Test response');
    });

    test('should escape HTML in conversation content', () => {
      conversationalInterface.addConversationTurn('<script>alert("xss")</script>', 'Safe response');

      const userMessage = container.querySelector('.user-message');
      expect(userMessage?.innerHTML).not.toContain('<script>');
      expect(userMessage?.textContent).toContain('<script>alert("xss")</script>');
    });
  });

  describe('Voice Prompts', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should show voice prompts', () => {
      const voicePromptHandler = jest.fn();
      conversationalInterface.on('voicePrompt', voicePromptHandler);

      const prompt: VoicePrompt = {
        id: 'test-prompt',
        text: 'Please confirm your action',
        type: 'confirmation',
        options: ['Yes', 'No']
      };

      conversationalInterface.showVoicePrompt(prompt);

      expect(voicePromptHandler).toHaveBeenCalledWith(prompt);
      
      const state = conversationalInterface.getConversationState();
      expect(state.awaitingConfirmation).toBe(true);
    });
  });

  describe('Visual Feedback', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should update visual feedback indicators', () => {
      conversationalInterface.updateVisualFeedback({
        type: 'listening',
        message: 'Listening for your voice...',
        animated: true
      });

      const indicator = container.querySelector('.listening-indicator') as HTMLElement;
      const statusText = container.querySelector('#status-text') as HTMLElement;

      expect(indicator.classList.contains('active')).toBe(true);
      expect(statusText.textContent).toBe('Listening for your voice...');
    });

    test('should update conversation state based on feedback', () => {
      conversationalInterface.updateVisualFeedback({
        type: 'processing',
        message: 'Processing...',
        animated: true
      });

      const state = conversationalInterface.getConversationState();
      expect(state.isProcessing).toBe(true);
      expect(state.isListening).toBe(false);
    });
  });

  describe('Accessibility Settings', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should apply accessibility settings to interface', () => {
      const settings: Partial<AccessibilitySettings> = {
        highContrast: true,
        fontSize: 'extra-large',
        reducedMotion: true
      };

      conversationalInterface.updateAccessibilitySettings(settings);

      expect(container.classList.contains('high-contrast')).toBe(true);
      expect(container.classList.contains('extra-large-text')).toBe(true);
      expect(container.classList.contains('reduced-motion')).toBe(true);
    });

    test('should emit events when accessibility settings change', () => {
      const settingsHandler = jest.fn();
      conversationalInterface.on('accessibilitySettingsChanged', settingsHandler);

      const settings: Partial<AccessibilitySettings> = {
        largeText: true
      };

      conversationalInterface.updateAccessibilitySettings(settings);

      expect(settingsHandler).toHaveBeenCalledWith(
        expect.objectContaining({ largeText: true })
      );
    });
  });

  describe('Voice Settings', () => {
    test('should update voice settings', () => {
      const settingsHandler = jest.fn();
      conversationalInterface.on('voiceSettingsChanged', settingsHandler);

      const settings: Partial<VoiceSettings> = {
        speed: 0.8,
        volume: 0.9,
        language: 'es-ES'
      };

      conversationalInterface.updateVoiceSettings(settings);

      const currentSettings = conversationalInterface.getVoiceSettings();
      expect(currentSettings.speed).toBe(0.8);
      expect(currentSettings.volume).toBe(0.9);
      expect(currentSettings.language).toBe('es-ES');
      expect(settingsHandler).toHaveBeenCalledWith(currentSettings);
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should activate voice input on spacebar', () => {
      const startListeningSpy = jest.spyOn(conversationalInterface, 'startListening');

      const spaceEvent = new KeyboardEvent('keydown', { 
        code: 'Space',
        target: document.body 
      } as any);
      document.dispatchEvent(spaceEvent);

      expect(startListeningSpy).toHaveBeenCalled();
    });

    test('should cancel operations on Escape key', () => {
      conversationalInterface.startListening();

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      const state = conversationalInterface.getConversationState();
      expect(state.isListening).toBe(false);
    });
  });

  describe('Settings Panel', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should toggle settings panel visibility', () => {
      const settingsButton = container.querySelector('#settings-button') as HTMLButtonElement;
      const settingsPanel = container.querySelector('#settings-panel') as HTMLElement;

      expect(settingsPanel.classList.contains('hidden')).toBe(true);

      settingsButton.click();

      expect(settingsPanel.classList.contains('hidden')).toBe(false);
      expect(settingsButton.getAttribute('aria-expanded')).toBe('true');
    });

    test('should emit settings opened event', () => {
      const settingsOpenedHandler = jest.fn();
      conversationalInterface.on('settingsOpened', settingsOpenedHandler);

      const settingsButton = container.querySelector('#settings-button') as HTMLButtonElement;
      settingsButton.click();

      expect(settingsOpenedHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      conversationalInterface.initialize(container);
    });

    test('should handle missing DOM elements gracefully', () => {
      // Remove a required element
      const voiceButton = container.querySelector('#voice-button');
      voiceButton?.remove();

      // Should not throw when trying to interact
      expect(() => {
        conversationalInterface.startListening();
        conversationalInterface.stopListening();
      }).not.toThrow();
    });

    test('should sanitize user input to prevent XSS', () => {
      const maliciousInput = '<img src="x" onerror="alert(1)">';
      conversationalInterface.addConversationTurn(maliciousInput, 'Response');

      const userMessage = container.querySelector('.user-message');
      expect(userMessage?.innerHTML).not.toContain('onerror');
      expect(userMessage?.textContent).toContain(maliciousInput);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly when destroyed', () => {
      conversationalInterface.initialize(container);
      
      const listenerCount = conversationalInterface.listenerCount('startListening');
      conversationalInterface.destroy();

      expect(container.innerHTML).toBe('');
      expect(conversationalInterface.listenerCount('startListening')).toBe(0);
    });
  });
});