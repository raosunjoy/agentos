/**
 * Performance Optimization Module
 * Provides efficient resource management and AI optimization for mid-range hardware
 */

export * from './types';
export { ModelQuantizer } from './model-quantizer';
export { ResourceManager } from './resource-manager';
export { AIScheduler } from './ai-scheduler';
export { FeatureDegradationManager } from './feature-degradation';
export { BatteryOptimizer } from './battery-optimizer';

// Re-export commonly used types
export type {
  ResourceMetrics,
  PerformanceMode,
  ThermalState,
  ModelQuantizationConfig,
  ResourceAllocation,
  PerformanceConstraints,
  FeatureDegradationLevel,
  PerformanceProfile,
  PerformanceMetrics,
  SchedulingPolicy
} from './types';

// Re-export battery optimization types
export type {
  PowerProfile,
  PowerConsumption,
  BatteryStats,
  WakeWordConfig,
  PowerSavingAction
} from './battery-optimizer';