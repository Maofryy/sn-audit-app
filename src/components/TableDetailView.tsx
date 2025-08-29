import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  AlertCircle, 
  Database, 
  Settings,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  TrendingUp,
  Shield,
  FileText
} from 'lucide-react';
import {
  TableAuditData,
  ForceGraphNode,
  ForceGraphEdge,
  ForceGraphConfig,
  TableMetadata,
  ReferenceFieldRelationship
} from '../types';
import { tableStatisticsService } from '../services/tableStatisticsService';
import { serviceNowService } from '../services/serviceNowService';

interface TableDetailViewProps {
  tableName: string;
  onClose?: () => void;
}

export function TableDetailView({ tableName, onClose }: TableDetailViewProps) {
  // State management
  const [auditData, setAuditData] = useState<TableAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphConfig, setGraphConfig] = useState<ForceGraphConfig>({
    width: 800,
    height: 600,
    charge: -200,
    distance: 100,
    collision_radius: 30,
    center_force: 0.1,
    show_labels: true,
    highlight_custom: true
  });

  // D3.js refs
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<ForceGraphNode, ForceGraphEdge> | null>(null);

  // Load table detail data
  useEffect(() => {
    if (tableName) {
      loadTableDetail();
    }
  }, [tableName]);

  // Initialize D3 graph when data loads
  useEffect(() => {
    if (auditData && svgRef.current) {
      initializeForceGraph();
    }
  }, [auditData, graphConfig]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  const loadTableDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔍 Loading detailed audit data for table: ${tableName}`);
      
      // Load all required data in parallel - simplified approach
      const [statistics, cmdbTables, relationships, fields] = await Promise.all([
        tableStatisticsService.getTableStatistics(tableName),
        serviceNowService.getCMDBTables(),
        serviceNowService.getReferenceFieldRelationships({ tableNames: [tableName] }),
        serviceNowService.getTableSchema(tableName)
      ]);

      console.log(`📈 Table ${tableName} statistics:`, statistics);
      console.log(`🔗 Found ${relationships.length} reference relationships`);
      console.log(`📋 Found ${fields.length} fields in dictionary`);

      // Find the table metadata
      const table = cmdbTables.find(t => t.name === tableName);
      if (!table) {
        throw new Error(`Table ${tableName} not found`);
      }

      // Generate basic audit KPIs focusing on dictionary structure
      const auditKPIs = await tableStatisticsService.generateBasicKPIs(tableName, statistics, fields);

      // Build reference graph data
      const referenceGraph = await buildReferenceGraphData(table, relationships, cmdbTables);

      const tableAuditData: TableAuditData = {
        table,
        statistics,
        fields,
        relationships, // Store raw relationships data
        quality_metrics: {
          table_name: tableName,
          completeness_score: 100,
          reference_integrity_score: 100,
          field_usage_stats: [],
          null_value_percentages: {},
          data_consistency_issues: [],
          generated_at: new Date()
        }, // Simplified placeholder
        audit_kpis: auditKPIs,
        reference_graph: referenceGraph
      };

      setAuditData(tableAuditData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table details');
      console.error('Error loading table detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildReferenceGraphData = async (
    centerTable: TableMetadata,
    relationships: ReferenceFieldRelationship[],
    allTables: TableMetadata[]
  ) => {
    // Get all related tables
    const relatedTableNames = new Set<string>();
    relationships.forEach(rel => {
      relatedTableNames.add(rel.source_table);
      relatedTableNames.add(rel.target_table);
    });

    const connectedTables = allTables.filter(table => 
      relatedTableNames.has(table.name) && table.name !== centerTable.name
    );

    // Build graph edges
    const graphEdges: ForceGraphEdge[] = relationships.map(rel => {
      const isCustom = rel.is_custom;
      const sourceTable = allTables.find(t => t.name === rel.source_table);
      const targetTable = allTables.find(t => t.name === rel.target_table);
      
      return {
        id: `${rel.source_table}-${rel.target_table}-${rel.field_name}`,
        source_table: rel.source_table,
        target_table: rel.target_table,
        field_name: rel.field_name,
        field_label: rel.field_label,
        is_custom: isCustom,
        is_mandatory: rel.is_mandatory,
        strength: rel.relationship_strength,
        color: getEdgeColor(isCustom, sourceTable?.is_custom, targetTable?.is_custom),
        width: rel.is_mandatory ? 3 : 1
      } as ForceGraphEdge;
    });

    return {
      center_table: centerTable,
      connected_tables: connectedTables,
      reference_edges: graphEdges,
      graph_metrics: {
        total_connections: relationships.length,
        custom_connections: relationships.filter(r => r.is_custom).length,
        complexity_score: Math.min(100, relationships.length * 5),
        centrality_score: relationships.length > 0 ? Math.min(100, relationships.length * 10) : 0,
        cluster_coefficient: connectedTables.length > 0 ? relationships.length / connectedTables.length : 0
      }
    };
  };

  const getEdgeColor = (isCustomField: boolean, sourceCustom?: boolean, targetCustom?: boolean): string => {
    if (isCustomField && (sourceCustom || targetCustom)) return '#f97316'; // Orange for custom field and/or custom table
    if (isCustomField) return '#fb923c'; // Light orange for custom field to standard table  
    return '#16a34a'; // Green for standard
  };

  const getNodeColor = (table: TableMetadata, isCenter: boolean): string => {
    if (isCenter) return '#3b82f6'; // Blue for center node
    return table.is_custom ? '#f97316' : '#16a34a'; // Orange for custom, green for standard
  };

  const initializeForceGraph = () => {
    if (!auditData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous graph

    const { reference_graph } = auditData;
    const { center_table, connected_tables, reference_edges } = reference_graph;

    // Prepare nodes data
    const nodes: ForceGraphNode[] = [
      {
        id: center_table.name,
        label: center_table.label,
        type: 'center',
        table: center_table,
        reference_count: reference_edges.length,
        custom_reference_count: reference_edges.filter(e => e.is_custom).length,
        is_custom: center_table.is_custom,
        size: 40,
        color: getNodeColor(center_table, true),
        x: graphConfig.width / 2,
        y: graphConfig.height / 2,
        fx: graphConfig.width / 2, // Fix center node position
        fy: graphConfig.height / 2
      },
      ...connected_tables.map(table => ({
        id: table.name,
        label: table.label,
        type: 'connected' as const,
        table,
        reference_count: reference_edges.filter(e => e.source_table === table.name || e.target_table === table.name).length,
        custom_reference_count: reference_edges.filter(e => 
          (e.source_table === table.name || e.target_table === table.name) && e.is_custom
        ).length,
        is_custom: table.is_custom,
        size: 25,
        color: getNodeColor(table, false)
      }))
    ];

    // Prepare edges data
    const edges: ForceGraphEdge[] = reference_edges.map(edge => ({
      ...edge,
      source: nodes.find(n => n.id === edge.source_table)!,
      target: nodes.find(n => n.id === edge.target_table)!
    }));

    // Create simulation
    const simulation = d3.forceSimulation<ForceGraphNode>(nodes)
      .force('link', d3.forceLink<ForceGraphNode, ForceGraphEdge>(edges)
        .id(d => d.id)
        .distance(graphConfig.distance)
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(graphConfig.charge))
      .force('center', d3.forceCenter(graphConfig.width / 2, graphConfig.height / 2).strength(graphConfig.center_force))
      .force('collision', d3.forceCollide().radius(graphConfig.collision_radius));

    simulationRef.current = simulation;

    // Create container group with zoom
    const container = svg.append('g');
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Add edges
    const link = container.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', d => d.color)
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', d => d.width);

    // Add nodes
    const node = container.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.size)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .call(d3.drag<SVGCircleElement, ForceGraphNode>()
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
          if (d.type !== 'center') { // Keep center node fixed
            d.fx = null;
            d.fy = null;
          }
        })
      );

    // Add labels if enabled
    if (graphConfig.show_labels) {
      const label = container.append('g')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .text(d => d.label)
        .attr('font-size', d => d.type === 'center' ? 14 : 10)
        .attr('font-weight', d => d.type === 'center' ? 'bold' : 'normal')
        .attr('text-anchor', 'middle')
        .attr('dy', d => d.size + 15)
        .attr('fill', '#374151');

      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as ForceGraphNode).x!)
          .attr('y1', d => (d.source as ForceGraphNode).y!)
          .attr('x2', d => (d.target as ForceGraphNode).x!)
          .attr('y2', d => (d.target as ForceGraphNode).y!);

        node
          .attr('cx', d => d.x!)
          .attr('cy', d => d.y!);

        label
          .attr('x', d => d.x!)
          .attr('y', d => d.y!);
      });
    } else {
      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as ForceGraphNode).x!)
          .attr('y1', d => (d.source as ForceGraphNode).y!)
          .attr('x2', d => (d.target as ForceGraphNode).x!)
          .attr('y2', d => (d.target as ForceGraphNode).y!);

        node
          .attr('cx', d => d.x!)
          .attr('cy', d => d.y!);
      });
    }

    // Add tooltips
    node
      .append('title')
      .text(d => `${d.label}\n${d.reference_count} references\n${d.custom_reference_count} custom references`);

    link
      .append('title')
      .text(d => `${d.field_label} (${d.field_name})\n${d.is_custom ? 'Custom' : 'Standard'} ${d.is_mandatory ? '(Mandatory)' : ''}`);
  };

  const resetGraph = () => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  };

  const toggleLabels = () => {
    setGraphConfig(prev => ({
      ...prev,
      show_labels: !prev.show_labels
    }));
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-lg">Loading table details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !auditData) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Failed to Load Table Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-2">
            <Button onClick={loadTableDetail} variant="outline" size="sm">
              Retry
            </Button>
            {onClose && (
              <Button onClick={onClose} variant="ghost" size="sm">
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Table Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6" />
              <div>
                <CardTitle>{auditData.table.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{auditData.table.name}</p>
              </div>
              {auditData.table.is_custom && (
                <Badge variant="secondary">Custom Table</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetGraph}
                className="flex items-center gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Graph
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLabels}
                className="flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                {graphConfig.show_labels ? 'Hide' : 'Show'} Labels
              </Button>
              {onClose && (
                <Button onClick={onClose} variant="ghost" size="sm">
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {auditData.audit_kpis.map(kpi => (
              <div key={kpi.id} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className={`text-2xl font-bold ${
                  kpi.status === 'good' ? 'text-green-600' :
                  kpi.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {kpi.value}{kpi.unit || ''}
                </div>
                <div className="text-sm text-muted-foreground">{kpi.name}</div>
                {kpi.status === 'critical' && <AlertCircle className="h-4 w-4 text-red-600 mx-auto mt-1" />}
                {kpi.status === 'warning' && <TrendingUp className="h-4 w-4 text-yellow-600 mx-auto mt-1" />}
                {kpi.status === 'good' && <Shield className="h-4 w-4 text-green-600 mx-auto mt-1" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}