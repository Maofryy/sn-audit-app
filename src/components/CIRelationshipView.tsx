import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraphSidebarOverlay } from './GraphSidebarOverlay';
import { TypesLegendCard } from './TypesLegendCard';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { useGraph, useGraphActions } from '../contexts/GraphContext';
import { useCIRelationships, useRelationshipTypes, useTableDetails } from '../hooks/useServiceNowData';
import { CIRelationship, RelationshipType } from '../types';
import { Loader2, AlertCircle, Network, Database } from 'lucide-react';
import { PERFORMANCE_THRESHOLDS, NetworkPerformanceMonitor } from '../utils/performanceOptimizations';

interface CINode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'ci' | 'table';
  className?: string;
  isCustom?: boolean;
  relationshipCount?: number;
}

interface CILink extends d3.SimulationLinkDatum<CINode> {
  id: string;
  relationshipType: string;
  relationshipLabel: string;
  direction: 'parent' | 'child';
}

export function CIRelationshipView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedRelationshipTypes, setSelectedRelationshipTypes] = useState<string[]>([]);
  
  const { state } = useGraph();
  const { setGraphStats, setSelectedTableDetails } = useGraphActions();
  
  // Fetch CI relationships and relationship types
  const {
    data: ciRelationships,
    isLoading: isRelationshipsLoading,
    error: relationshipsError
  } = useCIRelationships();

  const {
    data: relationshipTypes,
    isLoading: isTypesLoading,
    error: typesError
  } = useRelationshipTypes();

  // Fetch details for selected item
  const selectedItemDetails = useTableDetails(
    selectedNodeId || '',
    !!selectedNodeId
  );

  // D3 setup
  const [zoomBehavior, setZoomBehavior] = useState<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [simulation, setSimulation] = useState<d3.Simulation<CINode, CILink> | null>(null);
  const [performanceMonitor] = useState(() => new NetworkPerformanceMonitor());

  // Calculate loading state locally to prevent infinite loops
  const isComponentLoading = isRelationshipsLoading || isTypesLoading || selectedItemDetails.isLoading;
  const componentError = relationshipsError?.message || typesError?.message || selectedItemDetails.error?.message || null;

  // Update dimensions on container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(800, rect.width),
          height: Math.max(600, rect.height - 100)
        });
      }
    };

    // Initial dimension calculation - use setTimeout to avoid setState in useEffect
    setTimeout(() => {
      updateDimensions();
    }, 0);
    
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Transform CI relationships data into graph format
  const graphData = React.useMemo(() => {
    if (!ciRelationships || !relationshipTypes) {
      return { nodes: [], links: [] };
    }

    // Filter relationships by selected types
    let filteredRelationships = selectedRelationshipTypes.length > 0
      ? ciRelationships.filter(rel => selectedRelationshipTypes.includes(rel.type))
      : ciRelationships;

    // Performance optimization: limit data for large datasets
    if (filteredRelationships.length > PERFORMANCE_THRESHOLDS.LARGE_NETWORK) {
      filteredRelationships = filteredRelationships.slice(0, PERFORMANCE_THRESHOLDS.LARGE_NETWORK);
    }

    const nodeMap = new Map<string, CINode>();
    const links: CILink[] = [];

    // Create relationship type lookup
    const relationshipTypeMap = new Map(
      relationshipTypes.map(rt => [rt.sys_id, rt])
    );

    // Process relationships
    filteredRelationships.forEach((relationship: CIRelationship) => {
      const relType = relationshipTypeMap.get(relationship.type);
      
      // Add parent node
      if (!nodeMap.has(relationship.parent)) {
        nodeMap.set(relationship.parent, {
          id: relationship.parent,
          label: relationship.parent,
          type: 'ci',
          relationshipCount: 0
        });
      }

      // Add child node
      if (!nodeMap.has(relationship.child)) {
        nodeMap.set(relationship.child, {
          id: relationship.child,
          label: relationship.child,
          type: 'ci',
          relationshipCount: 0
        });
      }

      // Increment relationship counts
      const parentNode = nodeMap.get(relationship.parent)!;
      const childNode = nodeMap.get(relationship.child)!;
      parentNode.relationshipCount = (parentNode.relationshipCount || 0) + 1;
      childNode.relationshipCount = (childNode.relationshipCount || 0) + 1;

      // Add link
      links.push({
        id: relationship.sys_id,
        source: relationship.parent,
        target: relationship.child,
        relationshipType: relationship.type,
        relationshipLabel: relType?.label || relationship.type_name || 'Unknown',
        direction: 'parent'
      });
    });

    const nodes = Array.from(nodeMap.values());
    
    return { nodes, links };
  }, [ciRelationships, relationshipTypes, selectedRelationshipTypes]);

  // Initialize D3 force simulation
  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) return;

    // Start performance monitoring
    performanceMonitor.startRender();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    
    // Create main group for zoom/pan
    const g = svg.append('g').attr('class', 'main-group');

    // Initialize zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    
    // Use setTimeout to avoid setState in useEffect
    setTimeout(() => {
      setZoomBehavior(zoom);
    }, 0);

    // Create force simulation
    const forceSimulation = d3.forceSimulation<CINode>(graphData.nodes)
      .force('link', d3.forceLink<CINode, CILink>(graphData.links)
        .id(d => d.id)
        .distance(150)
        .strength(0.1)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Use setTimeout to avoid setState in useEffect
    setTimeout(() => {
      setSimulation(forceSimulation);
    }, 0);

    // Create arrow markers for directed relationships
    const defs = g.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('class', 'fill-muted-foreground');

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .enter().append('line')
      .attr('class', 'stroke-muted-foreground stroke-2')
      .attr('marker-end', 'url(#arrowhead)')
      .style('opacity', 0.6);

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, CINode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Node circles
    node.append('circle')
      .attr('r', d => Math.min(20, Math.max(8, Math.sqrt((d.relationshipCount || 1) * 5))))
      .attr('class', d => 
        d.type === 'ci' 
          ? 'fill-blue-500 stroke-blue-700 stroke-2' 
          : 'fill-green-500 stroke-green-700 stroke-2'
      )
      .style('opacity', 0.8);

    // Node labels
    node.append('text')
      .attr('dx', 25)
      .attr('dy', '.35em')
      .text(d => d.label.length > 20 ? d.label.substring(0, 20) + '...' : d.label)
      .attr('class', 'text-xs fill-foreground font-medium');

    // Node interaction
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNodeId(d.id);
    });

    // Add tooltips
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute invisible bg-popover text-popover-foreground p-2 rounded-md shadow-md z-50 text-xs')
      .style('pointer-events', 'none');

    node.on('mouseover', (event, d) => {
      tooltip.transition().duration(200).style('visibility', 'visible');
      tooltip.html(`
        <div class="font-semibold">${d.label}</div>
        <div>Type: ${d.type === 'ci' ? 'Configuration Item' : 'Table'}</div>
        <div>Relationships: ${d.relationshipCount || 0}</div>
      `);
    })
    .on('mousemove', (event) => {
      tooltip.style('top', (event.pageY - 10) + 'px')
        .style('left', (event.pageX + 10) + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition().duration(500).style('visibility', 'hidden');
    });

    // Simulation tick
    forceSimulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as CINode).x!)
        .attr('y1', d => (d.source as CINode).y!)
        .attr('x2', d => (d.target as CINode).x!)
        .attr('y2', d => (d.target as CINode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Update graph stats with performance monitoring
    performanceMonitor.endRender();
    const renderTime = performanceMonitor.getRenderTime();
    
    setGraphStats({
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.links.length,
      renderTime
    });

    // Drag functions
    function dragstarted(event: any, d: CINode) {
      if (!event.active) forceSimulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: CINode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: CINode) {
      if (!event.active) forceSimulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      tooltip.remove();
      forceSimulation.stop();
    };
  }, [graphData, dimensions, setGraphStats]);

  // Graph control handlers
  const handleZoomIn = () => {
    if (zoomBehavior && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomBehavior.scaleBy, 1.2
      );
    }
  };

  const handleZoomOut = () => {
    if (zoomBehavior && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomBehavior.scaleBy, 0.8
      );
    }
  };

  const handleResetView = () => {
    if (zoomBehavior && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomBehavior.transform,
        d3.zoomIdentity
      );
    }
    setSelectedNodeId(null);
    if (simulation) {
      simulation.alpha(0.3).restart();
    }
  };

  const handleRelationshipTypeToggle = (typeId: string) => {
    setSelectedRelationshipTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  if (isComponentLoading) {
    return (
      <Card className="w-full h-[600px]">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Loading CI Relationships</p>
              <p className="text-sm text-muted-foreground">
                Fetching relationship data from cmdb_rel_ci...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (relationshipsError || typesError) {
    return (
      <Card className="w-full h-[600px]">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
            <div>
              <p className="text-lg font-medium">Error Loading Relationships</p>
              <p className="text-sm text-muted-foreground">
                {relationshipsError?.message || typesError?.message}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              CI Relationship Mapping
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                {graphData.nodes.length} CIs
              </Badge>
              <Badge variant="outline">
                {graphData.links.length} Relationships
              </Badge>
              {ciRelationships && ciRelationships.length > PERFORMANCE_THRESHOLDS.LARGE_NETWORK && (
                <Badge variant="secondary" className="text-orange-600">
                  Limited View
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Filters & Details */}
        <div className="xl:col-span-1 space-y-4">

          {/* Relationship Type Filters */}
          {relationshipTypes && relationshipTypes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Relationship Types
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relationshipTypes.map((type: RelationshipType) => (
                  <div key={type.sys_id} className="flex items-center justify-between">
                    <span className="text-xs">{type.label}</span>
                    <Button
                      size="sm"
                      variant={selectedRelationshipTypes.includes(type.sys_id) ? "default" : "outline"}
                      onClick={() => handleRelationshipTypeToggle(type.sys_id)}
                      className="h-6 px-2 text-xs"
                    >
                      {selectedRelationshipTypes.includes(type.sys_id) ? "ON" : "OFF"}
                    </Button>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  {selectedRelationshipTypes.length === 0 
                    ? "Showing all relationship types" 
                    : `Showing ${selectedRelationshipTypes.length} selected types`}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Node Details */}
          {selectedNodeId && (
            <NodeDetailsPanel
              selectedTableId={selectedNodeId}
              tableDetails={selectedItemDetails.data}
              isLoading={selectedItemDetails.isLoading}
              error={selectedItemDetails.error}
            />
          )}
        </div>

        {/* Visualization */}
        <div className="xl:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div ref={containerRef} className="relative">
                {/* Sidebar Overlay Controls - positioned over D3.js canvas */}
                <GraphSidebarOverlay
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onResetView={handleResetView}
                />
                
                <svg
                  ref={svgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  className="border rounded-lg bg-background"
                  style={{ minHeight: '600px' }}
                />
                {graphData.nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No CI Relationships Found</p>
                      <p className="text-sm">
                        Try adjusting your filters or check your CI relationship data
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Types Legend Card */}
      <div className="flex justify-center">
        <TypesLegendCard
          customTableCount={graphData?.nodes?.filter(n => n.isCustom).length || 0}
        />
      </div>
    </div>
  );
}