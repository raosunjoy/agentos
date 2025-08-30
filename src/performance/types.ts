/**
 * Performance optimization types for AgentOS
 * Supports mid-range hardware with efficient resource management
 */

export interface ResourceMetrics {
  cpuUsage: number; // 0-100
  memoryUsage: number; // bytes
  batteryLevel: number; // 0-100
  thermalState: ThermalState;
  networkLatency: number; // ms
}

export enum ThermalState {
  NORMAL = 'normal',
  WARM = 'warm',
  HOT = 'hot',
  CRITICAL = 'critical'
}

export enum PerformanceMode {
  POWER_SAVE = 'power_save',
  BALANCED = 'balanced',
  PERFORMANCE = 'performance',
  ADAPTIVE = 'adaptive'
}

export interface ModelQuantizationConfig {
  precision: 'int8' | 'int16' | 'float16' | 'float32';
  compressionRatio: number;
  accuracyThreshold: number;
  targetLatency: number; // ms
}

export interface ResourceAllocation {
  cpuCores: number;
  memoryLimit: number; // bytes
  gpuMemory?: number; // bytes
  priority: number; // 1-10
}

export interface PerformanceConstraints {
  maxResponseTime: number; // ms
  maxMemoryUsage: number; // bytes
  maxCpuUsage: number; // percentage
  maxBatteryDrain: number; // percentage per hour
}

export interface FeatureDegradationLevel {
  level: number; // 0-5, 0 = full features, 5 = minimal
  disabledFeatures: string[];
  reducedQuality: string[];
  fallbackMethods: Record<string, string>;
}

export interface PerformanceProfile {
  mode: PerformanceMode;
  constraints: PerformanceConstraints;
  resourceAllocation: ResourceAllocation;
  quantizationConfig: ModelQuantizationConfig;
  degradationLevel: FeatureDegradationLevel;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  resourceEfficiency: number;
  batteryImpact: number;
  userSatisfaction: number;
}

export interface SchedulingPolicy {
  algorithm: 'round_robin' | 'priority' | 'fair_share' | 'adaptive';
  timeSlice: number; // ms
  priorityLevels: number;
  preemptionEnabled: boolean;
}