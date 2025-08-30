/**
 * Type definitions for the learning system
 */

export interface LearningEvent {
  id: string;
  timestamp: Date;
  type: 'pattern_discovered' | 'pattern_updated' | 'pattern_removed' | 
        'suggestion_generated' | 'suggestion_accepted' | 'suggestion_dismissed' |
        'learning_enabled' | 'learning_disabled' | 'privacy_compliance';
  data: Record<string, any>;
  userId?: string;
}

export interface LearningMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confidenceDistribution: {
    low: number;    // 0.0 - 0.4
    medium: number; // 0.4 - 0.7
    high: number;   // 0.7 - 1.0
  };
}

export interface PrivacySettings {
  dataMinimization: boolean;
  anonymizeAfterDays: number;
  retentionPeriodDays: number;
  allowPersonalization: boolean;
  shareAcrossDevices: boolean;
  exportDataFormat: 'json' | 'csv' | 'anonymized';
}

export interface LearningCapabilities {
  patternRecognition: boolean;
  proactiveSuggestions: boolean;
  adaptiveLearning: boolean;
  crossContextLearning: boolean;
  temporalAnalysis: boolean;
  preferenceInference: boolean;
}

export interface UserFeedback {
  suggestionId: string;
  response: 'helpful' | 'not_helpful' | 'partially_helpful';
  rating: number; // 1-5 scale
  comments?: string;
  timestamp: Date;
  context: Record<string, any>;
}

export interface LearningContext {
  userId?: string;
  sessionId: string;
  deviceId: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  activity?: string;
  mood?: 'positive' | 'neutral' | 'negative';
  environment: 'home' | 'work' | 'travel' | 'other';
}

export interface PatternValidation {
  isValid: boolean;
  confidence: number;
  supportingEvidence: number;
  contradictingEvidence: number;
  lastValidated: Date;
  validationMethod: 'statistical' | 'user_feedback' | 'cross_validation';
}

export interface SuggestionTemplate {
  id: string;
  type: 'action' | 'reminder' | 'optimization' | 'assistance';
  template: string;
  requiredContext: string[];
  optionalContext: string[];
  priority: 'low' | 'medium' | 'high';
  category: string;
  tags: string[];
}

export interface LearningModel {
  id: string;
  name: string;
  version: string;
  type: 'classification' | 'regression' | 'clustering' | 'recommendation';
  accuracy: number;
  lastTrained: Date;
  trainingDataSize: number;
  features: string[];
  hyperparameters: Record<string, any>;
}

export interface DataPoint {
  id: string;
  timestamp: Date;
  features: Record<string, number | string | boolean>;
  label?: string | number;
  weight: number;
  source: 'user_action' | 'system_event' | 'external_api';
  privacy_level: 'public' | 'private' | 'sensitive';
}

export interface LearningPipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRun: Date;
  nextRun?: Date;
  config: Record<string, any>;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'data_collection' | 'preprocessing' | 'feature_extraction' | 
        'model_training' | 'validation' | 'deployment';
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  error?: string;
  output?: any;
}

export interface AdaptationRule {
  id: string;
  condition: string; // JavaScript expression
  action: 'increase_confidence' | 'decrease_confidence' | 'modify_pattern' | 
          'create_pattern' | 'remove_pattern';
  parameters: Record<string, any>;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface LearningExperiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  startDate: Date;
  endDate?: Date;
  status: 'planned' | 'running' | 'completed' | 'cancelled';
  controlGroup: string[];
  treatmentGroup: string[];
  metrics: string[];
  results?: ExperimentResults;
}

export interface ExperimentResults {
  controlMetrics: Record<string, number>;
  treatmentMetrics: Record<string, number>;
  statisticalSignificance: number;
  effectSize: number;
  conclusion: string;
  recommendations: string[];
}

export interface LearningAlert {
  id: string;
  type: 'performance_degradation' | 'privacy_violation' | 'data_quality' | 
        'model_drift' | 'user_dissatisfaction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  actions: string[];
}

export interface LearningDashboard {
  totalPatterns: number;
  activePatterns: number;
  patternAccuracy: number;
  suggestionAcceptanceRate: number;
  userSatisfactionScore: number;
  privacyComplianceScore: number;
  systemPerformance: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  recentAlerts: LearningAlert[];
  trends: {
    patternGrowth: number[];
    accuracyTrend: number[];
    userEngagement: number[];
  };
}

export interface LearningConfiguration {
  global: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxMemoryUsage: number;
    maxCpuUsage: number;
  };
  patternRecognition: {
    algorithms: string[];
    minSampleSize: number;
    maxPatternAge: number;
    confidenceThreshold: number;
  };
  suggestions: {
    maxActive: number;
    cooldownPeriod: number;
    personalizationLevel: 'low' | 'medium' | 'high';
  };
  privacy: {
    dataRetention: number;
    anonymizationDelay: number;
    consentRequired: boolean;
    auditLogging: boolean;
  };
  performance: {
    batchSize: number;
    processingInterval: number;
    cacheSize: number;
    parallelProcessing: boolean;
  };
}

// Utility types
export type LearningEventHandler<T = any> = (event: LearningEvent, data: T) => void | Promise<void>;

export type PatternMatcher = (pattern: any, context: any) => number; // Returns confidence score

export type SuggestionGenerator = (patterns: any[], context: any) => any[];

export type PrivacyFilter = (data: any) => any;

export type LearningCallback = (result: any, error?: Error) => void;

// Enums
export enum LearningMode {
  PASSIVE = 'passive',
  ACTIVE = 'active',
  HYBRID = 'hybrid'
}

export enum PrivacyLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
  SENSITIVE = 'sensitive',
  CONFIDENTIAL = 'confidential'
}

export enum LearningStatus {
  INITIALIZING = 'initializing',
  LEARNING = 'learning',
  IDLE = 'idle',
  DISABLED = 'disabled',
  ERROR = 'error'
}

export enum SuggestionTrigger {
  TIME_BASED = 'time_based',
  CONTEXT_BASED = 'context_based',
  PATTERN_BASED = 'pattern_based',
  USER_INITIATED = 'user_initiated',
  SYSTEM_INITIATED = 'system_initiated'
}

// Constants
export const LEARNING_CONSTANTS = {
  MIN_PATTERN_CONFIDENCE: 0.3,
  MAX_PATTERN_CONFIDENCE: 1.0,
  DEFAULT_SUGGESTION_COOLDOWN: 30, // minutes
  MAX_ACTIVE_SUGGESTIONS: 5,
  DEFAULT_DATA_RETENTION: 90, // days
  MIN_PATTERN_OCCURRENCES: 3,
  MAX_PATTERNS_PER_USER: 1000,
  PRIVACY_ANONYMIZATION_DELAY: 30, // days
  PERFORMANCE_MONITORING_INTERVAL: 60, // seconds
  MAX_LEARNING_HISTORY: 10000 // events
} as const;