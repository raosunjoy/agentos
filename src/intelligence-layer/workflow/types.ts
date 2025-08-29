/**
 * Core types for the AgentOS Workflow Orchestrator
 * Supports declarative workflow definitions with parallel/sequential execution
 */

export interface WorkflowStep {
  stepId: string;
  name: string;
  type: 'service_call' | 'condition' | 'parallel' | 'sequential' | 'user_input';
  service?: string;
  parameters?: Record<string, any>;
  dependencies?: string[];
  rollbackAction?: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  exponential: boolean;
}

export interface WorkflowDefinition {
  workflowId: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  permissions: string[];
  timeout: number;
  rollbackStrategy: 'full' | 'partial' | 'none';
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  stepResults: Record<string, any>;
  error?: WorkflowError;
  progress: WorkflowProgress;
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back'
}

export interface WorkflowProgress {
  totalSteps: number;
  completedSteps: number;
  currentStepName: string;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}

export interface WorkflowError {
  stepId: string;
  errorCode: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

export interface StepExecutionContext {
  stepId: string;
  workflowId: string;
  executionId: string;
  parameters: Record<string, any>;
  previousResults: Record<string, any>;
  userContext: any;
}

export interface StepExecutionResult {
  success: boolean;
  result?: any;
  error?: WorkflowError;
  rollbackData?: any;
}

export interface WorkflowEventListener {
  onWorkflowStarted?(execution: WorkflowExecution): void;
  onStepStarted?(stepId: string, execution: WorkflowExecution): void;
  onStepCompleted?(stepId: string, result: any, execution: WorkflowExecution): void;
  onStepFailed?(stepId: string, error: WorkflowError, execution: WorkflowExecution): void;
  onWorkflowCompleted?(execution: WorkflowExecution): void;
  onWorkflowFailed?(execution: WorkflowExecution): void;
  onProgressUpdate?(progress: WorkflowProgress, execution: WorkflowExecution): void;
}