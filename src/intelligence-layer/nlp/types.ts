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
  keywords?: string[];
  patterns?: string[];
}

export interface IntentParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'location' | 'contact' | 'boolean';
  required: boolean;
  description: string;
  validation?: string;
}

export interface Parameter {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export type EntityType = 'date' | 'time' | 'number' | 'location' | 'person' | 'email' | 'phone' | 'url' | string;

export interface EntityMetadata {
  parameterName?: string;
  extractionMethod?: string;
  originalText?: string;
  pattern?: string;
}

export interface Entity {
  type: EntityType;
  value: string | number | Date;
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata?: EntityMetadata;
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: Entity[];
  parameters: Record<string, any>;
  ambiguousIntents?: IntentResult[];
}

export interface ClarificationOptions {
  message: string;
  options: Array<{ intentId: string; description: string; confidence: number }>;
  timeoutMs: number;
}

export interface ProcessingResult {
  success: boolean;
  result?: IntentResult;
  alternatives?: IntentResult[];
  error?: string;
  needsClarification?: boolean;
  clarificationOptions?: ClarificationOptions;
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
  intentId?: string;
  entities: Entity[];
  language: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalIntents?: number;
  trainingExamples?: number;
  lastTrained?: number;
  confusionMatrix?: number[][];
  lastUpdated?: Date;
}