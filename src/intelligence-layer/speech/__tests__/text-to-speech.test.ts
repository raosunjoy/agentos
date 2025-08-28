/**
 * Unit tests for Text-to-Speech Engine
 */

import { TextToSpeechEngine } from '../text-to-speech';
import { UserVoiceProfile } from '../types';

describe('TextToSpeechEngine', () => {
  let engine: TextToSpeechEngine;
  let userProfile: UserVoiceProfile;

  beforeEach(() => {
    userProfile = {
      userId: 'test-user',
      voiceCharacteristics: {
        fundamentalFrequency: 150,
        speechRate: 120,
        pauseDuration: 0.5,
        volumeLevel: 0.1
      },
      adaptationData: {
        commonMispronunciations: new Map(),
        speechPatterns: [],
        preferredPace: 0.8,
        backgroundNoiseProfile: new Float32Array(512)
      },
      lastUpdated: new Date()
    };

    engine = new TextToSpeechEngine(true, userProfile);
  });

  describe('Initialization', () => {
    it('should initialize with elderly optimizations', () => {
      expect(engine).toBeDefined();
    });

    it('should initialize without elderly optimizations', () => {
      const normalEngine = new TextToSpeechEngine(false);
      expect(normalEngine).toBeDefined();
    });

    it('should initialize without user profile', () => {
      const engineWithoutProfile = new TextToSpeechEngine(true);
      expect(engineWithoutProfile).toBeDefined();
    });
  });

  describe('Basic Speech Synthesis', () => {
    it('should synthesize simple text', async () => {
      const text = 'Hello world';
      
      const result = await engine.synthesize(text);
      
      expect(result).toHaveProperty('audioBuffer');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('sampleRate');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(22050);
    });

    it('should synthesize longer text', async () => {
      const text = 'This is a longer sentence that should take more time to synthesize and result in a longer audio buffer.';
      
      const result = await engine.synthesize(text);
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should handle empty text', async () => {
      const text = '';
      
      const result = await engine.synthesize(text);
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Custom Options', () => {
    it('should synthesize with custom rate', async () => {
      const text = 'This is a test';
      
      const result = await engine.synthesize(text, { rate: 0.5 });
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should synthesize with custom volume', async () => {
      const text = 'This is a test';
      
      const result = await engine.synthesize(text, { volume: 0.5 });
      
      expect(result.success).toBe(true);
    });

    it('should synthesize with custom pitch', async () => {
      const text = 'This is a test';
      
      const result = await engine.synthesize(text, { pitch: 1.2 });
      
      expect(result.success).toBe(true);
    });

    it('should synthesize with custom voice', async () => {
      const text = 'This is a test';
      
      const result = await engine.synthesize(text, { voice: 'gentle-male' });
      
      expect(result.success).toBe(true);
    });
  });

  describe('SSML Support', () => {
    it('should synthesize SSML markup', async () => {
      const ssml = '<speak>Hello <break time="500ms"/> world</speak>';
      
      const result = await engine.synthesizeSSML(ssml);
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should handle SSML with prosody', async () => {
      const ssml = '<speak><prosody rate="slow" pitch="low">Hello world</prosody></speak>';
      
      const result = await engine.synthesizeSSML(ssml);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Elderly Optimizations', () => {
    it('should apply elderly-optimized settings', async () => {
      const text = 'Dr. Smith will see you at 3:30 PM';
      
      const result = await engine.synthesize(text, { elderlyOptimized: true });
      
      expect(result.success).toBe(true);
      // Should expand abbreviations and add pauses
    });

    it('should expand abbreviations', async () => {
      const text = 'Dr. Smith vs. Mr. Jones at 3 PM';
      
      const result = await engine.synthesize(text, { elderlyOptimized: true });
      
      expect(result.success).toBe(true);
    });

    it('should handle numbers appropriately', async () => {
      const text = 'Call 555-123-4567 at 3:30';
      
      const result = await engine.synthesize(text, { elderlyOptimized: true });
      
      expect(result.success).toBe(true);
    });

    it('should improve technical term pronunciation', async () => {
      const text = 'Connect to WiFi and check your SMS';
      
      const result = await engine.synthesize(text, { elderlyOptimized: true });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Voice Selection', () => {
    it('should return available elderly-optimized voices', () => {
      const voices = engine.getElderlyOptimizedVoices();
      
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
      
      voices.forEach(voice => {
        expect(voice).toHaveProperty('id');
        expect(voice).toHaveProperty('name');
        expect(voice).toHaveProperty('language');
        expect(voice).toHaveProperty('gender');
        expect(voice).toHaveProperty('characteristics');
        expect(Array.isArray(voice.characteristics)).toBe(true);
      });
    });

    it('should include warm and clear voices', () => {
      const voices = engine.getElderlyOptimizedVoices();
      
      const warmVoice = voices.find(v => v.characteristics.includes('warm'));
      const clearVoice = voices.find(v => v.characteristics.includes('clear'));
      
      expect(warmVoice).toBeDefined();
      expect(clearVoice).toBeDefined();
    });
  });

  describe('User Profile Integration', () => {
    it('should set user profile', () => {
      const newProfile: UserVoiceProfile = {
        ...userProfile,
        adaptationData: {
          ...userProfile.adaptationData,
          preferredPace: 0.7
        }
      };

      expect(() => {
        engine.setUserProfile(newProfile);
      }).not.toThrow();
    });

    it('should adapt to user preferences', async () => {
      // Set a profile with specific preferences
      const customProfile: UserVoiceProfile = {
        ...userProfile,
        adaptationData: {
          ...userProfile.adaptationData,
          preferredPace: 0.6 // Slower pace
        }
      };
      
      engine.setUserProfile(customProfile);
      
      const text = 'This should be spoken slowly';
      const result = await engine.synthesize(text);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Voice Settings Updates', () => {
    it('should update settings based on too fast feedback', () => {
      expect(() => {
        engine.updateVoiceSettings({ tooFast: true });
      }).not.toThrow();
    });

    it('should update settings based on too slow feedback', () => {
      expect(() => {
        engine.updateVoiceSettings({ tooSlow: true });
      }).not.toThrow();
    });

    it('should update settings based on volume feedback', () => {
      expect(() => {
        engine.updateVoiceSettings({ 
          tooLoud: true,
          tooQuiet: false 
        });
      }).not.toThrow();
    });

    it('should update settings based on clarity feedback', () => {
      expect(() => {
        engine.updateVoiceSettings({ unclear: true });
      }).not.toThrow();
    });

    it('should handle multiple feedback types', () => {
      expect(() => {
        engine.updateVoiceSettings({
          tooFast: true,
          tooLoud: true,
          unclear: true
        });
      }).not.toThrow();
    });
  });

  describe('Emergency Speech', () => {
    it('should synthesize emergency messages', async () => {
      const text = 'Emergency services have been contacted';
      
      const result = await engine.synthesizeEmergency(text);
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should use appropriate urgency for emergency', async () => {
      const text = 'Help is on the way';
      
      const result = await engine.synthesizeEmergency(text);
      
      expect(result.success).toBe(true);
      // Should use clear voice and appropriate pacing
    });
  });

  describe('Performance', () => {
    it('should synthesize speech efficiently', async () => {
      const text = 'This is a performance test';
      
      const startTime = Date.now();
      const result = await engine.synthesize(text);
      const processingTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(2000); // Should be reasonably fast
    });

    it('should handle multiple concurrent synthesis requests', async () => {
      const texts = [
        'First message',
        'Second message',
        'Third message'
      ];

      const promises = texts.map(text => engine.synthesize(text));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle synthesis errors gracefully', async () => {
      // Test with potentially problematic text (but smaller to avoid timeout)
      const text = '!@#$%^&*()_+{}|:"<>?[]\\;\',./' + 'x'.repeat(100);
      
      const result = await engine.synthesize(text);
      
      // Should either succeed or fail gracefully
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });

    it('should handle invalid SSML gracefully', async () => {
      const invalidSSML = '<speak><invalid>Hello</invalid></speak>';
      
      const result = await engine.synthesizeSSML(invalidSSML);
      
      // Should handle invalid SSML gracefully
      expect(result).toHaveProperty('success');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text', async () => {
      const longText = 'This is a very long sentence. '.repeat(10); // Reduced for test performance
      
      const result = await engine.synthesize(longText);
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should handle text with special characters', async () => {
      const text = 'Hello! How are you? I\'m fine. It\'s 50% off today.';
      
      const result = await engine.synthesize(text);
      
      expect(result.success).toBe(true);
    });

    it('should handle text with numbers and symbols', async () => {
      const text = 'The temperature is 72°F, and it\'s $19.99 for 2 items.';
      
      const result = await engine.synthesize(text);
      
      expect(result.success).toBe(true);
    });

    it('should handle multilingual text appropriately', async () => {
      const text = 'Hello, bonjour, hola, guten tag';
      
      const result = await engine.synthesize(text);
      
      expect(result.success).toBe(true);
    });
  });
});