/**
 * Battery Optimization Tests
 * Tests for power management, wake word optimization, and battery life estimation
 */

import { BatteryOptimizer } from '../battery-optimizer';
import { PerformanceMode, ThermalState, PerformanceConstraints } from '../types';

describe('Battery Optimization System', () => {
  let batteryOptimizer: BatteryOptimizer;
  
  const testConstraints: PerformanceConstraints = {
    maxResponseTime: 500,
    maxMemoryUsage: 4 * 1024 * 1024 * 1024, // 4GB
    maxCpuUsage: 80,
    maxBatteryDrain: 5
  };

  beforeEach(() => {
    batteryOptimizer = new BatteryOptimizer(testConstraints);
  });

  afterEach(() => {
    batteryOptimizer.destroy();
  });

  describe('Battery Statistics', () => {
    it('should initialize with default battery stats', () => {
      const stats = batteryOptimizer.getBatteryStats();
      
      expect(stats.level).toBe(100);
      expect(stats.health).toBeGreaterThan(0);
      expect(stats.temperature).toBeGreaterThan(0);
      expect(stats.chargingState).toBeDefined();
    });

    it('should update battery statistics', () => {
      const newStats = {
        level: 75,
        temperature: 30,
        chargingState: 'charging' as const
      };

      batteryOptimizer.updateBatteryStats(newStats);
      const updatedStats = batteryOptimizer.getBatteryStats();

      expect(updatedStats.level).toBe(75);
      expect(updatedStats.temperature).toBe(30);
      expect(updatedStats.chargingState).toBe('charging');
    });

    it('should calculate battery life estimates', () => {
      const estimates = batteryOptimizer.getEstimatedBatteryLife();
      
      expect(estimates.current).toBeGreaterThan(0);
      expect(estimates.withOptimizations).toBeGreaterThanOrEqual(estimates.current);
      expect(estimates.potentialSavings).toBeGreaterThanOrEqual(0);
      expect(estimates.potentialSavings).toBeLessThanOrEqual(100);
    });
  });

  describe('Power Profiles', () => {
    it('should have a default balanced profile', () => {
      const profile = batteryOptimizer.getCurrentProfile();
      
      expect(profile.id).toBe('balanced');
      expect(profile.cpuThrottling).toBeGreaterThan(0);
      expect(profile.cpuThrottling).toBeLessThanOrEqual(1);
      expect(profile.aiProcessingLimit).toBeGreaterThan(0);
      expect(profile.aiProcessingLimit).toBeLessThanOrEqual(1);
    });

    it('should adjust profile for power save mode', () => {
      batteryOptimizer.updatePerformanceMode(PerformanceMode.POWER_SAVE);
      const profile = batteryOptimizer.getCurrentProfile();
      
      expect(profile.cpuThrottling).toBeLessThan(0.8);
      expect(profile.aiProcessingLimit).toBeLessThan(0.8);
      expect(profile.backgroundTasksEnabled).toBe(false);
      expect(profile.screenBrightness).toBeLessThan(0.5);
    });

    it('should adjust profile for performance mode', () => {
      batteryOptimizer.updatePerformanceMode(PerformanceMode.PERFORMANCE);
      const profile = batteryOptimizer.getCurrentProfile();
      
      expect(profile.cpuThrottling).toBe(1.0);
      expect(profile.aiProcessingLimit).toBe(1.0);
      expect(profile.backgroundTasksEnabled).toBe(true);
      expect(profile.screenBrightness).toBe(1.0);
    });

    it('should adapt profile based on battery level', () => {
      // Simulate low battery
      batteryOptimizer.updateBatteryStats({ level: 15 });
      batteryOptimizer.updatePerformanceMode(PerformanceMode.ADAPTIVE);
      
      const profile = batteryOptimizer.getCurrentProfile();
      
      expect(profile.cpuThrottling).toBeLessThan(0.8);
      expect(profile.aiProcessingLimit).toBeLessThan(0.8);
    });
  });

  describe('Wake Word Optimization', () => {
    it('should have default wake word configuration', () => {
      const config = batteryOptimizer.getWakeWordConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.sensitivity).toBeGreaterThan(0);
      expect(config.sensitivity).toBeLessThanOrEqual(1);
      expect(config.keywords).toContain('hey agent');
    });

    it('should update wake word configuration', () => {
      const newConfig = {
        sensitivity: 0.5,
        lowPowerMode: true,
        continuousListening: false
      };

      batteryOptimizer.updateWakeWordConfig(newConfig);
      const updatedConfig = batteryOptimizer.getWakeWordConfig();

      expect(updatedConfig.sensitivity).toBe(0.5);
      expect(updatedConfig.lowPowerMode).toBe(true);
      expect(updatedConfig.continuousListening).toBe(false);
    });

    it('should optimize wake word detection for power savings', () => {
      const initialConsumption = batteryOptimizer.getPowerConsumption();
      const wakeWordBefore = initialConsumption.find(c => c.component === 'wake_word_detection');
      
      batteryOptimizer.updateWakeWordConfig({ 
        sensitivity: 0.3, 
        lowPowerMode: true 
      });
      
      const optimizedConsumption = batteryOptimizer.getPowerConsumption();
      const wakeWordAfter = optimizedConsumption.find(c => c.component === 'wake_word_detection');
      
      // In low power mode, consumption should be 15mA or less
      expect(wakeWordAfter?.currentDraw).toBeLessThanOrEqual(15);
      expect(wakeWordAfter?.currentDraw).toBeLessThanOrEqual(wakeWordBefore?.currentDraw || 0);
    });
  });

  describe('Power Consumption Tracking', () => {
    it('should track power consumption by component', () => {
      const consumption = batteryOptimizer.getPowerConsumption();
      
      expect(consumption.length).toBeGreaterThan(0);
      
      const components = consumption.map(c => c.component);
      expect(components).toContain('display');
      expect(components).toContain('cpu');
      expect(components).toContain('ai_processor');
      expect(components).toContain('wake_word_detection');
    });

    it('should update consumption based on profile changes', () => {
      const initialConsumption = batteryOptimizer.getPowerConsumption();
      const cpuBefore = initialConsumption.find(c => c.component === 'cpu');
      
      batteryOptimizer.updatePerformanceMode(PerformanceMode.POWER_SAVE);
      
      const updatedConsumption = batteryOptimizer.getPowerConsumption();
      const cpuAfter = updatedConsumption.find(c => c.component === 'cpu');
      
      // In power save mode, CPU should be throttled (minimum 50mA)
      expect(cpuAfter?.currentDraw).toBeLessThanOrEqual(75); // 150 * 0.5 = 75
      expect(cpuAfter?.currentDraw).toBeLessThanOrEqual(cpuBefore?.currentDraw || 0);
    });

    it('should provide estimated duration for each component', () => {
      const consumption = batteryOptimizer.getPowerConsumption();
      
      consumption.forEach(component => {
        expect(component.estimatedDuration).toBeGreaterThan(0);
        expect(component.priority).toBeGreaterThan(0);
        expect(component.priority).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('Power Saving Actions', () => {
    it('should provide available power saving actions', () => {
      const actions = batteryOptimizer.getAvailablePowerSavingActions();
      
      expect(actions.length).toBeGreaterThan(0);
      
      actions.forEach(action => {
        expect(action.id).toBeDefined();
        expect(action.description).toBeDefined();
        expect(action.estimatedSavings).toBeGreaterThan(0);
        expect(['low', 'medium', 'high']).toContain(action.impact);
        expect(typeof action.userVisible).toBe('boolean');
      });
    });

    it('should execute power saving actions', async () => {
      const actions = batteryOptimizer.getAvailablePowerSavingActions();
      const action = actions[0];
      
      const success = await batteryOptimizer.executePowerSavingAction(action.id);
      expect(success).toBe(true);
      
      // Action should no longer be available
      const updatedActions = batteryOptimizer.getAvailablePowerSavingActions();
      const stillAvailable = updatedActions.find(a => a.id === action.id);
      expect(stillAvailable).toBeUndefined();
    });

    it('should revert power saving actions', async () => {
      const actions = batteryOptimizer.getAvailablePowerSavingActions();
      const action = actions[0];
      
      // Execute action
      await batteryOptimizer.executePowerSavingAction(action.id);
      
      // Revert action
      const success = await batteryOptimizer.revertPowerSavingAction(action.id);
      expect(success).toBe(true);
      
      // Action should be available again
      const revertedActions = batteryOptimizer.getAvailablePowerSavingActions();
      const availableAgain = revertedActions.find(a => a.id === action.id);
      expect(availableAgain).toBeDefined();
    });

    it('should not execute invalid actions', async () => {
      const success = await batteryOptimizer.executePowerSavingAction('invalid_action');
      expect(success).toBe(false);
    });

    it('should not revert non-active actions', async () => {
      const success = await batteryOptimizer.revertPowerSavingAction('non_active_action');
      expect(success).toBe(false);
    });
  });

  describe('Automatic Optimizations', () => {
    it('should apply critical power saving when battery is very low', async () => {
      // Simulate critical battery level
      batteryOptimizer.updateBatteryStats({ level: 5 });
      
      // Wait for automatic optimization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const profile = batteryOptimizer.getCurrentProfile();
      expect(profile.cpuThrottling).toBeLessThan(0.8);
      expect(profile.aiProcessingLimit).toBeLessThan(0.8);
    });

    it('should apply thermal throttling when temperature is high', () => {
      const initialProfile = batteryOptimizer.getCurrentProfile();
      
      // Simulate high temperature
      batteryOptimizer.updateBatteryStats({ temperature: 45 });
      
      const throttledProfile = batteryOptimizer.getCurrentProfile();
      expect(throttledProfile.cpuThrottling).toBeLessThan(initialProfile.cpuThrottling);
      expect(throttledProfile.aiProcessingLimit).toBeLessThan(initialProfile.aiProcessingLimit);
    });

    it('should optimize differently when charging', () => {
      // Test discharging state
      batteryOptimizer.updateBatteryStats({ 
        level: 30, 
        chargingState: 'discharging' 
      });
      batteryOptimizer.updatePerformanceMode(PerformanceMode.ADAPTIVE);
      const dischargingProfile = batteryOptimizer.getCurrentProfile();
      
      // Test charging state
      batteryOptimizer.updateBatteryStats({ 
        level: 30, 
        chargingState: 'charging' 
      });
      batteryOptimizer.updatePerformanceMode(PerformanceMode.ADAPTIVE);
      const chargingProfile = batteryOptimizer.getCurrentProfile();
      
      expect(chargingProfile.cpuThrottling).toBeGreaterThanOrEqual(dischargingProfile.cpuThrottling);
      expect(chargingProfile.aiProcessingLimit).toBeGreaterThanOrEqual(dischargingProfile.aiProcessingLimit);
    });
  });

  describe('Battery Life Estimation', () => {
    it('should provide realistic battery life estimates', () => {
      const estimates = batteryOptimizer.getEstimatedBatteryLife();
      
      expect(estimates.current).toBeGreaterThan(0);
      expect(estimates.current).toBeLessThan(100); // Should be reasonable hours
      expect(estimates.withOptimizations).toBeGreaterThanOrEqual(estimates.current);
      expect(estimates.potentialSavings).toBeGreaterThanOrEqual(0);
    });

    it('should show improved estimates with optimizations', async () => {
      const initialEstimates = batteryOptimizer.getEstimatedBatteryLife();
      
      // Apply some optimizations
      const actions = batteryOptimizer.getAvailablePowerSavingActions();
      if (actions.length > 0) {
        await batteryOptimizer.executePowerSavingAction(actions[0].id);
      }
      
      const optimizedEstimates = batteryOptimizer.getEstimatedBatteryLife();
      
      // Current life should improve after applying optimizations
      expect(optimizedEstimates.current).toBeGreaterThanOrEqual(initialEstimates.current);
    });

    it('should handle zero battery level gracefully', () => {
      batteryOptimizer.updateBatteryStats({ level: 0 });
      const estimates = batteryOptimizer.getEstimatedBatteryLife();
      
      expect(estimates.current).toBe(0);
      expect(estimates.withOptimizations).toBe(0);
    });
  });

  describe('Integration with Performance Modes', () => {
    it('should coordinate with performance mode changes', () => {
      const modes = [
        PerformanceMode.POWER_SAVE,
        PerformanceMode.BALANCED,
        PerformanceMode.PERFORMANCE,
        PerformanceMode.ADAPTIVE
      ];

      modes.forEach(mode => {
        batteryOptimizer.updatePerformanceMode(mode);
        const profile = batteryOptimizer.getCurrentProfile();
        
        expect(profile.cpuThrottling).toBeGreaterThan(0);
        expect(profile.cpuThrottling).toBeLessThanOrEqual(1);
        expect(profile.aiProcessingLimit).toBeGreaterThan(0);
        expect(profile.aiProcessingLimit).toBeLessThanOrEqual(1);
      });
    });

    it('should maintain consistency between modes and power consumption', () => {
      batteryOptimizer.updatePerformanceMode(PerformanceMode.POWER_SAVE);
      const powerSaveConsumption = batteryOptimizer.getPowerConsumption();
      const powerSaveTotal = powerSaveConsumption.reduce((sum, c) => sum + c.currentDraw, 0);
      
      batteryOptimizer.updatePerformanceMode(PerformanceMode.PERFORMANCE);
      const performanceConsumption = batteryOptimizer.getPowerConsumption();
      const performanceTotal = performanceConsumption.reduce((sum, c) => sum + c.currentDraw, 0);
      
      expect(performanceTotal).toBeGreaterThan(powerSaveTotal);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid battery stats gracefully', () => {
      // Test with invalid values
      batteryOptimizer.updateBatteryStats({ 
        level: -10, // Invalid
        temperature: 1000 // Unrealistic
      });
      
      const stats = batteryOptimizer.getBatteryStats();
      expect(stats).toBeDefined();
      
      const estimates = batteryOptimizer.getEstimatedBatteryLife();
      expect(estimates.current).toBeGreaterThanOrEqual(0);
    });

    it('should handle wake word config edge cases', () => {
      // Test with extreme values
      batteryOptimizer.updateWakeWordConfig({
        sensitivity: 2.0, // Above normal range
        keywords: [] // Empty keywords
      });
      
      const config = batteryOptimizer.getWakeWordConfig();
      expect(config).toBeDefined();
      expect(Array.isArray(config.keywords)).toBe(true);
    });
  });
});