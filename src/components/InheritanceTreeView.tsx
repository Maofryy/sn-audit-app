import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ZoomIn, ZoomOut, RotateCcw, Loader2, AlertTriangle, Database, Users, Calendar } from 'lucide-react';
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
  _isFiltered?: boolean; // Track if node is visually filtered
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
  const [collapsedNodes, setCollapsedNodes] = useState(new Set<string>());
  const [visibleTableTypes, setVisibleTableTypes] = useState({
    base: true,
    extended: true,
    custom: true
  });
  
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
  }, []); // convertHierarchyToTree is stable due to useCallback with no deps

  // Load node details on hover
  useEffect(() => {
    const loadNodeDetails = async () => {
      if (!hoveredNode?.table) {
        setNodeDetails(null);
        setLoadingDetails(false);
        return;
      }

      // Immediately set basic details from hoveredNode data
      setNodeDetails({
        table: hoveredNode.table,
        customFields: [],
        referenceFields: [],
        childTables: [],
        recordCount: hoveredNode.recordCount
      });

      setLoadingDetails(true);

      try {
        const [customFields, referenceFields, childTables] = await Promise.all([
          serviceNowService.getCustomFields(hoveredNode.table.name),
          serviceNowService.getReferenceFields().then(fields => 
            fields.filter(f => f.table === hoveredNode.table!.name)
          ),
          Promise.resolve(cmdbTablesData?.filter(t => t.super_class === hoveredNode.table!.sys_id) || [])
        ]);

        setNodeDetails({
          table: hoveredNode.table,
          customFields,
          referenceFields,
          childTables,
          recordCount: hoveredNode.recordCount
        });
      } catch (err) {
        console.error('Failed to load node details:', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    const timeoutId = setTimeout(loadNodeDetails, 200); // Debounce
    return () => clearTimeout(timeoutId);
  }, [hoveredNode]);

  // Resize handler with debounce
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

  // Convert hierarchy to tree structure
  const convertHierarchyToTree = useCallback((node: { table: TableMetadata; children?: any[]; customFieldCount?: number; totalRecordCount?: number }): TreeNodeData => {
    // Use the table_type already computed by the ServiceNow service
    // This ensures consistency with the backend logic
    const tableType = node.table.table_type || (
      node.table.is_custom ? 'custom' : 
      (node.table.name === 'cmdb_ci' || node.table.name === 'cmdb') ? 'base' : 'extended'
    );
    
    const treeNode = {
      name: node.table.name,
      label: node.table.label,
      type: tableType,
      table: node.table,
      customFieldCount: node.customFieldCount,
      recordCount: node.totalRecordCount,
      children: node.children?.map(convertHierarchyToTree)
    };
    
    return treeNode;
  }, []);

  // Get node color based on type
  const getNodeColor = (type: string, isHovered = false, isSelected = false) => {
    const baseColors = {
      'base': '#3b82f6', // Blue
      'extended': '#10b981', // Green
      'custom': '#ea580c', // Orange
    };
    
    let color = baseColors[type] || '#6b7280';
    
    if (isSelected) {
      // Darken selected nodes
      color = d3.color(color)?.darker(0.5)?.toString() || color;
    } else if (isHovered) {
      // Brighten hovered nodes
      color = d3.color(color)?.brighter(0.3)?.toString() || color;
    }
    
    return color;
  };

  // Setup D3 zoom and pan behavior
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

  // Mouse drag handlers for panning
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    setTransform(prev => ({
      ...prev,
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
    
    setDragStart({ x: event.clientX, y: event.clientY });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Apply visual filtering - show all nodes but dim filtered ones
  const applyVisualFiltering = useCallback((node: TreeNodeData): TreeNodeData => {
    // Recursively apply filtering to all children first
    const processedChildren = node.children
      ?.map(child => applyVisualFiltering(child)) || [];
    
    // Check if this node has any visible descendant
    const hasVisibleDescendant = (n: TreeNodeData): boolean => {
      if (n.type === 'base' || visibleTableTypes[n.type]) {
        return true;
      }
      return n.children?.some(child => hasVisibleDescendant(child)) || false;
    };
    
    // Determine if this node should be dimmed
    // Don't dim if: it's a base table, it's visible, OR it has visible descendants (to maintain tree structure)
    const shouldNotDim = node.type === 'base' || 
                         visibleTableTypes[node.type] || 
                         hasVisibleDescendant(node);
    
    return {
      ...node,
      children: processedChildren.length > 0 ? processedChildren : undefined,
      // Add a property to track if this node should be visually dimmed
      _isFiltered: !shouldNotDim
    };
  }, [visibleTableTypes]);

  // Use D3 to compute tree layout - responsive to dimensions
  const d3TreeLayout = useMemo(() => {
    if (!treeData) return null;
    
    // Apply visual filtering to the tree data (show all nodes, dim filtered ones)
    const visuallyFilteredTreeData = applyVisualFiltering(treeData);
    
    // Create D3 hierarchy from our visually filtered data
    const root = d3.hierarchy(visuallyFilteredTreeData, d => d.children);
    
    // Adaptive layout for large datasets
    const nodeCount = root.descendants().length;
    const margin = { top: 60, right: 150, bottom: 60, left: 150 };
    
    // Scale dimensions based on node count
    const baseWidth = Math.max(800, dimensions.width - margin.left - margin.right);
    const baseHeight = Math.max(400, dimensions.height - margin.top - margin.bottom);
    
    // Increase spacing for large trees - much more vertical space between levels
    const width = nodeCount > 100 ? baseWidth * 1.5 : baseWidth;
    const height = nodeCount > 100 ? Math.max(baseHeight * 3, nodeCount * 15) : Math.max(baseHeight * 2, nodeCount * 12);
    
    const treeLayout = d3.tree()
      .size([height, width])
      .separation((a, b) => {
        // Much larger spacing between grandchildren and across different branches
        const baseSeparation = (a.parent === b.parent ? 3.0 : 5.5);
        return nodeCount > 100 ? baseSeparation * 1.8 : baseSeparation;
      });
    
    // Apply layout to compute positions
    const layoutRoot = treeLayout(root);
    
    return {
      nodes: layoutRoot.descendants(),
      links: layoutRoot.links(),
      bounds: { width: width + margin.left + margin.right, height: height + margin.top + margin.bottom },
      margin
    };
  }, [treeData, dimensions.width, dimensions.height, applyVisualFiltering]);

  // Control handlers for zoom and pan
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

  // Render a single node with enhanced interactions
  const renderNode = (d3Node: d3.HierarchyPointNode<TreeNodeData>) => {
    if (!d3TreeLayout) return null;
    
    const node = d3Node.data; // Original data
    const isSelected = selectedNode?.name === node.name;
    const isHovered = hoveredNode?.name === node.name;
    const isFiltered = node._isFiltered;
    const { margin } = d3TreeLayout;
    
    // Get node color and apply dimming if filtered
    let nodeColor = getNodeColor(node.type, isHovered, isSelected);
    let textColor = "#374151";
    let opacity = 1;
    
    if (isFiltered) {
      nodeColor = "#d1d5db"; // Gray color for filtered nodes
      textColor = "#9ca3af";
      opacity = 0.5;
    }
    
    return (
      <g key={node.name} opacity={opacity}>
        <circle
          cx={d3Node.y + margin.left}
          cy={d3Node.x + margin.top}
          r={isSelected ? 10 : (isHovered ? 9 : 8)}
          fill={nodeColor}
          stroke={isSelected ? "#374151" : "#fff"}
          strokeWidth={isSelected ? 3 : 2}
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedNode(isSelected ? null : node)}
          onMouseEnter={() => setHoveredNode(node)}
        />
        <text
          x={d3Node.y + margin.left}
          y={d3Node.x + margin.top - 15}
          textAnchor="middle"
          fontSize="12"
          fill={textColor}
          fontWeight={node.type === 'custom' ? 'bold' : 'normal'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.label}
        </text>
      </g>
    );
  };

  // Render connection lines with enhanced styling
  const renderLink = (d3Link: d3.HierarchyPointLink<TreeNodeData>) => {
    if (!d3TreeLayout) return null;
    
    const { margin } = d3TreeLayout;
    
    // Determine if link should be dimmed (when target node is filtered)
    const isTargetFiltered = d3Link.target.data._isFiltered;
    const linkOpacity = isTargetFiltered ? 0.3 : 1;
    const strokeColor = isTargetFiltered ? "#e2e8f0" : "#cbd5e1";
    
    return (
      <path
        key={`${d3Link.source.data.name}-${d3Link.target.data.name}`}
        d={`M${d3Link.source.y + margin.left},${d3Link.source.x + margin.top}
            C${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.source.x + margin.top}
             ${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.target.x + margin.top}
             ${d3Link.target.y + margin.left},${d3Link.target.x + margin.top}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
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
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load table hierarchy: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!treeData || !d3TreeLayout) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No table hierarchy data available.
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
                  {treeData && d3TreeLayout && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Root: {treeData.name} | Total Tables: {d3TreeLayout.nodes.length} | Direct Children: {treeData.children?.length || 0}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground font-medium">Tables filter:</span>
                  <div className="flex gap-2">
                    <button
                      disabled
                      className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300 cursor-not-allowed opacity-75 flex items-center gap-1"
                      title="Base tables are always visible to maintain tree structure"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      Base
                    </button>
                    <button
                      onClick={() => setVisibleTableTypes(prev => ({ ...prev, extended: !prev.extended }))}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                        visibleTableTypes.extended
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-200 text-gray-500 border border-gray-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        visibleTableTypes.extended ? 'bg-green-600' : 'bg-gray-400'
                      }`}></div>
                      Extended
                    </button>
                    <button
                      onClick={() => setVisibleTableTypes(prev => ({ ...prev, custom: !prev.custom }))}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                        visibleTableTypes.custom
                          ? 'bg-orange-100 text-orange-700 border border-orange-300'
                          : 'bg-gray-200 text-gray-500 border border-gray-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        visibleTableTypes.custom ? 'bg-orange-600' : 'bg-gray-400'
                      }`}></div>
                      Custom
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef}
                className="w-full border rounded-lg bg-slate-50/50" 
                style={{ height: d3TreeLayout && d3TreeLayout.nodes.length > 100 ? '800px' : '600px' }}
              >
                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${d3TreeLayout.bounds.width} ${d3TreeLayout.bounds.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {/* Main group with transform */}
                  <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
                    {/* Render connection lines first (behind nodes) */}
                    {d3TreeLayout.links.map(renderLink)}
                    
                    {/* Render all nodes */}
                    {d3TreeLayout.nodes.map(renderNode)}
                  </g>
                  
                  {/* Fixed legend (not affected by zoom/pan) */}
                  <g transform="translate(20, 20)">
                    <rect x="-10" y="-10" width="140" height="80" fill="rgba(255,255,255,0.9)" stroke="#e2e8f0" rx="4"/>
                    <text x="0" y="0" fontSize="12" fontWeight="bold" fill="#374151">
                      Legend:
                    </text>
                    <circle cx="8" cy="16" r="5" fill="#3b82f6" />
                    <text x="20" y="20" fontSize="11" fill="#374151">Base Tables</text>
                    <circle cx="8" cy="32" r="5" fill={visibleTableTypes.extended ? "#10b981" : "#d1d5db"} />
                    <text x="20" y="36" fontSize="11" fill={visibleTableTypes.extended ? "#374151" : "#9ca3af"}>Extended Tables</text>
                    <circle cx="8" cy="48" r="5" fill={visibleTableTypes.custom ? "#ea580c" : "#d1d5db"} />
                    <text x="20" y="52" fontSize="11" fill={visibleTableTypes.custom ? "#374151" : "#9ca3af"}>Custom Tables</text>
                  </g>
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Details Panel */}
        <div className="lg:col-span-1">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                {hoveredNode ? 'Table Details' : selectedNode ? 'Selected Table' : 'Hover to Explore'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
              {(hoveredNode || selectedNode) ? (
                <div className="space-y-4">
                  {/* Basic Table Information - Always show immediately */}
                  {(hoveredNode || selectedNode) && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Table Information
                      </h4>
                      <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">System Name</span>
                          <p className="font-mono text-sm">{(hoveredNode || selectedNode)?.table?.name || (hoveredNode || selectedNode)?.name}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">Display Label</span>
                          <p className="text-sm">{(hoveredNode || selectedNode)?.table?.label || (hoveredNode || selectedNode)?.label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">Type</span>
                          <Badge 
                            variant="outline" 
                            className={
                              (hoveredNode || selectedNode)?.type === 'base' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              (hoveredNode || selectedNode)?.type === 'extended' ? 'bg-green-50 text-green-700 border-green-200' :
                              'bg-orange-50 text-orange-700 border-orange-200'
                            }
                          >
                            {(hoveredNode || selectedNode)?.type?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Details - Show when nodeDetails is available */}
                  {nodeDetails && (
                    <div className="space-y-4">
                      {nodeDetails.table.super_class && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Inheritance</h4>
                          <div className="bg-blue-50 p-2 rounded text-sm">
                            <span className="text-muted-foreground">Extends:</span>
                            <span className="font-mono ml-1">{nodeDetails.table.super_class}</span>
                          </div>
                        </div>
                      )}

                      {nodeDetails.recordCount !== undefined && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Record Count
                          </h4>
                          <div className="bg-green-50 p-2 rounded">
                            <span className="text-lg font-semibold text-green-700">
                              {nodeDetails.recordCount.toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground ml-1">records</span>
                          </div>
                        </div>
                      )}

                      {/* Loading indicator for additional details */}
                      {loadingDetails && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading additional details...
                        </div>
                      )}

                      {!loadingDetails && nodeDetails.childTables.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Child Tables ({nodeDetails.childTables.length})</h4>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {nodeDetails.childTables.map(child => (
                              <div key={child.name} className="text-xs bg-slate-50 p-1 rounded font-mono">
                                {child.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!loadingDetails && nodeDetails.customFields.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Custom Fields ({nodeDetails.customFields.length})</h4>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {nodeDetails.customFields.slice(0, 5).map(field => (
                              <div key={field.sys_id} className="text-xs bg-orange-50 p-1 rounded">
                                <span className="font-mono">{field.element}</span>
                                <span className="text-muted-foreground ml-1">({field.type})</span>
                              </div>
                            ))}
                            {nodeDetails.customFields.length > 5 && (
                              <div className="text-xs text-muted-foreground">+ {nodeDetails.customFields.length - 5} more...</div>
                            )}
                          </div>
                        </div>
                      )}

                      {!loadingDetails && nodeDetails.referenceFields.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Reference Fields ({nodeDetails.referenceFields.length})</h4>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {nodeDetails.referenceFields.slice(0, 3).map(field => (
                              <div key={field.sys_id} className="text-xs bg-blue-50 p-1 rounded">
                                <span className="font-mono">{field.element}</span>
                                <span className="text-muted-foreground ml-1">→ {field.reference_table}</span>
                              </div>
                            ))}
                            {nodeDetails.referenceFields.length > 3 && (
                              <div className="text-xs text-muted-foreground">+ {nodeDetails.referenceFields.length - 3} more...</div>
                            )}
                          </div>
                        </div>
                      )}

                      {nodeDetails.table.sys_created_on && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Timestamps
                          </h4>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>Created: {new Date(nodeDetails.table.sys_created_on).toLocaleDateString()}</div>
                            <div>By: {nodeDetails.table.sys_created_by}</div>
                            {nodeDetails.table.sys_updated_on && (
                              <div>Updated: {new Date(nodeDetails.table.sys_updated_on).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedNode && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedNode(null)}
                      className="w-full"
                    >
                      Clear Selection
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">ServiceNow Integration Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-100 p-2 rounded">
                      <div className="font-medium">Tables</div>
                      <div className="text-muted-foreground">{d3TreeLayout.nodes.length}</div>
                    </div>
                    <div className="bg-slate-100 p-2 rounded">
                      <div className="font-medium">Zoom</div>
                      <div className="text-muted-foreground">{Math.round(transform.k * 100)}%</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium">Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Live ServiceNow data</li>
                      <li>• Interactive navigation</li>
                      <li>• Detailed hover information</li>
                      <li>• Pan and zoom controls</li>
                      <li>• Custom table detection</li>
                    </ul>
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