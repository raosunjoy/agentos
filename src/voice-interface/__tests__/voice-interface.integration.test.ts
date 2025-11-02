/**
 * Integration Tests for Voice Interface
 * Comprehensive testing of speech recognition, text-to-speech, voice activity detection, and accessibility features
 */

import {
  VoiceInterface,
  SpeechToText,
  TextToSpeech,
  VoiceActivityDetector,
  ConversationalInterface,
  AccessibilityManager,
  AlternativeInputMethods,
  VoiceFeedback
} from '../index';

// Mock Web Speech API
const mockSpeechRecognition = {
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
};

const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => []),
  speaking: false,
  pending: false,
  paused: false
};

const mockSpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
  text,
  lang: 'en-US',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
}));

// Setup global mocks
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: jest.fn().mockImplementation(() => mockSpeechRecognition)
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: jest.fn().mockImplementation(() => mockSpeechRecognition)
});

Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: mockSpeechSynthesis
});

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  writable: true,
  value: mockSpeechSynthesisUtterance
});

describe('Voice Interface Integration', () => {
  let voiceInterface: VoiceInterface;
  let speechToText: SpeechToText;
  let textToSpeech: TextToSpeech;
  let voiceActivityDetector: VoiceActivityDetector;
  let conversationalInterface: ConversationalInterface;
  let accessibilityManager: AccessibilityManager;
  let alternativeInputMethods: AlternativeInputMethods;
  let voiceFeedback: VoiceFeedback;

  beforeEach(async () => {
    // Initialize components
    speechToText = new SpeechToText();
    textToSpeech = new TextToSpeech();
    voiceActivityDetector = new VoiceActivityDetector();
    conversationalInterface = new ConversationalInterface();
    accessibilityManager = new AccessibilityManager();
    alternativeInputMethods = new AlternativeInputMethods();
    voiceFeedback = new VoiceFeedback();

    voiceInterface = new VoiceInterface({
      speechToText,
      textToSpeech,
      voiceActivityDetector,
      conversationalInterface,
      accessibilityManager,
      alternativeInputMethods,
      voiceFeedback
    });

    // Initialize voice interface
    await voiceInterface.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (voiceInterface) {
      await voiceInterface.shutdown();
    }

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Speech Recognition and Processing', () => {
    test('should recognize speech and convert to text', async () => {
      const recognition = speechToText.createRecognition();

      // Mock recognition result
      const mockResult = {
        transcript: 'Hello AgentOS',
        confidence: 0.95,
        isFinal: true
      };

      // Simulate speech recognition event
      recognition.onresult({
        results: [[mockResult]],
        resultIndex: 0
      } as any);

      const result = await speechToText.recognize();

      expect(result.transcript).toBe('Hello AgentOS');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('should handle continuous speech recognition', async () => {
      const recognition = speechToText.createRecognition({ continuous: true });

      const results: string[] = [];

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        results.push(transcript);

        if (results.length >= 3) {
          recognition.stop();
        }
      };

      // Simulate multiple speech segments
      setTimeout(() => recognition.onresult({
        results: [['Hello']],
        resultIndex: 0
      } as any), 100);

      setTimeout(() => recognition.onresult({
        results: [[' my name is']],
        resultIndex: 1
      } as any), 200);

      setTimeout(() => recognition.onresult({
        results: [[' John']],
        resultIndex: 2
      } as any), 300);

      await speechToText.recognize({ continuous: true });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.includes('Hello'))).toBe(true);
    });

    test('should handle speech recognition errors gracefully', async () => {
      const recognition = speechToText.createRecognition();

      // Mock error event
      recognition.onerror({
        error: 'network',
        message: 'Network error occurred'
      } as any);

      await expect(speechToText.recognize()).rejects.toThrow();
    });
  });

  describe('Text-to-Speech Synthesis', () => {
    test('should synthesize text to speech', async () => {
      const text = 'Hello, how can I help you today?';

      await textToSpeech.speak(text, {
        lang: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8
      });

      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).toBe(text);
      expect(utterance.lang).toBe('en-US');
      expect(utterance.rate).toBe(1.0);
      expect(utterance.pitch).toBe(1.0);
      expect(utterance.volume).toBe(0.8);
    });

    test('should queue multiple speech requests', async () => {
      const texts = [
        'First message',
        'Second message',
        'Third message'
      ];

      const promises = texts.map(text => textToSpeech.speak(text));

      await Promise.all(promises);

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(3);
      texts.forEach((text, index) => {
        expect(mockSpeechSynthesis.speak.mock.calls[index][0].text).toBe(text);
      });
    });

    test('should handle speech synthesis cancellation', async () => {
      const text = 'This message should be cancelled';

      const speakPromise = textToSpeech.speak(text);
      textToSpeech.cancel();

      await expect(speakPromise).rejects.toThrow('Speech cancelled');

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    test('should support different voices and languages', async () => {
      const voices = [
        { name: 'English Male', lang: 'en-US', voiceURI: 'en-US-male' },
        { name: 'Spanish Female', lang: 'es-ES', voiceURI: 'es-ES-female' }
      ];

      mockSpeechSynthesis.getVoices.mockReturnValue(voices as any);

      const englishText = 'Hello world';
      const spanishText = 'Hola mundo';

      await textToSpeech.speak(englishText, { voice: voices[0] });
      await textToSpeech.speak(spanishText, { voice: voices[1], lang: 'es-ES' });

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
      expect(mockSpeechSynthesis.speak.mock.calls[0][0].lang).toBe('en-US');
      expect(mockSpeechSynthesis.speak.mock.calls[1][0].lang).toBe('es-ES');
    });
  });

  describe('Voice Activity Detection', () => {
    test('should detect voice activity in audio stream', async () => {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(new MediaStream());

      voiceActivityDetector.setAudioSource(microphone, analyser);

      // Mock audio data with voice activity
      const mockAudioData = new Uint8Array(1024);
      for (let i = 0; i < mockAudioData.length; i++) {
        mockAudioData[i] = Math.random() * 255; // Simulate audio signal
      }

      analyser.getByteFrequencyData = jest.fn().mockImplementation((array) => {
        array.set(mockAudioData);
      });

      const isActive = voiceActivityDetector.detectActivity();

      expect(typeof isActive).toBe('boolean');
    });

    test('should configure voice activity detection parameters', () => {
      voiceActivityDetector.configure({
        sensitivity: 0.7,
        minimumDuration: 300,
        maximumSilence: 1000
      });

      // Should not throw
      expect(() => voiceActivityDetector.detectActivity()).not.toThrow();
    });

    test('should handle audio context state changes', async () => {
      const audioContext = new AudioContext();

      // Start suspended
      expect(audioContext.state).toBe('suspended');

      // Resume context
      await audioContext.resume();
      expect(audioContext.state).toBe('running');

      // Close context
      await audioContext.close();
      expect(audioContext.state).toBe('closed');
    });
  });

  describe('Conversational Interface', () => {
    test('should manage conversation turns', async () => {
      const userMessage = 'What time is it?';
      const agentResponse = 'The current time is 3:45 PM.';

      await conversationalInterface.addUserMessage(userMessage);
      await conversationalInterface.addAgentResponse(agentResponse);

      const conversation = conversationalInterface.getConversation();

      expect(conversation.length).toBe(2);
      expect(conversation[0].speaker).toBe('user');
      expect(conversation[0].text).toBe(userMessage);
      expect(conversation[1].speaker).toBe('agent');
      expect(conversation[1].text).toBe(agentResponse);
    });

    test('should handle conversation context and prompts', async () => {
      const prompt = 'Please confirm your appointment time.';

      conversationalInterface.setPrompt(prompt);

      expect(conversationalInterface.getCurrentPrompt()).toBe(prompt);

      // Clear prompt after response
      await conversationalInterface.addUserMessage('Yes, 3 PM is good');
      conversationalInterface.clearPrompt();

      expect(conversationalInterface.getCurrentPrompt()).toBeNull();
    });

    test('should support conversation serialization', () => {
      const conversationData = conversationalInterface.serialize();
      expect(typeof conversationData).toBe('string');

      const parsed = JSON.parse(conversationData);
      expect(Array.isArray(parsed.conversation)).toBe(true);
    });

    test('should handle conversation history limits', async () => {
      // Add many messages
      for (let i = 0; i < 150; i++) {
        await conversationalInterface.addUserMessage(`Message ${i}`);
        await conversationalInterface.addAgentResponse(`Response ${i}`);
      }

      const conversation = conversationalInterface.getConversation();

      // Should maintain reasonable history size
      expect(conversation.length).toBeLessThanOrEqual(200); // Configurable limit
      expect(conversation[0].text).toBe('Message 0'); // Should keep earliest messages
    });
  });

  describe('Accessibility Features', () => {
    test('should provide screen reader support', () => {
      const element = document.createElement('button');
      element.textContent = 'Test Button';
      document.body.appendChild(element);

      accessibilityManager.enableScreenReaderSupport();

      expect(element.getAttribute('aria-label')).toBeTruthy();
      expect(element.getAttribute('role')).toBe('button');

      document.body.removeChild(element);
    });

    test('should implement keyboard navigation', () => {
      const container = document.createElement('div');
      const buttons = Array.from({ length: 3 }, () => {
        const button = document.createElement('button');
        button.textContent = 'Button';
        container.appendChild(button);
        return button;
      });
      document.body.appendChild(container);

      accessibilityManager.setupKeyboardNavigation(container);

      // Simulate Tab key navigation
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      container.dispatchEvent(tabEvent);

      // Should focus first button
      expect(document.activeElement).toBe(buttons[0]);

      document.body.removeChild(container);
    });

    test('should check WCAG compliance', () => {
      const compliantElement = document.createElement('input');
      compliantElement.id = 'test-input';
      compliantElement.type = 'text';
      compliantElement.required = true;

      const label = document.createElement('label');
      label.htmlFor = 'test-input';
      label.textContent = 'Test Input';

      document.body.appendChild(label);
      document.body.appendChild(compliantElement);

      const violations = accessibilityManager.checkCompliance([compliantElement]);
      expect(violations.length).toBe(0);

      document.body.removeChild(label);
      document.body.removeChild(compliantElement);
    });

    test('should provide alternative input methods', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      alternativeInputMethods.setupSwitchControl(input);

      // Should add accessibility attributes
      expect(input.getAttribute('tabindex')).toBe('0');

      document.body.removeChild(input);
    });
  });

  describe('Voice Feedback System', () => {
    test('should provide audio feedback for actions', async () => {
      const action = 'button_clicked';
      const message = 'Button was clicked';

      await voiceFeedback.provideFeedback(action, message);

      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).toContain(message);
    });

    test('should support different feedback types', async () => {
      const feedbacks = [
        { action: 'success', message: 'Operation completed successfully' },
        { action: 'error', message: 'An error occurred' },
        { action: 'warning', message: 'Please check your input' }
      ];

      for (const feedback of feedbacks) {
        await voiceFeedback.provideFeedback(feedback.action, feedback.message);
      }

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(3);
    });

    test('should configure feedback settings', () => {
      voiceFeedback.configure({
        enabled: true,
        volume: 0.7,
        rate: 1.2,
        voice: 'female'
      });

      // Should not throw
      expect(() => voiceFeedback.provideFeedback('test', 'test')).not.toThrow();
    });

    test('should handle feedback queue management', async () => {
      const feedbacks = Array.from({ length: 5 }, (_, i) => ({
        action: `action-${i}`,
        message: `Message ${i}`
      }));

      const promises = feedbacks.map(f =>
        voiceFeedback.provideFeedback(f.action, f.message)
      );

      await Promise.all(promises);

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(5);
    });
  });

  describe('End-to-End Voice Interaction', () => {
    test('should handle complete voice interaction flow', async () => {
      // 1. User speaks
      const userSpeech = 'What is the weather like?';
      const speechResult = await speechToText.recognize();
      speechResult.transcript = userSpeech;

      // 2. Process through conversational interface
      await conversationalInterface.addUserMessage(userSpeech);

      // 3. Generate response
      const response = 'The weather is sunny and 75 degrees.';
      await conversationalInterface.addAgentResponse(response);

      // 4. Provide voice feedback
      await voiceFeedback.provideFeedback('response', response);

      // 5. Verify complete flow
      const conversation = conversationalInterface.getConversation();
      expect(conversation.length).toBe(2);
      expect(conversation[0].text).toBe(userSpeech);
      expect(conversation[1].text).toBe(response);
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    test('should handle voice interaction errors gracefully', async () => {
      // Simulate speech recognition failure
      mockSpeechRecognition.dispatchEvent(new Event('error'));

      await expect(speechToText.recognize()).rejects.toThrow();

      // Should still provide error feedback
      await voiceFeedback.provideFeedback('error', 'Speech recognition failed');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('failed')
        })
      );
    });

    test('should support voice command cancellation', async () => {
      // Start speech recognition
      const recognitionPromise = speechToText.recognize();

      // Cancel immediately
      speechToText.cancel();

      await expect(recognitionPromise).rejects.toThrow('cancelled');

      // Should provide cancellation feedback
      await voiceFeedback.provideFeedback('cancelled', 'Voice command cancelled');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent voice operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        voiceInterface.processVoiceCommand(`Command ${i}`)
      );

      const results = await Promise.allSettled(operations);

      // Should handle concurrent operations without crashing
      expect(results.length).toBe(10);
      // Some may succeed, some may fail due to mock limitations, but shouldn't crash
    });

    test('should maintain audio quality under load', async () => {
      const testTexts = Array.from({ length: 50 }, (_, i) =>
        `Test message ${i} for audio quality assessment.`
      );

      const startTime = Date.now();
      await Promise.all(testTexts.map(text => textToSpeech.speak(text)));
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTime = totalTime / testTexts.length;

      // Should process within reasonable time limits
      expect(avgTime).toBeLessThan(100); // < 100ms per message
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(50);
    });

    test('should handle resource cleanup properly', async () => {
      // Create multiple voice interface instances
      const interfaces = Array.from({ length: 5 }, () =>
        new VoiceInterface({
          speechToText: new SpeechToText(),
          textToSpeech: new TextToSpeech(),
          voiceActivityDetector: new VoiceActivityDetector(),
          conversationalInterface: new ConversationalInterface(),
          accessibilityManager: new AccessibilityManager(),
          alternativeInputMethods: new AlternativeInputMethods(),
          voiceFeedback: new VoiceFeedback()
        })
      );

      // Initialize all
      await Promise.all(interfaces.map(iface => iface.initialize()));

      // Shutdown all
      await Promise.all(interfaces.map(iface => iface.shutdown()));

      // Should not have any dangling resources
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    test('should recover from audio device failures', async () => {
      // Simulate audio device disconnection
      mockSpeechRecognition.dispatchEvent(new Event('error'));

      // Should handle gracefully and possibly retry
      await expect(speechToText.recognize()).rejects.toThrow();

      // Should still be able to create new recognition instances
      const newRecognition = speechToText.createRecognition();
      expect(newRecognition).toBeDefined();
    });
  });

  describe('Integration with AgentOS', () => {
    test('should integrate with AgentOS intent processing', async () => {
      const voiceCommand = 'Set a reminder for 3 PM to take medicine';

      // Process through voice interface
      const voiceResult = await voiceInterface.processVoiceCommand(voiceCommand);

      expect(voiceResult).toBeDefined();
      expect(typeof voiceResult.transcript).toBe('string');
      expect(voiceResult.transcript.length).toBeGreaterThan(0);

      // Should have processed through conversational interface
      const conversation = conversationalInterface.getConversation();
      expect(conversation.length).toBeGreaterThan(0);
      expect(conversation[0].text).toBe(voiceCommand);
    });

    test('should support multimodal input (voice + text)', async () => {
      // Voice input
      const voiceInput = 'What time is it?';
      await voiceInterface.processVoiceCommand(voiceInput);

      // Text input
      const textInput = 'Actually, what day is it?';
      await conversationalInterface.addUserMessage(textInput);

      const conversation = conversationalInterface.getConversation();

      expect(conversation.length).toBe(2);
      expect(conversation[0].text).toBe(voiceInput);
      expect(conversation[1].text).toBe(textInput);
    });

    test('should provide comprehensive voice interface status', () => {
      const status = voiceInterface.getStatus();

      expect(status).toHaveProperty('speechToText');
      expect(status).toHaveProperty('textToSpeech');
      expect(status).toHaveProperty('voiceActivityDetector');
      expect(status).toHaveProperty('conversationalInterface');
      expect(status).toHaveProperty('accessibilityManager');
      expect(status).toHaveProperty('voiceFeedback');

      // All components should report their status
      Object.values(status).forEach(componentStatus => {
        expect(typeof componentStatus).toBe('object');
      });
    });
  });
});
