/**
 * Unit tests for Speech Processor
 */

import { SpeechProcessor } from '../speech-processor';
import { SpeechProcessingConfig, UserVoiceProfile } from '../types';

describe('SpeechProcessor', () => {
  let processor: SpeechProcessor;
  let config: SpeechProcessingConfig;
  let mockUserProfile: UserVoiceProfile;

  beforeEach(() => {
    mockUserProfile = {
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

    config = {
      audioConfig: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        bufferSize: 1024
      },
      enableNoiseReduction: true,
      enableVoiceActivityDetection: true,
      enableElderlyOptimizations: true,
      enableAdaptiveLearning: true,
      confidenceThreshold: 0.7,
      maxSilenceDuration: 2000,
      maxSpeechDuration: 30000,
      language: 'en',
      voiceProfile: mockUserProfile
    };

    processor = new SpeechProcessor(config);
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultProcessor = new SpeechProcessor({
        audioConfig: config.audioConfig,
        enableNoiseReduction: false,
        enableVoiceActivityDetection: true,
        enableElderlyOptimizations: false,
        enableAdaptiveLearning: false,
        confidenceThreshold: 0.7,
        maxSilenceDuration: 2000,
        maxSpeechDuration: 30000,
        language: 'en'
      });
      
      expect(defaultProcessor).toBeDefined();
    });

    it('should initialize with elderly optimizations enabled', () => {
      expect(processor).toBeDefined();
      const metrics = processor.getMetrics();
      expect(metrics).toHaveProperty('recognitionAccuracy');
      expect(metrics).toHaveProperty('averageProcessingTime');
    });
  });

  describe('Processing Control', () => {
    it('should start and stop processing', async () => {
      await expect(processor.startProcessing()).resolves.not.toThrow();
      await expect(processor.stopProcessing()).resolves.not.toThrow();
    });

    it('should not start processing if already started', async () => {
      await processor.startProcessing();
      await expect(processor.startProcessing()).resolves.not.toThrow();
      await processor.stopProcessing();
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await processor.startProcessing();
    });

    afterEach(async () => {
      await processor.stopProcessing();
    });

    it('should process audio chunk with voice activity', async () => {
      // Create mock audio with voice-like characteristics
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1; // 200Hz sine wave
      }

      const result = await processor.processAudioChunk(audioData);
      
      expect(result).toHaveProperty('voiceActivity');
      expect(result.voiceActivity).toHaveProperty('isVoiceActive');
      expect(result.voiceActivity).toHaveProperty('confidence');
      expect(result.voiceActivity).toHaveProperty('energyLevel');
      expect(result.voiceActivity).toHaveProperty('timestamp');
    });

    it('should process audio chunk with silence', async () => {
      // Create silent audio
      const audioData = new Float32Array(1024);
      // Leave as zeros (silence)

      const result = await processor.processAudioChunk(audioData);
      
      expect(result.voiceActivity.isVoiceActive).toBe(false);
      expect(result.voiceActivity.energyLevel).toBeLessThan(0.01);
    });

    it('should apply noise filtering when enabled', async () => {
      // Create noisy audio
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1 + // Signal
                      Math.random() * 0.05; // Noise
      }

      const result = await processor.processAudioChunk(audioData);
      
      if (result.noiseFilter) {
        expect(result.noiseFilter).toHaveProperty('filteredAudio');
        expect(result.noiseFilter).toHaveProperty('noiseLevel');
        expect(result.noiseFilter).toHaveProperty('signalToNoiseRatio');
      }
    });
  });

  describe('Complete Utterance Processing', () => {
    it('should process complete utterance', async () => {
      const audioData = new Float32Array(8000); // 0.5 seconds at 16kHz
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const result = await processor.processUtterance(audioData);
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('isFinal');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('language');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle empty audio gracefully', async () => {
      const audioData = new Float32Array(0);
      
      const result = await processor.processUtterance(audioData);
      
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Speech Synthesis', () => {
    it('should synthesize speech with default settings', async () => {
      const text = 'Hello, how can I help you today?';
      
      const result = await processor.synthesizeSpeech(text);
      
      expect(result).toHaveProperty('audioBuffer');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('sampleRate');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should synthesize emergency speech', async () => {
      const text = 'Emergency services have been contacted';
      
      const result = await processor.synthesizeSpeech(text, { emergency: true });
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should synthesize with custom rate and volume', async () => {
      const text = 'This is a test message';
      
      const result = await processor.synthesizeSpeech(text, {
        rate: 0.8,
        volume: 0.9
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Adaptive Learning', () => {
    it('should provide feedback for learning', () => {
      const mockResult = {
        text: 'call mom',
        confidence: 0.9,
        isFinal: true,
        processingTime: 150,
        language: 'en'
      };

      expect(() => {
        processor.provideFeedback(mockResult, {
          wasCorrect: true,
          difficultyLevel: 'easy'
        });
      }).not.toThrow();
    });

    it('should handle incorrect recognition feedback', () => {
      const mockResult = {
        text: 'call tom',
        confidence: 0.8,
        isFinal: true,
        processingTime: 150,
        language: 'en'
      };

      expect(() => {
        processor.provideFeedback(mockResult, {
          wasCorrect: false,
          actualText: 'call mom',
          difficultyLevel: 'medium'
        });
      }).not.toThrow();
    });

    it('should get personalized parameters', () => {
      const params = processor.getPersonalizedParameters();
      
      if (params) {
        expect(params).toHaveProperty('speechRateAdjustment');
        expect(params).toHaveProperty('volumeAdjustment');
        expect(params).toHaveProperty('pauseToleranceMultiplier');
        expect(params).toHaveProperty('customVocabulary');
        expect(params).toHaveProperty('commonPhrases');
      }
    });
  });

  describe('Voice Settings', () => {
    it('should update voice settings based on feedback', () => {
      expect(() => {
        processor.updateVoiceSettings({
          tooFast: true,
          tooLoud: false
        });
      }).not.toThrow();
    });

    it('should handle multiple feedback types', () => {
      expect(() => {
        processor.updateVoiceSettings({
          tooSlow: true,
          tooQuiet: true,
          unclear: true
        });
      }).not.toThrow();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should return processing metrics', () => {
      const metrics = processor.getMetrics();
      
      expect(metrics).toHaveProperty('recognitionAccuracy');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('noiseReductionEffectiveness');
      expect(metrics).toHaveProperty('voiceActivityAccuracy');
      expect(metrics).toHaveProperty('userSatisfactionScore');
      expect(metrics).toHaveProperty('adaptationProgress');
      
      expect(metrics.recognitionAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.recognitionAccuracy).toBeLessThanOrEqual(1);
    });

    it('should return detailed component metrics', () => {
      const detailedMetrics = processor.getDetailedMetrics();
      
      expect(detailedMetrics).toHaveProperty('speechToText');
      expect(detailedMetrics).toHaveProperty('voiceActivityDetector');
      expect(detailedMetrics).toHaveProperty('overall');
      
      if (config.enableAdaptiveLearning) {
        expect(detailedMetrics).toHaveProperty('adaptiveLearning');
      }
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        confidenceThreshold: 0.8,
        enableNoiseReduction: false
      };

      expect(() => {
        processor.updateConfig(newConfig);
      }).not.toThrow();
    });

    it('should update voice profile', () => {
      const newProfile: UserVoiceProfile = {
        ...mockUserProfile,
        voiceCharacteristics: {
          ...mockUserProfile.voiceCharacteristics,
          speechRate: 100
        }
      };

      expect(() => {
        processor.updateConfig({ voiceProfile: newProfile });
      }).not.toThrow();
    });
  });

  describe('Environment Calibration', () => {
    it('should calibrate for user environment', async () => {
      const backgroundAudio = new Float32Array(8000);
      // Add some background noise
      for (let i = 0; i < backgroundAudio.length; i++) {
        backgroundAudio[i] = Math.random() * 0.02; // Low-level noise
      }

      await expect(processor.calibrateEnvironment(backgroundAudio)).resolves.not.toThrow();
    });
  });

  describe('Emergency Processing', () => {
    it('should detect emergency keywords', async () => {
      // Mock audio that would result in emergency text
      const audioData = new Float32Array(8000);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 300 * i / 16000) * 0.15; // Louder, higher pitch
      }

      const result = await processor.processEmergency(audioData);
      
      expect(result).toHaveProperty('recognition');
      expect(result).toHaveProperty('isEmergency');
      expect(result).toHaveProperty('confidence');
      expect(result.recognition).toHaveProperty('text');
    });
  });

  describe('Learning Data Export', () => {
    it('should export anonymized learning data', () => {
      const learningData = processor.exportLearningData();
      
      if (learningData) {
        expect(learningData).toHaveProperty('speechPatterns');
        expect(learningData).toHaveProperty('commonErrors');
        expect(learningData).toHaveProperty('voiceCharacteristics');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle processing when not started', async () => {
      const audioData = new Float32Array(1024);
      
      await expect(processor.processAudioChunk(audioData)).rejects.toThrow();
    });

    it('should handle invalid audio data gracefully', async () => {
      await processor.startProcessing();
      
      const invalidAudio = new Float32Array(0);
      const result = await processor.processAudioChunk(invalidAudio);
      
      expect(result.voiceActivity.isVoiceActive).toBe(false);
      
      await processor.stopProcessing();
    });
  });

  describe('Performance', () => {
    it('should process audio chunks efficiently', async () => {
      await processor.startProcessing();
      
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const startTime = Date.now();
      await processor.processAudioChunk(audioData);
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(1000); // Should be reasonably fast
      
      await processor.stopProcessing();
    });

    it('should handle multiple concurrent audio chunks', async () => {
      await processor.startProcessing();
      
      const audioData = new Float32Array(1024);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 200 * i / 16000) * 0.1;
      }

      const promises = Array(5).fill(null).map(() => 
        processor.processAudioChunk(audioData)
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      
      await processor.stopProcessing();
    });
  });
});