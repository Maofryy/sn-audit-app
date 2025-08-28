import * as d3 from 'd3';
import { GraphLayoutType } from '@/components/GraphControls';

export interface TreeNodeData {
  name: string;
  label: string;
  type: 'base' | 'extended' | 'custom';
  table?: unknown;
  children?: TreeNodeData[];
  customFieldCount?: number;
  recordCount?: number;
  relationships?: unknown[];
  _isFiltered?: boolean;
}

export interface LayoutDimensions {
  width: number;
  height: number;
}

export interface LayoutMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RadialLayoutSettings {
  radiusStep: number;
  nodeSpacing: number; 
  levelSpacing: number;
}

export interface LayoutResult {
  nodes: d3.HierarchyPointNode<TreeNodeData>[];
  links: d3.HierarchyPointLink<TreeNodeData>[];
  bounds: {
    width: number;
    height: number;
  };
  margin: LayoutMargin;
  nodeCount: number;
  isHighPerformance: boolean;
  isUltraHighPerformance: boolean;
  layoutWidth: number;
  layoutHeight: number;
}

export interface LayoutAlgorithm {
  name: GraphLayoutType;
  calculate: (
    treeData: TreeNodeData,
    dimensions: LayoutDimensions,
    performanceMode: 'auto' | 'high' | 'maximum',
    radialSettings?: RadialLayoutSettings
  ) => LayoutResult;
}

// Base layout class for common functionality
abstract class BaseLayout implements LayoutAlgorithm {
  abstract name: GraphLayoutType;

  protected getMargin(): LayoutMargin {
    return { top: 40, right: 40, bottom: 40, left: 40 };
  }

  protected calculatePerformanceMetrics(nodeCount: number) {
    return {
      isHighPerformance: nodeCount > 500,
      isUltraHighPerformance: nodeCount > 1000
    };
  }

  abstract calculate(
    treeData: TreeNodeData,
    dimensions: LayoutDimensions,
    performanceMode: 'auto' | 'high' | 'maximum',
    radialSettings?: RadialLayoutSettings
  ): LayoutResult;
}

// Horizontal Tree Layout (current implementation)
export class HorizontalTreeLayout extends BaseLayout {
  name: GraphLayoutType = 'tree';

  calculate(
    treeData: TreeNodeData,
    dimensions: LayoutDimensions,
    performanceMode: 'auto' | 'high' | 'maximum',
    radialSettings?: RadialLayoutSettings
  ): LayoutResult {
    const root = d3.hierarchy(treeData, d => d.children);
    const nodeCount = root.descendants().length;
    const margin = this.getMargin();
    const { isHighPerformance, isUltraHighPerformance } = this.calculatePerformanceMetrics(nodeCount);

    // Use full available canvas dimensions
    const availableWidth = dimensions.width - margin.left - margin.right;
    const availableHeight = dimensions.height - margin.top - margin.bottom;

    // Calculate optimal layout dimensions based on tree structure
    const depth = Math.max(...root.descendants().map(d => d.depth));
    const maxNodesAtLevel = Math.max(...Array.from({length: depth + 1}, (_, i) => 
      root.descendants().filter(d => d.depth === i).length
    ));

    // Dynamic sizing that utilizes full canvas
    let layoutWidth = Math.max(availableWidth, depth * 200);
    let layoutHeight = Math.max(availableHeight, maxNodesAtLevel * 50);

    // Performance-based adjustments
    if (isUltraHighPerformance) {
      layoutWidth = Math.max(layoutWidth, availableWidth * 1.2);
      layoutHeight = Math.max(layoutHeight, availableHeight * 1.5);
    } else if (isHighPerformance) {
      layoutWidth = Math.max(layoutWidth, availableWidth * 1.1);
      layoutHeight = Math.max(layoutHeight, availableHeight * 1.3);
    }

    // Use horizontal layout (width and height swapped for d3.tree)
    const treeLayout = d3.tree()
      .size([layoutHeight, layoutWidth])
      .separation((a, b) => {
        const baseSeparation = 1.0;
        const densityFactor = Math.min(2.0, Math.max(0.5, 50 / maxNodesAtLevel));
        
        if (a.parent === b.parent) {
          return baseSeparation * densityFactor;
        }
        return baseSeparation * densityFactor * 1.5;
      });

    const layoutRoot = treeLayout(root);

    // Calculate actual bounds used by the layout
    const allNodes = layoutRoot.descendants();
    const minX = Math.min(...allNodes.map(d => d.x));
    const maxX = Math.max(...allNodes.map(d => d.x));
    const minY = Math.min(...allNodes.map(d => d.y));
    const maxY = Math.max(...allNodes.map(d => d.y));

    const actualWidth = maxY - minY + 100;
    const actualHeight = maxX - minX + 100;

    return {
      nodes: layoutRoot.descendants(),
      links: layoutRoot.links(),
      bounds: { 
        width: Math.max(actualWidth, availableWidth) + margin.left + margin.right, 
        height: Math.max(actualHeight, availableHeight) + margin.top + margin.bottom 
      },
      margin,
      nodeCount,
      isHighPerformance,
      isUltraHighPerformance,
      layoutWidth: actualWidth,
      layoutHeight: actualHeight
    };
  }
}

// Radial layout removed - was causing readability issues with large graphs


// Sunburst Layout (placeholder for future implementation)
export class SunburstLayout extends BaseLayout {
  name: GraphLayoutType = 'sunburst';

  calculate(
    treeData: TreeNodeData,
    dimensions: LayoutDimensions,
    performanceMode: 'auto' | 'high' | 'maximum',
    radialSettings?: RadialLayoutSettings
  ): LayoutResult {
    // For now, use the horizontal tree layout as fallback
    const horizontalLayout = new HorizontalTreeLayout();
    const result = horizontalLayout.calculate(treeData, dimensions, performanceMode);
    
    // TODO: Implement sunburst layout using d3.partition
    
    return result;
  }
}

// Layout Factory
export class TreeLayoutFactory {
  private static layouts: Map<GraphLayoutType, LayoutAlgorithm> = new Map([
    ['tree', new HorizontalTreeLayout()],
    ['sunburst', new SunburstLayout()],
    // Note: force-directed would be implemented differently as it's not hierarchical
    // Note: radial layout removed due to readability issues with large graphs
  ]);

  static getLayout(type: GraphLayoutType): LayoutAlgorithm {
    const layout = this.layouts.get(type);
    if (!layout) {
      console.warn(`Layout type '${type}' not found, falling back to tree layout`);
      return this.layouts.get('tree')!;
    }
    return layout;
  }

  static getSupportedLayouts(): GraphLayoutType[] {
    return Array.from(this.layouts.keys());
  }
}