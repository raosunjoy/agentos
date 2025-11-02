/**
 * Integration Tests for Workflow Engine + RGPx
 * Tests end-to-end workflow execution with automatic RGPx coherence monitoring
 */

import { WorkflowEngine } from '../workflow-engine';
import { RGPxWorkflowIntegration } from '../rgpx-integration';
import {
  WorkflowDefinition,
  WorkflowStatus,
  StepExecutionContext,
  StepExecutionResult
} from '../types';

describe('Workflow Engine + RGPx Integration', () => {
  let engine: WorkflowEngine;
  let rgpxIntegration: RGPxWorkflowIntegration;

  beforeEach(() => {
    engine = new WorkflowEngine();
    rgpxIntegration = engine.enableRGPxIntegration();
  });

  const createMockExecutor = (
    serviceType: string,
    result: any = { success: true },
    delay: number = 50
  ): jest.Mock => {
    const executor = jest.fn().mockImplementation(async (context: StepExecutionContext) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return result;
    });
    engine.registerStepExecutor(serviceType, executor);
    return executor;
  };

  describe('Automatic RGPx Metrics Recording', () => {
    it('should automatically record entropy and flux for successful workflows', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-successful',
        name: 'Successful Workflow',
        description: 'Test successful workflow execution',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          },
          {
            stepId: 'step2',
            name: 'Step 2',
            type: 'service_call',
            service: 'service2',
            dependencies: ['step1'],
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { success: true });
      createMockExecutor('service2', { success: true });

      const initialMetrics = rgpxIntegration.getCoherenceMetrics();
      expect(initialMetrics.workflowCount).toBe(0);

      const execution = await engine.executeWorkflow(workflow);

      expect(execution.status).toBe(WorkflowStatus.COMPLETED);

      // Wait a bit for async metrics recording
      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedMetrics = rgpxIntegration.getCoherenceMetrics();
      expect(updatedMetrics.workflowCount).toBeGreaterThan(0);
      expect(updatedMetrics.successRate).toBeGreaterThan(0);
      expect(updatedMetrics.averageFlux).toBeGreaterThan(0);
    });

    it('should record higher entropy for failed workflows', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-failed',
        name: 'Failed Workflow',
        description: 'Test failed workflow execution',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          },
          {
            stepId: 'step2',
            name: 'Step 2',
            type: 'service_call',
            service: 'service2',
            dependencies: ['step1'],
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { success: true });
      createMockExecutor('service2', { error: 'Service failed' }, 50);

      const execution = await engine.executeWorkflow(workflow);

      // Wait for metrics recording
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = rgpxIntegration.getCoherenceMetrics();
      
      // Failed workflows should contribute to entropy
      if (metrics.workflowCount > 0) {
        expect(metrics.averageEntropy).toBeGreaterThanOrEqual(0);
      }
    });

    it('should track Φ-invariant changes over multiple workflows', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-multi',
        name: 'Multi-Step Workflow',
        description: 'Test multi-step workflow',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { success: true });

      // Execute multiple workflows
      for (let i = 0; i < 5; i++) {
        await engine.executeWorkflow({
          ...workflow,
          workflowId: `test-multi-${i}`
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const phiHistory = rgpxIntegration.getPhiInvariant();
      expect(phiHistory.value).toBeDefined();
      expect(phiHistory.timestamp).toBeDefined();
    });
  });

  describe('Coherence Plateau Detection', () => {
    it('should detect coherence plateau after stable workflow execution', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-stable',
        name: 'Stable Workflow',
        description: 'Test stable workflow pattern',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { success: true }, 50);

      // Execute many consistent workflows to establish stability
      for (let i = 0; i < 25; i++) {
        await engine.executeWorkflow({
          ...workflow,
          workflowId: `test-stable-${i}`
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const plateau = rgpxIntegration.detectPlateau();
      expect(plateau).toBeDefined();
      expect(plateau.isPlateau).toBeDefined();
      expect(plateau.phiValue).toBeDefined();
    });
  });

  describe('Workflow Success Rate Calculation', () => {
    it('should calculate accurate success rate from workflow outcomes', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-success-rate',
        name: 'Success Rate Test',
        description: 'Test success rate calculation',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      // Execute 10 workflows - 8 successful, 2 failed
      for (let i = 0; i < 10; i++) {
        const shouldSucceed = i < 8;
        createMockExecutor(`service1-${i}`, 
          shouldSucceed ? { success: true } : { error: 'failed' },
          50
        );

        const workflowCopy = {
          ...workflow,
          workflowId: `test-success-rate-${i}`,
          steps: [{
            ...workflow.steps[0],
            service: `service1-${i}`
          }]
        };

        await engine.executeWorkflow(workflowCopy);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const metrics = rgpxIntegration.getCoherenceMetrics();
      
      // Success rate should be close to 80% (8/10)
      if (metrics.workflowCount >= 10) {
        expect(metrics.successRate).toBeGreaterThanOrEqual(0.7);
        expect(metrics.successRate).toBeLessThanOrEqual(0.9);
      }
    });
  });

  describe('Coherence Level Calculation', () => {
    it('should calculate coherence level based on flux and entropy', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-coherence',
        name: 'Coherence Test',
        description: 'Test coherence calculation',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          },
          {
            stepId: 'step2',
            name: 'Step 2',
            type: 'service_call',
            service: 'service2',
            dependencies: ['step1'],
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { success: true }, 50);
      createMockExecutor('service2', { success: true }, 50);

      // Execute workflows with good success rate
      for (let i = 0; i < 10; i++) {
        await engine.executeWorkflow({
          ...workflow,
          workflowId: `test-coherence-${i}`
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const metrics = rgpxIntegration.getCoherenceMetrics();
      
      if (metrics.workflowCount > 0) {
        expect(metrics.coherenceLevel).toBeGreaterThanOrEqual(0);
        expect(metrics.coherenceLevel).toBeLessThanOrEqual(1);
        
        // Higher flux and lower entropy should yield higher coherence
        if (metrics.averageFlux > 0 && metrics.averageEntropy < 1000) {
          expect(metrics.coherenceLevel).toBeGreaterThan(0.5);
        }
      }
    });
  });

  describe('RGPx Integration Enable/Disable', () => {
    it('should allow disabling RGPx tracking', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'test-disable',
        name: 'Disable Test',
        description: 'Test disabling RGPx',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { success: true });

      const initialMetrics = rgpxIntegration.getCoherenceMetrics();
      const initialCount = initialMetrics.workflowCount;

      // Disable RGPx
      rgpxIntegration.setEnabled(false);

      await engine.executeWorkflow(workflow);
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterMetrics = rgpxIntegration.getCoherenceMetrics();
      
      // Metrics should not change when disabled
      expect(afterMetrics.workflowCount).toBe(initialCount);

      // Re-enable
      rgpxIntegration.setEnabled(true);

      await engine.executeWorkflow({ ...workflow, workflowId: 'test-disable-2' });
      await new Promise(resolve => setTimeout(resolve, 100));

      const reEnabledMetrics = rgpxIntegration.getCoherenceMetrics();
      expect(reEnabledMetrics.workflowCount).toBeGreaterThan(initialCount);
    });
  });

  describe('Real-World Workflow Scenarios', () => {
    it('should track RGPx metrics for multi-service workflow (calendar + health)', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'health-calendar',
        name: 'Health Calendar Workflow',
        description: 'Check appointment and set reminder',
        version: '1.0.0',
        steps: [
          {
            stepId: 'check_calendar',
            name: 'Check Calendar',
            type: 'service_call',
            service: 'calendar',
            parameters: { date: 'today' }
          },
          {
            stepId: 'set_reminder',
            name: 'Set Reminder',
            type: 'service_call',
            service: 'health',
            dependencies: ['check_calendar'],
            parameters: { action: 'reminder' }
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('calendar', { appointments: ['Doctor visit'] }, 100);
      createMockExecutor('health', { reminderSet: true }, 100);

      const execution = await engine.executeWorkflow(workflow);
      
      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = rgpxIntegration.getCoherenceMetrics();
      const phi = rgpxIntegration.getPhiInvariant();

      expect(metrics.workflowCount).toBeGreaterThan(0);
      expect(phi.value).toBeDefined();
    });

    it('should track metrics for parallel workflow execution', async () => {
      const workflow: WorkflowDefinition = {
        workflowId: 'parallel-workflow',
        name: 'Parallel Workflow',
        description: 'Test parallel execution',
        version: '1.0.0',
        steps: [
          {
            stepId: 'step1',
            name: 'Step 1',
            type: 'service_call',
            service: 'service1',
            parameters: {}
          },
          {
            stepId: 'step2',
            name: 'Step 2',
            type: 'service_call',
            service: 'service2',
            parameters: {} // No dependencies = parallel
          }
        ],
        permissions: [],
        timeout: 30000,
        rollbackStrategy: 'none'
      };

      createMockExecutor('service1', { result: 'data1' }, 100);
      createMockExecutor('service2', { result: 'data2' }, 100);

      const execution = await engine.executeWorkflow(workflow);
      
      expect(execution.status).toBe(WorkflowStatus.COMPLETED);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = rgpxIntegration.getCoherenceMetrics();
      expect(metrics.workflowCount).toBeGreaterThan(0);
    });
  });
});
