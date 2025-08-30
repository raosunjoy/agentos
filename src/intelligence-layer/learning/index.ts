/**
 * Learning System - On-device pattern recognition and proactive assistance
 * 
 * This module provides privacy-preserving machine learning capabilities that:
 * - Learn user behavior patterns without sending data to external servers
 * - Generate proactive suggestions based on learned patterns
 * - Adapt to user feedback to improve accuracy over time
 * - Maintain strict privacy controls and data minimization
 * 
 * @example
 * ```typescript
 * import { LearningSystem } from './learning';
 * 
 * const learningSystem = new LearningSystem({
 *   patternRecognition: {
 *     enabled: true,
 *     privacyMode: 'balanced'
 *   },
 *   proactiveAssistance: {
 *     enabled: true,
 *     maxSuggestions: 3
 *   }
 * });
 * 
 * await learningSystem.initialize();
 * 
 * // Process user behavior
 * await learningSystem.processEvent({
 *   timestamp: new Date(),
 *   type: 'voice_command',
 *   context: { command: 'weather', location: 'home' }
 * });
 * 
 * // Get proactive suggestions
 * const suggestions = await learningSystem.getSuggestions({
 *   timeSlot: 'morning',
 *   location: 'home'
 * });
 * ```
 */

// Main learning system
export { LearningSystem } from './learning-system';
export type { LearningSystemConfig, LearningInsights } from './learning-system';

// Pattern recognition engine
export { PatternRecognitionEngine } from './pattern-recognition';
export type { 
  UserBehaviorPattern, 
  BehaviorEvent, 
  PatternRecognitionConfig 
} from './pattern-recognition';

// Proactive assistant
export { ProactiveAssistant } from './proactive-assistant';
export type { 
  ProactiveSuggestion, 
  SuggestionAction, 
  ProactiveAssistantConfig 
} from './proactive-assistant';

// Types and interfaces
export * from './types';

// Re-export commonly used types for convenience
export type {
  LearningEvent,
  LearningMetrics,
  PrivacySettings,
  LearningCapabilities,
  UserFeedback,
  LearningContext
} from './types';

// Constants
export { LEARNING_CONSTANTS } from './types';

// Enums
export { 
  LearningMode, 
  PrivacyLevel, 
  LearningStatus, 
  SuggestionTrigger 
} from './types';