/**
 * AI Model Scheduler and Optimizer
 * Intelligent scheduling and optimization of AI models for performance and battery life
 */

import { EventEmitter } from 'events';
import { systemLogger } from '../core/logging';
import { errorHandler } from '../core/errors';

export interface ModelProfile {
  id: string;
  name: string;
  type: 'nlp' | 'voice' | 'vision' | 'general';
  size: number; // Model size in MB
  precision: 'fp32' | 'fp16' | 'int8' | 'int4' | 'binary';
  platform: 'cpu' | 'gpu' | 'npu' | 'webgl' | 'wasm';
  memoryRequirement: number; // Memory in MB
  computeRequirement: number; // Relative compute units
  batteryImpact: number; // Battery drain per minute
  accuracy: number; // Model accuracy score (0-1)
  latency: number; // Average inference time in ms
}

export interface DeviceCapabilities {
  platform: 'mobile' | 'desktop' | 'server';
  cpuCores: number;
  memoryGB: number;
  hasGPU: boolean;
  hasNPU: boolean;
  batteryLevel?: number;
  thermalStatus?: 'cool' | 'warm' | 'hot';
  networkType?: 'wifi' | 'cellular' | 'none';
}

export interface OptimizationConfig {
  prioritizeAccuracy: boolean;
  prioritizeBattery: boolean;
  prioritizeSpeed: boolean;
  maxMemoryUsage: number;
  maxBatteryDrain: number;
  thermalThrottling: boolean;
  adaptiveScaling: boolean;
}

export interface ScheduleDecision {
  modelId: string;
  platform: ModelProfile['platform'];
  precision: ModelProfile['precision'];
  batchSize: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedLatency: number;
  estimatedBatteryDrain: number;
  confidence: number;
}

export class AIScheduler extends EventEmitter {
  private logger = systemLogger('ai-scheduler');
  private modelProfiles: Map<string, ModelProfile> = new Map();
  private deviceCapabilities: DeviceCapabilities;
  private optimizationConfig: OptimizationConfig;
  private activeModels: Map<string, ScheduleDecision> = new Map();
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();

  constructor(deviceCapabilities: DeviceCapabilities, config?: Partial<OptimizationConfig>) {
    super();
    this.deviceCapabilities = deviceCapabilities;
    this.optimizationConfig = {
      prioritizeAccuracy: false,
      prioritizeBattery: true,
      prioritizeSpeed: false,
      maxMemoryUsage: deviceCapabilities.memoryGB * 1024, // Convert to MB
      maxBatteryDrain: 2, // 2% per minute max
      thermalThrottling: true,
      adaptiveScaling: true,
      ...config
    };

    this.initializeModelProfiles();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize default model profiles for common AI tasks
   */
  private initializeModelProfiles(): void {
    // NLP Models
    this.modelProfiles.set('bert-base', {
      id: 'bert-base',
      name: 'BERT Base',
      type: 'nlp',
      size: 420,
      precision: 'fp32',
      platform: 'cpu',
      memoryRequirement: 1024,
      computeRequirement: 100,
      batteryImpact: 1.2,
      accuracy: 0.92,
      latency: 150
    });

    this.modelProfiles.set('distilbert-int8', {
      id: 'distilbert-int8',
      name: 'DistilBERT INT8',
      type: 'nlp',
      size: 65,
      precision: 'int8',
      platform: 'cpu',
      memoryRequirement: 256,
      computeRequirement: 30,
      batteryImpact: 0.4,
      accuracy: 0.89,
      latency: 45
    });

    // Voice Models
    this.modelProfiles.set('wav2vec2-base', {
      id: 'wav2vec2-base',
      name: 'Wav2Vec2 Base',
      type: 'voice',
      size: 360,
      precision: 'fp32',
      platform: 'cpu',
      memoryRequirement: 512,
      computeRequirement: 80,
      batteryImpact: 0.9,
      accuracy: 0.94,
      latency: 120
    });

    this.modelProfiles.set('silero-vad', {
      id: 'silero-vad',
      name: 'Silero VAD',
      type: 'voice',
      size: 4,
      precision: 'fp16',
      platform: 'cpu',
      memoryRequirement: 16,
      computeRequirement: 5,
      batteryImpact: 0.1,
      accuracy: 0.96,
      latency: 8
    });

    // Optimized mobile models
    this.modelProfiles.set('mobile-bert-int8', {
      id: 'mobile-bert-int8',
      name: 'MobileBERT INT8',
      type: 'nlp',
      size: 25,
      precision: 'int8',
      platform: 'cpu',
      memoryRequirement: 64,
      computeRequirement: 12,
      batteryImpact: 0.2,
      accuracy: 0.91,
      latency: 25
    });

    this.logger.info('Initialized model profiles', {
      count: this.modelProfiles.size
    });
  }

  /**
   * Schedule AI model execution with optimal configuration
   */
  async scheduleModel(
    modelType: ModelProfile['type'],
    context: {
      urgency?: 'low' | 'medium' | 'high' | 'critical';
      accuracy?: number;
      maxLatency?: number;
      batteryBudget?: number;
    } = {}
  ): Promise<ScheduleDecision> {
    const startTime = Date.now();

    try {
      this.logger.info('Scheduling AI model', { modelType, context });

      // Find suitable model profiles
      const candidates = this.findModelCandidates(modelType, context);

      if (candidates.length === 0) {
        throw new Error(`No suitable model found for type: ${modelType}`);
      }

      // Evaluate and rank candidates
      const rankedCandidates = await this.rankModelCandidates(candidates, context);

      // Select optimal model
      const selectedModel = rankedCandidates[0];
      const decision = await this.createScheduleDecision(selectedModel, context);

      // Track active model
      this.activeModels.set(selectedModel.id, decision);

      // Record performance
      const schedulingTime = Date.now() - startTime;
      this.recordPerformanceMetric('scheduling', schedulingTime, {
        modelType,
        selectedModel: selectedModel.id,
        candidatesCount: candidates.length
      });

      this.emit('modelScheduled', decision);

      this.logger.info('Model scheduled successfully', {
        modelId: decision.modelId,
        platform: decision.platform,
        precision: decision.precision,
        estimatedLatency: decision.estimatedLatency,
        schedulingTime
      });

      return decision;

    } catch (error) {
      await errorHandler.handleError(error, {
        component: 'ai-scheduler',
        operation: 'scheduleModel',
        modelType
      });
      throw error;
    }
  }

  /**
   * Optimize model for specific constraints
   */
  async optimizeModel(
    modelId: string,
    constraints: {
      targetPlatform?: ModelProfile['platform'];
      maxMemory?: number;
      maxLatency?: number;
      accuracyThreshold?: number;
    }
  ): Promise<ModelProfile> {
    const baseModel = this.modelProfiles.get(modelId);
    if (!baseModel) {
      throw new Error(`Model not found: ${modelId}`);
    }

    this.logger.info('Optimizing model', { modelId, constraints });

    // Create optimized version
    const optimizedModel = await this.applyOptimizations(baseModel, constraints);

    // Validate optimization meets constraints
    const validation = this.validateOptimization(optimizedModel, constraints);
    if (!validation.valid) {
      throw new Error(`Optimization failed: ${validation.reason}`);
    }

    // Cache optimized model
    const optimizedId = `${modelId}-optimized-${Date.now()}`;
    this.modelProfiles.set(optimizedId, optimizedModel);

    this.emit('modelOptimized', { originalId: modelId, optimizedId, optimizations: validation });

    this.logger.info('Model optimized successfully', {
      originalId: modelId,
      optimizedId,
      improvements: validation.improvements
    });

    return optimizedModel;
  }

  /**
   * Monitor and adapt to performance
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.adaptToPerformance();
    }, 30000); // Every 30 seconds

    this.logger.debug('Performance monitoring started');
  }

  /**
   * Adapt scheduling based on performance metrics
   */
  private async adaptToPerformance(): Promise<void> {
    try {
      // Analyze recent performance
      const recentMetrics = this.getRecentPerformanceMetrics(300000); // Last 5 minutes

      // Detect performance degradation
      const degradation = this.detectPerformanceDegradation(recentMetrics);
      if (degradation.detected) {
        this.logger.warn('Performance degradation detected', degradation);

        // Adapt scheduling strategy
        await this.adaptSchedulingStrategy(degradation);

        this.emit('performanceAdapted', degradation);
      }

      // Update device capabilities if changed
      await this.updateDeviceCapabilities();

    } catch (error) {
      this.logger.error('Performance adaptation failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Find suitable model candidates for the task
   */
  private findModelCandidates(
    modelType: ModelProfile['type'],
    context: any
  ): ModelProfile[] {
    return Array.from(this.modelProfiles.values()).filter(model => {
      // Filter by type
      if (model.type !== modelType) return false;

      // Filter by device capabilities
      if (!this.isCompatibleWithDevice(model)) return false;

      // Filter by context constraints
      if (context.maxLatency && model.latency > context.maxLatency) return false;
      if (context.accuracy && model.accuracy < context.accuracy) return false;
      if (context.batteryBudget && model.batteryImpact > context.batteryBudget) return false;

      return true;
    });
  }

  /**
   * Rank model candidates by optimization preferences
   */
  private async rankModelCandidates(
    candidates: ModelProfile[],
    context: any
  ): Promise<ModelProfile[]> {
    const scoredCandidates = await Promise.all(
      candidates.map(async candidate => {
        const score = await this.scoreModelCandidate(candidate, context);
        return { model: candidate, score };
      })
    );

    // Sort by score (higher is better)
    return scoredCandidates
      .sort((a, b) => b.score - a.score)
      .map(item => item.model);
  }

  /**
   * Score a model candidate based on optimization preferences
   */
  private async scoreModelCandidate(
    model: ModelProfile,
    context: any
  ): Promise<number> {
    let score = 0;

    // Base score from accuracy
    score += model.accuracy * 30;

    // Performance optimization
    if (this.optimizationConfig.prioritizeSpeed) {
      score += (1000 - model.latency) / 10; // Lower latency = higher score
    }

    // Battery optimization
    if (this.optimizationConfig.prioritizeBattery) {
      score += (2 - model.batteryImpact) * 20; // Lower battery impact = higher score
    }

    // Accuracy priority
    if (this.optimizationConfig.prioritizeAccuracy) {
      score += model.accuracy * 40;
    }

    // Memory constraints
    if (model.memoryRequirement <= this.optimizationConfig.maxMemoryUsage) {
      score += 10;
    } else {
      score -= 20; // Penalty for exceeding memory
    }

    // Device compatibility bonus
    if (this.getOptimalPlatform(model) === model.platform) {
      score += 15;
    }

    // Historical performance bonus
    const historicalScore = await this.getHistoricalPerformanceScore(model.id);
    score += historicalScore;

    // Context-specific adjustments
    if (context.urgency === 'critical') {
      score += model.latency < 50 ? 10 : -10; // Prefer fast models for critical tasks
    }

    if (this.deviceCapabilities.batteryLevel && this.deviceCapabilities.batteryLevel < 20) {
      score += (1 - model.batteryImpact) * 25; // Strongly prefer battery-efficient models
    }

    return Math.max(0, score);
  }

  /**
   * Create scheduling decision
   */
  private async createScheduleDecision(
    model: ModelProfile,
    context: any
  ): Promise<ScheduleDecision> {
    const platform = this.getOptimalPlatform(model);
    const precision = this.getOptimalPrecision(model, context);
    const batchSize = this.calculateOptimalBatchSize(model, platform);

    // Estimate performance
    const estimatedLatency = await this.estimateLatency(model, platform, precision, batchSize);
    const estimatedBatteryDrain = this.estimateBatteryDrain(model, context);

    // Calculate confidence
    const confidence = this.calculateSchedulingConfidence(model, context);

    return {
      modelId: model.id,
      platform,
      precision,
      batchSize,
      priority: context.urgency || 'medium',
      estimatedLatency,
      estimatedBatteryDrain,
      confidence
    };
  }

  /**
   * Apply model optimizations
   */
  private async applyOptimizations(
    model: ModelProfile,
    constraints: any
  ): Promise<ModelProfile> {
    const optimized = { ...model };

    // Platform optimization
    if (constraints.targetPlatform) {
      optimized.platform = constraints.targetPlatform;
    } else {
      optimized.platform = this.getOptimalPlatform(model);
    }

    // Precision optimization
    if (this.canQuantize(model)) {
      optimized.precision = this.getOptimalPrecision(model, constraints);
      optimized.size = this.estimateQuantizedSize(model, optimized.precision);
      optimized.memoryRequirement = Math.floor(model.memoryRequirement * this.getPrecisionMultiplier(optimized.precision));
      optimized.computeRequirement = Math.floor(model.computeRequirement * this.getPrecisionMultiplier(optimized.precision));
      optimized.batteryImpact *= this.getPrecisionBatteryMultiplier(optimized.precision);
      optimized.latency *= this.getPrecisionLatencyMultiplier(optimized.precision);
      optimized.accuracy *= this.getPrecisionAccuracyMultiplier(optimized.precision);
    }

    return optimized;
  }

  /**
   * Get optimal platform for model
   */
  private getOptimalPlatform(model: ModelProfile): ModelProfile['platform'] {
    // Mobile optimization
    if (this.deviceCapabilities.platform === 'mobile') {
      if (this.deviceCapabilities.hasNPU && model.computeRequirement > 50) {
        return 'npu';
      }
      if (this.deviceCapabilities.hasGPU && model.size < 200) {
        return 'gpu';
      }
      return 'cpu'; // Most compatible for mobile
    }

    // Desktop/server optimization
    if (this.deviceCapabilities.hasGPU && model.computeRequirement > 30) {
      return 'gpu';
    }

    return 'cpu';
  }

  /**
   * Get optimal precision for model
   */
  private getOptimalPrecision(
    model: ModelProfile,
    constraints: any
  ): ModelProfile['precision'] {
    // Battery-critical scenarios
    if (this.deviceCapabilities.batteryLevel && this.deviceCapabilities.batteryLevel < 15) {
      return 'int4';
    }

    // Memory-constrained
    if (constraints.maxMemory && model.memoryRequirement > constraints.maxMemory) {
      return 'int8';
    }

    // Accuracy priority
    if (constraints.accuracyThreshold && constraints.accuracyThreshold > 0.9) {
      return model.precision; // Keep original precision
    }

    // Default optimization
    if (model.precision === 'fp32' && model.size > 100) {
      return 'int8';
    }

    return model.precision;
  }

  /**
   * Calculate optimal batch size
   */
  private calculateOptimalBatchSize(model: ModelProfile, platform: string): number {
    const baseBatchSize = 1;

    // GPU can handle larger batches
    if (platform === 'gpu') {
      return Math.min(8, Math.floor(this.deviceCapabilities.memoryGB / (model.memoryRequirement / 1024)));
    }

    // NPU optimized for specific batch sizes
    if (platform === 'npu') {
      return 4; // NPU sweet spot
    }

    return baseBatchSize;
  }

  /**
   * Estimate inference latency
   */
  private async estimateLatency(
    model: ModelProfile,
    platform: string,
    precision: string,
    batchSize: number
  ): Promise<number> {
    let estimatedLatency = model.latency;

    // Platform multipliers
    const platformMultipliers: Record<string, number> = {
      cpu: 1.0,
      gpu: 0.7,
      npu: 0.5,
      webgl: 1.2,
      wasm: 1.5
    };

    estimatedLatency *= platformMultipliers[platform] || 1.0;

    // Precision multipliers
    const precisionMultipliers: Record<string, number> = {
      fp32: 1.0,
      fp16: 0.9,
      int8: 0.8,
      int4: 0.7,
      binary: 0.6
    };

    estimatedLatency *= precisionMultipliers[precision] || 1.0;

    // Batch size adjustment (diminishing returns)
    if (batchSize > 1) {
      estimatedLatency *= Math.max(0.5, 1 / Math.sqrt(batchSize));
    }

    // Device-specific adjustments
    if (this.deviceCapabilities.platform === 'mobile') {
      estimatedLatency *= 1.3; // Mobile devices are slower
    }

    if (this.deviceCapabilities.thermalStatus === 'hot') {
      estimatedLatency *= 1.5; // Thermal throttling
    }

    return Math.max(1, Math.floor(estimatedLatency));
  }

  /**
   * Estimate battery drain
   */
  private estimateBatteryDrain(model: ModelProfile, context: any): number {
    let drain = model.batteryImpact;

    // Context adjustments
    if (context.urgency === 'critical') {
      drain *= 1.2; // Critical tasks use more power
    }

    // Device adjustments
    if (this.deviceCapabilities.batteryLevel && this.deviceCapabilities.batteryLevel < 20) {
      drain *= 1.1; // Low battery increases relative drain
    }

    if (this.deviceCapabilities.thermalStatus === 'hot') {
      drain *= 1.3; // Thermal stress increases power consumption
    }

    return Math.max(0.01, drain);
  }

  /**
   * Calculate scheduling confidence
   */
  private calculateSchedulingConfidence(model: ModelProfile, context: any): number {
    let confidence = 0.8; // Base confidence

    // Historical performance
    const historicalConfidence = this.getHistoricalConfidence(model.id);
    confidence = (confidence + historicalConfidence) / 2;

    // Device compatibility
    if (this.isCompatibleWithDevice(model)) {
      confidence += 0.1;
    } else {
      confidence -= 0.2;
    }

    // Constraint satisfaction
    if (context.maxLatency && model.latency <= context.maxLatency) {
      confidence += 0.05;
    }

    if (context.accuracy && model.accuracy >= context.accuracy) {
      confidence += 0.05;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Check device compatibility
   */
  private isCompatibleWithDevice(model: ModelProfile): boolean {
    // Memory check
    if (model.memoryRequirement > this.optimizationConfig.maxMemoryUsage) {
      return false;
    }

    // Platform check
    if (model.platform === 'gpu' && !this.deviceCapabilities.hasGPU) {
      return false;
    }

    if (model.platform === 'npu' && !this.deviceCapabilities.hasNPU) {
      return false;
    }

    return true;
  }

  /**
   * Check if model can be quantized
   */
  private canQuantize(model: ModelProfile): boolean {
    // Only quantize certain model types
    return ['nlp', 'voice'].includes(model.type) &&
           ['fp32', 'fp16'].includes(model.precision);
  }

  /**
   * Get precision-specific multipliers
   */
  private getPrecisionMultiplier(precision: string): number {
    const multipliers: Record<string, number> = {
      fp32: 1.0,
      fp16: 0.7,
      int8: 0.5,
      int4: 0.3,
      binary: 0.2
    };
    return multipliers[precision] || 1.0;
  }

  private getPrecisionBatteryMultiplier(precision: string): number {
    const multipliers: Record<string, number> = {
      fp32: 1.0,
      fp16: 0.8,
      int8: 0.6,
      int4: 0.4,
      binary: 0.3
    };
    return multipliers[precision] || 1.0;
  }

  private getPrecisionLatencyMultiplier(precision: string): number {
    const multipliers: Record<string, number> = {
      fp32: 1.0,
      fp16: 0.95,
      int8: 0.9,
      int4: 0.85,
      binary: 0.8
    };
    return multipliers[precision] || 1.0;
  }

  private getPrecisionAccuracyMultiplier(precision: string): number {
    const multipliers: Record<string, number> = {
      fp32: 1.0,
      fp16: 0.98,
      int8: 0.95,
      int4: 0.9,
      binary: 0.8
    };
    return multipliers[precision] || 1.0;
  }

  /**
   * Estimate quantized model size
   */
  private estimateQuantizedSize(model: ModelProfile, precision: string): number {
    const compressionRatios: Record<string, number> = {
      fp32: 1.0,
      fp16: 0.5,
      int8: 0.25,
      int4: 0.125,
      binary: 0.0625
    };

    return Math.floor(model.size * (compressionRatios[precision] || 1.0));
  }

  /**
   * Validate optimization results
   */
  private validateOptimization(
    model: ModelProfile,
    constraints: any
  ): { valid: boolean; reason?: string; improvements?: any } {
    const improvements = {
      sizeReduction: 0,
      memoryReduction: 0,
      batteryReduction: 0,
      latencyReduction: 0
    };

    const originalModel = this.modelProfiles.get(model.id.replace(/-optimized-\d+$/, ''));
    if (originalModel) {
      improvements.sizeReduction = ((originalModel.size - model.size) / originalModel.size) * 100;
      improvements.memoryReduction = ((originalModel.memoryRequirement - model.memoryRequirement) / originalModel.memoryRequirement) * 100;
      improvements.batteryReduction = ((originalModel.batteryImpact - model.batteryImpact) / originalModel.batteryImpact) * 100;
      improvements.latencyReduction = ((originalModel.latency - model.latency) / originalModel.latency) * 100;
    }

    // Check constraints
    if (constraints.maxMemory && model.memoryRequirement > constraints.maxMemory) {
      return { valid: false, reason: 'Memory constraint not satisfied' };
    }

    if (constraints.maxLatency && model.latency > constraints.maxLatency) {
      return { valid: false, reason: 'Latency constraint not satisfied' };
    }

    if (constraints.accuracyThreshold && model.accuracy < constraints.accuracyThreshold) {
      return { valid: false, reason: 'Accuracy constraint not satisfied' };
    }

    return { valid: true, improvements };
  }

  /**
   * Performance monitoring methods
   */
  private recordPerformanceMetric(
    operation: string,
    value: number,
    metadata: any = {}
  ): void {
    if (!this.performanceHistory.has(operation)) {
      this.performanceHistory.set(operation, []);
    }

    const metrics = this.performanceHistory.get(operation)!;
    metrics.push({
      timestamp: Date.now(),
      value,
      metadata
    });

    // Keep only recent metrics (last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentMetrics = metrics.filter(m => m.timestamp > oneHourAgo);
    this.performanceHistory.set(operation, recentMetrics);
  }

  private getRecentPerformanceMetrics(timeRange: number): PerformanceMetrics[] {
    const allMetrics: PerformanceMetrics[] = [];
    const since = Date.now() - timeRange;

    for (const metrics of this.performanceHistory.values()) {
      allMetrics.push(...metrics.filter(m => m.timestamp > since));
    }

    return allMetrics;
  }

  private detectPerformanceDegradation(metrics: PerformanceMetrics[]): any {
    if (metrics.length < 10) return { detected: false };

    // Simple degradation detection - if average latency increased by 50%
    const latencies = metrics.map(m => m.value);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    const recentLatencies = latencies.slice(-5);
    const recentAvg = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;

    const degradation = recentAvg > avgLatency * 1.5;

    return {
      detected: degradation,
      avgLatency,
      recentAvg,
      degradationRatio: recentAvg / avgLatency
    };
  }

  private async adaptSchedulingStrategy(degradation: any): Promise<void> {
    // Increase battery/latency priorities when performance degrades
    if (degradation.degradationRatio > 1.5) {
      this.optimizationConfig.prioritizeSpeed = true;
      this.optimizationConfig.prioritizeBattery = true;
      this.optimizationConfig.prioritizeAccuracy = false;

      this.logger.info('Adapted scheduling strategy for performance degradation', {
        newPriorities: {
          speed: true,
          battery: true,
          accuracy: false
        }
      });
    }
  }

  private async updateDeviceCapabilities(): Promise<void> {
    // Update battery level and thermal status from system
    try {
      // This would integrate with device APIs in real implementation
      // For now, simulate occasional updates
      if (Math.random() < 0.1) { // 10% chance of update
        this.deviceCapabilities.batteryLevel = Math.max(5, this.deviceCapabilities.batteryLevel! - Math.random() * 5);
      }
    } catch (error) {
      this.logger.debug('Device capability update failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private getHistoricalPerformanceScore(modelId: string): number {
    const metrics = this.performanceHistory.get(modelId) || [];
    if (metrics.length === 0) return 0;

    // Simple scoring based on recent performance
    const recentMetrics = metrics.slice(-10);
    const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;

    // Lower values are better (latency, etc.)
    return Math.max(0, 10 - avgValue / 10);
  }

  private getHistoricalConfidence(modelId: string): number {
    const metrics = this.performanceHistory.get(modelId) || [];
    if (metrics.length < 5) return 0.5;

    // Calculate variance - lower variance = higher confidence
    const values = metrics.map(m => m.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Convert to confidence score (0-1)
    return Math.max(0.1, Math.min(1.0, 1 - (stdDev / avg)));
  }

  /**
   * Public API methods
   */
  getActiveModels(): Map<string, ScheduleDecision> {
    return new Map(this.activeModels);
  }

  getModelProfiles(): ModelProfile[] {
    return Array.from(this.modelProfiles.values());
  }

  getDeviceCapabilities(): DeviceCapabilities {
    return { ...this.deviceCapabilities };
  }

  getOptimizationConfig(): OptimizationConfig {
    return { ...this.optimizationConfig };
  }

  updateOptimizationConfig(config: Partial<OptimizationConfig>): void {
    this.optimizationConfig = { ...this.optimizationConfig, ...config };
    this.logger.info('Optimization config updated', config);
  }

  getPerformanceStats(): any {
    const stats: any = {};

    for (const [operation, metrics] of this.performanceHistory.entries()) {
      if (metrics.length > 0) {
        const values = metrics.map(m => m.value);
        stats[operation] = {
          count: metrics.length,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: values[values.length - 1]
        };
      }
    }

    return stats;
  }
}

interface PerformanceMetrics {
  timestamp: number;
  value: number;
  metadata: any;
}