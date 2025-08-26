import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ZoomIn, ZoomOut, RotateCcw, Loader2, AlertTriangle, Database, Users, Calendar } from 'lucide-react';
import { GraphLayoutType } from './GraphControls';
import { GraphSidebar } from './GraphSidebar';
import { GraphSearchOverlay } from './GraphSearchOverlay';
import { serviceNowService } from '@/services/serviceNowService';
import { useCMDBData } from '@/contexts/CMDBDataContext';
import { TableMetadata, FieldMetadata } from '@/types';

interface TreeNodeData {
  name: string;
  label: string;
  type: 'base' | 'extended' | 'custom';
  table?: TableMetadata;
  children?: TreeNodeData[];
  customFieldCount?: number;
  recordCount?: number;
  relationships?: FieldMetadata[];
  _isFiltered?: boolean;
}

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

  // Simple tree layout (keeping original logic)
  const d3TreeLayout = useMemo(() => {
    if (!treeData) return null;
    
    const visuallyFilteredTreeData = applyVisualFiltering(treeData);
    const root = d3.hierarchy(visuallyFilteredTreeData, d => d.children);
    
    const nodeCount = root.descendants().length;
    const margin = { top: 60, right: 150, bottom: 60, left: 150 };
    
    const baseWidth = Math.max(800, dimensions.width - margin.left - margin.right);
    const baseHeight = Math.max(400, dimensions.height - margin.top - margin.bottom);
    
    const width = nodeCount > 100 ? baseWidth * 1.5 : baseWidth;
    const height = nodeCount > 100 ? Math.max(baseHeight * 3, nodeCount * 15) : Math.max(baseHeight * 2, nodeCount * 12);
    
    const treeLayout = d3.tree()
      .size([height, width])
      .separation((a, b) => {
        const baseSeparation = (a.parent === b.parent ? 3.0 : 5.5);
        return nodeCount > 100 ? baseSeparation * 1.8 : baseSeparation;
      });
    
    const layoutRoot = treeLayout(root);
    
    return {
      nodes: layoutRoot.descendants(),
      links: layoutRoot.links(),
      bounds: { width: width + margin.left + margin.right, height: height + margin.top + margin.bottom },
      margin
    };
  }, [treeData, dimensions.width, dimensions.height, applyVisualFiltering]);

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
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
    setSelectedNode(null);
    setHoveredNode(null);
  };

  // Setup D3 zoom behavior
  useEffect(() => {
    if (!svgRef.current || !treeData) return;

    const svg = d3.select(svgRef.current);
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 25])
      .on('zoom', (event) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k
        });
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    return () => {
      svg.on('.zoom', null);
    };
  }, [treeData]);

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

  // Enhanced node styling with orange custom table emphasis
  const getNodeStyle = (nodeType: string, isSelected: boolean, isHovered: boolean, isFiltered: boolean) => {
    const styles = {
      base: {
        fill: '#1e40af',
        stroke: '#1e293b',
        radius: 6,
        strokeWidth: 2
      },
      extended: {
        fill: '#059669',
        stroke: '#1e293b', 
        radius: 7,
        strokeWidth: 2
      },
      custom: {
        fill: '#ea580c',
        stroke: '#9a3412',
        radius: 10,
        strokeWidth: 3
      }
    };

    let style = styles[nodeType as keyof typeof styles] || styles.extended;
    
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

  // Render node
  const renderNode = (d3Node: d3.HierarchyPointNode<TreeNodeData>) => {
    if (!d3TreeLayout) return null;
    
    const node = d3Node.data;
    const isSelected = selectedNode?.name === node.name;
    const isHovered = hoveredNode?.name === node.name;
    const isFiltered = node._isFiltered;
    const isCustom = node.type === 'custom';
    const { margin } = d3TreeLayout;
    
    const nodeStyle = getNodeStyle(node.type, isSelected, isHovered, isFiltered);
    let textColor = isFiltered ? "#9ca3af" : "#374151";
    let opacity = isFiltered ? 0.5 : 1;
    
    // Apply custom table emphasis scaling
    if (isCustom && !isFiltered) {
      const emphasisScale = {
        'subtle': 1.2,
        'moderate': 1.67,
        'maximum': 2.0
      }[customTableEmphasis];
      
      nodeStyle.radius = Math.round(nodeStyle.radius * emphasisScale);
    }
    
    return (
      <g key={node.name} opacity={opacity} className={isCustom ? 'custom-table-node' : ''}>
        {/* Glow effect for custom tables */}
        {isCustom && !isFiltered && (
          <circle
            cx={d3Node.y + margin.left}
            cy={d3Node.x + margin.top}
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
            points={`${d3Node.y + margin.left - nodeStyle.radius},${d3Node.x + margin.top} ${d3Node.y + margin.left},${d3Node.x + margin.top - nodeStyle.radius} ${d3Node.y + margin.left + nodeStyle.radius},${d3Node.x + margin.top} ${d3Node.y + margin.left},${d3Node.x + margin.top + nodeStyle.radius}`}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={nodeStyle.strokeWidth}
            style={{ cursor: 'pointer' }}
            onClick={() => handleNodeClick(node)}
            onMouseEnter={() => setHoveredNode(node)}
          />
        ) : (
          <circle
            cx={d3Node.y + margin.left}
            cy={d3Node.x + margin.top}
            r={nodeStyle.radius}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={nodeStyle.strokeWidth}
            style={{ cursor: 'pointer' }}
            onClick={() => handleNodeClick(node)}
            onMouseEnter={() => setHoveredNode(node)}
          />
        )}
        
        {/* Enhanced label */}
        <text
          x={d3Node.y + margin.left}
          y={d3Node.x + margin.top - (nodeStyle.radius + 5)}
          textAnchor="middle"
          fontSize={isCustom ? "13" : "12"}
          fill={textColor}
          fontWeight={isCustom ? 'bold' : 'normal'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.label}
        </text>
        
        {/* Custom table indicator */}
        {isCustom && !isFiltered && (
          <text
            x={d3Node.y + margin.left + nodeStyle.radius + 5}
            y={d3Node.x + margin.top - nodeStyle.radius}
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

  // Render link with path highlighting
  const renderLink = (d3Link: d3.HierarchyPointLink<TreeNodeData>) => {
    if (!d3TreeLayout) return null;
    
    const { margin } = d3TreeLayout;
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
    
    return (
      <path
        key={`${d3Link.source.data.name}-${d3Link.target.data.name}`}
        className={className}
        d={`M${d3Link.source.y + margin.left},${d3Link.source.x + margin.top}
            C${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.source.x + margin.top}
             ${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.target.x + margin.top}
             ${d3Link.target.y + margin.left},${d3Link.target.x + margin.top}`}
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

  if (error || !treeData || !d3TreeLayout) {
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tree Visualization */}
        <div className="lg:col-span-2">
          <Card className="w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">CMDB Table Hierarchy</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Root: {treeData.name} | Tables: {d3TreeLayout.nodes.filter(n => !n.data._isFiltered).length}/{d3TreeLayout.nodes.length}
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
                {/* Sidebar Controls */}
                <GraphSidebar
                  layoutType={layoutType}
                  onLayoutChange={setLayoutType}
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
                  customTableEmphasis={customTableEmphasis}
                  onCustomEmphasisChange={setCustomTableEmphasis}
                  showCustomOnly={showCustomOnly}
                  onCustomOnlyToggle={() => setShowCustomOnly(!showCustomOnly)}
                  customTableCount={d3TreeLayout?.nodes.filter(n => n.data.type === 'custom' && !n.data._isFiltered).length || 0}
                />
                
                {/* Search Overlay */}
                <GraphSearchOverlay
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  nodeCount={d3TreeLayout.nodes.length}
                  filteredCount={d3TreeLayout.nodes.filter(n => !n.data._isFiltered).length}
                />

                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${d3TreeLayout.bounds.width} ${d3TreeLayout.bounds.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="cursor-grab"
                >
                  <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
                    {d3TreeLayout.links.map(renderLink)}
                    {d3TreeLayout.nodes.map(renderNode)}
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
                          <span className="font-semibold">Custom Tables ({d3TreeLayout?.nodes.filter(n => n.data.type === 'custom' && !n.data._isFiltered).length || 0})</span>
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
    </div>
  );
}