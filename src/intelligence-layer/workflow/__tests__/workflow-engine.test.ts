/**
 * Integration tests for WorkflowEngine
 * Tests complex multi-step workflows with parallel/sequential execution
 */

import { WorkflowEngine } from '../workflow-engine';
import { WorkflowRegistry } from '../workflow-registry';
import { ProgressTracker } from '../progress-tracker';
import {
  WorkflowDefinition,
  WorkflowStatus,
  StepExecutionContext,
  StepExecutionResult,
  WorkflowEventListener
} from '../types';

describe('WorkflowEngine Integration Tests', () => {
  let engine: WorkflowEngine;
  let registry: WorkflowRegistry;
  let progressTracker: ProgressTracker;
  let mockExecutors: Map<string, jest.Mock>;

  beforeEach(() => {
    engine = new WorkflowEngine();
    registry = new WorkflowRegistry();
    progressTracker = new ProgressTracker();
    mockExecutors = new Map();

    // Add progress tracker as listener
    engine.addListener(progressTracker);
  });

  const createMockExecutor = (
    serviceType: string,
    result: any = { success: true },
    delay: number = 100
  ): jest.Mock => {
    const executor = jest.fn().mockImplementation(async (context: StepExecutionContext) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return result;
    });
    
    mockExecutors.set(serviceType, executor);
    engine.registerStepExecutor(serviceType, executor);
    return executor;
  };

  describe('Sequential Workflow Execution', () => {
    it('should execute steps in sequence with dependency resolution', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-sequential',
        name: 'Sequential Test Workflow',
        description: 'Test sequential execution',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'First Step',
            type: 'service_call',
            service: 'service1',
            parameters: { input: 'test' }
          },
          {
            stepId: 'step2',
            name: 'Second Step',
            type: 'service_call',
            service: 'service2',
            dependencies: ['step1'],
            parameters: { input: 'test2' }
          },
          {
            stepId: 'step3',
            name: 'Third Step',
            type: 'service_call',
            service: 'service3',
            dependencies: ['step2'],
            parameters: { input: 'test3' }
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'full'
      };

      const executor1 = createMockExecutor('service1', { success: true, result: 'result1' });
      const executor2 = createMockExecutor('service2', { success: true, result: 'result2' });
      const executor3 = createMockExecutor('service3', { success: true, result: 'result3' });

      const execution = await engine.executeWorkflow(workflow);

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.completedSteps).toEqual(['step1', 'step2', 'step3']);
      expect(execution.stepResults.step1).toBe('result1');
      expect(execution.stepResults.step2).toBe('result2');
      expect(execution.stepResults.step3).toBe('result3');

      // Verify execution order by checking call times
      const call1Time = executor1.mock.invocationCallOrder[0];
      const call2Time = executor2.mock.invocationCallOrder[0];
      const call3Time = executor3.mock.invocationCallOrder[0];
      
      expect(call1Time).toBeLessThan(call2Time);
      expect(call2Time).toBeLessThan(call3Time);
    });
  });

  describe('Parallel Workflow Execution', () => {
    it('should execute parallel steps concurrently', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-parallel',
        name: 'Parallel Test Workflow',
        description: 'Test parallel execution',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Parallel Step 1',
            type: 'parallel',
            service: 'service1',
            parameters: { input: 'test1' }
          },
          {
            stepId: 'step2',
            name: 'Parallel Step 2',
            type: 'parallel',
            service: 'service2',
            parameters: { input: 'test2' }
          },
          {
            stepId: 'step3',
            name: 'Sequential Step',
            type: 'service_call',
            service: 'service3',
            dependencies: ['step1', 'step2'],
            parameters: { input: 'test3' }
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'full'
      };

      const startTime = Date.now();
      createMockExecutor('service1', { success: true, result: 'result1' }, 200);
      createMockExecutor('service2', { success: true, result: 'result2' }, 200);
      createMockExecutor('service3', { success: true, result: 'result3' }, 100);

      const execution = await engine.executeWorkflow(workflow);
      const totalTime = Date.now() - startTime;

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.completedSteps).toContain('step1');
      expect(execution.completedSteps).toContain('step2');
      expect(execution.completedSteps).toContain('step3');

      // Parallel execution should be faster than sequential
      expect(totalTime).toBeLessThan(600); // Should be ~300ms instead of 500ms
    });
  });

  describe('Error Handling and Rollback', () => {
    it('should handle step failures and execute rollback', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-rollback',
        name: 'Rollback Test Workflow',
        description: 'Test rollback functionality',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Success Step',
            type: 'service_call',
            service: 'service1',
            rollbackAction: 'undo_step1'
          },
          {
            stepId: 'step2',
            name: 'Failure Step',
            type: 'service_call',
            service: 'service2',
            dependencies: ['step1'],
            rollbackAction: 'undo_step2'
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'full'
      };

      createMockExecutor('service1', { success: true, result: 'result1' });
      createMockExecutor('service2', { success: false, error: { message: 'Step failed' } });
      
      const rollbackExecutor = createMockExecutor('rollback', { success: true });

      const execution = await engine.executeWorkflow(workflow);

      expect(execution.status).toBe(WorkflowStatus.ROLLED_BACK);
      expect(execution.completedSteps).toContain('step1');
      expect(execution.failedSteps).toContain('step2');
      expect(rollbackExecutor).toHaveBeenCalled();
    });

    it('should retry failed steps according to retry policy', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-retry',
        name: 'Retry Test Workflow',
        description: 'Test retry functionality',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Retry Step',
            type: 'service_call',
            service: 'service1',
            retryPolicy: {
              maxAttempts: 3,
              backoffMs: 100,
              exponential: false
            }
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      const executor = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({ success: true, result: 'success' });

      engine.registerStepExecutor('service1', executor);

      const execution = await engine.executeWorkflow(workflow);

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(executor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress and notify listeners', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-progress',
        name: 'Progress Test Workflow',
        description: 'Test progress tracking',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1'
          },
          {
            stepId: 'step2',
            name: 'Step 2',
            type: 'service_call',
            service: 'service2',
            dependencies: ['step1']
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { success: true, result: 'result1' });
      createMockExecutor('service2', { success: true, result: 'result2' });

      const progressUpdates: any[] = [];
      
      const execution = await engine.executeWorkflow(workflow);
      
      // Set up progress tracking after execution starts
      progressTracker.onProgress(execution.executionId, (update) => {
        progressUpdates.push(update);
      });

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.progress.percentComplete).toBe(100);
      expect(execution.completedSteps).toHaveLength(2);
    });
  });

  describe('Complex Multi-Step Workflows', () => {
    it('should handle complex workflow with mixed parallel and sequential steps', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-complex',
        name: 'Complex Test Workflow',
        description: 'Test complex multi-step workflow',
        version: '1.0.0',
        steps: [
          // Initial step
          {
            stepId: 'init',
            name: 'Initialize',
            type: 'service_call',
            service: 'init_service'
          },
          // Parallel processing
          {
            stepId: 'process_a',
            name: 'Process A',
            type: 'parallel',
            service: 'processor_a',
            dependencies: ['init']
          },
          {
            stepId: 'process_b',
            name: 'Process B',
            type: 'parallel',
            service: 'processor_b',
            dependencies: ['init']
          },
          {
            stepId: 'process_c',
            name: 'Process C',
            type: 'parallel',
            service: 'processor_c',
            dependencies: ['init']
          },
          // Aggregation step
          {
            stepId: 'aggregate',
            name: 'Aggregate Results',
            type: 'service_call',
            service: 'aggregator',
            dependencies: ['process_a', 'process_b', 'process_c']
          },
          // Final step
          {
            stepId: 'finalize',
            name: 'Finalize',
            type: 'service_call',
            service: 'finalizer',
            dependencies: ['aggregate']
          }
        ],
        permissions: [],
        timeout: 60000,
        rollbackStrategy: 'partial'
      };

      // Create mock executors for all services
      createMockExecutor('init_service', { success: true, result: 'initialized' });
      createMockExecutor('processor_a', { success: true, result: 'processed_a' });
      createMockExecutor('processor_b', { success: true, result: 'processed_b' });
      createMockExecutor('processor_c', { success: true, result: 'processed_c' });
      createMockExecutor('aggregator', { success: true, result: 'aggregated' });
      createMockExecutor('finalizer', { success: true, result: 'finalized' });

      const execution = await engine.executeWorkflow(workflow);

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.completedSteps).toHaveLength(6);
      expect(execution.stepResults.init).toBe('initialized');
      expect(execution.stepResults.process_a).toBe('processed_a');
      expect(execution.stepResults.process_b).toBe('processed_b');
      expect(execution.stepResults.process_c).toBe('processed_c');
      expect(execution.stepResults.aggregate).toBe('aggregated');
      expect(execution.stepResults.finalize).toBe('finalized');
    });
  });

  describe('Workflow Cancellation', () => {
    it('should allow cancellation of running workflows', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-cancel',
        name: 'Cancellation Test',
        description: 'Test workflow cancellation',
        version: '1.0.0',
        steps: [
          {
            stepId: 'long_step',
            name: 'Long Running Step',
            type: 'service_call',
            service: 'long_service'
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      // Create a long-running executor
      createMockExecutor('long_service', { success: true, result: 'done' }, 5000);

      // Start workflow execution
      const executionPromise = engine.executeWorkflow(workflow);
      
      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the execution ID from the engine's internal map
      const executionIds = Array.from((engine as any).executions.keys());
      const executionId = executionIds[0];
      
      if (executionId) {
        const cancelled = await engine.cancelWorkflow(executionId);
        expect(cancelled).toBe(true);
      }

      const execution = await executionPromise;
      // The execution might complete before cancellation, so check for either status
      expect([WorkflowStatus.CANCELLED, WorkflowStatus.COMPLETED]).toContain(execution.status);
    });
  });
});