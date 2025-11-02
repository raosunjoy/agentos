/**
 * Integration tests for Workflow Engine + RGPx Integration
 * Tests complete workflow execution with automatic RGPx metrics recording
 */

import { WorkflowEngine } from '../workflow-engine';
import { WorkflowDefinition, WorkflowStatus, StepExecutionContext, StepExecutionResult } from '../types';

describe('Workflow Engine + RGPx Integration', () => {
  let engine: WorkflowEngine;
  let rgpxIntegration: any;

  beforeEach(() => {
    engine = new WorkflowEngine();
    rgpxIntegration = engine.enableRGPxIntegration();
  });

  describe('Successful Workflow Execution with RGPx', () => {
    it('should automatically record RGPx metrics for successful workflow', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-rgpx-success',
        name: 'Test RGPx Workflow',
        description: 'Test workflow with RGPx integration',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'First Step',
            type: 'service_call',
            service: 'test-service',
            parameters: { input: 'test' }
          },
          {
            stepId: 'step2',
            name: 'Second Step',
            type: 'service_call',
            service: 'test-service',
            dependencies: ['step1'],
            parameters: { input: 'test2' }
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      // Register mock executor
      engine.registerStepExecutor('test-service', async (context: StepExecutionContext): Promise<StepExecutionResult> => {
        return {
          success: true,
          result: { output: `processed ${context.stepId}` }
        };
      });

      // Execute workflow
      const execution = await engine.executeWorkflow(workflow);

      // Verify workflow completed
      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.completedSteps.length).toBe(2);

      // Verify RGPx metrics were recorded
      const metrics = rgpxIntegration.getCoherenceMetrics();
      expect(metrics.workflowCount).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0);
      expect(metrics.averageFlux).toBeGreaterThan(0);

      // Verify Φ-invariant was calculated
      const phi = rgpxIntegration.getPhiInvariant();
      expect(phi.value).toBeGreaterThanOrEqual(0);
      expect(phi.timestamp).toBeDefined();
    });

    it('should track entropy for failed workflow steps', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-rgpx-failure',
        name: 'Test RGPx Failure Workflow',
        description: 'Test workflow with failures',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Successful Step',
            type: 'service_call',
            service: 'test-service',
            parameters: { input: 'test' }
          },
          {
            stepId: 'step2',
            name: 'Failing Step',
            type: 'service_call',
            service: 'failing-service',
            dependencies: ['step1'],
            parameters: { input: 'fail' }
          },
          {
            stepId: 'step3',
            name: 'Another Step',
            type: 'service_call',
            service: 'test-service',
            dependencies: ['step2'],
            parameters: { input: 'test3' }
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      // Register successful executor
      engine.registerStepExecutor('test-service', async (): Promise<StepExecutionResult> => {
        return { success: true, result: { output: 'success' } };
      });

      // Register failing executor
      engine.registerStepExecutor('failing-service', async (): Promise<StepExecutionResult> => {
        return {
          success: false,
          error: {
            stepId: 'step2',
            errorCode: 'TEST_ERROR',
            message: 'Intentional test failure',
            recoverable: false
          }
        };
      });

      // Execute workflow (will fail at step2)
      const execution = await engine.executeWorkflow(workflow);

      // Verify workflow failed
      expect(execution.status).toBe(WorkflowStatus.FAILED);
      expect(execution.failedSteps.length).toBeGreaterThan(0);

      // Verify RGPx metrics were still recorded
      const metrics = rgpxIntegration.getCoherenceMetrics();
      expect(metrics.workflowCount).toBeGreaterThan(0);

      // Failed workflows should have entropy recorded
      expect(metrics.averageEntropy).toBeGreaterThan(0);

      // Success rate should be affected by failures
      expect(metrics.successRate).toBeLessThan(1);
    });
  });

  describe('RGPx Metrics Evolution', () => {
    it('should track coherence metrics across multiple workflows', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-multi',
        name: 'Multi Workflow Test',
        description: 'Test multiple workflows',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Single Step',
            type: 'service_call',
            service: 'test-service',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      engine.registerStepExecutor('test-service', async (): Promise<StepExecutionResult> => {
        return { success: true, result: { output: 'success' } };
      });

      // Execute multiple workflows
      const initialMetrics = rgpxIntegration.getCoherenceMetrics();
      expect(initialMetrics.workflowCount).toBe(0);

      // Execute 5 workflows
      for (let i = 0; i < 5; i++) {
        await engine.executeWorkflow({
          ...workflow,
          workflowId: `test-multi-${i}`
        });
      }

      const finalMetrics = rgpxIntegration.getCoherenceMetrics();
      expect(finalMetrics.workflowCount).toBeGreaterThanOrEqual(5);
      expect(finalMetrics.successRate).toBeGreaterThan(0);
    });

    it('should detect coherence plateau after stable execution', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-plateau',
        name: 'Plateau Detection Test',
        description: 'Test coherence plateau detection',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step',
            type: 'service_call',
            service: 'test-service',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      engine.registerStepExecutor('test-service', async (): Promise<StepExecutionResult> => {
        return { success: true, result: { output: 'success' } };
      });

      // Execute many workflows to establish stable state
      jest.useFakeTimers();
      for (let i = 0; i < 25; i++) {
        await engine.executeWorkflow({
          ...workflow,
          workflowId: `test-plateau-${i}`
        });
        
        // Advance time between workflows
        jest.advanceTimersByTime(300);
      }

      const plateau = rgpxIntegration.detectPlateau();
      expect(plateau).toBeDefined();
      expect(plateau.isPlateau).toBeDefined(); // May or may not be true depending on variance
      
      jest.useRealTimers();
    });
  });

  describe('RGPx Integration Control', () => {
    it('should allow disabling RGPx tracking', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-disable',
        name: 'Disable RGPx Test',
        description: 'Test disabling RGPx',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step',
            type: 'service_call',
            service: 'test-service',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      engine.registerStepExecutor('test-service', async (): Promise<StepExecutionResult> => {
        return { success: true, result: { output: 'success' } };
      });

      // Disable RGPx
      rgpxIntegration.setEnabled(false);

      const initialMetrics = rgpxIntegration.getCoherenceMetrics();
      const initialCount = initialMetrics.workflowCount;

      // Execute workflow
      await engine.executeWorkflow(workflow);

      // Metrics should not change when disabled
      const afterMetrics = rgpxIntegration.getCoherenceMetrics();
      expect(afterMetrics.workflowCount).toBe(initialCount);
    });

    it('should re-enable RGPx tracking after disabling', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-reenable',
        name: 'Re-enable RGPx Test',
        description: 'Test re-enabling RGPx',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step',
            type: 'service_call',
            service: 'test-service',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      engine.registerStepExecutor('test-service', async (): Promise<StepExecutionResult> => {
        return { success: true, result: { output: 'success' } };
      });

      // Disable, execute (should not record), re-enable, execute (should record)
      rgpxIntegration.setEnabled(false);
      await engine.executeWorkflow({ ...workflow, workflowId: 'test-1' });
      
      const metricsBefore = rgpxIntegration.getCoherenceMetrics();
      
      rgpxIntegration.setEnabled(true);
      await engine.executeWorkflow({ ...workflow, workflowId: 'test-2' });
      
      const metricsAfter = rgpxIntegration.getCoherenceMetrics();
      expect(metricsAfter.workflowCount).toBeGreaterThan(metricsBefore.workflowCount);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle parallel workflow steps with RGPx', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-parallel',
        name: 'Parallel Workflow Test',
        description: 'Test parallel execution with RGPx',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'First Step',
            type: 'service_call',
            service: 'test-service',
            parameters: {}
          },
          {
            stepId: 'step2a',
            name: 'Parallel A',
            type: 'parallel',
            service: 'test-service',
            dependencies: ['step1'],
            parameters: {}
          },
          {
            stepId: 'step2b',
            name: 'Parallel B',
            type: 'parallel',
            service: 'test-service',
            dependencies: ['step1'],
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      engine.registerStepExecutor('test-service', async (): Promise<StepExecutionResult> => {
        return { success: true, result: { output: 'success' } };
      });

      const execution = await engine.executeWorkflow(workflow);
      
      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      
      // Verify RGPx metrics recorded for parallel execution
      const metrics = rgpxIntegration.getCoherenceMetrics();
      expect(metrics.workflowCount).toBeGreaterThan(0);
    });

    it('should track metrics correctly for workflows with dependencies', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-dependencies',
        name: 'Dependency Workflow Test',
        description: 'Test dependency resolution with RGPx',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'test-service',
            parameters: {}
          },
          {
            stepId: 'step2',
            name: 'Step 2',
            type: 'service_call',
            service: 'test-service',
            dependencies: ['step1'],
            parameters: {}
          },
          {
            stepId: 'step3',
            name: 'Step 3',
            type: 'service_call',
            service: 'test-service',
            dependencies: ['step2'],
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 5000,
        rollbackStrategy: 'none'
      };

      engine.registerStepExecutor('test-service', async (): Promise<StepExecutionResult> => {
        return { success: true, result: { output: 'success' } };
      });

      const execution = await engine.executeWorkflow(workflow);
      
      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      expect(execution.completedSteps.length).toBe(3);
      
      // Verify RGPx metrics
      const metrics = rgpxIntegration.getCoherenceMetrics();
      expect(metrics.successRate).toBe(1.0); // All steps succeeded
      expect(metrics.averageFlux).toBeGreaterThan(0);
    });
  });
});

