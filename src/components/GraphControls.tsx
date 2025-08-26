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
  Minimize2
} from 'lucide-react';

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
  
  // Filter settings
  showCustomOnly?: boolean;
  onCustomOnlyToggle?: () => void;
  
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
  showCustomOnly = false,
  onCustomOnlyToggle,
  viewType = 'inheritance',
  nodeCount = 0,
  edgeCount = 0,
  selectedCount = 0
}: GraphControlsProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

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
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Show Custom Only</Label>
                    <Button
                      size="sm"
                      variant={showCustomOnly ? "default" : "outline"}
                      onClick={onCustomOnlyToggle}
                      className="h-6 px-2 text-xs"
                    >
                      {showCustomOnly ? "ON" : "OFF"}
                    </Button>
                  </div>
                  {viewType === 'inheritance' && (
                    <div className="text-xs text-muted-foreground">
                      Filter to show only custom tables and their inheritance paths
                    </div>
                  )}
                  {viewType === 'references' && (
                    <div className="text-xs text-muted-foreground">
                      Filter to show only references involving custom tables
                    </div>
                  )}
                  {viewType === 'ci-relationships' && (
                    <div className="text-xs text-muted-foreground">
                      Filter to show only relationships with custom CI classes
                    </div>
                  )}
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
  };

  // Add event listener for clicks outside (in a real implementation)
  // useEffect(() => {
  //   document.addEventListener('click', handleClickOutside);
  //   return () => document.removeEventListener('click', handleClickOutside);
  // }, []);
}