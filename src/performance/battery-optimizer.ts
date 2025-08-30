/**
 * Battery Optimization System
 * Manages power consumption for AI operations and system components
 */

import { 
  ResourceMetrics, 
  PerformanceMode, 
  ThermalState,
  PerformanceConstraints 
} from './types';

export interface PowerProfile {
  id: string;
  name: string;
  description: string;
  cpuThrottling: number; // 0-1, 1 = no throttling
  aiProcessingLimit: number; // percentage of normal capacity
  backgroundTasksEnabled: boolean;
  screenBrightness: number; // 0-1
  networkOptimization: boolean;
  wakeWordSensitivity: number; // 0-1, lower = less sensitive but more power efficient
}

export interface PowerConsumption {
  component: string;
  currentDraw: number; // mA
  estimatedDuration: number; // hours at current rate
  priority: number; // 1-10
}

export interface BatteryStats {
  level: number; // 0-100
  health: number; // 0-100
  temperature: number; // Celsius
  voltage: number; // V
  chargingState: 'charging' | 'discharging' | 'full' | 'unknown';
  timeToEmpty: number; // minutes, -1 if charging
  timeToFull: number; // minutes, -1 if not charging
}

export interface WakeWordConfig {
  enabled: boolean;
  sensitivity: number; // 0-1
  continuousListening: boolean;
  adaptiveSensitivity: boolean;
  lowPowerMode: boolean;
  keywords: string[];
}

export interface PowerSavingAction {
  id: string;
  description: string;
  estimatedSavings: number; // mA
  impact: 'low' | 'medium' | 'high';
  userVisible: boolean;
  execute: () => Promise<void>;
  revert: () => Promise<void>;
}

export class BatteryOptimizer {
  private currentProfile: PowerProfile;
  private batteryStats: BatteryStats;
  private powerConsumption: Map<string, PowerConsumption> = new Map();
  private wakeWordConfig: WakeWordConfig;
  private activePowerActions: Set<string> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private constraints: PerformanceConstraints;
  private performanceMode: PerformanceMode = PerformanceMode.ADAPTIVE;

  constructor(constraints: PerformanceConstraints) {
    this.constraints = constraints;
    this.currentProfile = this.getDefaultProfile();
    this.batteryStats = this.initializeBatteryStats();
    this.wakeWordConfig = this.initializeWakeWordConfig();
    this.initializePowerConsumption();
    this.startBatteryMonitoring();
  }

  /**
   * Update battery statistics
   */
  updateBatteryStats(stats: Partial<BatteryStats>): void {
    this.batteryStats = { ...this.batteryStats, ...stats };
    this.evaluatePowerOptimizations();
  }

  /**
   * Update performance mode and adjust power profile
   */
  updatePerformanceMode(mode: PerformanceMode): void {
    this.performanceMode = mode;
    this.adjustProfileForMode(mode);
  }

  /**
   * Get current battery statistics
   */
  getBatteryStats(): BatteryStats {
    return { ...this.batteryStats };
  }

  /**
   * Get current power profile
   */
  getCurrentProfile(): PowerProfile {
    return { ...this.currentProfile };
  }

  /**
   * Set custom power profile
   */
  setProfile(profile: PowerProfile): void {
    this.currentProfile = profile;
    this.applyProfile();
  }

  /**
   * Get wake word configuration
   */
  getWakeWordConfig(): WakeWordConfig {
    return { ...this.wakeWordConfig };
  }

  /**
   * Update wake word configuration
   */
  updateWakeWordConfig(config: Partial<WakeWordConfig>): void {
    this.wakeWordConfig = { ...this.wakeWordConfig, ...config };
    this.optimizeWakeWordDetection();
  }

  /**
   * Get power consumption breakdown
   */
  getPowerConsumption(): PowerConsumption[] {
    return Array.from(this.powerConsumption.values());
  }

  /**
   * Get available power saving actions
   */
  getAvailablePowerSavingActions(): PowerSavingAction[] {
    const actions: PowerSavingAction[] = [];

    // Background process optimization
    if (!this.activePowerActions.has('background_optimization')) {
      actions.push({
        id: 'background_optimization',
        description: 'Reduce background process activity',
        estimatedSavings: 50, // mA
        impact: 'low',
        userVisible: false,
        execute: async () => this.optimizeBackgroundProcesses(),
        revert: async () => this.restoreBackgroundProcesses()
      });
    }

    // Screen brightness reduction
    if (this.currentProfile.screenBrightness > 0.3) {
      actions.push({
        id: 'reduce_brightness',
        description: 'Reduce screen brightness to 30%',
        estimatedSavings: 80, // mA
        impact: 'medium',
        userVisible: true,
        execute: async () => this.reduceScreenBrightness(),
        revert: async () => this.restoreScreenBrightness()
      });
    }

    // AI processing throttling
    if (this.currentProfile.aiProcessingLimit > 0.5) {
      actions.push({
        id: 'throttle_ai',
        description: 'Reduce AI processing to 50% capacity',
        estimatedSavings: 120, // mA
        impact: 'medium',
        userVisible: true,
        execute: async () => this.throttleAIProcessing(),
        revert: async () => this.restoreAIProcessing()
      });
    }

    // Wake word optimization
    if (this.wakeWordConfig.sensitivity > 0.3) {
      actions.push({
        id: 'optimize_wake_word',
        description: 'Reduce wake word sensitivity for power savings',
        estimatedSavings: 30, // mA
        impact: 'low',
        userVisible: false,
        execute: async () => this.optimizeWakeWordForPower(),
        revert: async () => this.restoreWakeWordSensitivity()
      });
    }

    return actions.filter(action => !this.activePowerActions.has(action.id));
  }

  /**
   * Execute power saving action
   */
  async executePowerSavingAction(actionId: string): Promise<boolean> {
    const actions = this.getAvailablePowerSavingActions();
    const action = actions.find(a => a.id === actionId);
    
    if (!action) return false;

    try {
      await action.execute();
      this.activePowerActions.add(actionId);
      return true;
    } catch (error) {
      console.error(`Failed to execute power saving action ${actionId}:`, error);
      return false;
    }
  }

  /**
   * Revert power saving action
   */
  async revertPowerSavingAction(actionId: string): Promise<boolean> {
    if (!this.activePowerActions.has(actionId)) return false;

    // Create a temporary action for reverting
    const revertActions = {
      'background_optimization': async () => this.restoreBackgroundProcesses(),
      'reduce_brightness': async () => this.restoreScreenBrightness(),
      'throttle_ai': async () => this.restoreAIProcessing(),
      'optimize_wake_word': async () => this.restoreWakeWordSensitivity()
    };

    const revertAction = revertActions[actionId as keyof typeof revertActions];
    if (!revertAction) return false;

    try {
      await revertAction();
      this.activePowerActions.delete(actionId);
      return true;
    } catch (error) {
      console.error(`Failed to revert power saving action ${actionId}:`, error);
      return false;
    }
  }

  /**
   * Get estimated battery life with current settings
   */
  getEstimatedBatteryLife(): {
    current: number; // hours
    withOptimizations: number; // hours
    potentialSavings: number; // percentage
  } {
    const totalConsumption = Array.from(this.powerConsumption.values())
      .reduce((sum, consumption) => sum + consumption.currentDraw, 0);

    const batteryCapacity = 4000; // mAh (typical smartphone battery)
    const currentLife = (batteryCapacity * (this.batteryStats.level / 100)) / totalConsumption;

    const availableActions = this.getAvailablePowerSavingActions();
    const potentialSavings = availableActions.reduce((sum, action) => sum + action.estimatedSavings, 0);
    const optimizedConsumption = Math.max(100, totalConsumption - potentialSavings);
    const optimizedLife = (batteryCapacity * (this.batteryStats.level / 100)) / optimizedConsumption;

    return {
      current: Math.max(0, currentLife),
      withOptimizations: Math.max(0, optimizedLife),
      potentialSavings: Math.min(100, (potentialSavings / totalConsumption) * 100)
    };
  }

  /**
   * Initialize default power profile
   */
  private getDefaultProfile(): PowerProfile {
    return {
      id: 'balanced',
      name: 'Balanced',
      description: 'Balance between performance and battery life',
      cpuThrottling: 0.8,
      aiProcessingLimit: 0.8,
      backgroundTasksEnabled: true,
      screenBrightness: 0.7,
      networkOptimization: true,
      wakeWordSensitivity: 0.7
    };
  }

  /**
   * Initialize battery statistics
   */
  private initializeBatteryStats(): BatteryStats {
    return {
      level: 100,
      health: 95,
      temperature: 25,
      voltage: 3.8,
      chargingState: 'discharging',
      timeToEmpty: 480, // 8 hours
      timeToFull: -1
    };
  }

  /**
   * Initialize wake word configuration
   */
  private initializeWakeWordConfig(): WakeWordConfig {
    return {
      enabled: true,
      sensitivity: 0.7,
      continuousListening: true,
      adaptiveSensitivity: true,
      lowPowerMode: false,
      keywords: ['hey agent', 'agent os']
    };
  }

  /**
   * Initialize power consumption tracking
   */
  private initializePowerConsumption(): void {
    const components: PowerConsumption[] = [
      {
        component: 'display',
        currentDraw: 200,
        estimatedDuration: 8,
        priority: 8
      },
      {
        component: 'cpu',
        currentDraw: 150,
        estimatedDuration: 10,
        priority: 9
      },
      {
        component: 'ai_processor',
        currentDraw: 100,
        estimatedDuration: 12,
        priority: 7
      },
      {
        component: 'wake_word_detection',
        currentDraw: 30,
        estimatedDuration: 48,
        priority: 6
      },
      {
        component: 'network',
        currentDraw: 80,
        estimatedDuration: 15,
        priority: 5
      },
      {
        component: 'background_tasks',
        currentDraw: 40,
        estimatedDuration: 24,
        priority: 3
      }
    ];

    components.forEach(component => {
      this.powerConsumption.set(component.component, component);
    });
  }

  /**
   * Adjust profile based on performance mode
   */
  private adjustProfileForMode(mode: PerformanceMode): void {
    switch (mode) {
      case PerformanceMode.POWER_SAVE:
        this.currentProfile = {
          ...this.currentProfile,
          cpuThrottling: 0.5,
          aiProcessingLimit: 0.4,
          backgroundTasksEnabled: false,
          screenBrightness: 0.3,
          wakeWordSensitivity: 0.4
        };
        break;

      case PerformanceMode.PERFORMANCE:
        this.currentProfile = {
          ...this.currentProfile,
          cpuThrottling: 1.0,
          aiProcessingLimit: 1.0,
          backgroundTasksEnabled: true,
          screenBrightness: 1.0,
          wakeWordSensitivity: 0.9
        };
        break;

      case PerformanceMode.ADAPTIVE:
        this.adjustProfileAdaptively();
        break;

      default: // BALANCED
        this.currentProfile = this.getDefaultProfile();
        break;
    }

    this.applyProfile();
  }

  /**
   * Adjust profile adaptively based on battery level and usage
   */
  private adjustProfileAdaptively(): void {
    let throttling = 0.8;
    let aiLimit = 0.8;
    let brightness = 0.7;
    let wakeWordSensitivity = 0.7;

    // Adjust based on battery level
    if (this.batteryStats.level < 20) {
      throttling *= 0.6;
      aiLimit *= 0.5;
      brightness *= 0.4;
      wakeWordSensitivity *= 0.5;
    } else if (this.batteryStats.level < 50) {
      throttling *= 0.8;
      aiLimit *= 0.7;
      brightness *= 0.7;
      wakeWordSensitivity *= 0.7;
    }

    // Adjust based on temperature
    if (this.batteryStats.temperature > 35) {
      throttling *= 0.7;
      aiLimit *= 0.6;
    }

    // Adjust based on charging state
    if (this.batteryStats.chargingState === 'charging') {
      throttling = Math.min(1.0, throttling * 1.2);
      aiLimit = Math.min(1.0, aiLimit * 1.2);
    }

    this.currentProfile = {
      ...this.currentProfile,
      cpuThrottling: throttling,
      aiProcessingLimit: aiLimit,
      screenBrightness: brightness,
      wakeWordSensitivity: wakeWordSensitivity,
      backgroundTasksEnabled: this.batteryStats.level > 15
    };
  }

  /**
   * Apply current power profile
   */
  private applyProfile(): void {
    // Update power consumption based on profile
    this.updateComponentPowerConsumption('cpu', 
      Math.max(50, 150 * this.currentProfile.cpuThrottling));
    this.updateComponentPowerConsumption('ai_processor', 
      Math.max(20, 100 * this.currentProfile.aiProcessingLimit));
    this.updateComponentPowerConsumption('display', 
      Math.max(50, 200 * this.currentProfile.screenBrightness));
    this.updateComponentPowerConsumption('wake_word_detection', 
      Math.max(10, 30 * this.currentProfile.wakeWordSensitivity));

    if (!this.currentProfile.backgroundTasksEnabled) {
      this.updateComponentPowerConsumption('background_tasks', 0);
    } else {
      this.updateComponentPowerConsumption('background_tasks', 40);
    }
  }

  /**
   * Update component power consumption
   */
  private updateComponentPowerConsumption(component: string, newDraw: number): void {
    const consumption = this.powerConsumption.get(component);
    if (consumption) {
      consumption.currentDraw = newDraw;
      consumption.estimatedDuration = newDraw > 0 ? 
        (4000 * (this.batteryStats.level / 100)) / newDraw : Infinity;
    }
  }

  /**
   * Evaluate and apply power optimizations
   */
  private evaluatePowerOptimizations(): void {
    // Auto-apply critical power saving measures
    if (this.batteryStats.level < 10) {
      this.applyCriticalPowerSaving();
    } else if (this.batteryStats.level < 20) {
      this.applyLowPowerSaving();
    }

    // Thermal throttling
    if (this.batteryStats.temperature > 40) {
      this.applyThermalThrottling();
    }
  }

  /**
   * Apply critical power saving measures
   */
  private async applyCriticalPowerSaving(): Promise<void> {
    const criticalActions = ['background_optimization', 'throttle_ai', 'reduce_brightness'];
    
    for (const actionId of criticalActions) {
      if (!this.activePowerActions.has(actionId)) {
        await this.executePowerSavingAction(actionId);
      }
    }

    // Force power save mode
    this.updatePerformanceMode(PerformanceMode.POWER_SAVE);
  }

  /**
   * Apply low power saving measures
   */
  private async applyLowPowerSaving(): Promise<void> {
    const lowPowerActions = ['background_optimization', 'optimize_wake_word'];
    
    for (const actionId of lowPowerActions) {
      if (!this.activePowerActions.has(actionId)) {
        await this.executePowerSavingAction(actionId);
      }
    }
  }

  /**
   * Apply thermal throttling
   */
  private applyThermalThrottling(): void {
    this.currentProfile.cpuThrottling = Math.min(0.6, this.currentProfile.cpuThrottling);
    this.currentProfile.aiProcessingLimit = Math.min(0.5, this.currentProfile.aiProcessingLimit);
    this.applyProfile();
  }

  /**
   * Optimize wake word detection for power efficiency
   */
  private optimizeWakeWordDetection(): void {
    if (this.wakeWordConfig.lowPowerMode) {
      // Use more power-efficient detection algorithm
      this.updateComponentPowerConsumption('wake_word_detection', 15);
    } else {
      // Use standard detection
      this.updateComponentPowerConsumption('wake_word_detection', 
        Math.max(10, 30 * this.wakeWordConfig.sensitivity));
    }
  }

  /**
   * Power saving action implementations
   */
  private async optimizeBackgroundProcesses(): Promise<void> {
    this.updateComponentPowerConsumption('background_tasks', 10);
  }

  private async restoreBackgroundProcesses(): Promise<void> {
    this.updateComponentPowerConsumption('background_tasks', 40);
  }

  private async reduceScreenBrightness(): Promise<void> {
    this.currentProfile.screenBrightness = 0.3;
    this.updateComponentPowerConsumption('display', 200 * 0.3);
  }

  private async restoreScreenBrightness(): Promise<void> {
    this.currentProfile.screenBrightness = 0.7;
    this.updateComponentPowerConsumption('display', 200 * 0.7);
  }

  private async throttleAIProcessing(): Promise<void> {
    this.currentProfile.aiProcessingLimit = 0.5;
    this.updateComponentPowerConsumption('ai_processor', 100 * 0.5);
  }

  private async restoreAIProcessing(): Promise<void> {
    this.currentProfile.aiProcessingLimit = 0.8;
    this.updateComponentPowerConsumption('ai_processor', 100 * 0.8);
  }

  private async optimizeWakeWordForPower(): Promise<void> {
    this.wakeWordConfig.sensitivity = 0.3;
    this.wakeWordConfig.lowPowerMode = true;
    this.optimizeWakeWordDetection();
  }

  private async restoreWakeWordSensitivity(): Promise<void> {
    this.wakeWordConfig.sensitivity = 0.7;
    this.wakeWordConfig.lowPowerMode = false;
    this.optimizeWakeWordDetection();
  }

  /**
   * Start battery monitoring
   */
  private startBatteryMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.simulateBatteryDrain();
      this.evaluatePowerOptimizations();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Simulate battery drain for testing
   */
  private simulateBatteryDrain(): void {
    if (this.batteryStats.chargingState === 'discharging') {
      const totalDrain = Array.from(this.powerConsumption.values())
        .reduce((sum, consumption) => sum + consumption.currentDraw, 0);
      
      // Simulate drain (very simplified)
      const drainPerSecond = totalDrain / (4000 * 3600); // mAh per second
      const percentageDrain = (drainPerSecond * 10) * 100; // 10 seconds
      
      this.batteryStats.level = Math.max(0, this.batteryStats.level - percentageDrain);
      
      // Update time estimates
      if (this.batteryStats.level > 0) {
        this.batteryStats.timeToEmpty = (this.batteryStats.level / 100) * 
          (4000 / totalDrain) * 60; // minutes
      } else {
        this.batteryStats.timeToEmpty = 0;
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.powerConsumption.clear();
    this.activePowerActions.clear();
  }
}