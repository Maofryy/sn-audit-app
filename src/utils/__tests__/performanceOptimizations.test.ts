import { describe, it, expect, beforeEach } from 'vitest';
import { PERFORMANCE_THRESHOLDS, NetworkPerformanceMonitor } from '../performanceOptimizations';

describe('Performance Optimizations', () => {
  describe('PERFORMANCE_THRESHOLDS', () => {
    it('has expected threshold values', () => {
      expect(PERFORMANCE_THRESHOLDS.SMALL_NETWORK).toBe(100);
      expect(PERFORMANCE_THRESHOLDS.MEDIUM_NETWORK).toBe(500);
      expect(PERFORMANCE_THRESHOLDS.LARGE_NETWORK).toBe(1000);
      expect(PERFORMANCE_THRESHOLDS.VERY_LARGE_NETWORK).toBe(2000);
    });
  });

  describe('NetworkPerformanceMonitor', () => {
    let monitor: NetworkPerformanceMonitor;

    beforeEach(() => {
      monitor = new NetworkPerformanceMonitor();
    });

    it('initializes with default metrics', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.renderTime).toBe(0);
      expect(metrics.frameCount).toBe(0);
      expect(metrics.nodeCount).toBe(0);
      expect(metrics.edgeCount).toBe(0);
    });

    it('tracks render time', () => {
      monitor.startRender();
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait 10ms
      }
      
      monitor.endRender();
      
      const metrics = monitor.getMetrics();
      expect(metrics.renderTime).toBeGreaterThan(0);
      expect(metrics.renderTime).toBeLessThan(1000); // Should be less than 1 second
    });

    it('updates frame metrics', () => {
      monitor.updateFrame();
      monitor.updateFrame();
      
      const metrics = monitor.getMetrics();
      expect(metrics.frameCount).toBe(1); // First call doesn't count
    });

    it('calculates performance metrics correctly', () => {
      monitor.setNetworkSize(150, 300);
      
      const metrics = monitor.getMetrics();
      expect(metrics.nodeCount).toBe(150);
      expect(metrics.edgeCount).toBe(300);
      expect(metrics.networkComplexity).toBe('medium');
    });

    it('provides appropriate recommendations for large networks', () => {
      monitor.setNetworkSize(1500, 3000);
      
      const metrics = monitor.getMetrics();
      expect(metrics.networkComplexity).toBe('very-large');
      expect(monitor.shouldUseCanvasRendering()).toBe(true);
    });
  });
});