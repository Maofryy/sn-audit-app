import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CIInstancesModal } from './CIInstancesModal';
import { useGraphActions } from '../contexts/GraphContext';
import { 
  Table, 
  Calendar, 
  User, 
  Database, 
  Link, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ExternalLink,
  Network,
  GitBranch,
  Share2
} from 'lucide-react';
import { TableMetadata, FieldMetadata } from '../types';

export interface NodeDetailsPanelProps {
  selectedTable?: TableMetadata | null;
  selectedTableId?: string;
  tableDetails?: any;
  tableFields?: FieldMetadata[];
  childTables?: string[];
  parentTable?: string;
  relationshipCount?: number;
  recordCount?: number;
  customFieldCount?: number;
  onClose?: () => void;
  onViewTable?: (tableName: string) => void;
  isLoading?: boolean;
  error?: any;
}

export function NodeDetailsPanel({
  selectedTable,
  selectedTableId,
  tableDetails,
  tableFields = [],
  childTables = [],
  parentTable,
  relationshipCount = 0,
  recordCount = 0,
  customFieldCount = 0,
  onClose,
  onViewTable,
  isLoading = false,
  error
}: NodeDetailsPanelProps) {
  const { navigateToTable } = useGraphActions();
  
  // Handle both calling patterns
  const table = selectedTable || tableDetails;
  const fields = tableFields || tableDetails?.fields || [];
  const finalRecordCount = recordCount || tableDetails?.recordCount || 0;
  
  if (!table && !selectedTableId) {
    return (
      <Card className="w-full h-[400px]">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <Eye className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Select a table to view details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTableTypeBadge = () => {
    switch (table?.table_type) {
      case 'base':
        return <Badge variant="default" className="bg-blue-600">Base Table</Badge>;
      case 'extended':
        return <Badge variant="secondary">Extended Table</Badge>;
      case 'custom':
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Custom Table</Badge>;
      default:
        return <Badge variant="outline">Unknown Type</Badge>;
    }
  };

  const getCustomFieldsInfo = () => {
    if (fields.length === 0) return null;
    
    const customFields = fields.filter(field => field.is_custom);
    const totalFields = fields.length;
    
    return {
      custom: customFields.length,
      total: totalFields,
      percentage: totalFields > 0 ? Math.round((customFields.length / totalFields) * 100) : 0
    };
  };

  const fieldsInfo = getCustomFieldsInfo();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Table className="h-4 w-4" />
              {table?.label || selectedTableId || 'Unknown'}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                {table?.name || selectedTableId || 'unknown'}
              </code>
              {getTableTypeBadge()}
            </div>
          </div>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <XCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            Loading table details...
          </div>
        ) : (
          <>
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">Records:</span>
                  <span>{finalRecordCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">Relationships:</span>
                  <span>{relationshipCount}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">Created:</span>
                  <span>{table?.sys_created_on ? formatDate(table.sys_created_on) : 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">By:</span>
                  <span>{table?.sys_created_by || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* CI Drill-down */}
            {(table?.name || selectedTableId)?.startsWith('cmdb') && finalRecordCount > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Configuration Items
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {finalRecordCount} CIs
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Drill down to view actual CI instances and their relationships from this table.
                  </p>
                  <CIInstancesModal
                    tableName={table?.name || selectedTableId || ''}
                    tableLabel={table?.label}
                    recordCount={finalRecordCount}
                  />
                </div>
              </div>
            )}

            {/* Quick Navigation */}
            {table?.name && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  View in Other Modes
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => navigateToTable(table.name, 'inheritance')}
                  >
                    <GitBranch className="h-3 w-3" />
                    Inheritance Tree
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => navigateToTable(table.name, 'references')}
                  >
                    <Link className="h-3 w-3" />
                    Reference Network
                  </Button>
                  {table.name.startsWith('cmdb') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => navigateToTable(table.name, 'ci-relationships')}
                    >
                      <Network className="h-3 w-3" />
                      CI Relationships
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Switch between different visualization modes for this table
                </p>
              </div>
            )}

            {/* Hierarchy Information */}
            {(parentTable || childTables.length > 0) && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Table Hierarchy</h4>
                <div className="space-y-2">
                  {parentTable && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Extends:</span>
                      <Button
                        variant="link"
                        className="h-auto p-0 font-normal"
                        onClick={() => onViewTable?.(parentTable)}
                      >
                        {parentTable}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  )}
                  {childTables.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Extended by:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {childTables.slice(0, 5).map((childTable) => (
                          <Button
                            key={childTable}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => onViewTable?.(childTable)}
                          >
                            {childTable}
                          </Button>
                        ))}
                        {childTables.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{childTables.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fields Summary */}
            {fieldsInfo && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Fields Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Total Fields:</span>
                      <span className="font-mono">{fieldsInfo.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custom Fields:</span>
                      <span className="font-mono font-medium text-orange-600">
                        {fieldsInfo.custom}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Custom %:</span>
                      <span className="font-mono">
                        {fieldsInfo.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all"
                        style={{ width: `${fieldsInfo.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Customization Risk */}
            {table?.is_custom && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Customization Risk
                </h4>
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-orange-600 border-orange-500">
                      Custom Table
                    </Badge>
                    <span className="text-muted-foreground">
                      May impact upgrades
                    </span>
                  </div>
                  {fieldsInfo && fieldsInfo.percentage > 20 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                        High Field Customization
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {fieldsInfo.percentage}% custom fields
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Custom Fields (if available) */}
            {fields.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Recent Fields</h4>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {fields
                      .filter(field => field.is_custom)
                      .slice(0, 10)
                      .map((field) => (
                        <div key={field.sys_id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                          <div>
                            <code className="font-medium">{field.element}</code>
                            <span className="ml-2 text-muted-foreground">
                              ({field.type})
                            </span>
                          </div>
                          <Badge variant="outline" className="text-orange-600 border-orange-500">
                            Custom
                          </Badge>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}