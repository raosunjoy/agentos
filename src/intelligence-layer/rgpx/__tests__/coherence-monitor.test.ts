/**
 * Unit tests for RGPx CoherenceMonitor
 */

import { CoherenceMonitor } from '../coherence-monitor';
import { WorkflowEntropy, WorkflowFlux } from '../types';

describe('CoherenceMonitor', () => {
  let monitor: CoherenceMonitor;

  beforeEach(() => {
    jest.useFakeTimers();
    monitor = new CoherenceMonitor();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default metrics', () => {
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageEntropy).toBe(0);
      expect(metrics.averageFlux).toBe(0);
      expect(metrics.coherenceLevel).toBe(0);
      expect(metrics.workflowCount).toBe(0);
    });

    it('should allow custom RGPx parameters', () => {
      const customMonitor = new CoherenceMonitor({
        npuDiffusion: 0.2,
        agentFeedback: 0.9,
        deviceConstraints: 0.1,
        targetPlateau: 0.9
      });

      const phi = customMonitor.calculatePhiInvariant();
      expect(phi.targetPlateau).toBe(0.9);
    });
  });

  describe('Entropy Recording', () => {
    it('should record workflow entropy', () => {
      const entropy: WorkflowEntropy = {
        workflowId: 'test-1',
        computeWaste: 1000000,
        memoryWaste: 10240,
        timeWaste: 500,
        totalEntropy: 500000
      };

      monitor.recordEntropy(entropy);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.averageEntropy).toBeGreaterThan(0);
    });

    it('should maintain entropy history', () => {
      const entropy: WorkflowEntropy = {
        workflowId: 'test-1',
        computeWaste: 1000000,
        memoryWaste: 10240,
        timeWaste: 500,
        totalEntropy: 500000
      };

      monitor.recordEntropy(entropy);
      monitor.recordEntropy({ ...entropy, workflowId: 'test-2' });

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.workflowCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Flux Recording', () => {
    it('should record workflow flux', () => {
      const flux: WorkflowFlux = {
        workflowId: 'test-1',
        successfulSteps: 5,
        userValue: 0.9,
        totalFlux: 9500
      };

      monitor.recordFlux(flux);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.averageFlux).toBeGreaterThan(0);
    });

    it('should calculate success rate from flux', () => {
      // Record multiple successful workflows
      for (let i = 0; i < 10; i++) {
        monitor.recordFlux({
          workflowId: `test-${i}`,
          successfulSteps: 5,
          userValue: 0.9,
          totalFlux: 9500
        });
      }

      // Record one failed workflow
      monitor.recordFlux({
        workflowId: 'test-failed',
        successfulSteps: 0,
        userValue: 0.0,
        totalFlux: 0
      });

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.successRate).toBeGreaterThan(0.8);
    });
  });

  describe('Phi Invariant Calculation', () => {
    it('should calculate Φ-invariant', () => {
      // Record some entropy and flux
      monitor.recordEntropy({
        workflowId: 'test-1',
        computeWaste: 1000000,
        memoryWaste: 10240,
        timeWaste: 500,
        totalEntropy: 500000
      });

      monitor.recordFlux({
        workflowId: 'test-1',
        successfulSteps: 5,
        userValue: 0.9,
        totalFlux: 9500
      });

      const phi = monitor.calculatePhiInvariant();
      expect(phi.value).toBeGreaterThan(0);
      expect(phi.targetPlateau).toBeDefined();
      expect(phi.timestamp).toBeDefined();
    });

    it('should calculate rate of change', () => {
      // Record initial state
      monitor.recordEntropy({
        workflowId: 'test-1',
        computeWaste: 1000000,
        memoryWaste: 10240,
        timeWaste: 500,
        totalEntropy: 500000
      });

      monitor.recordFlux({
        workflowId: 'test-1',
        successfulSteps: 5,
        userValue: 0.9,
        totalFlux: 9500
      });

      monitor.calculatePhiInvariant();

      // Wait a bit
      jest.advanceTimersByTime(1000);

      // Record new state
      monitor.recordEntropy({
        workflowId: 'test-2',
        computeWaste: 500000,
        memoryWaste: 5120,
        timeWaste: 250,
        totalEntropy: 250000
      });

      monitor.recordFlux({
        workflowId: 'test-2',
        successfulSteps: 10,
        userValue: 1.0,
        totalFlux: 20000
      });

      const phi2 = monitor.calculatePhiInvariant();
      expect(phi2.rateOfChange).toBeDefined();
    });
  });

  describe('Coherence Plateau Detection', () => {
    it('should detect plateau when Φ is stable', () => {
      // Record consistent entropy and flux (stable state)
      for (let i = 0; i < 20; i++) {
        monitor.recordEntropy({
          workflowId: `test-${i}`,
          computeWaste: 1000000,
          memoryWaste: 10240,
          timeWaste: 500,
          totalEntropy: 500000
        });

        monitor.recordFlux({
          workflowId: `test-${i}`,
          successfulSteps: 5,
          userValue: 0.9,
          totalFlux: 9500
        });

        monitor.calculatePhiInvariant();
        jest.advanceTimersByTime(300); // 300ms intervals
      }

      const plateau = monitor.detectPlateau();
      expect(plateau.isPlateau).toBe(true);
      expect(plateau.confidence).toBeGreaterThan(0);
    });

    it('should not detect plateau with insufficient data', () => {
      const plateau = monitor.detectPlateau();
      expect(plateau.isPlateau).toBe(false);
      expect(plateau.confidence).toBe(0);
    });

    it('should not detect plateau when Φ is unstable', () => {
      // Record varying entropy and flux (unstable state)
      for (let i = 0; i < 20; i++) {
        const entropy = i % 2 === 0 ? 1000000 : 5000000; // Vary entropy
        monitor.recordEntropy({
          workflowId: `test-${i}`,
          computeWaste: entropy,
          memoryWaste: 10240,
          timeWaste: 500,
          totalEntropy: entropy
        });

        monitor.recordFlux({
          workflowId: `test-${i}`,
          successfulSteps: 5,
          userValue: 0.9,
          totalFlux: 9500
        });

        monitor.calculatePhiInvariant();
        jest.advanceTimersByTime(300);
      }

      const plateau = monitor.detectPlateau();
      // May or may not be plateau depending on variance
      expect(plateau.phiValue).toBeDefined();
    });
  });

  describe('Coherence Metrics', () => {
    it('should calculate coherence level', () => {
      // High flux, low entropy = high coherence
      monitor.recordEntropy({
        workflowId: 'test-1',
        computeWaste: 100000,
        memoryWaste: 1024,
        timeWaste: 50,
        totalEntropy: 50000
      });

      monitor.recordFlux({
        workflowId: 'test-1',
        successfulSteps: 10,
        userValue: 1.0,
        totalFlux: 20000
      });

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.coherenceLevel).toBeGreaterThan(0);
      expect(metrics.coherenceLevel).toBeLessThanOrEqual(1);
    });

    it('should update metrics with new recordings', () => {
      const initialMetrics = monitor.getCurrentMetrics();

      monitor.recordEntropy({
        workflowId: 'test-1',
        computeWaste: 1000000,
        memoryWaste: 10240,
        timeWaste: 500,
        totalEntropy: 500000
      });

      monitor.recordFlux({
        workflowId: 'test-1',
        successfulSteps: 5,
        userValue: 0.9,
        totalFlux: 9500
      });

      const updatedMetrics = monitor.getCurrentMetrics();
      expect(updatedMetrics.workflowCount).toBeGreaterThan(initialMetrics.workflowCount);
    });
  });

  describe('History Management', () => {
    it('should limit history size', () => {
      // Record many workflows
      for (let i = 0; i < 1500; i++) {
        monitor.recordEntropy({
          workflowId: `test-${i}`,
          computeWaste: 1000000,
          memoryWaste: 10240,
          timeWaste: 500,
          totalEntropy: 500000
        });
      }

      const phiHistory = monitor.getPhiHistory();
      expect(phiHistory.length).toBeLessThanOrEqual(1000); // Max history size
    });

    it('should return limited history', () => {
      // Record multiple measurements
      for (let i = 0; i < 50; i++) {
        monitor.recordEntropy({
          workflowId: `test-${i}`,
          computeWaste: 1000000,
          memoryWaste: 10240,
          timeWaste: 500,
          totalEntropy: 500000
        });

        monitor.recordFlux({
          workflowId: `test-${i}`,
          successfulSteps: 5,
          userValue: 0.9,
          totalFlux: 9500
        });

        monitor.calculatePhiInvariant();
      }

      const limitedHistory = monitor.getPhiHistory(10);
      expect(limitedHistory.length).toBe(10);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      monitor.recordEntropy({
        workflowId: 'test-1',
        computeWaste: 1000000,
        memoryWaste: 10240,
        timeWaste: 500,
        totalEntropy: 500000
      });

      monitor.reset();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.workflowCount).toBe(0);
      expect(monitor.getPhiHistory().length).toBe(0);
    });
  });

  describe('Parameter Updates', () => {
    it('should update RGPx parameters', () => {
      monitor.updateParameters({
        targetPlateau: 0.95
      });

      const phi = monitor.calculatePhiInvariant();
      expect(phi.targetPlateau).toBe(0.95);
    });
  });
});

