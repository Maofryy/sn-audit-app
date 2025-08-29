import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReferenceFieldRelationship } from '../types';
import { 
  Database, 
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Play,
  Pause
} from 'lucide-react';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'table';
  isCustom: boolean;
  incomingCount: number;
  outgoingCount: number;
  totalRelations: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  fieldName: string;
  fieldLabel: string;
  isMandatory: boolean;
  isCustom: boolean;
  strength: number;
  direction: 'outgoing' | 'incoming';
}

interface ReferenceFieldForceGraphProps {
  relationships: ReferenceFieldRelationship[];
  selectedTable?: string;
  height?: number;
  className?: string;
}

export function ReferenceFieldForceGraph({ 
  relationships, 
  selectedTable, 
  height = 600, 
  className 
}: ReferenceFieldForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  
  // Process data into nodes and links
  const graphData = React.useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    // Create nodes from relationships
    relationships.forEach(rel => {
      // Add source table node
      if (!nodeMap.has(rel.source_table)) {
        nodeMap.set(rel.source_table, {
          id: rel.source_table,
          name: rel.source_table,
          type: 'table',
          isCustom: rel.source_table.startsWith('u_') || rel.source_table.startsWith('x_'),
          incomingCount: 0,
          outgoingCount: 0,
          totalRelations: 0
        });
      }

      // Add target table node
      if (!nodeMap.has(rel.target_table)) {
        nodeMap.set(rel.target_table, {
          id: rel.target_table,
          name: rel.target_table,
          type: 'table',
          isCustom: rel.target_table.startsWith('u_') || rel.target_table.startsWith('x_'),
          incomingCount: 0,
          outgoingCount: 0,
          totalRelations: 0
        });
      }

      // Update counts
      const sourceNode = nodeMap.get(rel.source_table)!;
      const targetNode = nodeMap.get(rel.target_table)!;
      
      sourceNode.outgoingCount++;
      targetNode.incomingCount++;

      // Create link
      links.push({
        id: `${rel.source_table}-${rel.field_name}-${rel.target_table}`,
        source: rel.source_table,
        target: rel.target_table,
        fieldName: rel.field_name,
        fieldLabel: rel.field_label,
        isMandatory: rel.is_mandatory,
        isCustom: rel.is_custom,
        strength: rel.relationship_strength,
        direction: 'outgoing'
      });
    });

    // Calculate total relations
    nodeMap.forEach(node => {
      node.totalRelations = node.incomingCount + node.outgoingCount;
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links
    };
  }, [relationships]);

  // D3 Force Graph Setup
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const margin = 20;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create container group
    const container = svg.append('g');

    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links)
        .id(d => d.id)
        .distance(d => 100 - (d.strength * 50))
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody()
        .strength(d => -300 - (d.totalRelations * 20))
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => 30 + Math.sqrt(d.totalRelations) * 5));

    simulationRef.current = simulation;

    // Create arrow markers
    const defs = svg.append('defs');
    
    // Outgoing arrow (blue)
    defs.append('marker')
      .attr('id', 'arrowhead-outgoing')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#3b82f6')
      .attr('stroke', '#3b82f6');

    // Incoming arrow (green) 
    defs.append('marker')
      .attr('id', 'arrowhead-incoming')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#10b981')
      .attr('stroke', '#10b981');

    // Create links
    const link = container.append('g')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('stroke', d => d.isCustom ? '#f59e0b' : (d.isMandatory ? '#ef4444' : '#6b7280'))
      .attr('stroke-width', d => Math.max(1, d.strength * 4))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', d => {
        if (selectedTable) {
          return d.source === selectedTable ? 'url(#arrowhead-outgoing)' : 'url(#arrowhead-incoming)';
        }
        return 'url(#arrowhead-outgoing)';
      })
      .on('mouseover', function(event, d) {
        // Highlight link on hover
        d3.select(this).attr('stroke-opacity', 1).attr('stroke-width', Math.max(2, d.strength * 6));
        
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'force-graph-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .html(`
            <div><strong>${d.fieldLabel}</strong></div>
            <div>Field: ${d.fieldName}</div>
            <div>Strength: ${Math.round(d.strength * 100)}%</div>
            ${d.isMandatory ? '<div>Mandatory</div>' : ''}
            ${d.isCustom ? '<div>Custom Field</div>' : ''}
          `);

        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('stroke-opacity', 0.6).attr('stroke-width', Math.max(1, d.strength * 4));
        d3.selectAll('.force-graph-tooltip').remove();
      });

    // Create nodes
    const node = container.append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .enter()
      .append('circle')
      .attr('r', d => 15 + Math.sqrt(d.totalRelations) * 3)
      .attr('fill', d => {
        if (d.id === selectedTable) return '#3b82f6';
        if (d.isCustom) return '#f59e0b';
        return '#6b7280';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(selectedNode === d.id ? null : d.id);
      })
      .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke-width', 4);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('stroke-width', 2);
      })
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Create labels
    const label = container.append('g')
      .selectAll('text')
      .data(graphData.nodes)
      .enter()
      .append('text')
      .text(d => d.name)
      .style('font-size', '12px')
      .style('font-weight', d => d.id === selectedTable ? 'bold' : 'normal')
      .style('fill', '#374151')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .attr('dy', '0.35em');

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      label
        .attr('x', d => d.x!)
        .attr('y', d => d.y! + (15 + Math.sqrt(d.totalRelations) * 3) + 15);
    });

    // Control simulation
    if (!isRunning) {
      simulation.stop();
    }

    return () => {
      simulation.stop();
    };
  }, [graphData, selectedTable, height, isRunning]);

  const handleRestart = () => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
      setIsRunning(true);
    }
  };

  const handleToggleSimulation = () => {
    if (simulationRef.current) {
      if (isRunning) {
        simulationRef.current.stop();
      } else {
        simulationRef.current.restart();
      }
      setIsRunning(!isRunning);
    }
  };

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        svg.property('__zoom').scaleBy, 1.2
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        svg.property('__zoom').scaleBy, 0.8
      );
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        svg.property('__zoom').transform,
        d3.zoomIdentity
      );
    }
    handleRestart();
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    const customTables = graphData.nodes.filter(n => n.isCustom).length;
    const customRelationships = graphData.links.filter(l => l.isCustom).length;
    const mandatoryRelationships = graphData.links.filter(l => l.isMandatory).length;
    
    return {
      totalTables: graphData.nodes.length,
      totalRelationships: graphData.links.length,
      customTables,
      customRelationships,
      mandatoryRelationships
    };
  }, [graphData]);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Controls and Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Reference Field Network
              {selectedTable && (
                <Badge variant="default">
                  Focused on {selectedTable}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSimulation}
              >
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isRunning ? 'Pause' : 'Resume'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
              >
                <RotateCcw className="h-4 w-4" />
                Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Reset View
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
              <div className="text-lg font-bold text-blue-600">{stats.totalTables}</div>
              <div className="text-xs text-blue-600">Tables</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="text-lg font-bold text-green-600">{stats.totalRelationships}</div>
              <div className="text-xs text-green-600">Relations</div>
            </div>
            <div className="text-center p-2 bg-orange-50 dark:bg-orange-950 rounded">
              <div className="text-lg font-bold text-orange-600">{stats.customTables}</div>
              <div className="text-xs text-orange-600">Custom Tables</div>
            </div>
            <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
              <div className="text-lg font-bold text-yellow-600">{stats.customRelationships}</div>
              <div className="text-xs text-yellow-600">Custom Fields</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded">
              <div className="text-lg font-bold text-red-600">{stats.mandatoryRelationships}</div>
              <div className="text-xs text-red-600">Mandatory</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Selected Table</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Custom Table</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span>Standard Table</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-blue-500" />
              <span>Outgoing Reference</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 text-green-500" />
              <span>Incoming Reference</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graph */}
      <Card>
        <CardContent className="p-0">
          <div className="relative">
            <svg
              ref={svgRef}
              width="100%"
              height={height}
              style={{ border: '1px solid #e5e7eb' }}
            />
            {graphData.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4" />
                  <p>No reference field relationships to display</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}