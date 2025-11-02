/**
 * Unit tests for PRD Metrics Tracker
 */

import { PRDMetricsTracker } from '../prd-metrics-tracker';

describe('PRDMetricsTracker', () => {
  let tracker: PRDMetricsTracker;

  beforeEach(() => {
    tracker = new PRDMetricsTracker();
  });

  describe('Initialization', () => {
    it('should initialize with PRD metrics', () => {
      const dashboard = tracker.getDashboard();
      expect(dashboard.metrics.length).toBeGreaterThan(0);
      expect(dashboard.overallProgress).toBeGreaterThanOrEqual(0);
      expect(dashboard.overallProgress).toBeLessThanOrEqual(100);
    });

    it('should have intent accuracy metric', () => {
      const metric = tracker.getMetric('intent_accuracy');
      expect(metric).toBeDefined();
      expect(metric?.name).toBe('Intent Recognition Accuracy');
      expect(metric?.current).toBe(95);
      expect(metric?.betaTarget).toBe(97);
      expect(metric?.v10Target).toBe(98);
    });

    it('should have battery drain metric', () => {
      const metric = tracker.getMetric('battery_drain');
      expect(metric).toBeDefined();
      expect(metric?.name).toBe('Battery Impact (Daily)');
      expect(metric?.current).toBe(5);
      expect(metric?.betaTarget).toBe(2.5);
    });
  });

  describe('Metric Updates', () => {
    it('should update metric value', () => {
      tracker.updateMetric('intent_accuracy', 96);

      const metric = tracker.getMetric('intent_accuracy');
      expect(metric?.current).toBe(96);
    });

    it('should auto-calculate status for numeric metrics', () => {
      // Update to beta target (should be on_track)
      tracker.updateMetric('intent_accuracy', 97);
      const metric = tracker.getMetric('intent_accuracy');
      expect(metric?.status).toBe('on_track');

      // Update to v1.0 target (should be achieved)
      tracker.updateMetric('intent_accuracy', 98);
      const updatedMetric = tracker.getMetric('intent_accuracy');
      expect(updatedMetric?.status).toBe('achieved');
    });

    it('should handle battery metric (lower is better)', () => {
      // Current 5% is above beta target 2.5%, should be in_progress
      const initialMetric = tracker.getMetric('battery_drain');
      expect(initialMetric?.status).toBe('in_progress');

      // Update to beta target
      tracker.updateMetric('battery_drain', 2.5);
      const metric = tracker.getMetric('battery_drain');
      expect(metric?.status).toBe('on_track');

      // Update to v1.0 target
      tracker.updateMetric('battery_drain', 2);
      const updatedMetric = tracker.getMetric('battery_drain');
      expect(updatedMetric?.status).toBe('achieved');
    });

    it('should handle string metrics', () => {
      tracker.updateMetric('plugin_count', '50 plugins');
      const metric = tracker.getMetric('plugin_count');
      expect(metric?.current).toBe('50 plugins');
      expect(metric?.status).toBe('pending'); // String metrics default to pending
    });
  });

  describe('Dashboard Generation', () => {
    it('should generate dashboard with all metrics', () => {
      const dashboard = tracker.getDashboard();
      expect(dashboard.metrics.length).toBeGreaterThan(0);
      expect(dashboard.lastUpdated).toBeDefined();
    });

    it('should calculate overall progress', () => {
      const dashboard = tracker.getDashboard();
      expect(dashboard.overallProgress).toBeGreaterThanOrEqual(0);
      expect(dashboard.overallProgress).toBeLessThanOrEqual(100);
    });

    it('should update overall progress when metrics change', () => {
      const initialProgress = tracker.getDashboard().overallProgress;

      // Improve metrics
      tracker.updateMetric('intent_accuracy', 98); // achieved
      tracker.updateMetric('battery_drain', 2); // achieved

      const updatedProgress = tracker.getDashboard().overallProgress;
      expect(updatedProgress).toBeGreaterThanOrEqual(initialProgress);
    });
  });

  describe('Report Generation', () => {
    it('should generate formatted report', () => {
      const report = tracker.getReport();
      expect(report).toContain('PRD v1.3 Metrics Report');
      expect(report).toContain('Overall Progress');
      expect(report).toContain('Metrics:');
    });

    it('should include all metrics in report', () => {
      const report = tracker.getReport();
      const dashboard = tracker.getDashboard();

      dashboard.metrics.forEach(metric => {
        expect(report).toContain(metric.name);
        expect(report).toContain(String(metric.current));
      });
    });

    it('should include status icons in report', () => {
      const report = tracker.getReport();
      // Check for status indicators
      expect(report).toMatch(/[✅🎯🔄📋]/);
    });
  });

  describe('Status Calculation', () => {
    it('should mark achieved metrics correctly', () => {
      tracker.updateMetric('code_coverage', 95, 'achieved');
      const metric = tracker.getMetric('code_coverage');
      expect(metric?.status).toBe('achieved');
    });

    it('should mark on_track metrics correctly', () => {
      tracker.updateMetric('response_time', 300, 'on_track');
      const metric = tracker.getMetric('response_time');
      expect(metric?.status).toBe('on_track');
    });

    it('should mark in_progress metrics correctly', () => {
      tracker.updateMetric('battery_drain', 4, 'in_progress');
      const metric = tracker.getMetric('battery_drain');
      expect(metric?.status).toBe('in_progress');
    });

    it('should mark pending metrics correctly', () => {
      const metric = tracker.getMetric('elderly_task_completion');
      expect(metric?.status).toBe('pending');
    });
  });

  describe('Metric Retrieval', () => {
    it('should return undefined for non-existent metric', () => {
      const metric = tracker.getMetric('non_existent');
      expect(metric).toBeUndefined();
    });

    it('should return all metrics in dashboard', () => {
      const dashboard = tracker.getDashboard();
      expect(dashboard.metrics.length).toBeGreaterThan(0);
      expect(dashboard.metrics.every(m => m.name)).toBe(true);
    });
  });
});

