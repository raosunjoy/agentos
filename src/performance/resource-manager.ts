/**
 * Dynamic Resource Allocation and Scaling System
 * Manages system resources efficiently for mid-range hardware
 */

import { 
  ResourceMetrics, 
  ResourceAllocation, 
  PerformanceConstraints,
  PerformanceMode,
  ThermalState 
} from './types';

export interface ResourceRequest {
  id: string;
  priority: number;
  estimatedDuration: number; // ms
  requiredResources: ResourceAllocation;
  canDegrade: boolean;
}

export interface ResourceGrant {
  requestId: string;
  allocatedResources: ResourceAllocation;
  expirationTime: number;
  degradationLevel: number;
}

export class ResourceManager {
  private currentMetrics: ResourceMetrics;
  private activeAllocations: Map<string, ResourceGrant> = new Map();
  private pendingRequests: ResourceRequest[] = [];
  private performanceMode: PerformanceMode = PerformanceMode.ADAPTIVE;
  private constraints: PerformanceConstraints;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(initialConstraints: PerformanceConstraints) {
    this.constraints = initialConstraints;
    this.currentMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      batteryLevel: 100,
      thermalState: ThermalState.NORMAL,
      networkLatency: 50
    };
    this.startResourceMonitoring();
  }

  /**
   * Request resource allocation
   */
  async requestResources(request: ResourceRequest): Promise<ResourceGrant | null> {
    // Check if resources are immediately available
    if (this.canAllocateImmediately(request)) {
      return this.allocateResources(request);
    }

    // Add to pending queue if not immediately available
    this.pendingRequests.push(request);
    this.pendingRequests.sort((a, b) => b.priority - a.priority);

    // Try to free up resources
    await this.optimizeAllocations();

    // Retry allocation
    if (this.canAllocateImmediately(request)) {
      this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
      return this.allocateResources(request);
    }

    return null;
  }

  /**
   * Release allocated resources
   */
  releaseResources(requestId: string): void {
    const allocation = this.activeAllocations.get(requestId);
    if (allocation) {
      this.activeAllocations.delete(requestId);
      this.processPendingRequests();
    }
  }

  /**
   * Update performance mode and constraints
   */
  updatePerformanceMode(mode: PerformanceMode, constraints?: PerformanceConstraints): void {
    this.performanceMode = mode;
    if (constraints) {
      this.constraints = constraints;
    }
    this.rebalanceAllocations();
  }

  /**
   * Get current resource utilization
   */
  getResourceUtilization(): ResourceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Check if resources can be allocated immediately
   */
  private canAllocateImmediately(request: ResourceRequest): boolean {
    const totalCpuUsage = this.getTotalCpuUsage() + (request.requiredResources.cpuCores * 25);
    const totalMemoryUsage = this.getTotalMemoryUsage() + request.requiredResources.memoryLimit;

    // In power save mode, be more restrictive
    const cpuLimit = this.performanceMode === PerformanceMode.POWER_SAVE ? 
      this.constraints.maxCpuUsage * 0.6 : this.constraints.maxCpuUsage;
    const memoryLimit = this.performanceMode === PerformanceMode.POWER_SAVE ? 
      this.constraints.maxMemoryUsage * 0.7 : this.constraints.maxMemoryUsage;

    return (
      totalCpuUsage <= cpuLimit &&
      totalMemoryUsage <= memoryLimit &&
      this.currentMetrics.thermalState !== ThermalState.CRITICAL
    );
  }

  /**
   * Allocate resources for a request
   */
  private allocateResources(request: ResourceRequest): ResourceGrant {
    const grant: ResourceGrant = {
      requestId: request.id,
      allocatedResources: { ...request.requiredResources },
      expirationTime: Date.now() + request.estimatedDuration,
      degradationLevel: 0
    };

    // Apply degradation if necessary
    if (this.shouldApplyDegradation()) {
      grant.degradationLevel = this.calculateDegradationLevel();
      grant.allocatedResources = this.applyResourceDegradation(
        request.requiredResources,
        grant.degradationLevel
      );
    }

    this.activeAllocations.set(request.id, grant);
    return grant;
  }

  /**
   * Optimize current allocations to free up resources
   */
  private async optimizeAllocations(): Promise<void> {
    // Remove expired allocations
    const now = Date.now();
    for (const [id, grant] of this.activeAllocations.entries()) {
      if (grant.expirationTime < now) {
        this.activeAllocations.delete(id);
      }
    }

    // Apply degradation to low-priority allocations if needed
    if (this.isResourceConstrained()) {
      const sortedAllocations = Array.from(this.activeAllocations.entries())
        .sort(([, a], [, b]) => a.degradationLevel - b.degradationLevel);

      for (const [id, grant] of sortedAllocations) {
        if (grant.degradationLevel < 3) {
          grant.degradationLevel++;
          grant.allocatedResources = this.applyResourceDegradation(
            grant.allocatedResources,
            grant.degradationLevel
          );
        }
      }
    }
  }

  /**
   * Process pending resource requests
   */
  private processPendingRequests(): void {
    const processableRequests = this.pendingRequests.filter(request => 
      this.canAllocateImmediately(request)
    );

    for (const request of processableRequests) {
      this.allocateResources(request);
      this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
    }
  }

  /**
   * Rebalance allocations based on new performance mode
   */
  private rebalanceAllocations(): void {
    const modeMultipliers = {
      [PerformanceMode.POWER_SAVE]: 0.6,
      [PerformanceMode.BALANCED]: 0.8,
      [PerformanceMode.PERFORMANCE]: 1.2,
      [PerformanceMode.ADAPTIVE]: this.getAdaptiveMultiplier()
    };

    const multiplier = modeMultipliers[this.performanceMode];

    for (const grant of this.activeAllocations.values()) {
      grant.allocatedResources.cpuCores = Math.max(1, 
        Math.floor(grant.allocatedResources.cpuCores * multiplier)
      );
      grant.allocatedResources.memoryLimit = Math.floor(
        grant.allocatedResources.memoryLimit * multiplier
      );
    }
  }

  /**
   * Get adaptive multiplier based on current system state
   */
  private getAdaptiveMultiplier(): number {
    let multiplier = 1.0;

    // Adjust based on battery level
    if (this.currentMetrics.batteryLevel < 20) {
      multiplier *= 0.6;
    } else if (this.currentMetrics.batteryLevel < 50) {
      multiplier *= 0.8;
    }

    // Adjust based on thermal state
    switch (this.currentMetrics.thermalState) {
      case ThermalState.HOT:
        multiplier *= 0.7;
        break;
      case ThermalState.CRITICAL:
        multiplier *= 0.5;
        break;
    }

    // Adjust based on CPU usage
    if (this.currentMetrics.cpuUsage > 80) {
      multiplier *= 0.8;
    }

    return Math.max(0.5, Math.min(1.5, multiplier));
  }

  /**
   * Check if system is resource constrained
   */
  private isResourceConstrained(): boolean {
    return (
      this.currentMetrics.cpuUsage > this.constraints.maxCpuUsage * 0.8 ||
      this.currentMetrics.memoryUsage > this.constraints.maxMemoryUsage * 0.8 ||
      this.currentMetrics.thermalState === ThermalState.HOT ||
      this.currentMetrics.batteryLevel < 30
    );
  }

  /**
   * Determine if degradation should be applied
   */
  private shouldApplyDegradation(): boolean {
    return (
      this.isResourceConstrained() ||
      this.performanceMode === PerformanceMode.POWER_SAVE
    );
  }

  /**
   * Calculate appropriate degradation level
   */
  private calculateDegradationLevel(): number {
    let level = 0;

    if (this.currentMetrics.cpuUsage > 70) level++;
    if (this.currentMetrics.memoryUsage > this.constraints.maxMemoryUsage * 0.7) level++;
    if (this.currentMetrics.batteryLevel < 30) level++;
    if (this.currentMetrics.thermalState === ThermalState.HOT) level += 2;
    if (this.currentMetrics.thermalState === ThermalState.CRITICAL) level += 3;

    return Math.min(5, level);
  }

  /**
   * Apply resource degradation based on level
   */
  private applyResourceDegradation(
    resources: ResourceAllocation,
    degradationLevel: number
  ): ResourceAllocation {
    const degradationFactor = Math.max(0.3, 1 - (degradationLevel * 0.15));

    return {
      cpuCores: Math.max(1, Math.floor(resources.cpuCores * degradationFactor)),
      memoryLimit: Math.floor(resources.memoryLimit * degradationFactor),
      gpuMemory: resources.gpuMemory ? 
        Math.floor(resources.gpuMemory * degradationFactor) : undefined,
      priority: resources.priority
    };
  }

  /**
   * Get total CPU usage from active allocations
   */
  private getTotalCpuUsage(): number {
    let total = this.currentMetrics.cpuUsage;
    for (const grant of this.activeAllocations.values()) {
      total += grant.allocatedResources.cpuCores * 25; // Rough estimate
    }
    return total;
  }

  /**
   * Get total memory usage from active allocations
   */
  private getTotalMemoryUsage(): number {
    let total = this.currentMetrics.memoryUsage;
    for (const grant of this.activeAllocations.values()) {
      total += grant.allocatedResources.memoryLimit;
    }
    return total;
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateResourceMetrics();
      this.cleanupExpiredAllocations();
    }, 1000);
  }

  /**
   * Update current resource metrics
   */
  private updateResourceMetrics(): void {
    // Simulate resource monitoring
    // In real implementation, this would query system APIs
    this.currentMetrics = {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 8 * 1024 * 1024 * 1024, // 8GB max
      batteryLevel: Math.max(0, this.currentMetrics.batteryLevel - 0.01),
      thermalState: this.simulateThermalState(),
      networkLatency: 50 + Math.random() * 100
    };
  }

  /**
   * Simulate thermal state based on CPU usage
   */
  private simulateThermalState(): ThermalState {
    if (this.currentMetrics.cpuUsage > 90) return ThermalState.CRITICAL;
    if (this.currentMetrics.cpuUsage > 75) return ThermalState.HOT;
    if (this.currentMetrics.cpuUsage > 50) return ThermalState.WARM;
    return ThermalState.NORMAL;
  }

  /**
   * Clean up expired allocations
   */
  private cleanupExpiredAllocations(): void {
    const now = Date.now();
    for (const [id, grant] of this.activeAllocations.entries()) {
      if (grant.expirationTime < now) {
        this.activeAllocations.delete(id);
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
    this.activeAllocations.clear();
    this.pendingRequests = [];
  }
}