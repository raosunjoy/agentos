/**
 * AgentOS Configuration Types
 * Defines all configuration options for the AgentOS platform
 */

export interface AgentOSConfig {
  // Core system settings
  version: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Feature flags
  enablePlugins: boolean;
  enableSecurity: boolean;
  enablePerformanceOptimization: boolean;
  enableVoiceInterface: boolean;
  enableCaregiverSystem: boolean;

  // Resource limits
  maxMemoryUsage: number; // bytes
  maxCPUUsage: number; // percentage

  // Security settings
  pluginSandbox: boolean;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';

  // NLP settings
  nlp: {
    confidenceThreshold: number;
    cacheSize: number;
    enableElderlyOptimizations: boolean;
    supportedLanguages: string[];
  };

  // Voice interface settings
  voice: {
    wakeWord: string;
    speechRate: number;
    pitch: number;
    volume: number;
  };

  // Performance settings
  performance: {
    adaptiveScaling: boolean;
    batteryOptimization: boolean;
    thermalManagement: boolean;
    memoryManagement: boolean;
  };
}

export interface NLPConfig {
  confidenceThreshold: number;
  cacheSize: number;
  enableElderlyOptimizations: boolean;
  supportedLanguages: string[];
  defaultLanguage: string;
  maxAmbiguousResults: number;
  enableCache: boolean;
}

export interface PluginConfig {
  registryPath: string;
  pluginPaths: string[];
  sandboxEnabled: boolean;
  performanceMonitoring: boolean;
  maxPlugins: number;
  defaultResourceLimits: {
    maxMemoryMB: number;
    maxCPUPercent: number;
    maxNetworkBandwidthKBps: number;
    maxStorageMB: number;
    maxExecutionTimeMs: number;
  };
}

export interface VoiceConfig {
  wakeWord: string;
  speechRate: number;
  pitch: number;
  volume: number;
  enableNoiseFiltering: boolean;
  enableElderlyOptimizations: boolean;
  supportedLanguages: string[];
}

export interface PerformanceConfig {
  adaptiveScaling: boolean;
  batteryOptimization: boolean;
  thermalManagement: boolean;
  memoryManagement: boolean;
  maxMemoryUsage: number;
  maxCPUUsage: number;
  enableModelQuantization: boolean;
  targetBatteryLifeHours: number;
}

export interface CaregiverConfig {
  enableEmergencyAlerts: boolean;
  enableDailyReports: boolean;
  enableRemoteAccess: boolean;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  auditLogRetentionDays: number;
}
