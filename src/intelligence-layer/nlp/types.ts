/**
 * Type definitions for the NLP Engine
 */

export interface Intent {
  id: string;
  name: string;
  description: string;
  examples: string[];
  parameters: IntentParameter[];
  requiredPermissions: string[];
  category: string;
}

export interface IntentParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'location' | 'contact' | 'boolean';
  required: boolean;
  description: string;
  validation?: string;
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any>;
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: Entity[];
  parameters: Record<string, any>;
  ambiguousIntents?: IntentResult[];
}

export interface ProcessingResult {
  success: boolean;
  result?: IntentResult;
  error?: string;
  needsClarification?: boolean;
  clarificationOptions?: IntentResult[];
  language: string;
  processingTime: number;
}

export interface LanguageConfig {
  code: string;
  name: string;
  enabled: boolean;
  modelPath?: string;
  confidenceThreshold: number;
}

export interface NLPConfig {
  languages: LanguageConfig[];
  defaultLanguage: string;
  confidenceThreshold: number;
  maxAmbiguousResults: number;
  enableElderlyOptimizations: boolean;
  cacheSize: number;
}

export interface TrainingExample {
  text: string;
  intent: string;
  entities: Entity[];
  language: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  lastUpdated: Date;
}