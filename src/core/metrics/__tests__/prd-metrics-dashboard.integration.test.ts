/**
 * Integration Tests for PRD Metrics Dashboard
 * Tests real-time metric updates, dashboard generation, and reporting
 */

import { PRDMetricsTracker } from '../prd-metrics-tracker';
import { MetricsCollector } from '../metrics-collector';

describe('PRD Metrics Dashboard Integration', () => {
  let prdTracker: PRDMetricsTracker;
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    prdTracker = new PRDMetricsTracker();
    metricsCollector = new MetricsCollector();
  });

  describe('Real-Time Metric Updates', () => {
    it('should update metrics in real-time and reflect in dashboard', () => {
      // Get initial dashboard
      const initialDashboard = prdTracker.getDashboard();
      const initialProgress = initialDashboard.overallProgress;

      // Simulate intent accuracy improvement
      prdTracker.updateMetric('intent_accuracy', 96);

      // Get updated dashboard
      const updatedDashboard = prdTracker.getDashboard();
      const updatedProgress = updatedDashboard.overallProgress;

      // Progress should improve (or stay same if already high)
      expect(updatedProgress).toBeGreaterThanOrEqual(initialProgress);

      // Intent accuracy should be updated
      const intentMetric = prdTracker.getMetric('intent_accuracy');
      expect(intentMetric?.current).toBe(96);
    });

    it('should update battery metric and calculate status correctly', () => {
      // Current battery drain is 5%, target is 2.5%
      const initialMetric = prdTracker.getMetric('battery_drain');
      expect(initialMetric?.current).toBe(5);
      expect(initialMetric?.status).toBe('in_progress');

      // Improve to beta target
      prdTracker.updateMetric('battery_drain', 2.5);
      const updatedMetric = prdTracker.getMetric('battery_drain');
      expect(updatedMetric?.current).toBe(2.5);
      expect(updatedMetric?.status).toBe('on_track');

      // Improve to v1.0 target
      prdTracker.updateMetric('battery_drain', 2);
      const v10Metric = prdTracker.getMetric('battery_drain');
      expect(v10Metric?.current).toBe(2);
      expect(v10Metric?.status).toBe('achieved');
    });
  });

  describe('Dashboard Generation', () => {
    it('should generate complete dashboard with all metrics', () => {
      const dashboard = prdTracker.getDashboard();

      expect(dashboard.overallProgress).toBeDefined();
      expect(dashboard.metrics.length).toBeGreaterThan(0);
      expect(dashboard.lastUpdated).toBeDefined();

      // Verify all metrics are present
      const metricKeys = ['intent_accuracy', 'battery_drain', 'response_time', 
                         'code_coverage', 'elderly_task_completion', 
                         'plugin_count', 'privacy_trust'];

      metricKeys.forEach(key => {
        const keyPrefix = key.split('_')[0];
        if (keyPrefix) {
          const metric = dashboard.metrics.find(m => 
            m.name.toLowerCase().includes(keyPrefix)
          );
          expect(metric).toBeDefined();
        }
      });
    });

    it('should calculate overall progress based on metric statuses', () => {
      // Improve multiple metrics
      prdTracker.updateMetric('intent_accuracy', 98); // achieved
      prdTracker.updateMetric('code_coverage', 95); // already achieved
      prdTracker.updateMetric('battery_drain', 2); // achieved

      const dashboard = prdTracker.getDashboard();
      
      // Progress should be high with multiple achieved metrics
      expect(dashboard.overallProgress).toBeGreaterThan(50);
      expect(dashboard.overallProgress).toBeLessThanOrEqual(100);
    });

    it('should update dashboard timestamp on changes', async () => {
      const dashboard1 = prdTracker.getDashboard();
      const timestamp1 = dashboard1.lastUpdated;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update a metric
      prdTracker.updateMetric('response_time', 400);

      const dashboard2 = prdTracker.getDashboard();
      const timestamp2 = dashboard2.lastUpdated;

      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
    });
  });

  describe('Report Generation', () => {
    it('should generate formatted report with all metrics', () => {
      const report = prdTracker.getReport();

      expect(report).toContain('PRD v1.3 Metrics Report');
      expect(report).toContain('Overall Progress');
      expect(report).toContain('Metrics:');

      // Check for metric names
      const dashboard = prdTracker.getDashboard();
      dashboard.metrics.forEach(metric => {
        expect(report).toContain(metric.name);
      });
    });

    it('should include status indicators in report', () => {
      const report = prdTracker.getReport();

      // Should contain status icons
      expect(report).toMatch(/[✅🎯🔄📋]/);
    });

    it('should include current values and targets in report', () => {
      // Update a metric
      prdTracker.updateMetric('intent_accuracy', 97);

      const report = prdTracker.getReport();
      const metric = prdTracker.getMetric('intent_accuracy');

      expect(report).toContain(String(metric?.current));
      expect(report).toContain(String(metric?.betaTarget));
      expect(report).toContain(String(metric?.v10Target));
    });
  });

  describe('Integration with Metrics Collector', () => {
    it('should track PRD metrics alongside system metrics', () => {
      // Start metrics collection
      metricsCollector.startCollection(1000);

      // Update PRD metrics
      prdTracker.updateMetric('intent_accuracy', 96);
      prdTracker.updateMetric('response_time', 450);

      // Record a system metric
      metricsCollector.recordMetric('test_metric', 100);

      // Get PRD dashboard
      const prdDashboard = prdTracker.getDashboard();

      // Both should be available
      expect(prdDashboard.overallProgress).toBeDefined();
      expect(prdDashboard.metrics.length).toBeGreaterThan(0);

      // Stop metrics collection
      metricsCollector.stopCollection();
    });
  });

  describe('Metric Status Transitions', () => {
    it('should transition metrics through status states correctly', () => {
      // Start with pending/in_progress
      const initialMetric = prdTracker.getMetric('battery_drain');
      expect(['in_progress', 'pending']).toContain(initialMetric?.status);

      // Move to on_track
      prdTracker.updateMetric('battery_drain', 2.5);
      const onTrackMetric = prdTracker.getMetric('battery_drain');
      expect(onTrackMetric?.status).toBe('on_track');

      // Move to achieved
      prdTracker.updateMetric('battery_drain', 2);
      const achievedMetric = prdTracker.getMetric('battery_drain');
      expect(achievedMetric?.status).toBe('achieved');
    });

    it('should handle status for "higher is better" metrics', () => {
      // Intent accuracy: higher is better
      prdTracker.updateMetric('intent_accuracy', 94); // below beta target
      const metric1 = prdTracker.getMetric('intent_accuracy');
      expect(['in_progress', 'pending']).toContain(metric1?.status);

      prdTracker.updateMetric('intent_accuracy', 97); // at beta target
      const metric2 = prdTracker.getMetric('intent_accuracy');
      expect(metric2?.status).toBe('on_track');

      prdTracker.updateMetric('intent_accuracy', 98); // at v1.0 target
      const metric3 = prdTracker.getMetric('intent_accuracy');
      expect(metric3?.status).toBe('achieved');
    });
  });

  describe('Multiple Metric Updates', () => {
    it('should handle rapid sequential metric updates', () => {
      // Simulate rapid improvements
      prdTracker.updateMetric('intent_accuracy', 95);
      prdTracker.updateMetric('intent_accuracy', 96);
      prdTracker.updateMetric('intent_accuracy', 97);
      prdTracker.updateMetric('intent_accuracy', 98);

      const finalMetric = prdTracker.getMetric('intent_accuracy');
      expect(finalMetric?.current).toBe(98);
      expect(finalMetric?.status).toBe('achieved');
    });

    it('should update dashboard correctly after multiple metric changes', () => {
      // Update multiple metrics
      prdTracker.updateMetric('intent_accuracy', 98);
      prdTracker.updateMetric('battery_drain', 2);
      prdTracker.updateMetric('response_time', 250);

      const dashboard = prdTracker.getDashboard();

      // Count achieved metrics
      const achievedCount = dashboard.metrics.filter(m => m.status === 'achieved').length;
      expect(achievedCount).toBeGreaterThanOrEqual(2);

      // Overall progress should reflect improvements
      expect(dashboard.overallProgress).toBeGreaterThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle string metrics correctly', () => {
      const metric = prdTracker.getMetric('plugin_count');
      expect(metric?.current).toBe('Framework Complete');
      expect(metric?.status).toBe('in_progress');

      // Update to string value
      prdTracker.updateMetric('plugin_count', '150 plugins');
      const updated = prdTracker.getMetric('plugin_count');
      expect(updated?.current).toBe('150 plugins');
    });

    it('should handle non-existent metric keys gracefully', () => {
      const metric = prdTracker.getMetric('non_existent');
      expect(metric).toBeUndefined();

      // Updating non-existent metric should not throw
      expect(() => {
        prdTracker.updateMetric('non_existent', 100);
      }).not.toThrow();
    });

    it('should maintain metric history in dashboard', () => {
      const dashboard1 = prdTracker.getDashboard();
      const metricsCount1 = dashboard1.metrics.length;

      // Update metrics
      prdTracker.updateMetric('intent_accuracy', 97);

      const dashboard2 = prdTracker.getDashboard();
      const metricsCount2 = dashboard2.metrics.length;

      // Should have same number of metrics
      expect(metricsCount2).toBe(metricsCount1);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should track progress through development phases', () => {
      // Phase 1: Initial development
      const phase1 = prdTracker.getDashboard();
      expect(phase1.overallProgress).toBeGreaterThanOrEqual(0);

      // Phase 2: Beta targets achieved
      prdTracker.updateMetric('intent_accuracy', 97); // beta target
      prdTracker.updateMetric('battery_drain', 2.5); // beta target
      prdTracker.updateMetric('response_time', 300); // beta target

      const phase2 = prdTracker.getDashboard();
      expect(phase2.overallProgress).toBeGreaterThan(phase1.overallProgress);

      // Phase 3: v1.0 targets achieved
      prdTracker.updateMetric('intent_accuracy', 98);
      prdTracker.updateMetric('battery_drain', 2);
      prdTracker.updateMetric('response_time', 200);

      const phase3 = prdTracker.getDashboard();
      expect(phase3.overallProgress).toBeGreaterThan(phase2.overallProgress);
    });

    it('should generate executive report for stakeholders', () => {
      // Update metrics to show progress
      prdTracker.updateMetric('intent_accuracy', 96);
      prdTracker.updateMetric('battery_drain', 3);
      prdTracker.updateMetric('response_time', 400);

      const report = prdTracker.getReport();
      const dashboard = prdTracker.getDashboard();

      // Report should be readable and informative
      expect(report).toContain(`${dashboard.overallProgress}%`);
      expect(report.length).toBeGreaterThan(500); // Substantial report

      // Should be suitable for stakeholder review
      expect(report).toContain('Current:');
      expect(report).toContain('Beta Target:');
      expect(report).toContain('v1.0 Target:');
    });
  });
});
