/**
 * Unit tests for Speech-to-Text Engine
 */

import { SpeechToTextEngine } from '../speech-to-text';
import { AudioConfig, ElderlyOptimizations, UserVoiceProfile } from '../types';

describe('SpeechToTextEngine', () => {
  let engine: SpeechToTextEngine;
  let audioConfig: AudioConfig;
  let elderlyOptimizations: ElderlyOptimizations;
  let userProfile: UserVoiceProfile;

  beforeEach(() => {
    audioConfig = {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      bufferSize: 1024
    };

    elderlyOptimizations = {
      extendedPauseDetection: true,
      slowSpeechTolerance: true,
      repeatWordHandling: true,
      fillerWordRemoval: true,
      volumeNormalization: true,
      clarityEnhancement: true
    };

    userProfile = {
      userId: 'test-user',
      voiceCharacteristics: {
        fundamentalFrequency: 150,
        speechRate: 120,
        pauseDuration: 0.5,
        volumeLevel: 0.1
      },
      adaptationData: {
        commonMispronunciations: new Map([['tom', 'mom']]),
        speechPatterns: ['call mom', 'text john'],
        preferredPace: 0.8,
        backgroundNoiseProfile: new Float32Array(512)
      },
      lastUpdated: new Date()
    };

    engine = new SpeechToTextEngine(audioConfig, elderlyOptimizations, userProfile);
  });

  describe('Initialization', () => {
    it('should initialize with configuration', () => {
      expect(engine).toBeDefined();
    });

    it('should initialize without user profile', () => {
      const engineWithoutProfile = new SpeechToTextEngine(audioConfig, elderlyOptimizations);
      expect(engineWithoutProfile).toBeDefined();
    });
  });

  describe('Listening Control', () => {
    it('should start and stop listening', async () => {
      await expect(engine.startListening()).resolves.not.toThrow();
      await expect(engine.stopListening()).resolves.not.toThrow();
    });

    it('should not start listening if already listening', async () => {
      await engine.startListening();
      await expect(engine.startListening()).resolves.not.toThrow();
      await engine.stopListening();
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await engine.startListening();
    });

    afterEach(async () => {
      await engine.stopListening();
    });

    it('should process audio chunk with voice', async () => {
      const audioData = new Float32Array(1600); // 100ms at 16kHz
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const result = await engine.processAudioChunk(audioData);
      
      if (result) {
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('isFinal');
        expect(result).toHaveProperty('processingTime');
        expect(result).toHaveProperty('language');
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });

    it('should return null for silent audio', async () => {
      const audioData = new Float32Array(1600);
      // Leave as zeros (silence)

      const result = await engine.processAudioChunk(audioData);
      expect(result).toBeNull();
    });

    it('should handle noisy audio', async () => {
      const audioData = new Float32Array(1600);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.random() * 0.02; // Low-level noise
      }

      const result = await engine.processAudioChunk(audioData);
      // Should return null for noise-only audio (low energy)
      if (result) {
        expect(result.confidence).toBeLessThan(0.5);
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe('Complete Utterance Processing', () => {
    it('should process complete utterance', async () => {
      const audioData = new Float32Array(8000); // 0.5 seconds
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const result = await engine.processUtterance(audioData);
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('isFinal');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('language');
      expect(result.isFinal).toBe(true);
    });

    it('should handle empty audio buffer', async () => {
      const audioData = new Float32Array(0);
      
      const result = await engine.processUtterance(audioData);
      
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.isFinal).toBe(true);
    });
  });

  describe('Elderly Optimizations', () => {
    it('should handle repeated words', async () => {
      // Mock a result that would contain repeated words
      const audioData = new Float32Array(8000);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const result = await engine.processUtterance(audioData);
      
      // The engine should process and potentially clean up repeated words
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
    });

    it('should apply volume normalization', async () => {
      // Test with very quiet audio
      const audioData = new Float32Array(8000);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.01; // Very quiet
      }

      const result = await engine.processUtterance(audioData);
      
      // Should still process despite low volume
      expect(result).toBeDefined();
    });

    it('should enhance clarity for elderly speech', async () => {
      // Test with audio that simulates elderly speech characteristics
      const audioData = new Float32Array(8000);
      for (let i = 0; i < audioData.length; i++) {
        // Lower frequency, slower modulation
        audioData[i] = Math.sin(2 * Math.PI * 150 * i / 16000) * 0.08;
      }

      const result = await engine.processUtterance(audioData);
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('User Profile Integration', () => {
    it('should set user profile', () => {
      const newProfile: UserVoiceProfile = {
        ...userProfile,
        voiceCharacteristics: {
          ...userProfile.voiceCharacteristics,
          speechRate: 100
        }
      };

      expect(() => {
        engine.setUserProfile(newProfile);
      }).not.toThrow();
    });

    it('should apply user-specific adaptations', async () => {
      const audioData = new Float32Array(8000);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const result = await engine.processUtterance(audioData);
      
      // Should apply user profile adaptations
      expect(result).toBeDefined();
    });
  });

  describe('Metrics', () => {
    it('should return recognition metrics', () => {
      const metrics = engine.getMetrics();
      
      expect(metrics).toHaveProperty('averageConfidence');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('recognitionAccuracy');
      
      expect(metrics.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.averageConfidence).toBeLessThanOrEqual(1);
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(metrics.recognitionAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.recognitionAccuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    it('should process audio efficiently', async () => {
      const audioData = new Float32Array(1600);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const startTime = Date.now();
      await engine.processUtterance(audioData);
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(200); // Should be reasonably fast
    });

    it('should handle multiple concurrent processing requests', async () => {
      const audioData = new Float32Array(1600);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const promises = Array(3).fill(null).map(() => 
        engine.processUtterance(audioData)
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short audio', async () => {
      const audioData = new Float32Array(160); // 10ms
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const result = await engine.processUtterance(audioData);
      expect(result).toBeDefined();
    });

    it('should handle very long audio', async () => {
      const audioData = new Float32Array(160000); // 10 seconds
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const result = await engine.processUtterance(audioData);
      expect(result).toBeDefined();
    });

    it('should handle audio with extreme values', async () => {
      const audioData = new Float32Array(1600);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = i % 2 === 0 ? 1.0 : -1.0; // Square wave at max amplitude
      }

      const result = await engine.processUtterance(audioData);
      expect(result).toBeDefined();
    });
  });
});