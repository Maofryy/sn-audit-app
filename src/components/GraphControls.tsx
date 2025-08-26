import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  Search,
  Filter,
  Settings,
  Maximize2,
  Minimize2,
  Network,
  Sun,
  Target
} from 'lucide-react';

export type GraphLayoutType = 'tree' | 'force-directed' | 'sunburst' | 'radial';

export interface GraphControlsProps {
  // Zoom controls
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  
  // Export controls
  onExportSVG?: () => void;
  onExportPNG?: () => void;
  
  // Search and filter
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  
  // View controls
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  
  // Layout controls
  layoutType?: GraphLayoutType;
  onLayoutChange?: (layout: GraphLayoutType) => void;
  
  // Filter settings
  showCustomOnly?: boolean;
  onCustomOnlyToggle?: () => void;
  showBaseOnly?: boolean;
  onBaseOnlyToggle?: () => void;
  showExtendedOnly?: boolean;
  onExtendedOnlyToggle?: () => void;
  
  // View-specific settings
  viewType?: 'inheritance' | 'references' | 'ci-relationships';
  
  // Statistics
  nodeCount?: number;
  edgeCount?: number;
  selectedCount?: number;
}

export function GraphControls({
  onZoomIn,
  onZoomOut,
  onResetView,
  onExportSVG,
  onExportPNG,
  searchTerm = '',
  onSearchChange,
  onToggleFullscreen,
  isFullscreen = false,
  layoutType = 'tree',
  onLayoutChange,
  showCustomOnly = false,
  onCustomOnlyToggle,
  showBaseOnly = false,
  onBaseOnlyToggle,
  showExtendedOnly = false,
  onExtendedOnlyToggle,
  viewType = 'inheritance',
  nodeCount = 0,
  edgeCount = 0,
  selectedCount = 0
}: GraphControlsProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const getViewTypeLabel = () => {
    switch (viewType) {
      case 'inheritance': return 'Tables';
      case 'references': return 'References';
      case 'ci-relationships': return 'CI Relationships';
      default: return 'Items';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Graph Controls
          </div>
          <div className="flex gap-2 text-sm font-normal">
            <Badge variant="outline">
              {nodeCount} {getViewTypeLabel()}
            </Badge>
            {edgeCount > 0 && (
              <Badge variant="outline">
                {edgeCount} Connections
              </Badge>
            )}
            {selectedCount > 0 && (
              <Badge variant="secondary">
                {selectedCount} Selected
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="graph-search" className="text-sm font-medium">
            Search {getViewTypeLabel()}
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="graph-search"
              placeholder={`Search ${getViewTypeLabel().toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Graph Layout Controls */}
        <div className="space-y-2">
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="gap-2 w-full justify-between"
            >
              <div className="flex items-center gap-2">
                {layoutType === 'tree' && <Network className="h-3 w-3" />}
                {layoutType === 'force-directed' && <Target className="h-3 w-3" />}
                {layoutType === 'sunburst' && <Sun className="h-3 w-3" />}
                {layoutType === 'radial' && <Network className="h-3 w-3" />}
                <span className="text-sm">
                  {layoutType === 'tree' && 'Tree Layout'}
                  {layoutType === 'force-directed' && 'Force-Directed'}
                  {layoutType === 'sunburst' && 'Sunburst'}
                  {layoutType === 'radial' && 'Radial'}
                </span>
              </div>
              <Settings className="h-3 w-3" />
            </Button>
            {showLayoutMenu && (
              <Card className="absolute top-10 left-0 z-50 w-full shadow-lg">
                <CardContent className="p-2 space-y-1">
                  <Button
                    size="sm"
                    variant={layoutType === 'tree' ? 'default' : 'ghost'}
                    onClick={() => { onLayoutChange?.('tree'); setShowLayoutMenu(false); }}
                    className="w-full justify-start gap-2"
                  >
                    <Network className="h-3 w-3" />
                    Tree Layout
                  </Button>
                  <Button
                    size="sm"
                    variant={layoutType === 'force-directed' ? 'default' : 'ghost'}
                    onClick={() => { onLayoutChange?.('force-directed'); setShowLayoutMenu(false); }}
                    className="w-full justify-start gap-2"
                  >
                    <Target className="h-3 w-3" />
                    Force-Directed
                  </Button>
                  <Button
                    size="sm"
                    variant={layoutType === 'sunburst' ? 'default' : 'ghost'}
                    onClick={() => { onLayoutChange?.('sunburst'); setShowLayoutMenu(false); }}
                    className="w-full justify-start gap-2"
                  >
                    <Sun className="h-3 w-3" />
                    Sunburst
                  </Button>
                  <Button
                    size="sm"
                    variant={layoutType === 'radial' ? 'default' : 'ghost'}
                    onClick={() => { onLayoutChange?.('radial'); setShowLayoutMenu(false); }}
                    className="w-full justify-start gap-2"
                  >
                    <Network className="h-3 w-3" />
                    Radial Layout
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/* Zoom Controls */}
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onZoomIn}
              disabled={!onZoomIn}
              className="h-8 w-8 p-0"
              title="Zoom In"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onZoomOut}
              disabled={!onZoomOut}
              className="h-8 w-8 p-0"
              title="Zoom Out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onResetView}
              disabled={!onResetView}
              className="h-8 w-8 p-0"
              title="Reset View"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          {/* View Controls */}
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleFullscreen}
            disabled={!onToggleFullscreen}
            className="gap-1"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3 w-3" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                Fullscreen
              </>
            )}
          </Button>

          {/* Filter Menu */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="gap-1"
            >
              <Filter className="h-3 w-3" />
              Filters
            </Button>
            {showFilterMenu && (
              <Card className="absolute top-10 left-0 z-50 w-64 shadow-lg">
                <CardContent className="p-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Table Type Filters</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <Label className="text-xs">Base Only</Label>
                        </div>
                        <Button
                          size="sm"
                          variant={showBaseOnly ? "default" : "outline"}
                          onClick={onBaseOnlyToggle}
                          className="h-6 px-2 text-xs"
                        >
                          {showBaseOnly ? "ON" : "OFF"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <Label className="text-xs">Extended Only</Label>
                        </div>
                        <Button
                          size="sm"
                          variant={showExtendedOnly ? "default" : "outline"}
                          onClick={onExtendedOnlyToggle}
                          className="h-6 px-2 text-xs"
                        >
                          {showExtendedOnly ? "ON" : "OFF"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <Label className="text-xs">Custom Only</Label>
                        </div>
                        <Button
                          size="sm"
                          variant={showCustomOnly ? "default" : "outline"}
                          onClick={onCustomOnlyToggle}
                          className="h-6 px-2 text-xs"
                        >
                          {showCustomOnly ? "ON" : "OFF"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-2">
                    {viewType === 'inheritance' && (
                      <div className="text-xs text-muted-foreground">
                        Filters will gray out tables not matching the selected criteria while maintaining tree structure
                      </div>
                    )}
                    {viewType === 'references' && (
                      <div className="text-xs text-muted-foreground">
                        Filter to show only references involving selected table types
                      </div>
                    )}
                    {viewType === 'ci-relationships' && (
                      <div className="text-xs text-muted-foreground">
                        Filter to show only relationships with selected CI class types
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Export Menu */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="gap-1"
            >
              <Download className="h-3 w-3" />
              Export
            </Button>
            {showExportMenu && (
              <Card className="absolute top-10 right-0 z-50 w-40 shadow-lg">
                <CardContent className="p-2 space-y-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onExportSVG}
                    disabled={!onExportSVG}
                    className="w-full justify-start text-xs"
                  >
                    Export as SVG
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onExportPNG}
                    disabled={!onExportPNG}
                    className="w-full justify-start text-xs"
                  >
                    Export as PNG
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        {(nodeCount > 0 || edgeCount > 0) && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <div className="flex justify-between">
              <span>Total {getViewTypeLabel()}: {nodeCount}</span>
              {edgeCount > 0 && <span>Connections: {edgeCount}</span>}
            </div>
            {selectedCount > 0 && (
              <div className="mt-1">Selected: {selectedCount}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Click outside to close menus
  const handleClickOutside = () => {
    setShowExportMenu(false);
    setShowFilterMenu(false);
    setShowLayoutMenu(false);
  };

  // Add event listener for clicks outside (in a real implementation)
  // useEffect(() => {
  //   document.addEventListener('click', handleClickOutside);
  //   return () => document.removeEventListener('click', handleClickOutside);
  // }, []);
}