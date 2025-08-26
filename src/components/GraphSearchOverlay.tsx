import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface GraphSearchOverlayProps {
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  nodeCount?: number;
  filteredCount?: number;
}

export function GraphSearchOverlay({
  searchTerm = '',
  onSearchChange,
  nodeCount = 0,
  filteredCount
}: GraphSearchOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClearSearch = () => {
    onSearchChange?.('');
    setIsExpanded(false);
  };

  return (
    <div className="absolute top-4 right-4 z-50">
      {!isExpanded ? (
        /* Collapsed Search Button */
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsExpanded(true)}
          className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Search className="h-4 w-4" />
        </Button>
      ) : (
        /* Expanded Search Bar */
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-8 pr-8 bg-white/80"
                autoFocus
              />
              {searchTerm && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSearch}
                  className="absolute right-1 top-1 h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {searchTerm ? (
                filteredCount !== undefined ? (
                  `${filteredCount} of ${nodeCount} tables`
                ) : (
                  `Searching ${nodeCount} tables...`
                )
              ) : (
                `${nodeCount} total tables`
              )}
            </span>
            {searchTerm && (
              <span className="text-blue-600">
                "{searchTerm}"
              </span>
            )}
          </div>
          
          {/* Quick help */}
          {!searchTerm && (
            <div className="mt-2 text-xs text-gray-400 border-t pt-2">
              Search by table name or label
            </div>
          )}
        </div>
      )}
    </div>
  );
}