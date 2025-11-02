/**
 * Integration tests for PRD Metrics Dashboard
 * Tests real-time metric updates and dashboard generation
 */

import { PRDMetricsTracker } from '../prd-metrics-tracker';

describe('PRD Metrics Dashboard Integration', () => {
  let tracker: PRDMetricsTracker;

  beforeEach(() => {
    tracker = new PRDMetricsTracker();
  });

  describe('Real-Time Metric Updates', () => {
    it('should update dashboard when metrics change', () => {
      const initialDashboard = tracker.getDashboard();
      const initialProgress = initialDashboard.overallProgress;

      // Update intent accuracy (improving metric)
      tracker.updateMetric('intent_accuracy', 96);
      
      const updatedDashboard = tracker.getDashboard();
      
      // Dashboard should reflect new value
      const accuracyMetric = updatedDashboard.metrics.find(m => m.name === 'Intent Recognition Accuracy');
      expect(accuracyMetric?.current).toBe(96);
      expect(updatedDashboard.lastUpdated).toBeGreaterThan(initialDashboard.lastUpdated);
    });

    it('should recalculate overall progress when metrics improve', () => {
      const initialDashboard = tracker.getDashboard();
      
      // Improve multiple metrics
      tracker.updateMetric('intent_accuracy', 98); // achieved
      tracker.updateMetric('battery_drain', 2); // achieved
      tracker.updateMetric('response_time', 200); // achieved

      const updatedDashboard = tracker.getDashboard();
      
      // Overall progress should increase
      expect(updatedDashboard.overallProgress).toBeGreaterThanOrEqual(initialDashboard.overallProgress);
      
      // More metrics should be in achieved/on_track status
      const achievedCount = updatedDashboard.metrics.filter(m => m.status === 'achieved').length;
      expect(achievedCount).toBeGreaterThan(0);
    });

    it('should track metric history through updates', () => {
      // Update metric multiple times
      tracker.updateMetric('intent_accuracy', 95);
      const dashboard1 = tracker.getDashboard();
      
      tracker.updateMetric('intent_accuracy', 96);
      const dashboard2 = tracker.getDashboard();
      
      tracker.updateMetric('intent_accuracy', 97);
      const dashboard3 = tracker.getDashboard();

      // Each update should have new timestamp
      expect(dashboard3.lastUpdated).toBeGreaterThan(dashboard2.lastUpdated);
      expect(dashboard2.lastUpdated).toBeGreaterThan(dashboard1.lastUpdated);

      // Current value should reflect latest update
      const metric3 = dashboard3.metrics.find(m => m.name === 'Intent Recognition Accuracy');
      expect(metric3?.current).toBe(97);
    });
  });

  describe('Status Calculation Integration', () => {
    it('should automatically calculate status based on current vs targets', () => {
      // Start below beta target
      tracker.updateMetric('battery_drain', 4.5);
      let metric = tracker.getMetric('battery_drain');
      expect(metric?.status).toBe('in_progress');

      // Reach beta target
      tracker.updateMetric('battery_drain', 2.5);
      metric = tracker.getMetric('battery_drain');
      expect(metric?.status).toBe('on_track');

      // Exceed v1.0 target
      tracker.updateMetric('battery_drain', 1.8);
      metric = tracker.getMetric('battery_drain');
      expect(metric?.status).toBe('achieved');
    });

    it('should handle different metric types correctly', () => {
      // Higher is better (accuracy)
      tracker.updateMetric('intent_accuracy', 94);
      let accuracy = tracker.getMetric('intent_accuracy');
      expect(accuracy?.status).toBe('in_progress');

      tracker.updateMetric('intent_accuracy', 97);
      accuracy = tracker.getMetric('intent_accuracy');
      expect(accuracy?.status).toBe('on_track');

      tracker.updateMetric('intent_accuracy', 98);
      accuracy = tracker.getMetric('intent_accuracy');
      expect(accuracy?.status).toBe('achieved');

      // Lower is better (battery)
      tracker.updateMetric('battery_drain', 3);
      let battery = tracker.getMetric('battery_drain');
      expect(battery?.status).toBe('in_progress');

      tracker.updateMetric('battery_drain', 2.5);
      battery = tracker.getMetric('battery_drain');
      expect(battery?.status).toBe('on_track');

      tracker.updateMetric('battery_drain', 2);
      battery = tracker.getMetric('battery_drain');
      expect(battery?.status).toBe('achieved');
    });
  });

  describe('Dashboard Report Generation', () => {
    it('should generate formatted report with all metrics', () => {
      // Update some metrics
      tracker.updateMetric('intent_accuracy', 96);
      tracker.updateMetric('battery_drain', 3.5);
      tracker.updateMetric('response_time', 450);

      const report = tracker.getReport();

      // Should contain all metric names
      const dashboard = tracker.getDashboard();
      dashboard.metrics.forEach(metric => {
        expect(report).toContain(metric.name);
      });

      // Should contain current values
      expect(report).toContain('96'); // intent accuracy
      expect(report).toContain('3.5'); // battery drain
      expect(report).toContain('450'); // response time

      // Should contain overall progress
      expect(report).toContain('Overall Progress');
    });

    it('should include status icons in report', () => {
      tracker.updateMetric('intent_accuracy', 98); // achieved
      tracker.updateMetric('code_coverage', 95); // achieved

      const report = tracker.getReport();
      
      // Should contain status indicators
      expect(report).toMatch(/[✅🎯🔄📋]/);
    });
  });

  describe('Multi-Metric Scenarios', () => {
    it('should handle updating all metrics simultaneously', () => {
      const updates = {
        intent_accuracy: 97,
        battery_drain: 2.5,
        response_time: 300,
        code_coverage: 96
      };

      Object.entries(updates).forEach(([key, value]) => {
        tracker.updateMetric(key, value);
      });

      const dashboard = tracker.getDashboard();

      // All metrics should be updated
      Object.entries(updates).forEach(([key, value]) => {
        const metric = tracker.getMetric(key);
        expect(metric?.current).toBe(value);
      });

      // Overall progress should reflect improvements
      expect(dashboard.overallProgress).toBeGreaterThan(0);
    });

    it('should maintain consistent dashboard state', () => {
      const dashboard1 = tracker.getDashboard();
      
      // Make some updates
      tracker.updateMetric('intent_accuracy', 96);
      
      const dashboard2 = tracker.getDashboard();
      
      // Verify dashboard state consistency
      expect(dashboard2.metrics.length).toBe(dashboard1.metrics.length);
      expect(dashboard2.metrics.every(m => m.name)).toBe(true);
      expect(dashboard2.metrics.every(m => m.lastUpdated)).toBe(true);
    });
  });

  describe('Metric Retrieval', () => {
    it('should retrieve individual metrics correctly', () => {
      tracker.updateMetric('intent_accuracy', 96);
      
      const metric = tracker.getMetric('intent_accuracy');
      
      expect(metric).toBeDefined();
      expect(metric?.name).toBe('Intent Recognition Accuracy');
      expect(metric?.current).toBe(96);
      expect(metric?.betaTarget).toBe(97);
      expect(metric?.v10Target).toBe(98);
      expect(metric?.status).toBe('on_track');
    });

    it('should return undefined for non-existent metrics', () => {
      const metric = tracker.getMetric('non_existent');
      expect(metric).toBeUndefined();
    });
  });

  describe('Dashboard Consistency', () => {
    it('should generate consistent dashboards across multiple calls', () => {
      tracker.updateMetric('intent_accuracy', 96);
      
      const dashboard1 = tracker.getDashboard();
      const dashboard2 = tracker.getDashboard();

      // Should be consistent (same metrics, same structure)
      expect(dashboard2.metrics.length).toBe(dashboard1.metrics.length);
      
      dashboard1.metrics.forEach((metric1, index) => {
        const metric2 = dashboard2.metrics[index];
        expect(metric2.name).toBe(metric1.name);
        expect(metric2.current).toBe(metric1.current);
      });
    });

    it('should update timestamps on metric changes', () => {
      const dashboard1 = tracker.getDashboard();
      
      // Small delay
      jest.advanceTimersByTime(10);
      
      tracker.updateMetric('intent_accuracy', 96);
      
      const dashboard2 = tracker.getDashboard();
      
      // Updated metric should have newer timestamp
      const metric2 = dashboard2.metrics.find(m => m.name === 'Intent Recognition Accuracy');
      expect(metric2?.lastUpdated).toBeGreaterThan(dashboard1.lastUpdated);
    });
  });
});

