import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Note: Switch component missing - using checkbox instead
// Using basic HTML table instead of missing UI components
import { useReferenceFieldsData } from '../hooks/useServiceNowData';
import { ReferenceFieldFilter, ReferenceFieldRelationship, TableMetadata } from '../types';
import { 
  Loader2, 
  AlertCircle, 
  Search, 
  Filter, 
  Database, 
  ArrowRight,
  Shield,
  User,
  Calendar
} from 'lucide-react';

interface ReferenceFieldsDisplayProps {
  selectedTable?: string;
  relationships?: ReferenceFieldRelationship[];
  allTables?: TableMetadata[];
  className?: string;
}

export function ReferenceFieldsDisplay({ 
  selectedTable, 
  relationships: providedRelationships, 
  allTables, 
  className 
}: ReferenceFieldsDisplayProps = {}) {
  // Filter state
  const [filter, setFilter] = useState<ReferenceFieldFilter>({
    customOnly: false,
    mandatoryOnly: false,
    searchTerm: '',
    ...(selectedTable && { tableNames: [selectedTable] })
  });

  // Use provided data or fetch via hooks
  const hookData = useReferenceFieldsData(providedRelationships ? {} : filter);
  
  const relationships = providedRelationships || hookData.relationships;
  const networkData = hookData.networkData;
  const isLoading = providedRelationships ? false : hookData.isLoading;
  const error = hookData.error;
  const hasData = providedRelationships ? providedRelationships.length > 0 : hookData.hasData;

  // Update filter functions
  const updateFilter = (updates: Partial<ReferenceFieldFilter>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  const resetFilters = () => {
    setFilter({
      customOnly: false,
      mandatoryOnly: false,
      searchTerm: '',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading reference field relationships...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Failed to Load Reference Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {error.message || 'An error occurred while fetching reference field data.'}
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reference Field Relationships</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Reference Fields Found</h3>
          <p className="text-muted-foreground">
            No reference field relationships were found in your CMDB tables.
          </p>
        </CardContent>
      </Card>
    );
  }

  const relationshipsData = relationships.data || [];
  const networkMeta = networkData.data?.metadata;

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header with Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {selectedTable 
                ? `Reference Network for ${selectedTable}` 
                : 'Reference Field Relationships'
              }
              <Badge variant="secondary">{relationshipsData.length} relationships</Badge>
            </CardTitle>
            <div className="flex gap-2">
              {networkMeta && (
                <>
                  <Badge variant="outline">
                    {networkMeta.total_tables} tables
                  </Badge>
                  <Badge variant="outline" className="text-orange-600">
                    {networkMeta.custom_references} custom
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search fields, tables..."
                  value={filter.searchTerm || ''}
                  onChange={(e) => updateFilter({ searchTerm: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="custom-only"
                checked={filter.customOnly || false}
                onChange={(e) => updateFilter({ customOnly: e.target.checked })}
                className="rounded border border-gray-300"
              />
              <Label htmlFor="custom-only">Custom fields only</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="mandatory-only"
                checked={filter.mandatoryOnly || false}
                onChange={(e) => updateFilter({ mandatoryOnly: e.target.checked })}
                className="rounded border border-gray-300"
              />
              <Label htmlFor="mandatory-only">Mandatory only</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetFilters}
                className="flex items-center gap-1"
              >
                <Filter className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          {/* Summary Statistics */}
          {networkMeta && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {networkMeta.total_references}
                </div>
                <div className="text-sm text-blue-600">Total References</div>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {networkMeta.custom_references}
                </div>
                <div className="text-sm text-orange-600">Custom References</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {networkMeta.relationship_types?.mandatory_references || 0}
                </div>
                <div className="text-sm text-green-600">Mandatory</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {networkMeta.total_tables}
                </div>
                <div className="text-sm text-purple-600">Tables</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reference Fields Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reference Field Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source Table</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target Table</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Properties</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Strength</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {relationshipsData.map((relationship) => (
                  <tr key={relationship.sys_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-4 whitespace-nowrap font-medium">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        {relationship.source_table}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium">{relationship.field_label}</div>
                        <div className="text-sm text-muted-foreground">
                          {relationship.field_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        {relationship.target_table}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        {relationship.field_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex gap-1">
                        {relationship.is_custom && (
                          <Badge variant="secondary" className="text-xs">
                            Custom
                          </Badge>
                        )}
                        {relationship.is_mandatory && (
                          <Badge variant="default" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Mandatory
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3" />
                        {relationship.created_by}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 transition-all duration-300" 
                            style={{ width: `${relationship.relationship_strength * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(relationship.relationship_strength * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {relationshipsData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2" />
              <p>No reference fields match your current filters.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetFilters}
                className="mt-2"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}