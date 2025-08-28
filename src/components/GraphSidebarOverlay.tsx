import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Filter,
  Search,
  Download,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { GraphLayoutType } from './GraphControls';
// RadialLayoutSettings import removed

interface GraphSidebarOverlayProps {
  // Zoom controls
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  
  // View controls
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  
  // Export controls
  onExportSVG?: () => void;
  onExportPNG?: () => void;
  
  // Filter controls
  visibleTableTypes?: {
    base: boolean;
    extended: boolean;
    custom: boolean;
  };
  onTableTypeToggle?: (type: 'base' | 'extended' | 'custom') => void;
  
  // Search
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  
  // Custom table controls
  showCustomOnly?: boolean;
  onCustomOnlyToggle?: () => void;
  customTableCount?: number;
}

interface ControlGroup {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    action: () => void;
    active?: boolean;
    variant?: 'default' | 'secondary' | 'destructive';
  }>;
}

export function GraphSidebarOverlay({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleFullscreen,
  isFullscreen = false,
  onExportSVG,
  onExportPNG,
  visibleTableTypes = { base: true, extended: true, custom: true },
  onTableTypeToggle,
  searchTerm = '',
  onSearchChange,
  showCustomOnly = false,
  onCustomOnlyToggle,
  customTableCount = 0
}: GraphSidebarOverlayProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (groupId: string) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setHoveredGroup(groupId);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setHoveredGroup(null);
    }, 100); // Small delay to allow mouse to move to submenu
    setHoverTimeout(timeout);
  };

  const handleSubmenuMouseEnter = (groupId: string) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setHoveredGroup(groupId);
  };

  const handleSubmenuMouseLeave = () => {
    setHoveredGroup(null);
  };

  const controlGroups: ControlGroup[] = [
    {
      id: 'filter',
      icon: Filter,
      label: 'Filters',
      items: [
        { 
          icon: Search, 
          label: showCustomOnly ? 'Show All Tables' : 'Custom Only', 
          action: () => onCustomOnlyToggle?.(),
          active: showCustomOnly,
          variant: showCustomOnly ? 'secondary' : undefined
        }
      ]
    },
    {
      id: 'zoom',
      icon: ZoomIn,
      label: 'Zoom & View',
      items: [
        { icon: ZoomIn, label: 'Zoom In', action: () => onZoomIn?.() },
        { icon: ZoomOut, label: 'Zoom Out', action: () => onZoomOut?.() },
        { icon: RotateCcw, label: 'Reset View', action: () => onResetView?.() },
        { 
          icon: isFullscreen ? Minimize2 : Maximize2, 
          label: isFullscreen ? 'Exit Fullscreen' : 'Fullscreen', 
          action: () => onToggleFullscreen?.() 
        }
      ]
    },
    {
      id: 'export',
      icon: Download,
      label: 'Export',
      items: [
        { icon: Download, label: 'Export SVG', action: () => onExportSVG?.() },
        { icon: Download, label: 'Export PNG', action: () => onExportPNG?.() }
      ]
    }
  ];

  return (
    <div className="absolute right-2 top-2 z-40">
      {/* Compact Control Groups */}
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-1 space-y-1">
        {controlGroups.map((group) => (
          <div 
            key={group.id}
            className="relative"
            onMouseEnter={() => handleMouseEnter(group.id)}
            onMouseLeave={handleMouseLeave}
          >
            <Button
              size="sm"
              variant="ghost"
              className="w-7 h-7 p-0 relative group hover:bg-gray-100"
              onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
            >
              <group.icon className="h-3.5 w-3.5 text-gray-600" />
            </Button>
            
            {/* Hover Tooltip - positioned on left to avoid conflict */}
            <div className={`
              absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 
              bg-gray-900 text-white text-xs rounded whitespace-nowrap z-20
              transition-opacity duration-200 pointer-events-none
              ${hoveredGroup === group.id && !expandedGroup ? 'opacity-100' : 'opacity-0'}
            `}>
              {group.label}
            </div>
            
            {/* Invisible bridge area to connect icon and submenu */}
            {(hoveredGroup === group.id || expandedGroup === group.id) && (
              <div className="absolute right-0 top-0 w-2 h-7 z-25" />
            )}
            
            {/* Expanded Menu - stays on right */}
            {(hoveredGroup === group.id || expandedGroup === group.id) && (
              <div 
                className="absolute right-full mr-2 top-0 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-2 space-y-1 min-w-[140px] z-30"
                onMouseEnter={() => handleSubmenuMouseEnter(group.id)}
                onMouseLeave={handleSubmenuMouseLeave}
              >
                <div className="text-xs font-medium text-gray-700 px-1 py-1 border-b border-gray-100 mb-1">
                  {group.label}
                </div>
                
                {/* Standard menu items */}
                {group.items.map((item, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={item.active ? "default" : item.variant || "ghost"}
                    onClick={item.action}
                    className="w-full justify-start text-xs h-6 gap-2"
                  >
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}