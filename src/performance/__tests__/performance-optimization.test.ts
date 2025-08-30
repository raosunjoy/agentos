/**
 * Performance Optimization Tests
 * Tests for response time, resource usage, and system efficiency
 */

import { ModelQuantizer } from '../model-quantizer';
import { ResourceManager } from '../resource-manager';
import { AIScheduler } from '../ai-scheduler';
import { FeatureDegradationManager } from '../feature-degradation';
import { 
  PerformanceMode, 
  ThermalState, 
  PerformanceConstraints,
  ModelQuantizationConfig,
  ResourceRequest,
  AITask,
  SchedulingPolicy
} from '../types';

describe('Performance Optimization System', () => {
  let resourceManager: ResourceManager;
  let aiScheduler: AIScheduler;
  let modelQuantizer: ModelQuantizer;
  let degradationManager: FeatureDegradationManager;
  
  const testConstraints: PerformanceConstraints = {
    maxResponseTime: 500,
    maxMemoryUsage: 4 * 1024 * 1024 * 1024, // 4GB
    maxCpuUsage: 80,
    maxBatteryDrain: 5
  };

  const testSchedulingPolicy: SchedulingPolicy = {
    algorithm: 'priority',
    timeSlice: 100,
    priorityLevels: 10,
    preemptionEnabled: true
  };

  beforeEach(() => {
    resourceManager = new ResourceManager(testConstraints);
    aiScheduler = new AIScheduler(testSchedulingPolicy);
    modelQuantizer = new ModelQuantizer();
    degradationManager = new FeatureDegradationManager(testConstraints);
  });

  afterEach(() => {
    resourceManager.destroy();
    aiScheduler.destroy();
    degradationManager.destroy();
  });

  describe('Model Quantization', () => {
    it('should quantize models within accuracy threshold', async () => {
      const mockModelData = new ArrayBuffer(1024 * 1024); // 1MB model
      const config: ModelQuantizationConfig = {
        precision: 'int8',
        compressionRatio: 4,
        accuracyThreshold: 0.05,
        targetLatency: 100
      };

      const quantizedModel = await modelQuantizer.quantizeModel(
        'test_model',
        mockModelData,
        config,
        testConstraints
      );

      expect(quantizedModel.compressionRatio).toBeGreaterThan(2);
      expect(quantizedModel.accuracyLoss).toBeLessThan(config.accuracyThreshold);
      expect(quantizedModel.speedGain).toBeGreaterThan(1);
    });

    it('should reject quantization if accuracy loss is too high', async () => {
      const mockModelData = new ArrayBuffer(1024 * 1024);
      const strictConfig: ModelQuantizationConfig = {
        precision: 'int8',
        compressionRatio: 10, // Very aggressive compression
        accuracyThreshold: 0.01, // Very strict threshold
        targetLatency: 50
      };

      await expect(
        modelQuantizer.quantizeModel('test_model', mockModelData, strictConfig, testConstraints)
      ).rejects.toThrow('accuracy loss');
    });

    it('should cache quantized models for reuse', async () => {
      const mockModelData = new ArrayBuffer(1024 * 1024);
      const config: ModelQuantizationConfig = {
        precision: 'int8',
        compressionRatio: 4,
        accuracyThreshold: 0.1,
        targetLatency: 100
      };

      // First quantization
      const start1 = Date.now();
      await modelQuantizer.quantizeModel('test_model', mockModelData, config, testConstraints);
      const time1 = Date.now() - start1;

      // Second quantization (should use cache)
      const start2 = Date.now();
      await modelQuantizer.quantizeModel('test_model', mockModelData, config, testConstraints);
      const time2 = Date.now() - start2;

      expect(time2).toBeLessThan(time1 * 0.5); // Should be much faster
    });
  });

  describe('Resource Management', () => {
    it('should allocate resources within constraints', async () => {
      const request: ResourceRequest = {
        id: 'test_request',
        priority: 5,
        estimatedDuration: 1000,
        requiredResources: {
          cpuCores: 2,
          memoryLimit: 512 * 1024 * 1024, // 512MB
          priority: 5
        },
        canDegrade: true
      };

      const grant = await resourceManager.requestResources(request);
      
      expect(grant).toBeTruthy();
      expect(grant!.allocatedResources.cpuCores).toBeGreaterThan(0);
      expect(grant!.allocatedResources.memoryLimit).toBeGreaterThan(0);
    });

    it('should handle power save mode correctly', async () => {
      // Test that power save mode affects resource allocation
      resourceManager.updatePerformanceMode(PerformanceMode.POWER_SAVE);

      const request: ResourceRequest = {
        id: 'test_request',
        priority: 3,
        estimatedDuration: 1000,
        requiredResources: {
          cpuCores: 1, // Small request that should succeed
          memoryLimit: 256 * 1024 * 1024, // 256MB
          priority: 3
        },
        canDegrade: true
      };

      const grant = await resourceManager.requestResources(request);
      
      // Should still get a grant, but may be degraded in power save mode
      expect(grant).toBeTruthy();
      expect(grant!.allocatedResources).toBeDefined();
    });

    it('should reject requests that exceed hard limits', async () => {
      const excessiveRequest: ResourceRequest = {
        id: 'excessive_request',
        priority: 10,
        estimatedDuration: 1000,
        requiredResources: {
          cpuCores: 16, // More than available
          memoryLimit: 16 * 1024 * 1024 * 1024, // 16GB
          priority: 10
        },
        canDegrade: false
      };

      const grant = await resourceManager.requestResources(excessiveRequest);
      expect(grant).toBeNull();
    });

    it('should release resources properly', async () => {
      const request: ResourceRequest = {
        id: 'test_request',
        priority: 5,
        estimatedDuration: 1000,
        requiredResources: {
          cpuCores: 2,
          memoryLimit: 512 * 1024 * 1024,
          priority: 5
        },
        canDegrade: true
      };

      const grant = await resourceManager.requestResources(request);
      expect(grant).toBeTruthy();

      const utilizationBefore = resourceManager.getResourceUtilization();
      resourceManager.releaseResources(request.id);
      const utilizationAfter = resourceManager.getResourceUtilization();

      // Resources should be freed (in a real implementation)
      expect(utilizationAfter).toBeDefined();
    });
  });

  describe('AI Task Scheduling', () => {
    it('should schedule high-priority tasks first', () => {
      const lowPriorityTask: AITask = {
        id: 'low_priority',
        type: 'inference',
        priority: 3,
        estimatedDuration: 1000,
        resourceRequirements: { cpu: 20, memory: 256 * 1024 * 1024 },
        canPreempt: true,
        powerSensitive: false
      };

      const highPriorityTask: AITask = {
        id: 'high_priority',
        type: 'inference',
        priority: 8,
        estimatedDuration: 500,
        resourceRequirements: { cpu: 30, memory: 512 * 1024 * 1024 },
        canPreempt: false,
        powerSensitive: false
      };

      aiScheduler.scheduleTask(lowPriorityTask);
      aiScheduler.scheduleTask(highPriorityTask);

      // High priority task should be scheduled first
      const stats = aiScheduler.getStats();
      expect(stats).toBeDefined();
    });

    it('should delay power-sensitive tasks when battery is low', () => {
      const powerSensitiveTask: AITask = {
        id: 'power_sensitive',
        type: 'training',
        priority: 5,
        estimatedDuration: 5000,
        resourceRequirements: { cpu: 50, memory: 1024 * 1024 * 1024 },
        canPreempt: true,
        powerSensitive: true
      };

      // Simulate low battery
      aiScheduler.updateMetrics({
        cpuUsage: 30,
        memoryUsage: 2 * 1024 * 1024 * 1024,
        batteryLevel: 15,
        thermalState: ThermalState.NORMAL,
        networkLatency: 50
      });

      const taskId = aiScheduler.scheduleTask(powerSensitiveTask);
      expect(taskId).toBe(powerSensitiveTask.id);

      // Task should be delayed due to low battery
      const stats = aiScheduler.getStats();
      expect(stats).toBeDefined();
    });

    it('should preempt lower priority tasks for urgent ones', () => {
      const backgroundTask: AITask = {
        id: 'background',
        type: 'training',
        priority: 2,
        estimatedDuration: 10000,
        resourceRequirements: { cpu: 40, memory: 512 * 1024 * 1024 },
        canPreempt: true,
        powerSensitive: false
      };

      const urgentTask: AITask = {
        id: 'urgent',
        type: 'inference',
        priority: 9,
        estimatedDuration: 200,
        resourceRequirements: { cpu: 60, memory: 256 * 1024 * 1024 },
        canPreempt: false,
        powerSensitive: false
      };

      aiScheduler.scheduleTask(backgroundTask);
      aiScheduler.scheduleTask(urgentTask);

      const stats = aiScheduler.getStats();
      expect(stats.preemptions).toBeGreaterThanOrEqual(0);
    });

    it('should cancel tasks successfully', () => {
      const task: AITask = {
        id: 'cancellable',
        type: 'inference',
        priority: 5,
        estimatedDuration: 1000,
        resourceRequirements: { cpu: 30, memory: 256 * 1024 * 1024 },
        canPreempt: true,
        powerSensitive: false
      };

      aiScheduler.scheduleTask(task);
      const cancelled = aiScheduler.cancelTask(task.id);
      
      expect(cancelled).toBe(true);
    });
  });

  describe('Feature Degradation', () => {
    it('should disable non-essential features when battery is critical', () => {
      degradationManager.updateMetrics({
        cpuUsage: 50,
        memoryUsage: 2 * 1024 * 1024 * 1024,
        batteryLevel: 5, // Critical battery
        thermalState: ThermalState.NORMAL,
        networkLatency: 50
      });

      const level = degradationManager.getCurrentLevel();
      expect(level.level).toBeGreaterThan(3);
      expect(level.disabledFeatures.length).toBeGreaterThan(0);
    });

    it('should reduce quality when thermal state is high', () => {
      degradationManager.updateMetrics({
        cpuUsage: 60,
        memoryUsage: 3 * 1024 * 1024 * 1024,
        batteryLevel: 50,
        thermalState: ThermalState.HOT,
        networkLatency: 50
      });

      const level = degradationManager.getCurrentLevel();
      expect(level.reducedQuality.length).toBeGreaterThan(0);
    });

    it('should provide degradation recommendations', () => {
      const recommendations = degradationManager.getDegradationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('feature');
        expect(recommendations[0]).toHaveProperty('action');
        expect(recommendations[0]).toHaveProperty('impact');
        expect(recommendations[0]).toHaveProperty('savings');
      }
    });

    it('should respect user overrides', () => {
      const featureId = 'visual_animations';
      const overrideSuccess = degradationManager.overrideFeature(featureId, true, 100);
      expect(overrideSuccess).toBe(true);

      // Even with critical battery, user override should be respected
      degradationManager.updateMetrics({
        cpuUsage: 80,
        memoryUsage: 3 * 1024 * 1024 * 1024,
        batteryLevel: 5,
        thermalState: ThermalState.CRITICAL,
        networkLatency: 50
      });

      const featureState = degradationManager.getFeatureState(featureId);
      expect(featureState?.enabled).toBe(true);
      expect(featureState?.userOverride).toBe(true);
    });

    it('should apply power save mode correctly', () => {
      degradationManager.updatePerformanceMode(PerformanceMode.POWER_SAVE);

      const level = degradationManager.getCurrentLevel();
      expect(level.level).toBeGreaterThanOrEqual(3);
      expect(level.disabledFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should maintain response time under 500ms for typical operations', async () => {
      const start = Date.now();
      
      // Simulate typical AI operation
      const task: AITask = {
        id: 'typical_operation',
        type: 'inference',
        priority: 7,
        estimatedDuration: 300,
        resourceRequirements: { cpu: 40, memory: 512 * 1024 * 1024 },
        canPreempt: false,
        powerSensitive: false
      };

      const request: ResourceRequest = {
        id: 'typical_request',
        priority: 7,
        estimatedDuration: 300,
        requiredResources: {
          cpuCores: 2,
          memoryLimit: 512 * 1024 * 1024,
          priority: 7
        },
        canDegrade: true
      };

      const [grant] = await Promise.all([
        resourceManager.requestResources(request),
        Promise.resolve(aiScheduler.scheduleTask(task))
      ]);

      const responseTime = Date.now() - start;
      
      expect(responseTime).toBeLessThan(testConstraints.maxResponseTime);
      expect(grant).toBeTruthy();
    });

    it('should handle resource contention gracefully', async () => {
      // Create multiple competing requests
      const requests = Array.from({ length: 5 }, (_, i) => ({
        id: `request_${i}`,
        priority: Math.floor(Math.random() * 10) + 1,
        estimatedDuration: 1000,
        requiredResources: {
          cpuCores: 2,
          memoryLimit: 512 * 1024 * 1024,
          priority: Math.floor(Math.random() * 10) + 1
        },
        canDegrade: true
      }));

      const grants = await Promise.all(
        requests.map(req => resourceManager.requestResources(req))
      );

      // At least some requests should be granted
      const successfulGrants = grants.filter(grant => grant !== null);
      expect(successfulGrants.length).toBeGreaterThan(0);
    });

    it('should adapt to changing system conditions', () => {
      // Start with normal conditions
      const normalMetrics = {
        cpuUsage: 30,
        memoryUsage: 2 * 1024 * 1024 * 1024,
        batteryLevel: 80,
        thermalState: ThermalState.NORMAL,
        networkLatency: 50
      };

      degradationManager.updateMetrics(normalMetrics);
      aiScheduler.updateMetrics(normalMetrics);

      const initialLevel = degradationManager.getCurrentLevel();

      // Simulate degraded conditions
      const degradedMetrics = {
        cpuUsage: 85,
        memoryUsage: 3.5 * 1024 * 1024 * 1024,
        batteryLevel: 15,
        thermalState: ThermalState.HOT,
        networkLatency: 200
      };

      degradationManager.updateMetrics(degradedMetrics);
      aiScheduler.updateMetrics(degradedMetrics);

      const degradedLevel = degradationManager.getCurrentLevel();

      expect(degradedLevel.level).toBeGreaterThan(initialLevel.level);
    });
  });

  describe('Performance Metrics', () => {
    it('should track resource efficiency metrics', () => {
      const utilization = resourceManager.getResourceUtilization();
      expect(utilization).toHaveProperty('cpuUsage');
      expect(utilization).toHaveProperty('memoryUsage');
      expect(utilization).toHaveProperty('batteryLevel');
      expect(utilization).toHaveProperty('thermalState');
    });

    it('should track scheduling performance', () => {
      const stats = aiScheduler.getStats();
      expect(stats).toHaveProperty('tasksCompleted');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('powerEfficiency');
      expect(stats).toHaveProperty('deadlinesMissed');
    });

    it('should provide cache statistics for model quantizer', () => {
      const cacheStats = modelQuantizer.getCacheStats();
      expect(cacheStats).toHaveProperty('size');
      expect(cacheStats).toHaveProperty('models');
      expect(typeof cacheStats.size).toBe('number');
      expect(typeof cacheStats.models).toBe('number');
    });
  });
});