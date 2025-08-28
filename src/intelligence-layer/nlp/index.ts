/**
 * NLP Engine - Intent Recognition System
 * 
 * This module provides the core natural language processing capabilities
 * for AgentOS, including intent classification, entity extraction, and
 * confidence scoring with multi-language support.
 */

export { IntentClassifier } from './intent-classifier';
export { EntityExtractor } from './entity-extractor';
export { ConfidenceScorer } from './confidence-scorer';
export { LanguageDetector } from './language-detector';
export { NLPEngine } from './nlp-engine';

// Context Management System
export { ContextManager } from './context-manager';
export { PermissionValidator } from './permission-validator';
export { TemporalAnalyzer } from './temporal-analyzer';
export { PrivacyFilter } from './privacy-filter';

// Types and interfaces
export * from './types';
export * from './context-types';