/**
 * Speech Processing Pipeline - Voice interface for AgentOS
 * 
 * This module provides comprehensive speech processing capabilities
 * including speech-to-text, text-to-speech, noise filtering, and
 * elderly-optimized voice recognition.
 */

export { SpeechToTextEngine } from './speech-to-text';
export { TextToSpeechEngine } from './text-to-speech';
export { NoiseFilter } from './noise-filter';
export { VoiceActivityDetector } from './voice-activity-detector';
export { SpeechProcessor } from './speech-processor';
export { AdaptiveLearning } from './adaptive-learning';

// Types and interfaces
export * from './types';