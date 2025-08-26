import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraphSidebarOverlay } from './GraphSidebarOverlay';
import { TypesLegendCard } from './TypesLegendCard';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { useGraph, useGraphActions } from '../contexts/GraphContext';
import { useGraphData, useTableDetails } from '../hooks/useServiceNowData';
import { GraphNode, GraphEdge, TableMetadata } from '../types';
import { Loader2, AlertCircle } from 'lucide-react';

interface D3Node extends GraphNode, d3.SimulationNodeDatum {
  fx?: number | null;
  fy?: number | null;
}

interface D3Link extends GraphEdge, d3.SimulationLinkDatum<D3Node> {
  source: D3Node;
  target: D3Node;
}

export function ReferenceNetworkView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const { state } = useGraph();
  const { setGraphStats, setSelectedTableDetails, clearSelections } = useGraphActions();
  
  // Fetch graph data with references
  const {
    data: graphData,
    isLoading: isGraphLoading,
    error: graphError
  } = useGraphData(true); // Include references

  // Fetch details for selected table
  const selectedTableDetails = useTableDetails(
    selectedNodeId || '',
    !!selectedNodeId
  );

  // D3 setup
  const [zoomBehavior, setZoomBehavior] = useState<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [simulation, setSimulation] = useState<d3.Simulation<D3Node, D3Link> | null>(null);

  // Calculate loading state locally to prevent infinite loops
  const isComponentLoading = isGraphLoading || selectedTableDetails.isLoading;
  const componentError = graphError?.message || selectedTableDetails.error?.message || null;

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(400, rect.height)
        });
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial dimension calculation - use setTimeout to avoid setState in useEffect
    setTimeout(() => {
      handleResize();
    }, 0);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize D3 force simulation
  useEffect(() => {
    if (!graphData || !svgRef.current || dimensions.width === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const width = dimensions.width;
    const height = dimensions.height;

    // Prepare data
    const nodes: D3Node[] = graphData.nodes.map(node => ({ ...node }));
    const links: D3Link[] = graphData.edges
      .map(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          return { 
            ...edge, 
            source,
            target
          };
        }
        return null;
      })
      .filter(Boolean) as D3Link[];

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    
    // Use setTimeout to avoid setState in useEffect
    setTimeout(() => {
      setZoomBehavior(zoom);
    }, 0);

    // Main group
    const g = svg.append("g");

    // Create force simulation
    const sim = d3.forceSimulation<D3Node>(nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(links)
        .id((d) => d.id)
        .distance((d) => {
          // Inheritance links are shorter
          return d.type === 'extends' ? 100 : 150;
        })
        .strength((d) => {
          // Inheritance links are stronger
          return d.type === 'extends' ? 0.8 : 0.3;
        })
      )
      .force("charge", d3.forceManyBody()
        .strength((d) => {
          // Custom tables have stronger repulsion to spread them out
          return d.metadata?.isCustom ? -400 : -200;
        })
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide()
        .radius((d) => {
          // Custom tables have larger collision radius
          return d.metadata?.isCustom ? 25 : 20;
        })
      );

    // Use setTimeout to avoid setState in useEffect
    setTimeout(() => {
      setSimulation(sim);
    }, 0);

    // Define markers for arrowheads
    const defs = svg.append("defs");
    
    // Inheritance arrow marker
    defs.append("marker")
      .attr("id", "arrow-extends")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("class", "arrowhead")
      .style("fill", "#3b82f6");

    // Reference arrow marker
    defs.append("marker")
      .attr("id", "arrow-references")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("class", "arrowhead")
      .style("fill", "#64748b");

    // Create links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, D3Link>("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => getLinkColor(d.type))
      .attr("stroke-width", (d) => getLinkWidth(d.type))
      .attr("stroke-opacity", 0.8)
      .attr("marker-end", (d) => `url(#arrow-${d.type})`)
      .style("stroke-dasharray", (d) => d.type === 'references' ? "5,5" : "none");

    // Create nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, D3Node>("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      )
      .on("click", function(event, d) {
        event.stopPropagation();
        handleNodeClick(d);
      })
      .on("mouseover", function(event, d) {
        // Highlight connected nodes and links
        highlightConnected(d);
        
        d3.select(this).select("circle")
          .transition()
          .duration(100)
          .attr("r", (d) => getNodeRadius(d) * 1.2);
      })
      .on("mouseout", function(event, d) {
        // Remove highlighting
        removeHighlight();
        
        d3.select(this).select("circle")
          .transition()
          .duration(100)
          .attr("r", (d) => getNodeRadius(d));
      });

    // Add circles to nodes
    node.append("circle")
      .attr("r", (d) => getNodeRadius(d))
      .attr("fill", (d) => getNodeColor(d.table))
      .attr("stroke", (d) => getNodeBorderColor(d.table))
      .attr("stroke-width", 2);

    // Add labels to nodes
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", (d) => d.table?.is_custom ? "bold" : "normal")
      .style("fill", "#374151")
      .style("pointer-events", "none")
      .text((d) => {
        const label = d.table?.label || d.label;
        return label.length > 15 ? label.substring(0, 12) + "..." : label;
      });

    // Add record count badges for nodes with significant data
    node.filter((d) => d.metadata?.recordCount && d.metadata.recordCount > 1000)
      .append("text")
      .attr("dy", "1.8em")
      .attr("text-anchor", "middle")
      .style("font-size", "8px")
      .style("fill", "#6b7280")
      .style("pointer-events", "none")
      .text((d) => {
        const count = d.metadata?.recordCount || 0;
        if (count > 1000000) return `${Math.round(count / 1000000)}M`;
        if (count > 1000) return `${Math.round(count / 1000)}K`;
        return count.toString();
      });

    // Simulation tick function
    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as D3Node).x!)
        .attr("y1", (d) => (d.source as D3Node).y!)
        .attr("x2", (d) => (d.target as D3Node).x!)
        .attr("y2", (d) => (d.target as D3Node).y!);

      node
        .attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: D3Node) {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: D3Node) {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Node click handler
    function handleNodeClick(d: D3Node) {
      setSelectedNodeId(d.id);
      setSelectedTableDetails(d.table || null);
    }

    // Highlighting functions
    function highlightConnected(d: D3Node) {
      const connectedLinks = links.filter(l => 
        (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id
      );
      const connectedNodes = new Set([
        d.id,
        ...connectedLinks.map(l => (l.source as D3Node).id),
        ...connectedLinks.map(l => (l.target as D3Node).id)
      ]);

      // Fade out unconnected elements
      node.style("opacity", (n) => connectedNodes.has(n.id) ? 1 : 0.2);
      link.style("opacity", (l) => 
        (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id ? 1 : 0.1
      );
    }

    function removeHighlight() {
      node.style("opacity", 1);
      link.style("opacity", 0.8);
    }

    // Clear selection on background click
    svg.on("click", () => {
      setSelectedNodeId(null);
      clearSelections();
    });

    // Update graph stats
    setGraphStats({
      nodeCount: nodes.length,
      edgeCount: links.length,
      renderTime: performance.now()
    });

    // Cleanup function
    return () => {
      sim.stop();
    };

  }, [graphData, dimensions, setGraphStats, setSelectedTableDetails, clearSelections]);

  // Helper functions
  const getNodeColor = (table?: TableMetadata): string => {
    if (!table) return '#64748b';
    if (table.is_custom) return '#ea580c'; // Orange for custom
    if (table.table_type === 'base') return '#3b82f6'; // Blue for base
    return '#10b981'; // Green for extended
  };

  const getNodeBorderColor = (table?: TableMetadata): string => {
    if (!table) return '#475569';
    if (table.is_custom) return '#c2410c';
    if (table.table_type === 'base') return '#2563eb';
    return '#059669';
  };

  const getNodeRadius = (node: D3Node): number => {
    const baseRadius = 12;
    if (node.table?.is_custom) return baseRadius + 2;
    if (node.table?.table_type === 'base') return baseRadius + 4;
    return baseRadius;
  };

  const getLinkColor = (type: string): string => {
    switch (type) {
      case 'extends': return '#3b82f6'; // Blue for inheritance
      case 'references': return '#64748b'; // Gray for references
      default: return '#94a3b8';
    }
  };

  const getLinkWidth = (type: string): number => {
    switch (type) {
      case 'extends': return 3; // Thicker for inheritance
      case 'references': return 1.5; // Thinner for references
      default: return 1;
    }
  };

  // Control handlers
  const handleZoomIn = () => {
    if (zoomBehavior && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(200)
        .call(zoomBehavior.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (zoomBehavior && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(200)
        .call(zoomBehavior.scaleBy, 0.75);
    }
  };

  const handleResetView = () => {
    if (zoomBehavior && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomBehavior.transform, d3.zoomIdentity);
    }
    
    if (simulation) {
      simulation.alpha(1).restart();
    }
    
    clearSelections();
    setSelectedNodeId(null);
  };

  // Handle search
  const handleSearchChange = (term: string) => {
    // TODO: Implement search highlighting in network
    console.log('Search term:', term);
  };

  if (graphError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Network Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {graphError.message}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Network Visualization - now takes 3/4 instead of 2/3 */}
        <div className="lg:col-span-3">
          <Card className="w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Reference Field Network</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    ━ Inheritance
                  </Badge>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    ┅ References
                  </Badge>
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
                />
                
                {isComponentLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Loading reference network...</p>
                    </div>
                  </div>
                ) : (
                  <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    className="cursor-grab active:cursor-grabbing"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Node Details Panel */}
        <div className="lg:col-span-1">
          <NodeDetailsPanel
            selectedTable={state.selectedTableDetails}
            tableFields={selectedTableDetails.data.fields}
            recordCount={selectedTableDetails.data.recordCount}
            isLoading={selectedTableDetails.isLoading}
            onClose={() => {
              setSelectedNodeId(null);
              clearSelections();
            }}
          />
        </div>
      </div>

      {/* Types Legend Card */}
      <div className="flex justify-center">
        <TypesLegendCard
          customTableCount={graphData?.nodes?.filter(n => n.table?.is_custom).length || 0}
        />
      </div>
    </div>
  );
}