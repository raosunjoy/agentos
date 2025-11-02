/**
 * RGPx Integration for Workflow Orchestrator
 * 
 * Tracks workflow entropy and flux for coherence monitoring
 * Integrates with CoherenceMonitor for Φ-invariant calculation
 */

import { WorkflowExecution, WorkflowStatus } from './types';
import { CoherenceMonitor, WorkflowEntropy, WorkflowFlux } from '../rgpx';

export class RGPxWorkflowIntegration {
  private coherenceMonitor: CoherenceMonitor;
  private enabled: boolean = true;

  constructor(coherenceMonitor?: CoherenceMonitor) {
    this.coherenceMonitor = coherenceMonitor || new CoherenceMonitor();
  }

  /**
   * Enable or disable RGPx tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Record workflow execution metrics for RGPx
   */
  async recordWorkflowMetrics(execution: WorkflowExecution): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const workflowId = execution.workflowId;
    const startTime = execution.startTime.getTime();
    const endTime = execution.endTime?.getTime() || Date.now();
    const duration = endTime - startTime;

    // Calculate entropy (compute waste)
    const entropy = this.calculateWorkflowEntropy(execution, duration);
    this.coherenceMonitor.recordEntropy(entropy);

    // Calculate flux (useful output)
    const flux = this.calculateWorkflowFlux(execution);
    this.coherenceMonitor.recordFlux(flux);
  }

  /**
   * Calculate workflow entropy (compute waste)
   */
  private calculateWorkflowEntropy(
    execution: WorkflowExecution,
    duration: number
  ): WorkflowEntropy {
    const failedSteps = execution.failedSteps.length;
    const totalSteps = execution.progress.totalSteps;
    const failureRate = failedSteps / totalSteps;

    // Compute waste estimation
    // Failed steps = wasted compute cycles
    const computeWaste = failedSteps * 1000000; // Estimated CPU cycles per failed step
    
    // Memory waste from failed operations
    const memoryWaste = failedSteps * 1024 * 10; // 10KB per failed step estimate
    
    // Time waste (time spent on failed operations)
    const timeWaste = duration * failureRate;

    // Total entropy (weighted combination)
    const totalEntropy = (computeWaste * 0.5) + (memoryWaste * 0.3) + (timeWaste * 0.2);

    return {
      workflowId: execution.workflowId,
      computeWaste,
      memoryWaste,
      timeWaste,
      totalEntropy
    };
  }

  /**
   * Calculate workflow flux (useful output)
   */
  private calculateWorkflowFlux(execution: WorkflowExecution): WorkflowFlux {
    const successfulSteps = execution.completedSteps.length;
    const totalSteps = execution.progress.totalSteps;
    const successRate = successfulSteps / totalSteps;

    // User value: success rate weighted by completion
    // More successful steps = higher user value
    const userValue = successRate * (execution.status === WorkflowStatus.COMPLETED ? 1.0 : 0.5);

    // Total flux (successful steps + user value)
    const totalFlux = successfulSteps * 1000 + (userValue * 10000);

    return {
      workflowId: execution.workflowId,
      successfulSteps,
      userValue,
      totalFlux
    };
  }

  /**
   * Get current coherence metrics
   */
  getCoherenceMetrics() {
    return this.coherenceMonitor.getCurrentMetrics();
  }

  /**
   * Get Φ-invariant value
   */
  getPhiInvariant() {
    return this.coherenceMonitor.calculatePhiInvariant();
  }

  /**
   * Detect coherence plateau
   */
  detectPlateau() {
    return this.coherenceMonitor.detectPlateau();
  }

  /**
   * Get coherence monitor instance (for advanced usage)
   */
  getCoherenceMonitor(): CoherenceMonitor {
    return this.coherenceMonitor;
  }
}

