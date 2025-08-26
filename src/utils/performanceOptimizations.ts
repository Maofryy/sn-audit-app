import * as d3 from 'd3';

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  SMALL_NETWORK: 100,
  MEDIUM_NETWORK: 500, 
  LARGE_NETWORK: 1000,
  VERY_LARGE_NETWORK: 2000
} as const;

// Canvas-based rendering for very large networks
export class CanvasNetworkRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private transform: d3.ZoomTransform;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d')!;
    this.transform = d3.zoomIdentity;
  }

  setTransform(transform: d3.ZoomTransform) {
    this.transform = transform;
  }

  clear() {
    this.context.save();
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.restore();
  }

  renderNetwork(nodes: any[], links: any[]) {
    this.clear();
    
    this.context.save();
    this.context.translate(this.transform.x, this.transform.y);
    this.context.scale(this.transform.k, this.transform.k);

    // Render links first (behind nodes)
    this.renderLinks(links);
    
    // Then render nodes
    this.renderNodes(nodes);

    this.context.restore();
  }

  private renderLinks(links: any[]) {
    this.context.strokeStyle = '#cbd5e1';
    this.context.lineWidth = 1.5;

    for (const link of links) {
      this.context.beginPath();
      this.context.moveTo(link.source.x, link.source.y);
      this.context.lineTo(link.target.x, link.target.y);
      this.context.stroke();
    }
  }

  private renderNodes(nodes: any[]) {
    for (const node of nodes) {
      this.context.beginPath();
      this.context.arc(node.x, node.y, this.getNodeRadius(node), 0, 2 * Math.PI);
      
      // Fill
      this.context.fillStyle = this.getNodeColor(node);
      this.context.fill();
      
      // Stroke
      this.context.strokeStyle = this.getNodeBorderColor(node);
      this.context.lineWidth = 2;
      this.context.stroke();

      // Text label (for smaller networks only)
      if (nodes.length < PERFORMANCE_THRESHOLDS.MEDIUM_NETWORK) {
        this.renderNodeLabel(node);
      }
    }
  }

  private renderNodeLabel(node: any) {
    this.context.fillStyle = '#374151';
    this.context.font = '10px sans-serif';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    
    const label = node.table?.label || node.label;
    const truncatedLabel = label.length > 12 ? label.substring(0, 9) + '...' : label;
    
    this.context.fillText(truncatedLabel, node.x, node.y);
  }

  private getNodeRadius(node: any): number {
    if (node.table?.is_custom) return 8;
    if (node.table?.table_type === 'base') return 10;
    return 6;
  }

  private getNodeColor(node: any): string {
    if (!node.table) return '#64748b';
    if (node.table.is_custom) return '#ea580c';
    if (node.table.table_type === 'base') return '#3b82f6';
    return '#10b981';
  }

  private getNodeBorderColor(node: any): string {
    if (!node.table) return '#475569';
    if (node.table.is_custom) return '#c2410c';
    if (node.table.table_type === 'base') return '#2563eb';
    return '#059669';
  }
}

// Performance monitoring utilities
export class NetworkPerformanceMonitor {
  private metrics: {
    renderStartTime: number;
    renderEndTime: number;
    frameCount: number;
    lastFrameTime: number;
    averageFPS: number;
    nodeCount: number;
    edgeCount: number;
  } = {
    renderStartTime: 0,
    renderEndTime: 0,
    frameCount: 0,
    lastFrameTime: 0,
    averageFPS: 0,
    nodeCount: 0,
    edgeCount: 0
  };

  startRender() {
    this.metrics.renderStartTime = performance.now();
  }

  endRender() {
    this.metrics.renderEndTime = performance.now();
  }

  updateFrame() {
    const now = performance.now();
    if (this.metrics.lastFrameTime > 0) {
      const delta = now - this.metrics.lastFrameTime;
      this.metrics.frameCount++;
      
      // Calculate rolling average FPS
      const currentFPS = 1000 / delta;
      this.metrics.averageFPS = (this.metrics.averageFPS * 0.9) + (currentFPS * 0.1);
    }
    this.metrics.lastFrameTime = now;
  }

  setNetworkSize(nodeCount: number, edgeCount: number) {
    this.metrics.nodeCount = nodeCount;
    this.metrics.edgeCount = edgeCount;
  }

  getMetrics() {
    return {
      renderTime: this.metrics.renderEndTime - this.metrics.renderStartTime,
      averageFPS: Math.round(this.metrics.averageFPS),
      frameCount: this.metrics.frameCount,
      nodeCount: this.metrics.nodeCount,
      edgeCount: this.metrics.edgeCount,
      networkComplexity: this.getNetworkComplexity()
    };
  }

  private getNetworkComplexity(): 'small' | 'medium' | 'large' | 'very-large' {
    const { nodeCount, edgeCount } = this.metrics;
    const totalElements = nodeCount + edgeCount;
    
    if (totalElements < PERFORMANCE_THRESHOLDS.SMALL_NETWORK) return 'small';
    if (totalElements < PERFORMANCE_THRESHOLDS.MEDIUM_NETWORK) return 'medium';
    if (totalElements < PERFORMANCE_THRESHOLDS.LARGE_NETWORK) return 'large';
    return 'very-large';
  }

  shouldUseCanvasRendering(): boolean {
    return this.metrics.nodeCount > PERFORMANCE_THRESHOLDS.LARGE_NETWORK || 
           this.metrics.edgeCount > PERFORMANCE_THRESHOLDS.LARGE_NETWORK;
  }

  shouldReduceAnimations(): boolean {
    return this.metrics.averageFPS < 30 && this.metrics.frameCount > 10;
  }
}

// Network optimization utilities
export class NetworkOptimizer {
  // Reduce network complexity by removing low-importance edges
  static optimizeNetwork(nodes: any[], edges: any[], maxEdges: number = 1000) {
    if (edges.length <= maxEdges) {
      return { nodes, edges };
    }

    // Priority scoring for edges
    const scoredEdges = edges.map(edge => ({
      ...edge,
      score: this.calculateEdgeImportance(edge, nodes)
    }));

    // Sort by importance and take top edges
    const optimizedEdges = scoredEdges
      .sort((a, b) => b.score - a.score)
      .slice(0, maxEdges);

    // Keep only nodes that have connections
    const connectedNodeIds = new Set();
    optimizedEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const optimizedNodes = nodes.filter(node => connectedNodeIds.has(node.id));

    return {
      nodes: optimizedNodes,
      edges: optimizedEdges
    };
  }

  private static calculateEdgeImportance(edge: any, nodes: any[]): number {
    let score = 0;

    // Inheritance relationships are more important
    if (edge.type === 'extends') {
      score += 10;
    }

    // Relationships involving custom tables are important
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (sourceNode?.table?.is_custom || targetNode?.table?.is_custom) {
      score += 5;
    }

    // Base table relationships are important
    if (sourceNode?.table?.table_type === 'base' || targetNode?.table?.table_type === 'base') {
      score += 3;
    }

    return score;
  }

  // Clustering algorithm for very large networks
  static clusterNodes(nodes: any[], edges: any[], maxClusters: number = 20) {
    // Simple clustering based on connected components
    const clusters = new Map<string, Set<string>>();
    const nodeCluster = new Map<string, string>();

    // Find connected components
    const visited = new Set<string>();
    let clusterId = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cluster = new Set<string>();
        const stack = [node.id];
        
        while (stack.length > 0) {
          const currentId = stack.pop()!;
          if (visited.has(currentId)) continue;
          
          visited.add(currentId);
          cluster.add(currentId);
          nodeCluster.set(currentId, `cluster_${clusterId}`);

          // Add connected nodes
          edges
            .filter(e => e.source === currentId || e.target === currentId)
            .forEach(e => {
              const connectedId = e.source === currentId ? e.target : e.source;
              if (!visited.has(connectedId)) {
                stack.push(connectedId);
              }
            });
        }

        clusters.set(`cluster_${clusterId}`, cluster);
        clusterId++;
      }
    }

    return {
      clusters: Array.from(clusters.entries()).map(([id, nodeIds]) => ({
        id,
        nodeIds: Array.from(nodeIds),
        size: nodeIds.size
      })),
      nodeCluster
    };
  }
}

// Debounced search for large datasets
export function createDebouncedSearch(callback: (term: string) => void, delay: number = 300) {
  let timeoutId: NodeJS.Timeout;
  
  return (searchTerm: string) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(searchTerm);
    }, delay);
  };
}

// Virtual rendering for large node lists
export class VirtualNodeRenderer {
  private viewportHeight: number;
  private itemHeight: number;
  private scrollTop: number = 0;

  constructor(viewportHeight: number, itemHeight: number = 40) {
    this.viewportHeight = viewportHeight;
    this.itemHeight = itemHeight;
  }

  getVisibleRange(totalItems: number): { start: number; end: number } {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.viewportHeight / this.itemHeight);
    const end = Math.min(start + visibleCount + 1, totalItems);

    return { start, end };
  }

  updateScrollTop(scrollTop: number) {
    this.scrollTop = scrollTop;
  }

  getTotalHeight(totalItems: number): number {
    return totalItems * this.itemHeight;
  }
}