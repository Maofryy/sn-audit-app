// Performance monitoring utilities for large hierarchy visualization

export interface PerformanceMetrics {
  renderTime: number;
  nodeCount: number;
  visibleNodes: number;
  fps: number;
  memoryUsage: number;
  customTableDiscoveryTime: number;
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private renderStartTime: number = 0;
  private customTableDiscoveryStartTime: number = 0;
  
  startRender() {
    this.renderStartTime = performance.now();
  }
  
  endRender(): number {
    return performance.now() - this.renderStartTime;
  }
  
  startCustomTableDiscovery() {
    this.customTableDiscoveryStartTime = performance.now();
  }
  
  endCustomTableDiscovery(): number {
    return performance.now() - this.customTableDiscoveryStartTime;
  }
  
  measureFPS(): number {
    const now = performance.now();
    this.frameCount++;
    
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now;
      return 60; // Initial assumption
    }
    
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    return Math.round(1000 / deltaTime);
  }
  
  getMemoryUsage(): number {
    // @ts-ignore - performance.memory is non-standard but widely supported
    if (performance.memory) {
      // @ts-ignore
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    return 0;
  }
  
  generateReport(
    nodeCount: number, 
    visibleNodes: number, 
    renderTime: number,
    customTableDiscoveryTime: number
  ): PerformanceMetrics {
    return {
      renderTime,
      nodeCount,
      visibleNodes,
      fps: this.measureFPS(),
      memoryUsage: this.getMemoryUsage(),
      customTableDiscoveryTime
    };
  }
  
  // Performance thresholds and recommendations
  static getPerformanceRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.renderTime > 100) {
      recommendations.push('Consider enabling virtualized rendering for better performance');
    }
    
    if (metrics.fps < 30) {
      recommendations.push('Frame rate is below optimal. Try reducing node density or enabling level-of-detail rendering');
    }
    
    if (metrics.nodeCount > 1000) {
      recommendations.push('Large hierarchy detected. Performance mode is recommended');
    }
    
    if (metrics.customTableDiscoveryTime > 3000) {
      recommendations.push('Custom table discovery is taking too long. Consider using custom-only filter mode');
    }
    
    if (metrics.memoryUsage > 100) {
      recommendations.push('High memory usage detected. Consider enabling intelligent culling');
    }
    
    if (metrics.visibleNodes / metrics.nodeCount < 0.3) {
      recommendations.push('Many nodes are being culled. Virtualization is working effectively');
    }
    
    return recommendations;
  }
  
  // Performance testing simulation
  static simulateLargeHierarchy(nodeCount: number = 1000): any[] {
    const nodes = [];
    const customTablePrefixes = ['u_', 'x_', 'custom_'];
    
    for (let i = 0; i < nodeCount; i++) {
      const isCustom = Math.random() < 0.15; // 15% custom tables
      const prefix = isCustom ? customTablePrefixes[Math.floor(Math.random() * customTablePrefixes.length)] : '';
      
      nodes.push({
        name: `${prefix}table_${i}`,
        label: `${isCustom ? 'Custom ' : ''}Table ${i}`,
        type: isCustom ? 'custom' : (Math.random() < 0.2 ? 'base' : 'extended'),
        customFieldCount: isCustom ? Math.floor(Math.random() * 20) + 1 : 0,
        recordCount: Math.floor(Math.random() * 10000),
        x: Math.random() * 2000,
        y: Math.random() * 1500,
        _isFiltered: false
      });
    }
    
    return nodes;
  }
  
  // Validate 2-3 second custom table discovery requirement
  static validateCustomTableDiscovery(discoveryTime: number): {
    passed: boolean;
    grade: 'excellent' | 'good' | 'acceptable' | 'poor';
    message: string;
  } {
    if (discoveryTime <= 2000) {
      return {
        passed: true,
        grade: 'excellent',
        message: `Custom tables discovered in ${discoveryTime}ms - Excellent performance!`
      };
    } else if (discoveryTime <= 3000) {
      return {
        passed: true,
        grade: 'good',
        message: `Custom tables discovered in ${discoveryTime}ms - Within target range`
      };
    } else if (discoveryTime <= 5000) {
      return {
        passed: false,
        grade: 'acceptable',
        message: `Custom tables discovered in ${discoveryTime}ms - Slightly above target`
      };
    } else {
      return {
        passed: false,
        grade: 'poor',
        message: `Custom tables discovered in ${discoveryTime}ms - Performance needs improvement`
      };
    }
  }
}