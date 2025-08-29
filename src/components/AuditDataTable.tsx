import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Filter, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Clock,
  User,
  FileType,
  Hash,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  FieldMetadata,
  DataQualityMetrics,
  FieldUsageStats,
  DataConsistencyIssue
} from '../types';

interface AuditDataTableProps {
  tableName: string;
  fields: FieldMetadata[];
  qualityMetrics?: DataQualityMetrics;
  onFieldSelect?: (field: FieldMetadata) => void;
}

interface FieldAuditRow {
  field: FieldMetadata;
  auditScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface TableFilters {
  search: string;
  fieldTypes: string[];
  customOnly: boolean;
  hasIssues: boolean;
  riskLevels: string[];
}

interface SortConfig {
  field: keyof FieldAuditRow | 'element' | 'type' | 'mandatory';
  direction: 'asc' | 'desc';
}

export function AuditDataTable({ tableName, fields, qualityMetrics, onFieldSelect }: AuditDataTableProps) {
  // State management
  const [filters, setFilters] = useState<TableFilters>({
    search: '',
    fieldTypes: [],
    customOnly: false,
    hasIssues: false,
    riskLevels: []
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'auditScore',
    direction: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  // Process field data with simplified audit scoring
  const auditRows = useMemo((): FieldAuditRow[] => {
    return fields.map(field => {
      // Simplified audit score based on field structure only
      let auditScore = 100;
      
      // Deduct points for custom fields
      if (field.is_custom) auditScore -= 20;
      
      // Deduct points for non-reference custom fields (less audit value)
      if (field.is_custom && field.type !== 'reference') auditScore -= 10;
      
      // Bonus points for reference fields (key for CMDB audit)
      if (field.type === 'reference') auditScore += 5;
      
      // Deduct points for very long field names (poor naming convention)
      if (field.element.length > 50) auditScore -= 10;
      
      // Determine risk level based on dictionary structure concerns
      let riskLevel: FieldAuditRow['riskLevel'] = 'low';
      if (field.is_custom && field.type === 'reference') riskLevel = 'medium'; // Custom refs need attention
      else if (field.is_custom) riskLevel = 'low'; // Other custom fields less critical
      else if (!field.mandatory && field.type === 'reference') riskLevel = 'medium'; // Optional refs can be problematic

      return {
        field,
        auditScore: Math.max(0, auditScore),
        riskLevel
      };
    });
  }, [fields]);

  // Apply filters and sorting
  const filteredAndSortedRows = useMemo(() => {
    let filtered = [...auditRows];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(row =>
        row.field.element.toLowerCase().includes(searchLower) ||
        row.field.column_label.toLowerCase().includes(searchLower) ||
        row.field.type.toLowerCase().includes(searchLower)
      );
    }

    // Apply field type filter
    if (filters.fieldTypes.length > 0) {
      filtered = filtered.filter(row =>
        filters.fieldTypes.includes(row.field.type)
      );
    }

    // Apply custom only filter
    if (filters.customOnly) {
      filtered = filtered.filter(row => row.field.is_custom);
    }

    // Apply has issues filter
    if (filters.hasIssues) {
      filtered = filtered.filter(row => row.qualityIssues.length > 0);
    }

    // Apply risk level filter
    if (filters.riskLevels.length > 0) {
      filtered = filtered.filter(row =>
        filters.riskLevels.includes(row.riskLevel)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.field) {
        case 'element':
          aValue = a.field.element;
          bValue = b.field.element;
          break;
        case 'type':
          aValue = a.field.type;
          bValue = b.field.type;
          break;
        case 'mandatory':
          aValue = a.field.mandatory;
          bValue = b.field.mandatory;
          break;
        default:
          aValue = a[sortConfig.field as keyof FieldAuditRow];
          bValue = b[sortConfig.field as keyof FieldAuditRow];
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }

      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortConfig.direction === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? 1 : -1)
          : (aValue === bValue ? 0 : bValue ? 1 : -1);
      }

      return 0;
    });

    return filtered;
  }, [auditRows, filters, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = filteredAndSortedRows.slice(startIndex, startIndex + pageSize);

  // Update filters
  const updateFilter = (updates: Partial<TableFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle sort
  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort icon
  const getSortIcon = (field: SortConfig['field']) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  // Get risk badge
  const getRiskBadge = (riskLevel: FieldAuditRow['riskLevel']) => {
    switch (riskLevel) {
      case 'low':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Low Risk
        </Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Medium
        </Badge>;
      case 'high':
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          High Risk
        </Badge>;
      case 'critical':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Critical
        </Badge>;
    }
  };

  // Get field type icon
  const getFieldTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'reference': return <Database className="h-4 w-4" />;
      case 'string': case 'text': return <FileType className="h-4 w-4" />;
      case 'integer': case 'decimal': return <Hash className="h-4 w-4" />;
      case 'boolean': return <CheckCircle className="h-4 w-4" />;
      case 'datetime': case 'date': return <Clock className="h-4 w-4" />;
      default: return <FileType className="h-4 w-4" />;
    }
  };

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    setHiddenColumns(prev => {
      const newHidden = new Set(prev);
      if (newHidden.has(columnId)) {
        newHidden.delete(columnId);
      } else {
        newHidden.add(columnId);
      }
      return newHidden;
    });
  };

  // Get unique field types for filter
  const uniqueFieldTypes = useMemo(() => {
    return Array.from(new Set(fields.map(field => field.type))).sort();
  }, [fields]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileType className="h-5 w-5" />
            Field Configuration Audit
            <Badge variant="outline">{filteredAndSortedRows.length} fields</Badge>
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters Panel */}
        {showFilters && (
          <div className="border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Fields</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Field name, label..."
                    value={filters.search}
                    onChange={(e) => updateFilter({ search: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Field Types</Label>
                <div className="flex flex-wrap gap-1">
                  {uniqueFieldTypes.slice(0, 4).map(type => (
                    <Badge
                      key={type}
                      variant={filters.fieldTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        const newTypes = filters.fieldTypes.includes(type)
                          ? filters.fieldTypes.filter(t => t !== type)
                          : [...filters.fieldTypes, type];
                        updateFilter({ fieldTypes: newTypes });
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                  {uniqueFieldTypes.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{uniqueFieldTypes.length - 4}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Risk Levels</Label>
                <div className="flex flex-wrap gap-1">
                  {(['low', 'medium', 'high', 'critical'] as const).map(level => (
                    <Badge
                      key={level}
                      variant={filters.riskLevels.includes(level) ? "default" : "outline"}
                      className="cursor-pointer text-xs capitalize"
                      onClick={() => {
                        const newLevels = filters.riskLevels.includes(level)
                          ? filters.riskLevels.filter(l => l !== level)
                          : [...filters.riskLevels, level];
                        updateFilter({ riskLevels: newLevels });
                      }}
                    >
                      {level}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quick Filters</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="custom-only"
                      checked={filters.customOnly}
                      onChange={(e) => updateFilter({ customOnly: e.target.checked })}
                      className="rounded border border-gray-300"
                    />
                    <Label htmlFor="custom-only" className="text-sm">Custom fields only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has-issues"
                      checked={filters.hasIssues}
                      onChange={(e) => updateFilter({ hasIssues: e.target.checked })}
                      className="rounded border border-gray-300"
                    />
                    <Label htmlFor="has-issues" className="text-sm">Has quality issues</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => updateFilter({
                  search: '',
                  fieldTypes: [],
                  customOnly: false,
                  hasIssues: false,
                  riskLevels: []
                })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Column Visibility Controls */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Columns:</span>
          {[
            { id: 'created', label: 'Created' },
            { id: 'reference', label: 'Reference' }
          ].map(col => (
            <Button
              key={col.id}
              variant="ghost"
              size="sm"
              onClick={() => toggleColumn(col.id)}
              className="h-auto p-1 text-xs"
            >
              {hiddenColumns.has(col.id) ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {col.label}
            </Button>
          ))}
        </div>

        {/* Data Table */}
        <div className="rounded-md border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort('element')}
                      className="h-auto p-0 font-medium text-xs"
                    >
                      Field Name {getSortIcon('element')}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort('type')}
                      className="h-auto p-0 font-medium text-xs"
                    >
                      Type {getSortIcon('type')}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-left">Properties</th>
                  <th className="px-4 py-3 text-left">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort('auditScore')}
                      className="h-auto p-0 font-medium text-xs"
                    >
                      Audit Score {getSortIcon('auditScore')}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-left">Risk Level</th>
                  {!hiddenColumns.has('reference') && (
                    <th className="px-4 py-3 text-left">Reference</th>
                  )}
                  {!hiddenColumns.has('created') && (
                    <th className="px-4 py-3 text-left">Created By</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedRows.map((row) => (
                  <tr 
                    key={row.field.sys_id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => onFieldSelect?.(row.field)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {getFieldTypeIcon(row.field.type)}
                          <span className="font-medium">{row.field.element}</span>
                          {row.field.is_custom && (
                            <Badge variant="secondary" className="text-xs">Custom</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {row.field.column_label}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {row.field.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {row.field.mandatory && (
                          <Badge variant="default" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Mandatory
                          </Badge>
                        )}
                        {row.field.max_length && (
                          <Badge variant="outline" className="text-xs">
                            Max: {row.field.max_length}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-semibold">{Math.round(row.auditScore)}</div>
                        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${
                              row.auditScore >= 80 ? 'bg-green-600' :
                              row.auditScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${row.auditScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getRiskBadge(row.riskLevel)}
                    </td>
                    {!hiddenColumns.has('reference') && (
                      <td className="px-4 py-3">
                        {row.field.reference_table ? (
                          <Badge variant="outline" className="text-xs">
                            → {row.field.reference_table}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    {!hiddenColumns.has('created') && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {row.field.sys_created_by}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(startIndex + pageSize, filteredAndSortedRows.length)} of{' '}
              {filteredAndSortedRows.length} fields
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}