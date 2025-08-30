/**
 * Graceful Feature Degradation System
 * Manages feature availability based on resource constraints
 */

import { 
  FeatureDegradationLevel, 
  ResourceMetrics, 
  PerformanceConstraints,
  PerformanceMode,
  ThermalState 
} from './types';

export interface FeatureConfig {
  id: string;
  name: string;
  category: 'ai' | 'ui' | 'network' | 'storage' | 'sensor';
  priority: number; // 1-10, higher = more important
  resourceCost: {
    cpu: number;
    memory: number;
    battery: number; // per hour
    network?: number; // bandwidth
  };
  fallbackOptions: string[];
  canDisable: boolean;
  userVisible: boolean;
}

export interface DegradationRule {
  condition: (metrics: ResourceMetrics, constraints: PerformanceConstraints) => boolean;
  actions: DegradationAction[];
  priority: number;
  description: string;
}

export interface DegradationAction {
  type: 'disable' | 'reduce_quality' | 'use_fallback' | 'delay';
  targetFeatures: string[];
  parameters?: Record<string, any>;
}

export interface FeatureState {
  id: string;
  enabled: boolean;
  qualityLevel: number; // 0-100
  fallbackActive: string | null;
  lastDegradation: number;
  userOverride: boolean;
}

export class FeatureDegradationManager {
  private features: Map<string, FeatureConfig> = new Map();
  private featureStates: Map<string, FeatureState> = new Map();
  private degradationRules: DegradationRule[] = [];
  private currentLevel: FeatureDegradationLevel;
  private currentMetrics: ResourceMetrics;
  private constraints: PerformanceConstraints;
  private performanceMode: PerformanceMode = PerformanceMode.ADAPTIVE;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(constraints: PerformanceConstraints) {
    this.constraints = constraints;
    this.currentLevel = {
      level: 0,
      disabledFeatures: [],
      reducedQuality: [],
      fallbackMethods: {}
    };
    this.currentMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      batteryLevel: 100,
      thermalState: ThermalState.NORMAL,
      networkLatency: 50
    };
    
    this.initializeDefaultFeatures();
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Register a feature for degradation management
   */
  registerFeature(feature: FeatureConfig): void {
    this.features.set(feature.id, feature);
    this.featureStates.set(feature.id, {
      id: feature.id,
      enabled: true,
      qualityLevel: 100,
      fallbackActive: null,
      lastDegradation: 0,
      userOverride: false
    });
  }

  /**
   * Add a degradation rule
   */
  addDegradationRule(rule: DegradationRule): void {
    this.degradationRules.push(rule);
    this.degradationRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update system metrics and apply degradation
   */
  updateMetrics(metrics: ResourceMetrics): void {
    this.currentMetrics = metrics;
    this.evaluateAndApplyDegradation();
  }

  /**
   * Update performance mode
   */
  updatePerformanceMode(mode: PerformanceMode): void {
    this.performanceMode = mode;
    this.evaluateAndApplyDegradation();
  }

  /**
   * Get current degradation level
   */
  getCurrentLevel(): FeatureDegradationLevel {
    return { ...this.currentLevel };
  }

  /**
   * Get feature state
   */
  getFeatureState(featureId: string): FeatureState | null {
    return this.featureStates.get(featureId) || null;
  }

  /**
   * Override feature state (user preference)
   */
  overrideFeature(featureId: string, enabled: boolean, qualityLevel?: number): boolean {
    const state = this.featureStates.get(featureId);
    const feature = this.features.get(featureId);
    
    if (!state || !feature) return false;

    // Check if override is allowed
    if (!enabled && !feature.canDisable) return false;

    state.enabled = enabled;
    state.userOverride = true;
    
    if (qualityLevel !== undefined) {
      state.qualityLevel = Math.max(0, Math.min(100, qualityLevel));
    }

    return true;
  }

  /**
   * Get degradation recommendations for user
   */
  getDegradationRecommendations(): Array<{
    feature: string;
    action: string;
    impact: string;
    savings: string;
  }> {
    const recommendations: Array<{
      feature: string;
      action: string;
      impact: string;
      savings: string;
    }> = [];

    // Analyze features that could be degraded for better performance
    for (const [featureId, feature] of this.features.entries()) {
      const state = this.featureStates.get(featureId);
      if (!state || state.userOverride) continue;

      if (state.enabled && feature.canDisable && feature.priority <= 5) {
        recommendations.push({
          feature: feature.name,
          action: 'Disable temporarily',
          impact: 'Feature will be unavailable',
          savings: `${feature.resourceCost.battery}% battery/hour, ${feature.resourceCost.cpu}% CPU`
        });
      }

      if (state.qualityLevel > 50 && feature.fallbackOptions.length > 0) {
        recommendations.push({
          feature: feature.name,
          action: 'Use lower quality mode',
          impact: 'Reduced quality but functional',
          savings: `${Math.floor(feature.resourceCost.battery * 0.3)}% battery/hour`
        });
      }
    }

    return recommendations.sort((a, b) => 
      parseFloat(b.savings) - parseFloat(a.savings)
    );
  }

  /**
   * Initialize default features
   */
  private initializeDefaultFeatures(): void {
    const defaultFeatures: FeatureConfig[] = [
      {
        id: 'voice_recognition',
        name: 'Voice Recognition',
        category: 'ai',
        priority: 9,
        resourceCost: { cpu: 25, memory: 512 * 1024 * 1024, battery: 8 },
        fallbackOptions: ['simple_commands', 'text_input'],
        canDisable: false,
        userVisible: true
      },
      {
        id: 'nlp_processing',
        name: 'Natural Language Processing',
        category: 'ai',
        priority: 8,
        resourceCost: { cpu: 30, memory: 256 * 1024 * 1024, battery: 10 },
        fallbackOptions: ['keyword_matching', 'simple_parsing'],
        canDisable: false,
        userVisible: true
      },
      {
        id: 'predictive_suggestions',
        name: 'Predictive Suggestions',
        category: 'ai',
        priority: 5,
        resourceCost: { cpu: 15, memory: 128 * 1024 * 1024, battery: 5 },
        fallbackOptions: ['static_suggestions', 'history_based'],
        canDisable: true,
        userVisible: true
      },
      {
        id: 'visual_animations',
        name: 'Visual Animations',
        category: 'ui',
        priority: 3,
        resourceCost: { cpu: 10, memory: 64 * 1024 * 1024, battery: 3 },
        fallbackOptions: ['simple_transitions', 'static_ui'],
        canDisable: true,
        userVisible: true
      },
      {
        id: 'background_sync',
        name: 'Background Synchronization',
        category: 'network',
        priority: 6,
        resourceCost: { cpu: 5, memory: 32 * 1024 * 1024, battery: 4, network: 1024 },
        fallbackOptions: ['manual_sync', 'wifi_only'],
        canDisable: true,
        userVisible: true
      },
      {
        id: 'continuous_learning',
        name: 'Continuous Learning',
        category: 'ai',
        priority: 4,
        resourceCost: { cpu: 20, memory: 256 * 1024 * 1024, battery: 6 },
        fallbackOptions: ['periodic_learning', 'static_model'],
        canDisable: true,
        userVisible: false
      }
    ];

    defaultFeatures.forEach(feature => this.registerFeature(feature));
  }

  /**
   * Initialize default degradation rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: DegradationRule[] = [
      {
        condition: (metrics) => metrics.batteryLevel < 10,
        actions: [
          {
            type: 'disable',
            targetFeatures: ['visual_animations', 'continuous_learning', 'predictive_suggestions']
          },
          {
            type: 'use_fallback',
            targetFeatures: ['background_sync'],
            parameters: { fallback: 'wifi_only' }
          }
        ],
        priority: 10,
        description: 'Critical battery level - disable non-essential features'
      },
      {
        condition: (metrics) => metrics.batteryLevel < 20,
        actions: [
          {
            type: 'reduce_quality',
            targetFeatures: ['nlp_processing', 'voice_recognition'],
            parameters: { qualityLevel: 60 }
          },
          {
            type: 'disable',
            targetFeatures: ['visual_animations']
          }
        ],
        priority: 8,
        description: 'Low battery - reduce quality and disable animations'
      },
      {
        condition: (metrics) => metrics.thermalState === ThermalState.CRITICAL,
        actions: [
          {
            type: 'disable',
            targetFeatures: ['continuous_learning', 'predictive_suggestions']
          },
          {
            type: 'reduce_quality',
            targetFeatures: ['nlp_processing', 'voice_recognition'],
            parameters: { qualityLevel: 40 }
          }
        ],
        priority: 9,
        description: 'Critical thermal state - reduce AI processing'
      },
      {
        condition: (metrics) => metrics.thermalState === ThermalState.HOT,
        actions: [
          {
            type: 'reduce_quality',
            targetFeatures: ['nlp_processing', 'voice_recognition'],
            parameters: { qualityLevel: 70 }
          }
        ],
        priority: 7,
        description: 'High temperature - reduce AI processing quality'
      },
      {
        condition: (metrics, constraints) => metrics.cpuUsage > constraints.maxCpuUsage * 0.9,
        actions: [
          {
            type: 'delay',
            targetFeatures: ['continuous_learning', 'background_sync'],
            parameters: { delayMs: 30000 }
          },
          {
            type: 'reduce_quality',
            targetFeatures: ['predictive_suggestions'],
            parameters: { qualityLevel: 50 }
          }
        ],
        priority: 6,
        description: 'High CPU usage - delay background tasks'
      },
      {
        condition: (metrics, constraints) => metrics.memoryUsage > constraints.maxMemoryUsage * 0.8,
        actions: [
          {
            type: 'use_fallback',
            targetFeatures: ['nlp_processing'],
            parameters: { fallback: 'simple_parsing' }
          },
          {
            type: 'disable',
            targetFeatures: ['continuous_learning']
          }
        ],
        priority: 7,
        description: 'High memory usage - use simpler processing'
      }
    ];

    defaultRules.forEach(rule => this.addDegradationRule(rule));
  }

  /**
   * Evaluate and apply degradation based on current conditions
   */
  private evaluateAndApplyDegradation(): void {
    const applicableRules = this.degradationRules.filter(rule =>
      rule.condition(this.currentMetrics, this.constraints)
    );

    // Reset degradation level
    this.currentLevel = {
      level: 0,
      disabledFeatures: [],
      reducedQuality: [],
      fallbackMethods: {}
    };

    // Apply rules in priority order
    for (const rule of applicableRules) {
      this.applyDegradationRule(rule);
      this.currentLevel.level = Math.max(this.currentLevel.level, rule.priority / 2);
    }

    // Apply performance mode adjustments
    this.applyPerformanceModeAdjustments();
  }

  /**
   * Apply a specific degradation rule
   */
  private applyDegradationRule(rule: DegradationRule): void {
    for (const action of rule.actions) {
      for (const featureId of action.targetFeatures) {
        const state = this.featureStates.get(featureId);
        const feature = this.features.get(featureId);
        
        if (!state || !feature || state.userOverride) continue;

        switch (action.type) {
          case 'disable':
            if (feature.canDisable) {
              state.enabled = false;
              state.lastDegradation = Date.now();
              this.currentLevel.disabledFeatures.push(featureId);
            }
            break;

          case 'reduce_quality':
            const qualityLevel = action.parameters?.qualityLevel || 50;
            state.qualityLevel = Math.min(state.qualityLevel, qualityLevel);
            this.currentLevel.reducedQuality.push(featureId);
            break;

          case 'use_fallback':
            const fallback = action.parameters?.fallback;
            if (fallback && feature.fallbackOptions.includes(fallback)) {
              state.fallbackActive = fallback;
              this.currentLevel.fallbackMethods[featureId] = fallback;
            }
            break;

          case 'delay':
            // Delay is handled by the scheduler, just mark the feature
            state.lastDegradation = Date.now() + (action.parameters?.delayMs || 0);
            break;
        }
      }
    }
  }

  /**
   * Apply performance mode specific adjustments
   */
  private applyPerformanceModeAdjustments(): void {
    switch (this.performanceMode) {
      case PerformanceMode.POWER_SAVE:
        this.applyPowerSaveMode();
        break;
      case PerformanceMode.PERFORMANCE:
        this.applyPerformanceMode();
        break;
      case PerformanceMode.ADAPTIVE:
        this.applyAdaptiveMode();
        break;
      // BALANCED mode uses default settings
    }
  }

  /**
   * Apply power save mode adjustments
   */
  private applyPowerSaveMode(): void {
    for (const [featureId, state] of this.featureStates.entries()) {
      const feature = this.features.get(featureId);
      if (!feature || state.userOverride) continue;

      if (feature.priority <= 5 && feature.canDisable) {
        state.enabled = false;
        this.currentLevel.disabledFeatures.push(featureId);
      } else {
        state.qualityLevel = Math.min(state.qualityLevel, 60);
        this.currentLevel.reducedQuality.push(featureId);
      }
    }
    this.currentLevel.level = Math.max(this.currentLevel.level, 3);
  }

  /**
   * Apply performance mode adjustments
   */
  private applyPerformanceMode(): void {
    for (const [featureId, state] of this.featureStates.entries()) {
      if (state.userOverride) continue;
      
      state.enabled = true;
      state.qualityLevel = 100;
      state.fallbackActive = null;
    }
    this.currentLevel = {
      level: 0,
      disabledFeatures: [],
      reducedQuality: [],
      fallbackMethods: {}
    };
  }

  /**
   * Apply adaptive mode adjustments
   */
  private applyAdaptiveMode(): void {
    // Adaptive mode uses the rule-based system without additional adjustments
    // The rules already consider current system state
  }

  /**
   * Start monitoring for automatic degradation
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.evaluateAndApplyDegradation();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.features.clear();
    this.featureStates.clear();
    this.degradationRules = [];
  }
}