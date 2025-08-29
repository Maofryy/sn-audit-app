import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Database, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Zap,
  Star
} from 'lucide-react';
import {
  TableListItem,
  TableStatistics
} from '../types';
import { tableStatisticsService } from '../services/tableStatisticsService';
import { serviceNowService } from '../services/serviceNowService';
import { makeAuthenticatedRequest } from '../services/authService';

interface IntelligentTableSearchProps {
  onTableSelect: (tableName: string) => void;
  className?: string;
}

interface SearchSuggestion {
  table: TableListItem;
  relevanceScore: number;
  matchType: 'exact' | 'label' | 'name' | 'fuzzy';
  matchText: string;
}

interface CMDBTableSearchResult {
  sys_id: string;
  name: string;
  label: string;
  super_class: { value: string; display_value: string } | null;
  is_custom: boolean;
}

export function IntelligentTableSearch({ onTableSelect, className }: IntelligentTableSearchProps) {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [criticalTables, setCriticalTables] = useState<TableListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingStatistics, setLoadingStatistics] = useState(new Map<string, boolean>());
  
  // Refs
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchLoadingRef = useRef(false);

  // Helper functions for audit status and priority calculation
  const calculateAuditStatus = useCallback((statistics: TableStatistics): 'compliant' | 'warning' | 'non_compliant' => {
    const customRatio = statistics.total_references > 0 ? 
      (statistics.custom_references / statistics.total_references) * 100 : 0;
    
    if (customRatio > 50) return 'non_compliant';
    if (customRatio > 25 || statistics.total_references > 20) return 'warning';
    return 'compliant';
  }, []);

  const calculatePriorityScore = useCallback((statistics: TableStatistics, table: { is_custom: boolean }): number => {
    let score = 0;
    
    // Higher priority for tables with more custom references
    score += statistics.custom_references * 5;
    
    // Higher priority for tables with many total references
    score += Math.min(statistics.total_references * 2, 40);
    
    // Higher priority for custom tables
    if (table.is_custom) score += 20;
    
    // Higher priority for tables with records
    if (statistics.record_count && statistics.record_count > 0) {
      score += Math.min(Math.log10(statistics.record_count) * 5, 15);
    }
    
    return Math.min(100, score);
  }, []);

  const loadTableStatisticsAsync = useCallback(async (tables: TableListItem[]) => {
    // Load statistics for each table in parallel
    const statisticsPromises = tables.map(async (tableItem) => {
      const tableName = tableItem.table.name;
      
      try {
        // Mark this table as loading statistics
        setLoadingStatistics(prev => new Map(prev.set(tableName, true)));
        
        console.log(`📊 Loading statistics for ${tableName}...`);
        const statistics = await tableStatisticsService.getTableStatistics(tableName);
        
        // Calculate audit status and priority score
        const auditStatus = calculateAuditStatus(statistics);
        const priorityScore = calculatePriorityScore(statistics, tableItem.table);
        
        // Update the table item with real statistics
        const updatedTableItem: TableListItem = {
          ...tableItem,
          statistics,
          audit_status: auditStatus,
          priority_score: priorityScore,
          last_analyzed: new Date()
        };
        
        console.log(`✅ Statistics loaded for ${tableName}:`, {
          references: statistics.total_references,
          custom: statistics.custom_references,
          status: auditStatus,
          priority: Math.round(priorityScore)
        });
        
        // Update the table in the state
        setCriticalTables(prev => 
          prev.map(t => t.table.name === tableName ? updatedTableItem : t)
        );
        
        return updatedTableItem;
        
      } catch (error) {
        console.error(`❌ Error loading statistics for ${tableName}:`, error);
        return tableItem; // Keep original if stats loading fails
      } finally {
        // Mark this table as no longer loading statistics
        setLoadingStatistics(prev => {
          const newMap = new Map(prev);
          newMap.delete(tableName);
          return newMap;
        });
      }
    });
    
    try {
      const tablesWithStats = await Promise.all(statisticsPromises);
      
      // Re-sort tables by priority score and filter to top 6
      const finalCriticalTables = tablesWithStats
        .filter(table => 
          table.priority_score > 40 || 
          table.statistics.total_references > 5 ||
          table.audit_status !== 'compliant'
        )
        .sort((a, b) => b.priority_score - a.priority_score)
        .slice(0, 6);
      
      setCriticalTables(finalCriticalTables);
      console.log('🎯 Phase 2 complete: Final critical tables selected:', finalCriticalTables.length);
      
    } catch (error) {
      console.error('❌ Error in phase 2 statistics loading:', error);
    }
  }, [calculateAuditStatus, calculatePriorityScore]);

  const loadCriticalTables = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 Phase 1: Loading CMDB table metadata for critical tables...');
      
      // Phase 1: Get basic CMDB table metadata quickly
      const cmdbTables = await serviceNowService.getCMDBTables();
      
      // Create initial critical table candidates - showing only custom CMDB tables
      // Custom tables are most likely to have audit issues and require attention
      const criticalCandidates = cmdbTables
        .filter(table => {
          // Only include custom tables
          return table.is_custom;
        })
        .slice(0, 8); // Get up to 8 custom table candidates
      
      // Create initial TableListItems with placeholder statistics
      const initialCriticalTables: TableListItem[] = criticalCandidates.map(table => ({
        table,
        statistics: {
          table_name: table.name,
          table_label: table.label,
          total_references: 0, // Will be loaded async
          custom_references: 0,
          standard_references: 0,
          incoming_references: 0,
          outgoing_references: 0,
          mandatory_references: 0,
          record_count: undefined,
          last_updated: new Date().toISOString()
        },
        audit_status: 'compliant', // Will be calculated after stats load
        last_analyzed: new Date(),
        priority_score: table.is_custom ? 50 : 30 // Initial score, will be recalculated
      }));
      
      // Phase 1 complete - show cards immediately
      setCriticalTables(initialCriticalTables);
      setLoading(false);
      console.log('✅ Phase 1 complete: Showing', initialCriticalTables.length, 'critical table cards');
      
      // Phase 2: Load statistics asynchronously for each table
      console.log('🔍 Phase 2: Loading statistics for each table asynchronously...');
      loadTableStatisticsAsync(initialCriticalTables);
      
    } catch (error) {
      console.error('❌ Error loading critical tables:', error);
      setLoading(false);
    }
  }, [loadTableStatisticsAsync]);

  // Load critical tables on mount
  useEffect(() => {
    loadCriticalTables();
  }, [loadCriticalTables]);

  const searchCMDBTables = useCallback(async (searchQuery: string) => {
    if (searchLoadingRef.current) return; // Prevent multiple concurrent searches
    
    try {
      searchLoadingRef.current = true;
      setSearchLoading(true);
      console.log('🔍 Searching CMDB tables for:', searchQuery);
      
      // Build CMDB inheritance query (up to 8 generations from cmdb_ci)
      const cmdbInheritanceQuery = [
        'name=cmdb_ci',
        'super_class.name=cmdb_ci',
        'super_class.super_class.name=cmdb_ci',
        'super_class.super_class.super_class.name=cmdb_ci',
        'super_class.super_class.super_class.super_class.name=cmdb_ci',
        'super_class.super_class.super_class.super_class.super_class.name=cmdb_ci',
        'super_class.super_class.super_class.super_class.super_class.super_class.name=cmdb_ci',
        'super_class.super_class.super_class.super_class.super_class.super_class.super_class.name=cmdb_ci',
        'super_class.super_class.super_class.super_class.super_class.super_class.super_class.super_class.name=cmdb_ci'
      ].join('^OR');
      
      // Build search query for name and label (ServiceNow URL query syntax)
      const nameSearchQuery = `nameCONTAINS${searchQuery}^ORlabelCONTAINS${searchQuery}`;
      
      // Combine CMDB inheritance and search  
      const fullQuery = `${cmdbInheritanceQuery}^${nameSearchQuery}`;
      
      const response = await makeAuthenticatedRequest(
        `/api/now/table/sys_db_object?sysparm_query=${encodeURIComponent(fullQuery)}&sysparm_limit=20&sysparm_fields=sys_id,name,label,super_class,sys_created_by`
      );
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      const searchResults: CMDBTableSearchResult[] = data.result?.map((record: {
        sys_id: string;
        name: string;
        label?: string;
        super_class?: { value: string; display_value: string };
        sys_created_by?: string;
      }) => ({
        sys_id: record.sys_id,
        name: record.name,
        label: record.label || record.name,
        super_class: record.super_class,
        is_custom: isCustomTable(record)
      })) || [];
      
      console.log(`✅ Found ${searchResults.length} CMDB tables matching "${searchQuery}"`);
      
      // Convert search results to suggestions
      const searchSuggestions = await convertToSuggestions(searchResults, searchQuery);
      setSuggestions(searchSuggestions);
      setShowSuggestions(searchSuggestions.length > 0);
      setSelectedIndex(-1);
      
    } catch (error) {
      console.error('❌ Error searching CMDB tables:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      searchLoadingRef.current = false;
      setSearchLoading(false);
    }
  }, []);

  const handleTableSelect = useCallback((tableItem: TableListItem) => {
    console.log('📋 Selected table:', tableItem.table.name);
    setSearchTerm('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onTableSelect(tableItem.table.name);
  }, [onTableSelect]);

  // Generate suggestions when search term changes
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      searchCMDBTables(searchTerm);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  }, [searchTerm]); // Remove searchCMDBTables from dependencies

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > -1 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleTableSelect(suggestions[selectedIndex].table);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, suggestions, selectedIndex, handleTableSelect]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCustomTable = (record: { name: string; sys_created_by?: string }): boolean => {
    const customPrefixes = ['u_', 'x_', 'custom_'];
    return customPrefixes.some(prefix => record.name.startsWith(prefix)) ||
           (record.sys_created_by && record.sys_created_by !== 'system');
  };

  const convertToSuggestions = async (searchResults: CMDBTableSearchResult[], query: string): Promise<SearchSuggestion[]> => {
    const queryLower = query.toLowerCase().trim();
    const suggestions: SearchSuggestion[] = [];

    for (const result of searchResults) {
      const nameLower = result.name.toLowerCase();
      const labelLower = result.label.toLowerCase();
      
      let relevanceScore = 0;
      let matchType: SearchSuggestion['matchType'] = 'fuzzy';
      let matchText = '';

      // Calculate relevance score based on match quality
      if (nameLower === queryLower) {
        relevanceScore = 100;
        matchType = 'exact';
        matchText = result.name;
      } else if (labelLower === queryLower) {
        relevanceScore = 95;
        matchType = 'exact';
        matchText = result.label;
      } else if (nameLower.startsWith(queryLower)) {
        relevanceScore = 90;
        matchType = 'name';
        matchText = result.name;
      } else if (labelLower.startsWith(queryLower)) {
        relevanceScore = 85;
        matchType = 'label';
        matchText = result.label;
      } else if (nameLower.includes(queryLower)) {
        relevanceScore = 70;
        matchType = 'name';
        matchText = result.name;
      } else if (labelLower.includes(queryLower)) {
        relevanceScore = 65;
        matchType = 'label';
        matchText = result.label;
      } 
      // Fuzzy matches commented out for cleaner results - can be re-enabled later
      // else {
      //   relevanceScore = 40;
      //   matchType = 'fuzzy';
      //   matchText = result.name;
      // }
      else {
        // Skip tables that don't have clear name/label matches
        continue;
      }

      // Boost score for custom tables (often more interesting for audits)
      if (result.is_custom) relevanceScore += 10;

      // Create a minimal TableListItem for the suggestion
      const tableListItem: TableListItem = {
        table: {
          sys_id: result.sys_id,
          name: result.name,
          label: result.label,
          super_class: result.super_class?.value || null,
          sys_scope: '',
          sys_created_on: '',
          sys_created_by: '',
          sys_updated_on: '',
          sys_updated_by: '',
          is_custom: result.is_custom,
          table_type: 'extended',
          extends_hierarchy: []
        },
        statistics: {
          table_name: result.name,
          table_label: result.label,
          total_references: 0, // Will be loaded on demand
          custom_references: 0,
          standard_references: 0,
          incoming_references: 0,
          outgoing_references: 0,
          mandatory_references: 0,
          record_count: undefined,
          last_updated: new Date().toISOString()
        },
        audit_status: 'compliant', // Default, will be calculated on demand
        last_analyzed: new Date(),
        priority_score: relevanceScore
      };

      suggestions.push({
        table: tableListItem,
        relevanceScore,
        matchType,
        matchText
      });
    }

    // Sort by relevance score and return top results
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);
  };

  const generateSuggestions_DEPRECATED = (query: string, tables: TableListItem[]): SearchSuggestion[] => {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase().trim();
    const suggestions: SearchSuggestion[] = [];

    tables.forEach(table => {
      const nameLower = table.table.name.toLowerCase();
      const labelLower = table.table.label.toLowerCase();
      
      let relevanceScore = 0;
      let matchType: SearchSuggestion['matchType'] = 'fuzzy';
      let matchText = '';

      // Exact name match (highest priority)
      if (nameLower === queryLower) {
        relevanceScore = 100;
        matchType = 'exact';
        matchText = table.table.name;
      }
      // Exact label match
      else if (labelLower === queryLower) {
        relevanceScore = 95;
        matchType = 'exact';
        matchText = table.table.label;
      }
      // Name starts with query
      else if (nameLower.startsWith(queryLower)) {
        relevanceScore = 90;
        matchType = 'name';
        matchText = table.table.name;
      }
      // Label starts with query
      else if (labelLower.startsWith(queryLower)) {
        relevanceScore = 85;
        matchType = 'label';
        matchText = table.table.label;
      }
      // Name contains query
      else if (nameLower.includes(queryLower)) {
        relevanceScore = 70;
        matchType = 'name';
        matchText = table.table.name;
      }
      // Label contains query
      else if (labelLower.includes(queryLower)) {
        relevanceScore = 65;
        matchType = 'label';
        matchText = table.table.label;
      }
      // Fuzzy match for typos/partial matches
      else if (fuzzyMatch(queryLower, nameLower) || fuzzyMatch(queryLower, labelLower)) {
        relevanceScore = 40;
        matchType = 'fuzzy';
        matchText = fuzzyMatch(queryLower, nameLower) ? table.table.name : table.table.label;
      }

      // Boost score for critical tables
      if (table.priority_score > 70) relevanceScore += 15;
      if (table.audit_status === 'non_compliant') relevanceScore += 10;
      if (table.audit_status === 'warning') relevanceScore += 5;
      if (table.table.is_custom) relevanceScore += 8; // Custom tables are often interesting for audit

      // Only include matches with reasonable relevance
      if (relevanceScore >= 40) {
        suggestions.push({
          table,
          relevanceScore,
          matchType,
          matchText
        });
      }
    });

    // Sort by relevance score and return top 5
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);
  };

  const fuzzyMatch = (query: string, target: string): boolean => {
    if (query.length > target.length) return false;
    
    let queryIndex = 0;
    for (let i = 0; i < target.length && queryIndex < query.length; i++) {
      if (target[i] === query[queryIndex]) {
        queryIndex++;
      }
    }
    
    return queryIndex === query.length;
  };

  const handleSearchFocus = () => {
    if (searchTerm.trim()) {
      setShowSuggestions(true);
    }
  };

  const getMatchIcon = (matchType: SearchSuggestion['matchType']) => {
    switch (matchType) {
      case 'exact': return <Zap className="h-3 w-3 text-green-500" />;
      case 'name': return <Database className="h-3 w-3 text-blue-500" />;
      case 'label': return <Search className="h-3 w-3 text-purple-500" />;
      // Fuzzy matches temporarily disabled
      // case 'fuzzy': return <Star className="h-3 w-3 text-yellow-500" />;
      default: return <Database className="h-3 w-3 text-blue-500" />; // Fallback to name icon
    }
  };

  const getAuditStatusIcon = (status: TableListItem['audit_status']) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'non_compliant':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-muted-foreground">Loading CMDB tables...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Search Interface */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder="Search CMDB tables by name or label (min 2 chars)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={handleSearchFocus}
                  className="pl-10 pr-12 py-3 text-lg border-2 focus:border-blue-500 transition-colors"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              {/* Search Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg"
                >
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.table.table.sys_id}
                      className={`p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        index === selectedIndex ? 'bg-blue-50 dark:bg-blue-900 border-blue-200' : ''
                      }`}
                      onClick={() => handleTableSelect(suggestion.table)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getMatchIcon(suggestion.matchType)}
                            <span className="font-semibold text-sm">
                              {suggestion.table.table.label}
                            </span>
                            {suggestion.table.table.is_custom && (
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                Custom
                              </Badge>
                            )}
                            {getAuditStatusIcon(suggestion.table.audit_status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {suggestion.table.table.name}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Database className="h-3 w-3" />
                              {suggestion.table.statistics.total_references} refs
                            </span>
                            {suggestion.table.statistics.custom_references > 0 && (
                              <span className="text-orange-600">
                                ({suggestion.table.statistics.custom_references} custom)
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Priority: {Math.round(suggestion.table.priority_score)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search Tips */}
            <div className="text-sm text-muted-foreground">
              <span>💡 Searches CMDB tables (inherited from cmdb_ci up to 8 generations). Try: "incident", "user", "server", "application"</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Tables Quick Access */}
      {criticalTables.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">Custom CMDB Tables Requiring Attention</h3>
                <Badge variant="outline" className="text-xs">
                  {criticalTables.length} custom tables
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {criticalTables.map((table) => (
                  <Card 
                    key={table.table.sys_id}
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-amber-400"
                    onClick={() => handleTableSelect(table)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{table.table.label}</span>
                          </div>
                          {loadingStatistics.get(table.table.name) ? (
                            <div className="animate-pulse rounded-full h-3 w-3 bg-gray-300"></div>
                          ) : (
                            getAuditStatusIcon(table.audit_status)
                          )}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {table.table.name}
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Database className="h-3 w-3" />
                            {loadingStatistics.get(table.table.name) ? (
                              <span className="flex items-center gap-1">
                                <div className="animate-spin rounded-full h-2 w-2 border border-gray-400 border-t-transparent"></div>
                                Loading...
                              </span>
                            ) : (
                              <>
                                {table.statistics.total_references} refs
                                {table.statistics.custom_references > 0 && (
                                  <span className="text-orange-600">
                                    ({table.statistics.custom_references} custom)
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <TrendingUp className="h-3 w-3" />
                            {loadingStatistics.get(table.table.name) ? (
                              <span className="text-muted-foreground">...</span>
                            ) : (
                              Math.round(table.priority_score)
                            )}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!searchLoading && searchTerm.length >= 2 && suggestions.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No CMDB tables found</h3>
            <p className="text-muted-foreground mb-4">
              No CMDB tables (inherited from cmdb_ci) match your search term "{searchTerm}"
            </p>
            <Button 
              variant="outline" 
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}