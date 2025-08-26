import { useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface VirtualizedNode {
  id: string;
  x: number;
  y: number;
  data: any;
  visible: boolean;
  lodLevel: 'full' | 'simplified' | 'minimal';
  priority: 'high' | 'medium' | 'low';
}

interface VirtualizedLink {
  id: string;
  source: VirtualizedNode;
  target: VirtualizedNode;
  visible: boolean;
}

interface VirtualizedRendererProps {
  nodes: d3.HierarchyPointNode<any>[];
  links: d3.HierarchyPointLink<any>[];
  transform: { x: number; y: number; k: number };
  bounds: { width: number; height: number };
  customTableEmphasis: 'subtle' | 'moderate' | 'maximum';
  onRender: (visibleNodes: VirtualizedNode[], visibleLinks: VirtualizedLink[]) => void;
}

export function VirtualizedRenderer({
  nodes,
  links,
  transform,
  bounds,
  customTableEmphasis,
  onRender
}: VirtualizedRendererProps) {
  const frameRef = useRef<number>();
  const lastTransformRef = useRef(transform);
  
  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    HIGH_NODE_COUNT: 500,
    ULTRA_HIGH_NODE_COUNT: 1000,
    VIEWPORT_BUFFER: 200,
    MIN_ZOOM_FOR_LABELS: 0.5,
    MIN_ZOOM_FOR_DETAILS: 1.0,
    CUSTOM_TABLE_PRIORITY_ZOOM: 0.3
  };

  // Calculate viewport bounds with buffer
  const getViewportBounds = useMemo(() => {
    const { x, y, k } = transform;
    const buffer = PERFORMANCE_THRESHOLDS.VIEWPORT_BUFFER / k;
    
    return {
      left: (-x / k) - buffer,
      right: (-x / k) + (bounds.width / k) + buffer,
      top: (-y / k) - buffer,
      bottom: (-y / k) + (bounds.height / k) + buffer
    };
  }, [transform, bounds]);

  // Determine level of detail based on zoom and node count
  const getLevelOfDetail = (node: any, zoom: number, nodeCount: number): 'full' | 'simplified' | 'minimal' => {
    const isCustomTable = node.data?.type === 'custom';
    
    // Custom tables always get priority
    if (isCustomTable && zoom >= PERFORMANCE_THRESHOLDS.CUSTOM_TABLE_PRIORITY_ZOOM) {
      return 'full';
    }
    
    // Performance-based LOD
    if (nodeCount > PERFORMANCE_THRESHOLDS.ULTRA_HIGH_NODE_COUNT) {
      if (zoom < 0.5) return 'minimal';
      if (zoom < 1.0) return 'simplified';
      return 'full';
    }
    
    if (nodeCount > PERFORMANCE_THRESHOLDS.HIGH_NODE_COUNT) {
      if (zoom < 0.3) return 'minimal';
      if (zoom < 0.7) return 'simplified';
      return 'full';
    }
    
    return zoom < PERFORMANCE_THRESHOLDS.MIN_ZOOM_FOR_DETAILS ? 'simplified' : 'full';
  };

  // Calculate node priority for rendering order
  const getNodePriority = (node: any): 'high' | 'medium' | 'low' => {
    if (node.data?.type === 'custom') return 'high';
    if (node.data?.type === 'base') return 'medium';
    return 'low';
  };

  // Virtualized node processing
  const processVirtualizedNodes = useMemo(() => {
    const viewport = getViewportBounds;
    const zoom = transform.k;
    const nodeCount = nodes.length;
    
    return nodes.map(node => {
      const x = node.y || 0;
      const y = node.x || 0;
      
      // Frustum culling - check if node is in viewport
      const inViewport = x >= viewport.left && 
                        x <= viewport.right && 
                        y >= viewport.top && 
                        y <= viewport.bottom;
      
      // Custom table preservation - always render if custom and zoom > threshold
      const isCustomTable = node.data?.type === 'custom';
      const preserveCustom = isCustomTable && zoom >= PERFORMANCE_THRESHOLDS.CUSTOM_TABLE_PRIORITY_ZOOM;
      
      const visible = inViewport || preserveCustom;
      const lodLevel = getLevelOfDetail(node, zoom, nodeCount);
      const priority = getNodePriority(node);
      
      return {
        id: node.data?.name || `node-${x}-${y}`,
        x,
        y,
        data: node.data,
        visible,
        lodLevel,
        priority,
        originalNode: node
      } as VirtualizedNode;
    }).filter(node => node.visible);
  }, [nodes, getViewportBounds, transform.k]);

  // Enhanced link processing with extended viewport for better zoom behavior
  const processVirtualizedLinks = useMemo(() => {
    const { x, y, k } = transform;
    const extendedBuffer = (PERFORMANCE_THRESHOLDS.VIEWPORT_BUFFER * 2) / k; // Double buffer for links
    
    // Extended viewport specifically for link rendering
    const linkViewport = {
      left: (-x / k) - extendedBuffer,
      right: (-x / k) + (bounds.width / k) + extendedBuffer,
      top: (-y / k) - extendedBuffer,
      bottom: (-y / k) + (bounds.height / k) + extendedBuffer
    };
    
    // Create a map of all nodes (not just visible ones) for link processing
    const allNodesMap = new Map(nodes.map(node => [
      node.data?.name || `node-${node.y}-${node.x}`,
      node
    ]));
    
    const visibleNodeIds = new Set(processVirtualizedNodes.map(n => n.id));
    
    return links.map(link => {
      const sourceId = link.source.data?.name || `node-${link.source.y}-${link.source.x}`;
      const targetId = link.target.data?.name || `node-${link.target.y}-${link.target.x}`;
      
      const sourceNode = allNodesMap.get(sourceId);
      const targetNode = allNodesMap.get(targetId);
      
      if (!sourceNode || !targetNode) return null;
      
      const sourceX = sourceNode.y || 0;
      const sourceY = sourceNode.x || 0;
      const targetX = targetNode.y || 0;
      const targetY = targetNode.x || 0;
      
      // Check if link intersects with the extended viewport
      const linkIntersectsViewport = (
        // At least one endpoint is in viewport
        (sourceX >= linkViewport.left && sourceX <= linkViewport.right && 
         sourceY >= linkViewport.top && sourceY <= linkViewport.bottom) ||
        (targetX >= linkViewport.left && targetX <= linkViewport.right && 
         targetY >= linkViewport.top && targetY <= linkViewport.bottom) ||
        // Link crosses viewport (simplified check)
        (Math.min(sourceX, targetX) <= linkViewport.right && 
         Math.max(sourceX, targetX) >= linkViewport.left &&
         Math.min(sourceY, targetY) <= linkViewport.bottom && 
         Math.max(sourceY, targetY) >= linkViewport.top)
      );
      
      // For links involving custom tables, be more lenient
      const involvesCustomTable = sourceNode.data?.type === 'custom' || targetNode.data?.type === 'custom';
      const customTableLeniency = involvesCustomTable && k >= PERFORMANCE_THRESHOLDS.CUSTOM_TABLE_PRIORITY_ZOOM;
      
      const visible = linkIntersectsViewport || customTableLeniency;
      
      return {
        id: `${sourceId}-${targetId}`,
        source: processVirtualizedNodes.find(n => n.id === sourceId) || {
          id: sourceId,
          x: sourceX,
          y: sourceY,
          data: sourceNode.data,
          visible: visibleNodeIds.has(sourceId),
          lodLevel: 'simplified' as const,
          priority: 'low' as const,
          originalNode: sourceNode
        },
        target: processVirtualizedNodes.find(n => n.id === targetId) || {
          id: targetId,
          x: targetX,
          y: targetY,
          data: targetNode.data,
          visible: visibleNodeIds.has(targetId),
          lodLevel: 'simplified' as const,
          priority: 'low' as const,
          originalNode: targetNode
        },
        visible,
        originalLink: link
      } as VirtualizedLink;
    }).filter(link => link && link.visible);
  }, [links, processVirtualizedNodes, transform, bounds, nodes]);

  // Intelligent rendering with requestAnimationFrame
  useEffect(() => {
    // Cancel previous frame
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    
    // Batch render updates
    frameRef.current = requestAnimationFrame(() => {
      // Sort nodes by priority for rendering order
      const sortedNodes = [...processVirtualizedNodes].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      
      onRender(sortedNodes, processVirtualizedLinks);
      lastTransformRef.current = transform;
    });
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [processVirtualizedNodes, processVirtualizedLinks, transform, onRender]);

  // Performance monitoring
  const getPerformanceMetrics = useMemo(() => {
    const totalNodes = nodes.length;
    const visibleNodes = processVirtualizedNodes.length;
    const culledNodes = totalNodes - visibleNodes;
    const customTablesVisible = processVirtualizedNodes.filter(n => n.data?.type === 'custom').length;
    
    return {
      totalNodes,
      visibleNodes,
      culledNodes,
      cullPercentage: Math.round((culledNodes / totalNodes) * 100),
      customTablesVisible,
      zoom: Math.round(transform.k * 100) / 100,
      performanceLevel: totalNodes > PERFORMANCE_THRESHOLDS.ULTRA_HIGH_NODE_COUNT ? 'ultra-high' :
                       totalNodes > PERFORMANCE_THRESHOLDS.HIGH_NODE_COUNT ? 'high' : 'normal'
    };
  }, [nodes.length, processVirtualizedNodes, transform.k]);

  return null; // This is a logic component, no visual output
}

// Performance optimization hook
export function useVirtualizedPerformance() {
  const performanceRef = useRef({
    frameTime: 0,
    lastFrameTime: Date.now(),
    averageFrameTime: 16, // Target 60fps
    frameCount: 0
  });

  const measurePerformance = () => {
    const now = Date.now();
    const frameTime = now - performanceRef.current.lastFrameTime;
    performanceRef.current.frameTime = frameTime;
    performanceRef.current.frameCount++;
    
    // Calculate rolling average
    performanceRef.current.averageFrameTime = 
      (performanceRef.current.averageFrameTime * 0.9) + (frameTime * 0.1);
    
    performanceRef.current.lastFrameTime = now;
    
    return {
      currentFPS: Math.round(1000 / frameTime),
      averageFPS: Math.round(1000 / performanceRef.current.averageFrameTime),
      frameTime: frameTime,
      isPerformant: frameTime < 33 // 30fps threshold
    };
  };

  return { measurePerformance };
}