/**
 * AgentOS System Types
 * Defines core system interfaces and types
 */

export interface AgentOSStatus {
  initialized: boolean;
  version: string;
  environment: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: number;
  activePlugins?: number;
  activeConnections?: number;
  securityStatus?: SecurityStatus;
  performanceMetrics?: PerformanceMetrics;
}

export interface SecurityStatus {
  frameworkInitialized: boolean;
  activeThreats: number;
  recentEvents: number;
  monitoringActive: boolean;
  lastUpdated: number;
  anomalyDetectionEnabled: boolean;
  zeroTrustEnabled: boolean;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  memoryEfficiency: number;
  cpuEfficiency: number;
  batteryLifeHours: number;
  thermalState: 'normal' | 'warning' | 'critical';
  activeOptimizations: string[];
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    intelligence: ComponentHealth;
    plugins: ComponentHealth;
    voice: ComponentHealth;
    security: ComponentHealth;
    performance: ComponentHealth;
    caregiver: ComponentHealth;
  };
  lastChecked: number;
  uptime: number;
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  uptime: number;
  errorCount: number;
  lastError?: string;
  metrics: Record<string, any>;
}

export interface SystemEvent {
  id: string;
  type: SystemEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  component: string;
  message: string;
  details?: Record<string, any>;
  resolved: boolean;
}

export enum SystemEventType {
  SYSTEM_STARTUP = 'system_startup',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  COMPONENT_INITIALIZED = 'component_initialized',
  COMPONENT_FAILED = 'component_failed',
  SECURITY_ALERT = 'security_alert',
  PERFORMANCE_WARNING = 'performance_warning',
  MEMORY_WARNING = 'memory_warning',
  PLUGIN_LOADED = 'plugin_loaded',
  PLUGIN_FAILED = 'plugin_failed',
  VOICE_COMMAND_PROCESSED = 'voice_command_processed',
  NLP_INTENT_RECOGNIZED = 'nlp_intent_recognized',
  CAREGIVER_ACCESS = 'caregiver_access'
}

export interface SystemMetrics {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeThreads: number;
  networkConnections: number;
  diskUsage: {
    total: number;
    used: number;
    available: number;
  };
  batteryLevel?: number;
  thermalState?: string;
}
