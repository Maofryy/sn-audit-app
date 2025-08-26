import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface TypesLegendCardProps {
  visibleTableTypes?: {
    base: boolean;
    extended: boolean;
    custom: boolean;
  };
  onTableTypeToggle?: (type: 'base' | 'extended' | 'custom') => void;
  customTableCount?: number;
  showCustomOnly?: boolean;
  onCustomOnlyToggle?: () => void;
  className?: string;
}

export function TypesLegendCard({
  visibleTableTypes = { base: true, extended: true, custom: true },
  onTableTypeToggle,
  customTableCount = 0,
  showCustomOnly = false,
  onCustomOnlyToggle,
  className = ''
}: TypesLegendCardProps) {
  const filterLegend = [
    { type: 'base', label: 'Base Tables', color: 'bg-blue-500', visible: visibleTableTypes.base },
    { type: 'extended', label: 'Extended Tables', color: 'bg-green-500', visible: visibleTableTypes.extended },
    { type: 'custom', label: 'Custom Tables', color: 'bg-orange-500', visible: visibleTableTypes.custom }
  ];

  // Only show if there are filters applied or custom tables exist
  const shouldShow = !visibleTableTypes.base || !visibleTableTypes.extended || !visibleTableTypes.custom || customTableCount > 0 || showCustomOnly;
  
  if (!shouldShow) return null;

  return (
    <Card className={`w-fit ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-4">
          <div className="text-xs font-medium text-gray-700">
            Table Types:
          </div>
          
          <div className="flex items-center gap-3">
            {filterLegend.map(({ type, label, color, visible }) => (
              <button
                key={type}
                onClick={() => onTableTypeToggle?.(type as 'base' | 'extended' | 'custom')}
                className="flex items-center gap-1.5 hover:bg-gray-50 rounded px-2 py-1 transition-colors group"
                title={`Toggle ${label} visibility`}
              >
                <div className={`w-3 h-3 rounded-full ${color} ${!visible ? 'opacity-30' : ''} transition-opacity`} />
                <span className={`text-xs ${visible ? 'text-gray-700' : 'text-gray-400'} transition-colors group-hover:text-gray-900`}>
                  {type === 'custom' ? `${label} (${customTableCount})` : label}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {visible ? (
                    <Eye className="h-3 w-3 text-gray-500" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Custom Only Toggle */}
          {customTableCount > 0 && (
            <>
              <div className="w-px h-4 bg-gray-300" />
              <Button
                size="sm"
                variant={showCustomOnly ? "default" : "outline"}
                onClick={onCustomOnlyToggle}
                className="text-xs h-6 px-2"
              >
                Custom Only
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}