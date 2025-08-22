# Graph Visualization Research - React + D3 Integration

## Overview

This document outlines research findings on implementing interactive graph visualizations for CMDB table inheritance and relationship mapping using React and D3.js.

## D3.js Fundamentals for CMDB Visualization

### Core D3 Concepts

#### Force Simulation
D3's force simulation is ideal for CMDB relationship visualization:
- **Centering Force**: Attracts nodes to screen center
- **Collision Force**: Prevents node overlap with radius-based collision detection
- **Link Force**: Maintains relationships between connected nodes
- **Many-Body Force**: Applies attraction/repulsion between all nodes

#### Data Binding Pattern
```javascript
// D3 data binding for dynamic updates
const nodes = d3.select(svg)
  .selectAll('.node')
  .data(nodeData, d => d.id)
  .join(
    enter => enter.append('circle').attr('class', 'node'),
    update => update.attr('fill', d => getNodeColor(d)),
    exit => exit.remove()
  );
```

### React + D3 Integration Patterns

#### Pattern 1: React for Structure, D3 for Calculation
```javascript
function CMDBGraph({ data }) {
  const svgRef = useRef();
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  
  useEffect(() => {
    // D3 calculates positions
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id))
      .force('charge', d3.forceManyBody())
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    simulation.on('tick', () => {
      setNodes([...simulation.nodes()]);
    });
  }, [data]);
  
  // React renders the elements
  return (
    <svg ref={svgRef}>
      {links.map(link => <Line key={link.id} {...link} />)}
      {nodes.map(node => <Node key={node.id} {...node} />)}
    </svg>
  );
}
```

#### Pattern 2: D3 for Complete SVG Management
```javascript
function CMDBGraphD3({ data }) {
  const svgRef = useRef();
  
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    
    // D3 handles all DOM manipulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links))
      .force('charge', d3.forceManyBody())
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    const link = svg.selectAll('.link')
      .data(data.links)
      .join('line')
      .attr('class', 'link');
    
    const node = svg.selectAll('.node')
      .data(data.nodes)
      .join('circle')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
  }, [data]);
  
  return <svg ref={svgRef}></svg>;
}
```

## CMDB-Specific Visualization Requirements

### Table Inheritance Hierarchy

#### Hierarchical Tree Layout
```javascript
function TableInheritanceTree({ tables }) {
  const hierarchy = d3.hierarchy(buildTableHierarchy(tables));
  const treeLayout = d3.tree().size([height, width]);
  const treeData = treeLayout(hierarchy);
  
  return (
    <svg>
      {treeData.links().map(link => (
        <path
          key={`${link.source.data.id}-${link.target.data.id}`}
          d={d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x)(link)}
          className="inheritance-link"
        />
      ))}
      {treeData.descendants().map(node => (
        <TableNode 
          key={node.data.id}
          table={node.data}
          x={node.y}
          y={node.x}
        />
      ))}
    </svg>
  );
}
```

#### Node Types and Styling
```javascript
const nodeStyles = {
  baseTable: { color: '#2563eb', size: 40 }, // Blue for base CMDB tables
  customTable: { color: '#dc2626', size: 35 }, // Red for custom tables
  extendedTable: { color: '#059669', size: 30 }, // Green for extended tables
  deprecatedTable: { color: '#6b7280', size: 25 } // Gray for deprecated
};

function TableNode({ table, x, y }) {
  const style = nodeStyles[table.type] || nodeStyles.baseTable;
  
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r={style.size}
        fill={style.color}
        className="table-node"
      />
      <text
        dy=".35em"
        textAnchor="middle"
        className="table-label"
      >
        {table.label}
      </text>
    </g>
  );
}
```

### Relationship Network Diagram

#### Force-Directed Layout for Relationships
```javascript
function RelationshipNetwork({ tables, relationships }) {
  const [simulation, setSimulation] = useState(null);
  
  useEffect(() => {
    const sim = d3.forceSimulation(tables)
      .force('link', d3.forceLink(relationships)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));
    
    setSimulation(sim);
    
    return () => sim.stop();
  }, [tables, relationships]);
  
  return (
    <NetworkCanvas
      simulation={simulation}
      nodes={tables}
      links={relationships}
    />
  );
}
```

#### Relationship Type Visualization
```javascript
const relationshipStyles = {
  'extends': { color: '#3b82f6', width: 3, style: 'solid' },
  'references': { color: '#10b981', width: 2, style: 'dashed' },
  'depends_on': { color: '#f59e0b', width: 2, style: 'dotted' },
  'contains': { color: '#8b5cf6', width: 1, style: 'solid' }
};

function RelationshipEdge({ link }) {
  const style = relationshipStyles[link.type];
  
  return (
    <line
      x1={link.source.x}
      y1={link.source.y}
      x2={link.target.x}
      y2={link.target.y}
      stroke={style.color}
      strokeWidth={style.width}
      strokeDasharray={style.style === 'dashed' ? '5,5' : 
                       style.style === 'dotted' ? '2,2' : 'none'}
      className="relationship-edge"
    />
  );
}
```

## Performance Optimization

### Canvas vs SVG Performance
```javascript
// Use Canvas for large datasets (1000+ nodes)
function CanvasGraph({ nodes, links }) {
  const canvasRef = useRef();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    function drawGraph() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw links
      links.forEach(link => {
        context.beginPath();
        context.moveTo(link.source.x, link.source.y);
        context.lineTo(link.target.x, link.target.y);
        context.stroke();
      });
      
      // Draw nodes
      nodes.forEach(node => {
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        context.fill();
      });
    }
    
    const simulation = d3.forceSimulation(nodes)
      .on('tick', drawGraph);
      
  }, [nodes, links]);
  
  return <canvas ref={canvasRef} width={width} height={height} />;
}
```

### Virtual Scrolling for Large Hierarchies
```javascript
import { VariableSizeList as List } from 'react-window';

function VirtualizedTableList({ tables }) {
  const getItemSize = (index) => {
    const table = tables[index];
    return table.hasChildren ? 60 : 40; // Larger for expandable items
  };
  
  const TableRow = ({ index, style }) => (
    <div style={style}>
      <TableListItem table={tables[index]} />
    </div>
  );
  
  return (
    <List
      height={600}
      itemCount={tables.length}
      itemSize={getItemSize}
      width={300}
    >
      {TableRow}
    </List>
  );
}
```

## Interactive Features

### Zoom and Pan
```javascript
function ZoomableGraph({ children }) {
  const svgRef = useRef();
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });
    
    svg.call(zoom);
  }, []);
  
  return (
    <svg ref={svgRef}>
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        {children}
      </g>
    </svg>
  );
}
```

### Node Search and Filtering
```javascript
function GraphSearch({ nodes, onFilterChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    showCustomOnly: false,
    showRelationships: true,
    tableType: 'all'
  });
  
  useEffect(() => {
    const filteredNodes = nodes.filter(node => {
      if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      if (filters.showCustomOnly && !node.isCustom) {
        return false;
      }
      
      if (filters.tableType !== 'all' && node.type !== filters.tableType) {
        return false;
      }
      
      return true;
    });
    
    onFilterChange(filteredNodes);
  }, [searchTerm, filters, nodes]);
  
  return (
    <div className="graph-controls">
      <input
        type="text"
        placeholder="Search tables..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {/* Filter controls */}
    </div>
  );
}
```

### Node Details Panel
```javascript
function NodeDetailsPanel({ selectedNode, position }) {
  if (!selectedNode) return null;
  
  return (
    <div 
      className="node-details-panel"
      style={{
        position: 'absolute',
        left: position.x + 20,
        top: position.y,
        zIndex: 1000
      }}
    >
      <h3>{selectedNode.label}</h3>
      <p><strong>Table:</strong> {selectedNode.name}</p>
      <p><strong>Extends:</strong> {selectedNode.extends || 'None'}</p>
      <p><strong>Records:</strong> {selectedNode.recordCount}</p>
      <p><strong>Custom Fields:</strong> {selectedNode.customFieldCount}</p>
      
      {selectedNode.relationships && (
        <div>
          <h4>Relationships:</h4>
          <ul>
            {selectedNode.relationships.map(rel => (
              <li key={rel.id}>{rel.type}: {rel.target}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Component Architecture

### Graph Container Component
```javascript
function CMDBGraphContainer() {
  const [graphData, setGraphData] = useState(null);
  const [viewMode, setViewMode] = useState('inheritance'); // 'inheritance' | 'relationships'
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadGraphData() {
      setLoading(true);
      try {
        const data = await cmdbService.getGraphData(viewMode);
        setGraphData(data);
      } catch (error) {
        console.error('Failed to load graph data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadGraphData();
  }, [viewMode]);
  
  if (loading) return <GraphSkeleton />;
  
  return (
    <div className="cmdb-graph-container">
      <GraphControls 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        data={graphData}
      />
      
      {viewMode === 'inheritance' ? (
        <TableInheritanceTree tables={graphData.tables} />
      ) : (
        <RelationshipNetwork 
          tables={graphData.tables}
          relationships={graphData.relationships}
        />
      )}
    </div>
  );
}
```

### Recommended Libraries

#### Primary Dependencies
```json
{
  "d3": "^7.8.5",
  "@types/d3": "^7.4.0",
  "react-window": "^1.8.8",
  "@types/react-window": "^1.8.5"
}
```

#### Alternative Libraries
- **react-d3-graph**: Ready-made components (limited customization)
- **vis-network**: Alternative visualization library
- **cytoscape**: Advanced graph analysis features
- **sigma.js**: High-performance graph rendering

## Testing Strategies

### Unit Testing Graph Components
```javascript
import { render, fireEvent } from '@testing-library/react';
import { CMDBGraphContainer } from './CMDBGraphContainer';

test('renders graph with table nodes', async () => {
  const mockData = {
    tables: [
      { id: 'cmdb_ci', name: 'cmdb_ci', label: 'Configuration Item' },
      { id: 'cmdb_ci_server', name: 'cmdb_ci_server', label: 'Server', extends: 'cmdb_ci' }
    ]
  };
  
  const { findByText } = render(<CMDBGraphContainer data={mockData} />);
  
  expect(await findByText('Configuration Item')).toBeInTheDocument();
  expect(await findByText('Server')).toBeInTheDocument();
});
```

### Performance Testing
```javascript
function measureGraphPerformance(nodeCount) {
  const startTime = performance.now();
  
  // Generate test data
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `node_${i}`,
    name: `Table ${i}`,
    x: Math.random() * 800,
    y: Math.random() * 600
  }));
  
  // Render graph
  render(<Graph nodes={nodes} />);
  
  const endTime = performance.now();
  console.log(`Rendered ${nodeCount} nodes in ${endTime - startTime}ms`);
}
```

## Best Practices

1. **Performance**: Use Canvas for >500 nodes, SVG for detailed interactions
2. **Responsiveness**: Implement debounced resize handlers
3. **Accessibility**: Add ARIA labels and keyboard navigation
4. **User Experience**: Provide clear loading states and error handling
5. **Customization**: Allow users to choose layout algorithms
6. **Export**: Implement SVG/PNG export functionality

This research provides the foundation for implementing sophisticated CMDB visualization capabilities in the audit application.