import { useQuery, useQueries, UseQueryOptions } from '@tanstack/react-query';
import { serviceNowService } from '../services/serviceNowService';
import { 
  TableMetadata, 
  FieldMetadata, 
  TableHierarchy, 
  GraphData, 
  CIRelationship, 
  RelationshipType 
} from '../types';

// Query Keys
export const queryKeys = {
  // Tables
  cmdbTables: ['cmdb-tables'] as const,
  allTables: ['all-tables'] as const,
  customTables: ['custom-tables'] as const,
  tableSchema: (tableName: string) => ['table-schema', tableName] as const,
  
  // Hierarchy
  tableHierarchy: ['table-hierarchy'] as const,
  
  // Relationships
  ciRelationships: (parentId?: string, childId?: string) => 
    ['ci-relationships', parentId, childId] as const,
  relationshipTypes: ['relationship-types'] as const,
  referenceFields: ['reference-fields'] as const,
  
  // Graph Data
  graphData: (includeReferences: boolean = true) => 
    ['graph-data', includeReferences] as const,
  
  // Records
  recordCount: (tableName: string) => ['record-count', tableName] as const,
  tableRecords: (tableName: string, query?: string, limit: number = 100) =>
    ['table-records', tableName, query, limit] as const,
  
  // Custom fields
  customFields: (tableName?: string) => ['custom-fields', tableName] as const,
} as const;

// Base query options with common settings
const baseQueryOptions = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  cacheTime: 1000 * 60 * 15, // 15 minutes
  refetchOnWindowFocus: false,
  retry: 2,
} as const;

// Table-related queries
export function useCMDBTables(options?: Partial<UseQueryOptions<TableMetadata[], Error>>) {
  return useQuery({
    queryKey: queryKeys.cmdbTables,
    queryFn: () => serviceNowService.getCMDBTables(),
    ...baseQueryOptions,
    ...options,
  });
}

export function useAllTables(options?: Partial<UseQueryOptions<TableMetadata[], Error>>) {
  return useQuery({
    queryKey: queryKeys.allTables,
    queryFn: () => serviceNowService.getAllTables(),
    ...baseQueryOptions,
    ...options,
  });
}

export function useCustomTables(options?: Partial<UseQueryOptions<TableMetadata[], Error>>) {
  return useQuery({
    queryKey: queryKeys.customTables,
    queryFn: () => serviceNowService.getCustomTables(),
    ...baseQueryOptions,
    ...options,
  });
}

export function useTableSchema(
  tableName: string,
  options?: Partial<UseQueryOptions<FieldMetadata[], Error>>
) {
  return useQuery({
    queryKey: queryKeys.tableSchema(tableName),
    queryFn: () => serviceNowService.getTableSchema(tableName),
    enabled: !!tableName,
    ...baseQueryOptions,
    ...options,
  });
}

// Hierarchy queries
export function useTableHierarchy(options?: Partial<UseQueryOptions<TableHierarchy, Error>>) {
  return useQuery({
    queryKey: queryKeys.tableHierarchy,
    queryFn: () => serviceNowService.buildTableHierarchy(),
    ...baseQueryOptions,
    staleTime: 1000 * 60 * 30, // 30 minutes for hierarchy (changes less frequently)
    ...options,
  });
}

// Relationship queries
export function useCIRelationships(
  parentId?: string,
  childId?: string,
  options?: Partial<UseQueryOptions<CIRelationship[], Error>>
) {
  return useQuery({
    queryKey: queryKeys.ciRelationships(parentId, childId),
    queryFn: () => serviceNowService.getCIRelationships(parentId, childId),
    enabled: !!(parentId || childId),
    ...baseQueryOptions,
    ...options,
  });
}

export function useRelationshipTypes(options?: Partial<UseQueryOptions<RelationshipType[], Error>>) {
  return useQuery({
    queryKey: queryKeys.relationshipTypes,
    queryFn: () => serviceNowService.getRelationshipTypes(),
    ...baseQueryOptions,
    staleTime: 1000 * 60 * 60, // 1 hour (relationship types change rarely)
    ...options,
  });
}

export function useReferenceFields(options?: Partial<UseQueryOptions<FieldMetadata[], Error>>) {
  return useQuery({
    queryKey: queryKeys.referenceFields,
    queryFn: () => serviceNowService.getReferenceFields(),
    ...baseQueryOptions,
    staleTime: 1000 * 60 * 15, // 15 minutes
    ...options,
  });
}

// Graph data queries
export function useGraphData(
  includeReferences: boolean = true,
  options?: Partial<UseQueryOptions<GraphData, Error>>
) {
  return useQuery({
    queryKey: queryKeys.graphData(includeReferences),
    queryFn: () => serviceNowService.generateGraphData(includeReferences),
    ...baseQueryOptions,
    staleTime: 1000 * 60 * 10, // 10 minutes
    ...options,
  });
}

// Record queries
export function useRecordCount(
  tableName: string,
  options?: Partial<UseQueryOptions<number, Error>>
) {
  return useQuery({
    queryKey: queryKeys.recordCount(tableName),
    queryFn: () => serviceNowService.getRecordCount(tableName),
    enabled: !!tableName,
    ...baseQueryOptions,
    staleTime: 1000 * 60 * 30, // 30 minutes (record counts change less frequently)
    ...options,
  });
}

export function useTableRecords(
  tableName: string,
  query?: string,
  limit: number = 100,
  options?: Partial<UseQueryOptions<any[], Error>>
) {
  return useQuery({
    queryKey: queryKeys.tableRecords(tableName, query, limit),
    queryFn: () => serviceNowService.getRecords(tableName, query, limit),
    enabled: !!tableName,
    ...baseQueryOptions,
    ...options,
  });
}

// Custom field queries
export function useCustomFields(
  tableName?: string,
  options?: Partial<UseQueryOptions<FieldMetadata[], Error>>
) {
  return useQuery({
    queryKey: queryKeys.customFields(tableName),
    queryFn: () => serviceNowService.getCustomFields(tableName),
    ...baseQueryOptions,
    ...options,
  });
}

// Multi-table schema queries (for detailed table information)
export function useMultipleTableSchemas(tableNames: string[]) {
  return useQueries({
    queries: tableNames.map((tableName) => ({
      queryKey: queryKeys.tableSchema(tableName),
      queryFn: () => serviceNowService.getTableSchema(tableName),
      enabled: !!tableName,
      ...baseQueryOptions,
      staleTime: 1000 * 60 * 15, // 15 minutes
    })),
  });
}

// Multi-table record counts
export function useMultipleRecordCounts(tableNames: string[]) {
  return useQueries({
    queries: tableNames.map((tableName) => ({
      queryKey: queryKeys.recordCount(tableName),
      queryFn: () => serviceNowService.getRecordCount(tableName),
      enabled: !!tableName,
      ...baseQueryOptions,
      staleTime: 1000 * 60 * 30, // 30 minutes
    })),
  });
}

// Composite hook for complete table details (used in NodeDetailsPanel)
export function useTableDetails(tableName: string, enabled: boolean = true) {
  const tableSchemaQuery = useTableSchema(tableName, { enabled });
  const recordCountQuery = useRecordCount(tableName, { enabled });
  
  return {
    schema: tableSchemaQuery,
    recordCount: recordCountQuery,
    isLoading: tableSchemaQuery.isLoading || recordCountQuery.isLoading,
    error: tableSchemaQuery.error || recordCountQuery.error,
    data: {
      fields: tableSchemaQuery.data || [],
      recordCount: recordCountQuery.data || 0,
    }
  };
}

// Composite hook for graph view data
export function useGraphViewData(viewType: 'inheritance' | 'references' | 'ci-relationships') {
  const includeReferences = viewType === 'references';
  
  const graphDataQuery = useGraphData(includeReferences, {
    enabled: viewType === 'inheritance' || viewType === 'references'
  });
  
  const hierarchyQuery = useTableHierarchy({
    enabled: viewType === 'inheritance'
  });
  
  const relationshipTypesQuery = useRelationshipTypes({
    enabled: viewType === 'ci-relationships'
  });
  
  const ciRelationshipsQuery = useCIRelationships(undefined, undefined, {
    enabled: viewType === 'ci-relationships'
  });

  return {
    graphData: graphDataQuery,
    hierarchy: hierarchyQuery,
    relationshipTypes: relationshipTypesQuery,
    ciRelationships: ciRelationshipsQuery,
    isLoading: 
      graphDataQuery.isLoading || 
      hierarchyQuery.isLoading || 
      relationshipTypesQuery.isLoading ||
      ciRelationshipsQuery.isLoading,
    error: 
      graphDataQuery.error || 
      hierarchyQuery.error || 
      relationshipTypesQuery.error ||
      ciRelationshipsQuery.error,
  };
}