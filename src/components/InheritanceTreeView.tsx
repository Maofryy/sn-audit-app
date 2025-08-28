import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ZoomIn, ZoomOut, RotateCcw, Loader2, AlertTriangle, Database, Users, Calendar } from 'lucide-react';
import { GraphLayoutType } from './GraphControls';
import { GraphSidebarOverlay } from './GraphSidebarOverlay';
import { TypesLegendCard } from './TypesLegendCard';
import { GraphSearchOverlay } from './GraphSearchOverlay';
import { VirtualizedRenderer, useVirtualizedPerformance } from './VirtualizedRenderer';
import { HierarchyMiniMap } from './HierarchyMiniMap';
import { PerformanceMonitor } from '@/utils/performanceMonitor';
import { serviceNowService } from '@/services/serviceNowService';
import { useCMDBData } from '@/contexts/CMDBDataContext';
import { TableMetadata, FieldMetadata } from '@/types';
import { TreeLayoutFactory, TreeNodeData } from '@/utils/treeLayoutAlgorithms';

interface NodeDetails {
  table: TableMetadata;
  customFields: FieldMetadata[];
  referenceFields: FieldMetadata[];
  childTables: TableMetadata[];
  recordCount?: number;
}

export function InheritanceTreeView() {
  // Data fetching
  const { tables: cmdbTablesData, isLoading: cmdbTablesLoading } = useCMDBData();
  
  // State management
  const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TreeNodeData | null>(null);
  const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // New state for sidebar and search
  const [layoutType, setLayoutType] = useState<GraphLayoutType>('tree');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleTableTypes, setVisibleTableTypes] = useState({
    base: true,
    extended: true,
    custom: true
  });
  
  // Enhanced custom table controls
  const [customTableEmphasis, setCustomTableEmphasis] = useState<'subtle' | 'moderate' | 'maximum'>('moderate');
  const [showCustomOnly, setShowCustomOnly] = useState(false);
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set());
  
  // Performance optimization state
  const [performanceMode, setPerformanceMode] = useState<'auto' | 'high' | 'maximum'>('auto');
  const [virtualizedNodes, setVirtualizedNodes] = useState<any[]>([]);
  const [virtualizedLinks, setVirtualizedLinks] = useState<any[]>([]);
  const { measurePerformance } = useVirtualizedPerformance();
  const performanceMonitor = useRef(new PerformanceMonitor());
  
  // Radial layout removed - settings no longer needed
  
  // Refs for DOM access
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Load ServiceNow table hierarchy
  useEffect(() => {
    const loadTableHierarchy = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const hierarchy = await serviceNowService.buildTableHierarchy();
        const treeStructure = convertHierarchyToTree(hierarchy.root);
        
        setTreeData(treeStructure);
      } catch (err) {
        console.error('Failed to load table hierarchy:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadTableHierarchy();
  }, []);

  // Convert hierarchy to tree structure
  const convertHierarchyToTree = useCallback((node: { table: TableMetadata; children?: any[]; customFieldCount?: number; totalRecordCount?: number }): TreeNodeData => {
    const tableType = node.table.table_type || (
      node.table.is_custom ? 'custom' : 
      (node.table.name === 'cmdb_ci' || node.table.name === 'cmdb') ? 'base' : 'extended'
    );
    
    return {
      name: node.table.name,
      label: node.table.label,
      type: tableType,
      table: node.table,
      customFieldCount: node.customFieldCount,
      recordCount: node.totalRecordCount,
      children: node.children?.map(convertHierarchyToTree)
    };
  }, []);

  // Apply visual filtering based on search and table type filters
  const applyVisualFiltering = useCallback((node: TreeNodeData): TreeNodeData => {
    const processedChildren = node.children?.map(child => applyVisualFiltering(child)) || [];
    
    // Check if node matches search term
    const matchesSearch = !searchTerm || 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.label.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Custom-only mode filtering
    if (showCustomOnly) {
      const isCustomOrHasCustomDescendant = (n: TreeNodeData): boolean => {
        if (n.type === 'custom' && matchesSearch) return true;
        return n.children?.some(child => isCustomOrHasCustomDescendant(child)) || false;
      };
      
      const shouldShow = node.type === 'base' || isCustomOrHasCustomDescendant(node);
      
      return {
        ...node,
        children: processedChildren.length > 0 ? processedChildren : undefined,
        _isFiltered: !shouldShow
      };
    }
    
    // Standard filtering logic
    const hasVisibleDescendant = (n: TreeNodeData): boolean => {
      const nodeMatchesFilter = n.type === 'base' || visibleTableTypes[n.type];
      const nodeMatchesSearch = !searchTerm || 
        n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.label.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (nodeMatchesFilter && nodeMatchesSearch) {
        return true;
      }
      return n.children?.some(child => hasVisibleDescendant(child)) || false;
    };
    
    // Determine if this node should be dimmed
    const shouldNotDim = ((node.type === 'base' || visibleTableTypes[node.type]) && matchesSearch) || hasVisibleDescendant(node);
    
    return {
      ...node,
      children: processedChildren.length > 0 ? processedChildren : undefined,
      _isFiltered: !shouldNotDim
    };
  }, [visibleTableTypes, searchTerm, showCustomOnly]);

  // Enhanced tree layout using modular layout algorithms
  const layoutResult = useMemo(() => {
    if (!treeData) return null;
    
    const visuallyFilteredTreeData = applyVisualFiltering(treeData);
    const layout = TreeLayoutFactory.getLayout(layoutType);
    
    return layout.calculate(visuallyFilteredTreeData, dimensions, performanceMode);
  }, [treeData, dimensions, layoutType, applyVisualFiltering, performanceMode]);

  // Control handlers
  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1 / 1.5);
    }
  };

  const handleResetView = () => {
    if (zoomRef.current && svgRef.current && layoutResult) {
      // Calculate centered initial transform - smaller scale for massive graphs
      let initialScale = Math.min(
        dimensions.width / layoutResult.bounds.width,
        dimensions.height / layoutResult.bounds.height,
        1
      );
      
      // Standard initial scale
      initialScale = initialScale * 0.9;
      
      const centerX = (dimensions.width - layoutResult.bounds.width * initialScale) / 2;
      const centerY = (dimensions.height - layoutResult.bounds.height * initialScale) / 2;
      
      const resetTransform = d3.zoomIdentity
        .translate(centerX, centerY)
        .scale(initialScale);
      
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, resetTransform);
    }
    setSelectedNode(null);
    setHoveredNode(null);
    setHighlightedPaths(new Set());
  };

  // Setup D3 zoom behavior with proper initial positioning
  useEffect(() => {
    if (!svgRef.current || !treeData || !layoutResult) return;

    const svg = d3.select(svgRef.current);
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10]) // Standard zoom range
      .on('zoom', (event) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k
        });
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    
    // Center the graph initially with appropriate scale for massive graphs
    let initialScale = Math.min(
      dimensions.width / layoutResult.bounds.width,
      dimensions.height / layoutResult.bounds.height,
      1
    );
    
    // Standard initial scale with padding
    initialScale = initialScale * 0.9; // 90% to add some padding
    
    const centerX = (dimensions.width - layoutResult.bounds.width * initialScale) / 2;
    const centerY = (dimensions.height - layoutResult.bounds.height * initialScale) / 2;
    
    const initialTransform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(initialScale);
    
    svg.call(zoom.transform, initialTransform);

    return () => {
      svg.on('.zoom', null);
    };
  }, [treeData, layoutResult, dimensions]);

  // Resize handler
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const newWidth = Math.max(400, rect.width);
          const newHeight = Math.max(400, rect.height);
          
          setDimensions(prev => {
            if (Math.abs(prev.width - newWidth) > 10 || Math.abs(prev.height - newHeight) > 10) {
              return { width: newWidth, height: newHeight };
            }
            return prev;
          });
        }
      }, 150);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);


  // Enhanced node styling with orange custom table emphasis and LOD
  const getNodeStyle = (nodeType: string, isSelected: boolean, isHovered: boolean, isFiltered: boolean, lodLevel: 'full' | 'simplified' | 'minimal' = 'full') => {
    // Base styles - standard sizing
    const baseRadius = 6;
    const baseStrokeWidth = 2;
    
    const styles = {
      base: {
        fill: '#1e40af',
        stroke: '#1e293b',
        radius: baseRadius,
        strokeWidth: baseStrokeWidth
      },
      extended: {
        fill: '#059669',
        stroke: '#1e293b', 
        radius: baseRadius + 1,
        strokeWidth: baseStrokeWidth
      },
      custom: {
        fill: '#ea580c',
        stroke: '#9a3412',
        radius: baseRadius + 4,
        strokeWidth: baseStrokeWidth + 1
      }
    };

    let style = styles[nodeType as keyof typeof styles] || styles.extended;
    
    // Level of detail adjustments
    if (lodLevel === 'simplified') {
      style = {
        ...style,
        radius: Math.max(4, style.radius * 0.8),
        strokeWidth: Math.max(1, style.strokeWidth - 1)
      };
    } else if (lodLevel === 'minimal') {
      style = {
        ...style,
        radius: Math.max(3, style.radius * 0.6),
        strokeWidth: 1
      };
    }
    
    // Performance mode adjustments
    if (layoutResult?.isHighPerformance) {
      style = {
        ...style,
        radius: Math.max(3, style.radius * 0.8),
        strokeWidth: Math.max(1, style.strokeWidth)
      };
    }
    
    if (isFiltered) {
      style = {
        ...style,
        fill: '#d1d5db',
        stroke: '#9ca3af'
      };
    }
    
    if (isSelected) {
      style = {
        ...style,
        radius: style.radius + 2,
        strokeWidth: style.strokeWidth + 1
      };
    } else if (isHovered) {
      style = {
        ...style,
        radius: style.radius + 1
      };
    }
    
    return style;
  };

  // Handle virtualized rendering updates
  const handleVirtualizedRender = useCallback((nodes: any[], links: any[]) => {
    setVirtualizedNodes(nodes);
    setVirtualizedLinks(links);
  }, []);
  
  // Auto-detect performance mode based on node count
  useEffect(() => {
    if (!layoutResult) return;
    
    const nodeCount = layoutResult.nodeCount || 0;
    if (performanceMode === 'auto') {
      if (nodeCount > 1000) {
        setPerformanceMode('maximum');
      } else if (nodeCount > 500) {
        setPerformanceMode('high');
      }
    }
  }, [layoutResult, performanceMode]);

  // Render node with LOD and virtualization support
  const renderNode = (d3Node: d3.HierarchyPointNode<TreeNodeData>, lodLevel: 'full' | 'simplified' | 'minimal' = 'full') => {
    if (!layoutResult) return null;
    
    const node = d3Node.data;
    const isSelected = selectedNode?.name === node.name;
    const isHovered = hoveredNode?.name === node.name;
    const isFiltered = node._isFiltered;
    const isCustom = node.type === 'custom';
    const { margin } = layoutResult;
    const nodeDepth = d3Node.depth;
    
    // Performance measurements
    const perf = measurePerformance();
    performanceMonitor.current.startRender();
    
    const nodeStyle = getNodeStyle(node.type, isSelected, isHovered, isFiltered, lodLevel);
    const textColor = isFiltered ? "#9ca3af" : "#374151";
    const opacity = isFiltered ? 0.5 : 1;
    
    // Apply custom table emphasis scaling
    if (isCustom && !isFiltered) {
      const emphasisScale = {
        'subtle': 1.2,
        'moderate': 1.67,
        'maximum': 2.0
      }[customTableEmphasis];
      
      nodeStyle.radius = Math.round(nodeStyle.radius * emphasisScale);
    }
    
    // Simplified rendering for performance
    const shouldShowLabel = lodLevel === 'full' || (lodLevel === 'simplified' && isCustom);
    const shouldShowGlow = lodLevel === 'full' && isCustom && !isFiltered;
    const shouldShowIndicator = lodLevel !== 'minimal' && isCustom && !isFiltered;
    
    // Standard tree layout positioning
    const nodeX = d3Node.y + margin.left;
    const nodeY = d3Node.x + margin.top;
    const labelX = nodeX;
    const labelY = nodeY - (nodeStyle.radius + 5);
    const indicatorX = nodeX + nodeStyle.radius + 5;
    const indicatorY = nodeY - nodeStyle.radius;

    return (
      <g key={node.name} opacity={opacity} className={isCustom ? 'custom-table-node' : ''}>
        {/* Glow effect for custom tables */}
        {isCustom && !isFiltered && (
          <circle
            cx={nodeX}
            cy={nodeY}
            r={nodeStyle.radius + 4}
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            opacity="0.6"
            style={{
              filter: 'drop-shadow(0 0 8px #f97316)'
            }}
          />
        )}
        
        {/* Main node - diamond shape for custom tables */}
        {isCustom && !isFiltered ? (
          <polygon
            points={`${nodeX - nodeStyle.radius},${nodeY} ${nodeX},${nodeY - nodeStyle.radius} ${nodeX + nodeStyle.radius},${nodeY} ${nodeX},${nodeY + nodeStyle.radius}`}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={nodeStyle.strokeWidth}
            style={{ cursor: 'pointer' }}
            onClick={() => handleNodeClick(node)}
            onMouseEnter={() => setHoveredNode(node)}
          />
        ) : (
          <circle
            cx={nodeX}
            cy={nodeY}
            r={nodeStyle.radius}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={nodeStyle.strokeWidth}
            style={{ cursor: 'pointer' }}
            onClick={() => handleNodeClick(node)}
            onMouseEnter={() => setHoveredNode(node)}
          />
        )}
        
        {/* Standard text labels */}
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize={isCustom ? "13" : "12"}
          fill={textColor}
          fontWeight={isCustom ? 'bold' : 'normal'}
          style={{ 
            pointerEvents: 'none', 
            userSelect: 'none'
          }}
        >
          {node.label}
        </text>
        
        {/* Custom table indicator */}
        {isCustom && !isFiltered && (
          <text
            x={indicatorX}
            y={indicatorY}
            fontSize="10"
            fill="#ea580c"
            fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            ★
          </text>
        )}
      </g>
    );
  };

  // Get path from node to root for highlighting
  const getPathToRoot = useCallback((nodeName: string): string[] => {
    const path: string[] = [];
    const findPath = (node: TreeNodeData): boolean => {
      if (node.name === nodeName) {
        path.push(node.name);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findPath(child)) {
            path.push(node.name);
            return true;
          }
        }
      }
      return false;
    };
    
    if (treeData) {
      findPath(treeData);
    }
    return path.reverse();
  }, [treeData]);
  
  // Handle node selection with path highlighting
  const handleNodeClick = useCallback((node: TreeNodeData) => {
    const wasSelected = selectedNode?.name === node.name;
    setSelectedNode(wasSelected ? null : node);
    
    if (!wasSelected && node.type === 'custom') {
      // Highlight path to custom table
      const pathNodes = getPathToRoot(node.name);
      setHighlightedPaths(new Set(pathNodes));
    } else {
      setHighlightedPaths(new Set());
    }
  }, [selectedNode, getPathToRoot]);

  // Render link with path highlighting - adaptive for different layout types
  const renderLink = (d3Link: d3.HierarchyPointLink<TreeNodeData>) => {
    if (!layoutResult) return null;
    
    const { margin } = layoutResult;
    const isTargetFiltered = d3Link.target.data._isFiltered;
    const isInHighlightedPath = highlightedPaths.has(d3Link.source.data.name) && highlightedPaths.has(d3Link.target.data.name);
    
    let linkOpacity = isTargetFiltered ? 0.3 : 1;
    let strokeColor = isTargetFiltered ? "#e2e8f0" : "#cbd5e1";
    let strokeWidth = "2";
    let className = "";
    
    if (isInHighlightedPath && !isTargetFiltered) {
      strokeColor = "#f97316";
      strokeWidth = "4";
      linkOpacity = 1;
      className = "custom-path-highlight";
    }

    // Standard tree layout curved paths
    const pathD = `M${d3Link.source.y + margin.left},${d3Link.source.x + margin.top}
                   C${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.source.x + margin.top}
                    ${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.target.x + margin.top}
                    ${d3Link.target.y + margin.left},${d3Link.target.x + margin.top}`;
    
    return (
      <path
        key={`${d3Link.source.data.name}-${d3Link.target.data.name}`}
        className={className}
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={linkOpacity}
      />
    );
  };

  if (loading) {
    return (
      <div className="w-full space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Table Hierarchy...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !treeData || !layoutResult) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'No table hierarchy data available.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Tree Visualization - now takes 3/4 instead of 2/3 */}
        <div className="lg:col-span-3">
          <Card className="w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">CMDB Table Hierarchy</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Root: {treeData.name} | Tables: {layoutResult.nodes.filter(n => !n.data._isFiltered).length}/{layoutResult.nodes.length}
            {layoutResult.isHighPerformance && (
              <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                ⚡ Performance Mode
              </span>
            )}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef}
                className="w-full border rounded-lg bg-slate-50/50 relative" 
                style={{ height: '600px' }}
              >
                {/* Sidebar Overlay Controls - positioned over D3.js canvas */}
                <GraphSidebarOverlay
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onResetView={handleResetView}
                  visibleTableTypes={visibleTableTypes}
                  onTableTypeToggle={(type) => {
                    setVisibleTableTypes(prev => ({
                      ...prev,
                      [type]: !prev[type]
                    }));
                  }}
                  showCustomOnly={showCustomOnly}
                  onCustomOnlyToggle={() => setShowCustomOnly(!showCustomOnly)}
                  customTableCount={layoutResult?.nodes.filter(n => n.data.type === 'custom' && !n.data._isFiltered).length || 0}
                />
                
                {/* Search Overlay */}
                <GraphSearchOverlay
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  nodeCount={layoutResult.nodes.length}
                  filteredCount={layoutResult.nodes.filter(n => !n.data._isFiltered).length}
                />
                
                {/* Hierarchy Mini-Map */}
                <HierarchyMiniMap
                  treeData={treeData}
                  selectedNode={selectedNode}
                  onNodeClick={handleNodeClick}
                  transform={transform}
                  bounds={layoutResult.bounds}
                  canvasDimensions={dimensions}
                  layoutType={layoutType}
                />

                {/* Virtualized Renderer for Performance */}
                {layoutResult.isHighPerformance && (
                  <VirtualizedRenderer
                    nodes={layoutResult.nodes}
                    links={layoutResult.links}
                    transform={transform}
                    bounds={layoutResult.bounds}
                    customTableEmphasis={customTableEmphasis}
                    onRender={handleVirtualizedRender}
                  />
                )}
                
                <svg
                  ref={svgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                  className="cursor-grab border border-gray-200 rounded"
                >
                  <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
                    {/* Performance-optimized rendering */}
                    {layoutResult.isHighPerformance ? (
                      // Virtualized rendering for high node counts
                      <>
                        {virtualizedLinks.map(link => renderLink(link.originalLink))}
                        {virtualizedNodes.map(node => {
                          const lodLevel = node.lodLevel || 'full';
                          return renderNode(node.originalNode, lodLevel);
                        })}
                      </>
                    ) : (
                      // Standard rendering for normal node counts
                      <>
                        {layoutResult.links.map(renderLink)}
                        {layoutResult.nodes.map(node => renderNode(node))}
                      </>
                    )}
                  </g>
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Panel - keeping original */}
        <div className="lg:col-span-1">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                {hoveredNode ? 'Table Details' : selectedNode ? 'Selected Table' : 'Hover to Explore'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(hoveredNode || selectedNode) ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className={`p-3 rounded-lg space-y-2 ${
                      (hoveredNode || selectedNode)?.type === 'custom' 
                        ? 'custom-table-legend' 
                        : 'bg-slate-50'
                    }`}>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">System Name</span>
                        <p className="font-mono text-sm">{(hoveredNode || selectedNode)?.name}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Display Label</span>
                        <p className="text-sm">{(hoveredNode || selectedNode)?.label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Type</span>
                        <Badge 
                          variant="outline" 
                          className={(hoveredNode || selectedNode)?.type === 'custom' ? 'border-orange-500 text-orange-700' : ''}
                        >
                          <div className="flex items-center gap-1">
                            {(hoveredNode || selectedNode)?.type === 'custom' && (
                              <span className="custom-table-legend-icon">♦</span>
                            )}
                            {(hoveredNode || selectedNode)?.type?.toUpperCase()}
                          </div>
                        </Badge>
                      </div>
                      
                      {/* Custom table metrics */}
                      {(hoveredNode || selectedNode)?.type === 'custom' && (
                        <div className="border-t pt-2 mt-2">
                          <div className="text-xs text-orange-700 font-medium mb-1">Custom Table Metrics</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Custom Fields:</span>
                              <p className="font-medium">{(hoveredNode || selectedNode)?.customFieldCount || 0}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Records:</span>
                              <p className="font-medium">{(hoveredNode || selectedNode)?.recordCount || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Legend for all table types */}
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-2">Legend</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span>Base Tables (Foundation)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span>Extended Tables (Standard)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-500 transform rotate-45"></div>
                          <span className="font-semibold">Custom Tables ({layoutResult?.nodes.filter(n => n.data.type === 'custom' && !n.data._isFiltered).length || 0})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">ServiceNow Integration Active</span>
                  </div>
                  <div className="text-sm text-center text-muted-foreground italic">
                    Hover over any table to see details
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Types Legend Card */}
      <div className="flex justify-center">
        <TypesLegendCard
          visibleTableTypes={visibleTableTypes}
          onTableTypeToggle={(type) => {
            setVisibleTableTypes(prev => ({
              ...prev,
              [type]: !prev[type]
            }));
          }}
          customTableCount={layoutResult?.nodes.filter(n => n.data.type === 'custom' && !n.data._isFiltered).length || 0}
          showCustomOnly={showCustomOnly}
          onCustomOnlyToggle={() => setShowCustomOnly(!showCustomOnly)}
        />
      </div>
    </div>
  );
}