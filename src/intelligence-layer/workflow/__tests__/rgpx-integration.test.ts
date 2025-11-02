/**
 * Unit tests for RGPx Workflow Integration
 */

import { RGPxWorkflowIntegration } from '../rgpx-integration';
import { WorkflowExecution, WorkflowStatus } from '../types';

describe('RGPxWorkflowIntegration', () => {
  let integration: RGPxWorkflowIntegration;

  beforeEach(() => {
    jest.useFakeTimers();
    integration = new RGPxWorkflowIntegration();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default coherence monitor', () => {
      const metrics = integration.getCoherenceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.workflowCount).toBe(0);
    });

    it('should allow custom coherence monitor', () => {
      const { CoherenceMonitor } = require('../../rgpx');
      const customMonitor = new CoherenceMonitor();
      const customIntegration = new RGPxWorkflowIntegration(customMonitor);
      
      expect(customIntegration.getCoherenceMonitor()).toBe(customMonitor);
    });
  });

  describe('Workflow Metrics Recording', () => {
    it('should record metrics for completed workflow', async () => {
      const execution: WorkflowExecution = {
        executionId: 'test-1',
        workflowId: 'workflow-1',
        status: WorkflowStatus.COMPLETED,
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        completedSteps: ['step1', 'step2', 'step3'],
        failedSteps: [],
        stepResults: { result: 'success' },
        progress: {
          totalSteps: 3,
          completedSteps: 3,
          currentStepName: '',
          percentComplete: 100
        }
      };

      await integration.recordWorkflowMetrics(execution);

      const metrics = integration.getCoherenceMetrics();
      expect(metrics.workflowCount).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should record entropy for failed workflows', async () => {
      const execution: WorkflowExecution = {
        executionId: 'test-2',
        workflowId: 'workflow-2',
        status: WorkflowStatus.FAILED,
        startTime: new Date(Date.now() - 500),
        endTime: new Date(),
        completedSteps: ['step1'],
        failedSteps: ['step2', 'step3'],
        stepResults: {},
        progress: {
          totalSteps: 3,
          completedSteps: 1,
          currentStepName: '',
          percentComplete: 33
        }
      };

      await integration.recordWorkflowMetrics(execution);

      const metrics = integration.getCoherenceMetrics();
      expect(metrics.workflowCount).toBeGreaterThan(0);
      // Failed workflows should have higher entropy
      expect(metrics.averageEntropy).toBeGreaterThan(0);
    });

    it('should calculate entropy correctly', async () => {
      const execution: WorkflowExecution = {
        executionId: 'test-3',
        workflowId: 'workflow-3',
        status: WorkflowStatus.COMPLETED,
        startTime: new Date(Date.now() - 2000),
        endTime: new Date(),
        completedSteps: ['step1', 'step2'],
        failedSteps: ['step3'],
        stepResults: {},
        progress: {
          totalSteps: 3,
          completedSteps: 2,
          currentStepName: '',
          percentComplete: 67
        }
      };

      await integration.recordWorkflowMetrics(execution);

      // Workflow with failures should have entropy recorded
      const metrics = integration.getCoherenceMetrics();
      expect(metrics.averageEntropy).toBeGreaterThan(0);
    });

    it('should calculate flux correctly for successful workflows', async () => {
      const execution: WorkflowExecution = {
        executionId: 'test-4',
        workflowId: 'workflow-4',
        status: WorkflowStatus.COMPLETED,
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        completedSteps: ['step1', 'step2', 'step3', 'step4', 'step5'],
        failedSteps: [],
        stepResults: { result: 'success' },
        progress: {
          totalSteps: 5,
          completedSteps: 5,
          currentStepName: '',
          percentComplete: 100
        }
      };

      await integration.recordWorkflowMetrics(execution);

      const metrics = integration.getCoherenceMetrics();
      expect(metrics.averageFlux).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0);
    });
  });

  describe('Phi Invariant Calculation', () => {
    it('should calculate Φ-invariant after recording workflows', async () => {
      const execution: WorkflowExecution = {
        executionId: 'test-5',
        workflowId: 'workflow-5',
        status: WorkflowStatus.COMPLETED,
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        completedSteps: ['step1', 'step2'],
        failedSteps: [],
        stepResults: {},
        progress: {
          totalSteps: 2,
          completedSteps: 2,
          currentStepName: '',
          percentComplete: 100
        }
      };

      await integration.recordWorkflowMetrics(execution);
      const phi = integration.getPhiInvariant();

      expect(phi.value).toBeDefined();
      expect(phi.targetPlateau).toBeDefined();
      expect(phi.timestamp).toBeDefined();
    });
  });

  describe('Plateau Detection', () => {
    it('should detect coherence plateau', async () => {
      // Record multiple successful workflows to establish stable state
      for (let i = 0; i < 20; i++) {
        const execution: WorkflowExecution = {
          executionId: `test-${i}`,
          workflowId: `workflow-${i}`,
          status: WorkflowStatus.COMPLETED,
          startTime: new Date(Date.now() - 1000),
          endTime: new Date(),
          completedSteps: ['step1', 'step2'],
          failedSteps: [],
          stepResults: {},
          progress: {
            totalSteps: 2,
            completedSteps: 2,
            currentStepName: '',
            percentComplete: 100
          }
        };

        await integration.recordWorkflowMetrics(execution);
        jest.advanceTimersByTime(300);
      }

      const plateau = integration.detectPlateau();
      expect(plateau).toBeDefined();
      expect(plateau.isPlateau).toBeDefined();
    });
  });

  describe('Enable/Disable Tracking', () => {
    it('should allow disabling tracking', async () => {
      integration.setEnabled(false);

      const execution: WorkflowExecution = {
        executionId: 'test-6',
        workflowId: 'workflow-6',
        status: WorkflowStatus.COMPLETED,
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        completedSteps: ['step1'],
        failedSteps: [],
        stepResults: {},
        progress: {
          totalSteps: 1,
          completedSteps: 1,
          currentStepName: '',
          percentComplete: 100
        }
      };

      const initialMetrics = integration.getCoherenceMetrics();
      await integration.recordWorkflowMetrics(execution);
      const afterMetrics = integration.getCoherenceMetrics();

      // Metrics should not change when disabled
      expect(afterMetrics.workflowCount).toBe(initialMetrics.workflowCount);
    });
  });
});

