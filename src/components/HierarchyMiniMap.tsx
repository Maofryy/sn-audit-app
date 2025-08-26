import { useMemo, useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { Map as MapIcon, X } from 'lucide-react';

interface TreeNodeData {
  name: string;
  label: string;
  type: 'base' | 'extended' | 'custom';
  table?: any;
  children?: TreeNodeData[];
  customFieldCount?: number;
  recordCount?: number;
  _isFiltered?: boolean;
}

interface HierarchyMiniMapProps {
  treeData: TreeNodeData | null;
  selectedNode: TreeNodeData | null;
  onNodeClick: (node: TreeNodeData) => void;
  transform: { x: number; y: number; k: number };
  bounds: { width: number; height: number };
  className?: string;
  defaultVisible?: boolean;
}

export function HierarchyMiniMap({
  treeData,
  selectedNode,
  onNodeClick,
  transform,
  bounds,
  className = '',
  defaultVisible = true
}: HierarchyMiniMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isVisible, setIsVisible] = useState(defaultVisible);
  const miniMapSize = { width: 200, height: 150 };
  
  // Create mini-map layout
  const miniMapLayout = useMemo(() => {
    if (!treeData) return null;
    
    const root = d3.hierarchy(treeData, d => d.children);
    const nodeCount = root.descendants().length;
    
    // Compact layout for mini-map
    const treeLayout = d3.tree()
      .size([miniMapSize.height - 20, miniMapSize.width - 20])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));
    
    const layoutRoot = treeLayout(root);
    
    return {
      nodes: layoutRoot.descendants(),
      links: layoutRoot.links(),
      nodeCount
    };
  }, [treeData, miniMapSize]);

  // Custom table density calculation for heat-map
  const customTableDensity = useMemo(() => {
    if (!miniMapLayout) return new Map();
    
    const densityMap = new Map();
    const customNodes = miniMapLayout.nodes.filter(n => n.data.type === 'custom');
    
    // Create density areas around custom tables
    customNodes.forEach(node => {
      const radius = 30; // Heat-map radius
      const x = node.y + 10;
      const y = node.x + 10;
      
      for (let i = 0; i < miniMapSize.width; i += 5) {
        for (let j = 0; j < miniMapSize.height; j += 5) {
          const distance = Math.sqrt(Math.pow(i - x, 2) + Math.pow(j - y, 2));
          if (distance <= radius) {
            const intensity = Math.max(0, 1 - (distance / radius));
            const key = `${i},${j}`;
            densityMap.set(key, (densityMap.get(key) || 0) + intensity);
          }
        }
      }
    });
    
    return densityMap;
  }, [miniMapLayout, miniMapSize]);

  // Calculate viewport indicator
  const viewportIndicator = useMemo(() => {
    if (!bounds.width || !bounds.height) return null;
    
    const scaleX = miniMapSize.width / bounds.width;
    const scaleY = miniMapSize.height / bounds.height;
    
    const viewportWidth = Math.min(miniMapSize.width, bounds.width * scaleX / transform.k);
    const viewportHeight = Math.min(miniMapSize.height, bounds.height * scaleY / transform.k);
    
    const viewportX = Math.max(0, Math.min(miniMapSize.width - viewportWidth, -transform.x * scaleX / transform.k));
    const viewportY = Math.max(0, Math.min(miniMapSize.height - viewportHeight, -transform.y * scaleY / transform.k));
    
    return {
      x: viewportX,
      y: viewportY,
      width: viewportWidth,
      height: viewportHeight
    };
  }, [transform, bounds, miniMapSize]);

  if (!miniMapLayout) return null;

  return (
    <>
      {/* Map Toggle Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsVisible(!isVisible)}
        className={`absolute bottom-4 right-4 z-50 w-8 h-8 p-0 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg hover:bg-white/95 transition-all duration-200 ${className}`}
        title={isVisible ? "Hide Overview Map" : "Show Overview Map"}
      >
        {isVisible ? <X className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
      </Button>

      {/* Mini Map Container */}
      {isVisible && (
        <div className={`absolute bottom-16 right-4 z-40 bg-white/85 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-2 transition-all duration-300 ${className}`}>
          <div className="text-xs text-gray-600 mb-1 font-medium">
            Hierarchy Overview ({miniMapLayout.nodeCount} tables)
          </div>
      
      <svg
        ref={svgRef}
        width={miniMapSize.width}
        height={miniMapSize.height}
        className="border border-gray-100 rounded cursor-pointer"
        onClick={(e) => {
          // Handle mini-map navigation
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Find nearest node and navigate
          let nearestNode = null;
          let nearestDistance = Infinity;
          
          miniMapLayout.nodes.forEach(node => {
            const nodeX = node.y + 10;
            const nodeY = node.x + 10;
            const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
            
            if (distance < nearestDistance && distance < 15) {
              nearestDistance = distance;
              nearestNode = node.data;
            }
          });
          
          if (nearestNode) {
            onNodeClick(nearestNode);
          }
        }}
      >
        {/* Heat-map background for custom table density */}
        <defs>
          <radialGradient id="customHeatGradient">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ea580c" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.1" />
          </radialGradient>
        </defs>
        
        {/* Render heat-map */}
        {Array.from(customTableDensity.entries()).map(([key, intensity]) => {
          const [x, y] = key.split(',').map(Number);
          return (
            <circle
              key={key}
              cx={x}
              cy={y}
              r={3}
              fill="#f97316"
              opacity={Math.min(0.4, intensity * 0.8)}
              className="minimap-custom-heat"
            />
          );
        })}
        
        {/* Render links */}
        {miniMapLayout.links.map((link, i) => (
          <path
            key={i}
            d={`M${link.source.y + 10},${link.source.x + 10}L${link.target.y + 10},${link.target.x + 10}`}
            stroke={link.target.data.type === 'custom' ? '#f97316' : '#cbd5e1'}
            strokeWidth={link.target.data.type === 'custom' ? '1.5' : '0.5'}
            opacity="0.6"
          />
        ))}
        
        {/* Render nodes */}
        {miniMapLayout.nodes.map((node, i) => {
          const isSelected = selectedNode?.name === node.data.name;
          const isCustom = node.data.type === 'custom';
          const isFiltered = node.data._isFiltered;
          
          let nodeColor = '#cbd5e1';
          let nodeSize = 2;
          
          if (!isFiltered) {
            if (isCustom) {
              nodeColor = '#ea580c';
              nodeSize = 4;
            } else if (node.data.type === 'base') {
              nodeColor = '#3b82f6';
              nodeSize = 3;
            } else {
              nodeColor = '#10b981';
              nodeSize = 2;
            }
          }
          
          if (isSelected) {
            nodeSize += 1;
          }
          
          return (
            <g key={i}>
              {/* Selection indicator */}
              {isSelected && (
                <circle
                  cx={node.y + 10}
                  cy={node.x + 10}
                  r={nodeSize + 2}
                  fill="none"
                  stroke="#374151"
                  strokeWidth="2"
                  opacity="0.8"
                />
              )}
              
              {/* Custom table glow in mini-map */}
              {isCustom && !isFiltered && (
                <circle
                  cx={node.y + 10}
                  cy={node.x + 10}
                  r={nodeSize + 1}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="1"
                  opacity="0.6"
                />
              )}
              
              {/* Main node */}
              <circle
                cx={node.y + 10}
                cy={node.x + 10}
                r={nodeSize}
                fill={nodeColor}
                opacity={isFiltered ? 0.3 : 0.9}
                className="hover:opacity-100 transition-opacity"
              />
            </g>
          );
        })}
        
        {/* Viewport indicator */}
        {viewportIndicator && (
          <rect
            x={viewportIndicator.x}
            y={viewportIndicator.y}
            width={viewportIndicator.width}
            height={viewportIndicator.height}
            fill="none"
            stroke="#374151"
            strokeWidth="2"
            strokeDasharray="4,2"
            opacity="0.7"
            pointerEvents="none"
          />
        )}
        
        {/* Custom table count overlay */}
        <g transform={`translate(${miniMapSize.width - 60}, ${miniMapSize.height - 25})`}>
          <rect
            width="55"
            height="20"
            rx="10"
            fill="rgba(234, 88, 12, 0.9)"
            stroke="#9a3412"
            strokeWidth="1"
          />
          <text
            x="27"
            y="14"
            textAnchor="middle"
            fontSize="10"
            fill="white"
            fontWeight="bold"
          >
            {miniMapLayout.nodes.filter(n => n.data.type === 'custom' && !n.data._isFiltered).length} Custom
          </text>
        </g>
      </svg>
      
      {/* Mini-map legend */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>Base</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Ext</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span>Custom</span>
          </div>
        </div>
        <div className="text-orange-600 font-medium">
          🔥 Heat: Custom density
        </div>
      </div>
        </div>
      )}
    </>
  );
}