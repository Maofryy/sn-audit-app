import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Network,
  Target,
  Sun,
  Filter,
  Eye,
  EyeOff,
  Star,
  Search,
  Layers
} from 'lucide-react';
import { GraphLayoutType } from './GraphControls';

interface GraphSidebarProps {
  // Layout controls
  layoutType?: GraphLayoutType;
  onLayoutChange?: (layout: GraphLayoutType) => void;
  
  // Zoom controls
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  
  // Filter controls
  visibleTableTypes?: {
    base: boolean;
    extended: boolean;
    custom: boolean;
  };
  onTableTypeToggle?: (type: 'base' | 'extended' | 'custom') => void;
  
  // Enhanced custom table controls
  customTableEmphasis?: 'subtle' | 'moderate' | 'maximum';
  onCustomEmphasisChange?: (level: 'subtle' | 'moderate' | 'maximum') => void;
  showCustomOnly?: boolean;
  onCustomOnlyToggle?: () => void;
  customTableCount?: number;
}

export function GraphSidebar({
  layoutType = 'tree',
  onLayoutChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  visibleTableTypes = { base: true, extended: true, custom: true },
  onTableTypeToggle,
  customTableEmphasis = 'moderate',
  onCustomEmphasisChange,
  showCustomOnly = false,
  onCustomOnlyToggle,
  customTableCount = 0
}: GraphSidebarProps) {
  const [showFilters, setShowFilters] = useState(true);

  const layoutIcons = {
    'tree': Network,
    'force-directed': Target,
    'sunburst': Sun,
    'radial': Network
  };

  const layoutTooltips = {
    'tree': 'Tree Layout',
    'force-directed': 'Force-Directed',
    'sunburst': 'Sunburst',
    'radial': 'Radial Layout'
  };

  return (
    <div className="absolute left-4 top-4 z-50 flex flex-col bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-2 space-y-1">
      {/* Layout Controls */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 px-1 py-1 text-center font-medium">
          Layout
        </div>
        {Object.entries(layoutIcons).map(([layout, Icon]) => (
          <Button
            key={layout}
            size="sm"
            variant={layoutType === layout ? "default" : "ghost"}
            onClick={() => onLayoutChange?.(layout as GraphLayoutType)}
            className="w-7 h-7 p-0 relative group"
            title={layoutTooltips[layout as GraphLayoutType]}
          >
            <Icon className="h-4 w-4" />
            
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {layoutTooltips[layout as GraphLayoutType]}
            </div>
          </Button>
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 px-1 py-1 text-center font-medium">
          Zoom
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onZoomIn}
          className="w-7 h-7 p-0 relative group"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Zoom In
          </div>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onZoomOut}
          className="w-7 h-7 p-0 relative group"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Zoom Out
          </div>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onResetView}
          className="w-7 h-7 p-0 relative group"
          title="Reset View"
        >
          <RotateCcw className="h-4 w-4" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Reset View
          </div>
        </Button>
      </div>

      {/* Filter Toggle */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 px-1 py-1 text-center font-medium">
          Filter
        </div>
        <Button
          size="sm"
          variant={showFilters ? "default" : "ghost"}
          onClick={() => setShowFilters(!showFilters)}
          className={`w-7 h-7 p-0 relative group ${showFilters ? 'shadow-md ring-1 ring-blue-500/20' : ''}`}
          title={showFilters ? "Hide Filters" : "Show Filters"}
        >
          <Filter className={`h-4 w-4 ${showFilters ? 'text-white' : ''}`} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {showFilters ? "Hide Filters" : "Show Filters"}
          </div>
        </Button>
        
        {/* Filter Options */}
        {showFilters && (
          <div className="absolute left-full ml-2 top-0 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-3 space-y-3 min-w-[200px]">
            {/* Custom Table Quick Actions */}
            <div className="border-b pb-3">
              <div className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Star className="h-3 w-3 text-orange-500" />
                Custom Tables ({customTableCount})
              </div>
              
              <div className="space-y-2">
                <Button
                  size="sm"
                  onClick={onCustomOnlyToggle}
                  className={`w-full text-xs h-6 ${showCustomOnly ? 'custom-filter-button active' : 'custom-filter-button'}`}
                  title="Show only custom tables"
                >
                  <Search className="h-3 w-3 mr-1" />
                  Custom Only
                </Button>
                
                {/* Custom Table Emphasis Control */}
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Emphasis Level</div>
                  <div className="flex gap-1">
                    {['subtle', 'moderate', 'maximum'].map((level) => (
                      <Button
                        key={level}
                        size="sm"
                        variant={customTableEmphasis === level ? "default" : "ghost"}
                        onClick={() => onCustomEmphasisChange?.(level as 'subtle' | 'moderate' | 'maximum')}
                        className="flex-1 text-xs h-5 px-1"
                        title={`${level.charAt(0).toUpperCase() + level.slice(1)} emphasis`}
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          level === 'subtle' ? 'bg-orange-300' : 
                          level === 'moderate' ? 'bg-orange-500' : 'bg-orange-700'
                        }`}></div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Standard Table Type Filters */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Table Types
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-xs">Base</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onTableTypeToggle?.('base')}
                    className="w-6 h-6 p-0"
                  >
                    {visibleTableTypes.base ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-xs">Extended</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onTableTypeToggle?.('extended')}
                    className="w-6 h-6 p-0"
                  >
                    {visibleTableTypes.extended ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-diamond bg-orange-500 transform rotate-45"></div>
                    <span className="text-xs font-semibold">Custom</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onTableTypeToggle?.('custom')}
                    className="w-6 h-6 p-0"
                  >
                    {visibleTableTypes.custom ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}