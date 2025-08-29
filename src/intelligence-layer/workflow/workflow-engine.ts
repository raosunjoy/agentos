/**
 * Core Workflow Execution Engine for AgentOS
 * Handles declarative workflow execution with parallel/sequential support
 */

import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  WorkflowStatus,
  WorkflowError,
  WorkflowProgress,
  StepExecutionContext,
  StepExecutionResult,
  WorkflowEventListener
} from './types';

export class WorkflowEngine {
  private executions = new Map<string, WorkflowExecution>();
  private listeners: WorkflowEventListener[] = [];
  private stepExecutors = new Map<string, (context: StepExecutionContext) => Promise<StepExecutionResult>>();

  /**
   * Register a step executor for a specific service type
   */
  registerStepExecutor(
    serviceType: string,
    executor: (context: StepExecutionContext) => Promise<StepExecutionResult>
  ): void {
    this.stepExecutors.set(serviceType, executor);
  }

  /**
   * Add event listener for workflow events
   */
  addListener(listener: WorkflowEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Execute a workflow definition
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    initialParameters: Record<string, any> = {},
    userContext: any = {}
  ): Promise<WorkflowExecution> {
    const executionId = this.generateExecutionId();
    
    const execution: WorkflowExecution = {
      executionId,
      workflowId: workflow.workflowId,
      status: WorkflowStatus.PENDING,
      startTime: new Date(),
      completedSteps: [],
      failedSteps: [],
      stepResults: { ...initialParameters },
      progress: {
        totalSteps: workflow.steps.length,
        completedSteps: 0,
        currentStepName: '',
        percentComplete: 0
      }
    };

    this.executions.set(executionId, execution);
    this.notifyListeners('onWorkflowStarted', execution);

    try {
      execution.status = WorkflowStatus.RUNNING;
      await this.executeSteps(workflow, execution, userContext);
      
      execution.status = WorkflowStatus.COMPLETED;
      execution.endTime = new Date();
      this.notifyListeners('onWorkflowCompleted', execution);
      
    } catch (error) {
      execution.status = WorkflowStatus.FAILED;
      execution.endTime = new Date();
      execution.error = this.createWorkflowError(error);
      
      this.notifyListeners('onWorkflowFailed', execution);
      
      // Attempt rollback if configured
      if (workflow.rollbackStrategy !== 'none') {
        await this.rollbackWorkflow(workflow, execution);
      }
    }

    return execution;
  }

  /**
   * Execute workflow steps with dependency resolution
   */
  private async executeSteps(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    userContext: any
  ): Promise<void> {
    const stepMap = new Map(workflow.steps.map(step => [step.stepId, step]));
    const executedSteps = new Set<string>();
    const pendingSteps = new Set(workflow.steps.map(s => s.stepId));

    while (pendingSteps.size > 0) {
      // Find steps that can be executed (all dependencies met)
      const readySteps = Array.from(pendingSteps).filter(stepId => {
        const step = stepMap.get(stepId)!;
        return !step.dependencies || step.dependencies.every(dep => executedSteps.has(dep));
      });

      if (readySteps.length === 0) {
        throw new Error('Circular dependency detected in workflow steps');
      }

      // Group steps by execution type
      const parallelSteps: string[] = [];
      const sequentialSteps: string[] = [];

      for (const stepId of readySteps) {
        const step = stepMap.get(stepId)!;
        if (step.type === 'parallel') {
          parallelSteps.push(stepId);
        } else {
          sequentialSteps.push(stepId);
        }
      }

      // Execute parallel steps concurrently
      if (parallelSteps.length > 0) {
        await Promise.all(
          parallelSteps.map(stepId => 
            this.executeStep(stepMap.get(stepId)!, execution, userContext)
          )
        );
        
        parallelSteps.forEach(stepId => {
          executedSteps.add(stepId);
          pendingSteps.delete(stepId);
        });
      }

      // Execute sequential steps one by one
      for (const stepId of sequentialSteps) {
        await this.executeStep(stepMap.get(stepId)!, execution, userContext);
        executedSteps.add(stepId);
        pendingSteps.delete(stepId);
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    userContext: any
  ): Promise<void> {
    execution.currentStep = step.stepId;
    execution.progress.currentStepName = step.name;
    
    this.notifyListeners('onStepStarted', step.stepId, execution);
    this.updateProgress(execution);

    const context: StepExecutionContext = {
      stepId: step.stepId,
      workflowId: execution.workflowId,
      executionId: execution.executionId,
      parameters: step.parameters || {},
      previousResults: execution.stepResults,
      userContext
    };

    try {
      const result = await this.executeStepWithRetry(step, context);
      
      if (result.success) {
        execution.completedSteps.push(step.stepId);
        execution.stepResults[step.stepId] = result.result;
        execution.progress.completedSteps++;
        
        this.notifyListeners('onStepCompleted', step.stepId, result.result, execution);
      } else {
        throw new Error(result.error?.message || 'Step execution failed');
      }
      
    } catch (error) {
      execution.failedSteps.push(step.stepId);
      const workflowError = this.createWorkflowError(error, step.stepId);
      execution.error = workflowError;
      
      this.notifyListeners('onStepFailed', step.stepId, workflowError, execution);
      throw error;
    }
  }

  /**
   * Execute step with retry policy
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    context: StepExecutionContext
  ): Promise<StepExecutionResult> {
    const retryPolicy = step.retryPolicy || { maxAttempts: 1, backoffMs: 1000, exponential: false };
    let lastError: any;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const executor = this.stepExecutors.get(step.service || step.type);
        if (!executor) {
          throw new Error(`No executor found for service: ${step.service || step.type}`);
        }

        const result = await this.executeWithTimeout(
          executor(context),
          step.timeout || 30000
        );

        if (result.success) {
          return result;
        }

        lastError = result.error;
        
      } catch (error) {
        lastError = error;
      }

      // Wait before retry (except on last attempt)
      if (attempt < retryPolicy.maxAttempts) {
        const delay = retryPolicy.exponential 
          ? retryPolicy.backoffMs * Math.pow(2, attempt - 1)
          : retryPolicy.backoffMs;
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: this.createWorkflowError(lastError, step.stepId)
    };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Step execution timeout')), timeoutMs)
      )
    ]);
  }

  /**
   * Rollback workflow execution
   */
  private async rollbackWorkflow(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<void> {
    execution.status = WorkflowStatus.ROLLING_BACK;
    
    // Execute rollback actions in reverse order
    const completedSteps = execution.completedSteps.reverse();
    
    for (const stepId of completedSteps) {
      const step = workflow.steps.find(s => s.stepId === stepId);
      if (step?.rollbackAction) {
        try {
          // Execute rollback action
          const rollbackExecutor = this.stepExecutors.get('rollback');
          if (rollbackExecutor) {
            await rollbackExecutor({
              stepId: `${stepId}_rollback`,
              workflowId: execution.workflowId,
              executionId: execution.executionId,
              parameters: { action: step.rollbackAction, originalResult: execution.stepResults[stepId] },
              previousResults: execution.stepResults,
              userContext: {}
            });
          }
        } catch (rollbackError) {
          console.error(`Rollback failed for step ${stepId}:`, rollbackError);
        }
      }
    }
    
    execution.status = WorkflowStatus.ROLLED_BACK;
  }

  /**
   * Update workflow progress
   */
  private updateProgress(execution: WorkflowExecution): void {
    execution.progress.percentComplete = 
      (execution.progress.completedSteps / execution.progress.totalSteps) * 100;
    
    this.notifyListeners('onProgressUpdate', execution.progress, execution);
  }

  /**
   * Create workflow error from exception
   */
  private createWorkflowError(error: any, stepId?: string): WorkflowError {
    return {
      stepId: stepId || 'unknown',
      errorCode: error.code || 'EXECUTION_ERROR',
      message: error.message || 'Unknown error occurred',
      details: error.details || error,
      recoverable: error.recoverable || false
    };
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(eventName: keyof WorkflowEventListener, ...args: any[]): void {
    this.listeners.forEach(listener => {
      const handler = listener[eventName] as Function;
      if (handler) {
        try {
          handler.apply(listener, args);
        } catch (error) {
          console.error(`Error in workflow listener ${eventName}:`, error);
        }
      }
    });
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== WorkflowStatus.RUNNING) {
      return false;
    }

    execution.status = WorkflowStatus.CANCELLED;
    execution.endTime = new Date();
    return true;
  }
}