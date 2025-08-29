import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  AlertCircle, 
  Search, 
  Filter, 
  Database, 
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  TableListItem,
  TableListFilter,
  TableListSortOptions
} from '../types';
import { tableStatisticsService } from '../services/tableStatisticsService';

interface CMDBTablesListViewProps {
  onTableSelect?: (tableName: string) => void;
  selectedTable?: string;
}

export function CMDBTablesListView({ onTableSelect, selectedTable }: CMDBTablesListViewProps) {
  // State management
  const [tableList, setTableList] = useState<TableListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TableListFilter>({
    search_term: '',
    custom_only: false,
    has_issues: false,
  });
  const [sortOptions, setSortOptions] = useState<TableListSortOptions>({
    field: 'priority_score',
    direction: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load table list data
  useEffect(() => {
    loadTableList();
  }, [filters]);

  const loadTableList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading CMDB tables with filters:', filters);
      const items = await tableStatisticsService.getFilteredTableList(filters);
      console.log('✅ Loaded table list:', items.length, 'items');
      
      // Log some details about what we loaded
      items.forEach(item => {
        console.log(`📊 Table: ${item.table.name} - ${item.statistics.total_references} references (${item.statistics.custom_references} custom) - Priority: ${Math.round(item.priority_score)}`);
      });
      
      setTableList(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table list');
      console.error('❌ Error loading table list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sort and filter table list
  const sortedTableList = useMemo(() => {
    const sorted = [...tableList].sort((a, b) => {
      let aValue: any = a.statistics[sortOptions.field as keyof typeof a.statistics] || 
                      a[sortOptions.field as keyof typeof a];
      let bValue: any = b.statistics[sortOptions.field as keyof typeof b.statistics] || 
                      b[sortOptions.field as keyof typeof b];
      
      // Handle special cases
      if (sortOptions.field === 'name' || sortOptions.field === 'label') {
        aValue = a.table[sortOptions.field];
        bValue = b.table[sortOptions.field];
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOptions.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOptions.direction === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }
      
      return 0;
    });
    
    return sorted;
  }, [tableList, sortOptions]);

  // Update filter function
  const updateFilter = (updates: Partial<TableListFilter>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  // Handle sort change
  const handleSort = (field: TableListSortOptions['field']) => {
    setSortOptions(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Calculate global statistics
  const globalStats = useMemo(() => {
    if (tableList.length === 0) return null;
    
    return {
      total_tables: tableList.length,
      custom_tables: tableList.filter(item => item.table.is_custom).length,
      total_references: tableList.reduce((sum, item) => sum + item.statistics.total_references, 0),
      custom_references: tableList.reduce((sum, item) => sum + item.statistics.custom_references, 0),
      tables_needing_attention: tableList.filter(item => 
        item.audit_status === 'warning' || item.audit_status === 'non_compliant'
      ).length,
      high_priority_tables: tableList.filter(item => item.priority_score > 70).length
    };
  }, [tableList]);

  // Get audit status badge
  const getAuditStatusBadge = (status: TableListItem['audit_status']) => {
    switch (status) {
      case 'compliant':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Compliant
        </Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Warning
        </Badge>;
      case 'non_compliant':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Issues
        </Badge>;
      default:
        return null;
    }
  };

  // Get priority trend icon
  const getPriorityIcon = (score: number) => {
    if (score > 70) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (score > 40) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-green-500" />;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading CMDB tables...</span>
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
            Failed to Load CMDB Tables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadTableList} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Testing Mode Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Badge variant="secondary" className="bg-blue-600 text-white">🧪 Testing Mode</Badge>
            <span className="text-sm">
              Loading restricted to: <strong>cmdb_ci</strong>, <strong>cmdb_ci_patches</strong>, and <strong>u_test_custom_cmdb_table</strong> for focused testing
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Global Statistics Header */}
      {globalStats && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                CMDB Tables Overview
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTableList}
                  className="flex items-center gap-1"
                >
                  <BarChart3 className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {globalStats.total_tables}
                </div>
                <div className="text-sm text-blue-600">Total Tables</div>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {globalStats.custom_tables}
                </div>
                <div className="text-sm text-orange-600">Custom Tables</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {globalStats.total_references}
                </div>
                <div className="text-sm text-green-600">Total References</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {globalStats.custom_references}
                </div>
                <div className="text-sm text-purple-600">Custom References</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {globalStats.tables_needing_attention}
                </div>
                <div className="text-sm text-yellow-600">Need Attention</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {globalStats.high_priority_tables}
                </div>
                <div className="text-sm text-red-600">High Priority</div>
              </div>
            </div>

            {/* Filter Controls */}
            {showFilters && (
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search Tables</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name or label..."
                        value={filters.search_term || ''}
                        onChange={(e) => updateFilter({ search_term: e.target.value })}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Table Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {['base', 'extended', 'custom'].map(type => (
                        <Badge
                          key={type}
                          variant={filters.table_types?.includes(type as any) ? "default" : "outline"}
                          className="cursor-pointer capitalize"
                          onClick={() => {
                            const currentTypes = filters.table_types || [];
                            const newTypes = currentTypes.includes(type as any)
                              ? currentTypes.filter(t => t !== type)
                              : [...currentTypes, type as any];
                            updateFilter({ table_types: newTypes.length > 0 ? newTypes : undefined });
                          }}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Quick Filters</Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="custom-only"
                          checked={filters.custom_only || false}
                          onChange={(e) => updateFilter({ custom_only: e.target.checked })}
                          className="rounded border border-gray-300"
                        />
                        <Label htmlFor="custom-only" className="text-sm">Custom tables only</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="has-issues"
                          checked={filters.has_issues || false}
                          onChange={(e) => updateFilter({ has_issues: e.target.checked })}
                          className="rounded border border-gray-300"
                        />
                        <Label htmlFor="has-issues" className="text-sm">Tables with issues</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Reference Count Range</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.min_references || ''}
                        onChange={(e) => updateFilter({ 
                          min_references: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-20"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.max_references || ''}
                        onChange={(e) => updateFilter({ 
                          max_references: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setFilters({ search_term: '', custom_only: false, has_issues: false })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tables List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>CMDB Tables ({sortedTableList.length})</span>
            <div className="flex gap-2 text-sm text-muted-foreground">
              <span>Sort by:</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('name')}
                className="h-auto p-0 font-medium"
              >
                Name {sortOptions.field === 'name' && (sortOptions.direction === 'asc' ? '↑' : '↓')}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('total_references')}
                className="h-auto p-0 font-medium"
              >
                References {sortOptions.field === 'total_references' && (sortOptions.direction === 'asc' ? '↑' : '↓')}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort('priority_score')}
                className="h-auto p-0 font-medium"
              >
                Priority {sortOptions.field === 'priority_score' && (sortOptions.direction === 'asc' ? '↑' : '↓')}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedTableList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Tables Found</h3>
              <p>No CMDB tables match your current filters.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setFilters({ search_term: '', custom_only: false, has_issues: false })}
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTableList.map((item) => (
                <div
                  key={item.table.sys_id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedTable === item.table.name 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => onTableSelect?.(item.table.name)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{item.table.label}</h3>
                        {item.table.is_custom && (
                          <Badge variant="secondary" className="text-xs">Custom</Badge>
                        )}
                        {getAuditStatusBadge(item.audit_status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.table.name}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Database className="h-4 w-4" />
                          <span>{item.statistics.total_references} references</span>
                          {item.statistics.custom_references > 0 && (
                            <span className="text-orange-600">
                              ({item.statistics.custom_references} custom)
                            </span>
                          )}
                        </div>
                        {item.statistics.record_count !== undefined && (
                          <div className="text-muted-foreground">
                            {item.statistics.record_count.toLocaleString()} records
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">Priority</div>
                        <div className="flex items-center gap-1">
                          {getPriorityIcon(item.priority_score)}
                          <span className="text-sm">{Math.round(item.priority_score)}</span>
                        </div>
                      </div>
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}