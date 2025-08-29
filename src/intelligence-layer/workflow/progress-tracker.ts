/**
 * Progress Tracker for AgentOS Workflows
 * Provides real-time progress updates and user feedback
 */

import { WorkflowExecution, WorkflowProgress, WorkflowEventListener } from './types';

export interface ProgressUpdate {
  executionId: string;
  progress: WorkflowProgress;
  timestamp: Date;
  message?: string;
}

export interface UserFeedbackRequest {
  executionId: string;
  stepId: string;
  message: string;
  options?: string[];
  timeout?: number;
}

export interface UserFeedbackResponse {
  executionId: string;
  stepId: string;
  response: string;
  timestamp: Date;
}

export class ProgressTracker implements WorkflowEventListener {
  private progressCallbacks = new Map<string, (update: ProgressUpdate) => void>();
  private feedbackCallbacks = new Map<string, (request: UserFeedbackRequest) => Promise<UserFeedbackResponse>>();
  private executionProgress = new Map<string, WorkflowProgress>();

  /**
   * Register progress callback for an execution
   */
  onProgress(executionId: string, callback: (update: ProgressUpdate) => void): void {
    this.progressCallbacks.set(executionId, callback);
  }

  /**
   * Register user feedback callback
   */
  onFeedbackRequest(
    executionId: string, 
    callback: (request: UserFeedbackRequest) => Promise<UserFeedbackResponse>
  ): void {
    this.feedbackCallbacks.set(executionId, callback);
  }

  /**
   * Remove callbacks for execution
   */
  removeCallbacks(executionId: string): void {
    this.progressCallbacks.delete(executionId);
    this.feedbackCallbacks.delete(executionId);
    this.executionProgress.delete(executionId);
  }

  /**
   * Request user feedback during workflow execution
   */
  async requestUserFeedback(request: UserFeedbackRequest): Promise<UserFeedbackResponse> {
    const callback = this.feedbackCallbacks.get(request.executionId);
    if (!callback) {
      throw new Error(`No feedback callback registered for execution: ${request.executionId}`);
    }

    return callback(request);
  }

  /**
   * Get current progress for execution
   */
  getProgress(executionId: string): WorkflowProgress | undefined {
    return this.executionProgress.get(executionId);
  }

  // WorkflowEventListener implementation

  onWorkflowStarted(execution: WorkflowExecution): void {
    this.executionProgress.set(execution.executionId, execution.progress);
    this.notifyProgress(execution, 'Workflow started');
  }

  onStepStarted(stepId: string, execution: WorkflowExecution): void {
    this.executionProgress.set(execution.executionId, execution.progress);
    this.notifyProgress(execution, `Starting step: ${execution.progress.currentStepName}`);
  }

  onStepCompleted(stepId: string, result: any, execution: WorkflowExecution): void {
    this.executionProgress.set(execution.executionId, execution.progress);
    this.notifyProgress(execution, `Completed step: ${execution.progress.currentStepName}`);
  }

  onStepFailed(stepId: string, error: any, execution: WorkflowExecution): void {
    this.executionProgress.set(execution.executionId, execution.progress);
    this.notifyProgress(execution, `Step failed: ${error.message}`);
  }

  onWorkflowCompleted(execution: WorkflowExecution): void {
    execution.progress.percentComplete = 100;
    this.executionProgress.set(execution.executionId, execution.progress);
    this.notifyProgress(execution, 'Workflow completed successfully');
  }

  onWorkflowFailed(execution: WorkflowExecution): void {
    this.executionProgress.set(execution.executionId, execution.progress);
    this.notifyProgress(execution, `Workflow failed: ${execution.error?.message}`);
  }

  onProgressUpdate(progress: WorkflowProgress, execution: WorkflowExecution): void {
    this.executionProgress.set(execution.executionId, progress);
    this.notifyProgress(execution);
  }

  /**
   * Notify progress callback
   */
  private notifyProgress(execution: WorkflowExecution, message?: string): void {
    const callback = this.progressCallbacks.get(execution.executionId);
    if (callback) {
      const update: ProgressUpdate = {
        executionId: execution.executionId,
        progress: execution.progress,
        timestamp: new Date(),
        message
      };
      
      try {
        callback(update);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }

  /**
   * Calculate estimated time remaining
   */
  calculateEstimatedTime(execution: WorkflowExecution): number | undefined {
    if (execution.progress.completedSteps === 0) {
      return undefined;
    }

    const elapsed = Date.now() - execution.startTime.getTime();
    const avgTimePerStep = elapsed / execution.progress.completedSteps;
    const remainingSteps = execution.progress.totalSteps - execution.progress.completedSteps;
    
    return Math.round(avgTimePerStep * remainingSteps);
  }

  /**
   * Create progress summary
   */
  createProgressSummary(execution: WorkflowExecution): string {
    const { progress } = execution;
    const estimatedTime = this.calculateEstimatedTime(execution);
    
    let summary = `Progress: ${progress.completedSteps}/${progress.totalSteps} steps (${Math.round(progress.percentComplete)}%)`;
    
    if (progress.currentStepName) {
      summary += `\nCurrent: ${progress.currentStepName}`;
    }
    
    if (estimatedTime) {
      const minutes = Math.ceil(estimatedTime / 60000);
      summary += `\nEstimated time remaining: ${minutes} minute(s)`;
    }
    
    return summary;
  }
}