// Core ServiceNow types
export interface ServiceNowInstance {
  url: string;
  username: string;
  password: string;
  name?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  testing: boolean;
  error?: string;
  lastTested?: Date;
}

// CMDB Table Metadata
export interface TableMetadata {
  sys_id: string;
  name: string;
  label: string;
  super_class: string | null;
  sys_scope: string;
  sys_created_on: string;
  sys_created_by: string;
  sys_updated_on: string;
  sys_updated_by: string;
  is_custom: boolean;
  table_type: 'base' | 'extended' | 'custom';
  record_count?: number;
  extends_hierarchy: string[];
}

export interface FieldMetadata {
  sys_id: string;
  element: string;
  table: string;
  column_label: string;
  type: string;
  max_length?: number;
  mandatory: boolean;
  sys_created_on: string;
  sys_created_by: string;
  is_custom: boolean;
  reference_table?: string;
  choice_values?: string[];
}

// CMDB Relationships
export interface TableRelationship {
  id: string;
  source_table: string;
  target_table: string;
  relationship_type: 'extends' | 'references' | 'contains';
  field_name?: string;
  strength: number; // for visualization layout
}

// Reference Field Relationship Types for Story 2.2
export interface ReferenceFieldRelationship {
  sys_id: string;
  source_table: string;
  target_table: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_mandatory: boolean;
  is_custom: boolean;
  created_by: string;
  created_on: string;
  relationship_strength: number; // 0-1 for graph layout
  usage_count?: number; // how many records actually use this reference
}

export interface ReferenceNetworkData {
  tables: TableMetadata[];
  relationships: ReferenceFieldRelationship[];
  metadata: {
    total_tables: number;
    total_references: number;
    custom_references: number;
    generated_at: Date;
    relationship_types: Record<string, number>;
  };
}

export interface ReferenceFieldFilter {
  tableNames?: string[];
  relationshipTypes?: ('extends' | 'references' | 'contains')[];
  customOnly?: boolean;
  mandatoryOnly?: boolean;
  searchTerm?: string;
  createdAfter?: Date;
  createdBy?: string[];
  targetTables?: string[];
}

export interface CIRelationship {
  sys_id: string;
  parent: string;
  child: string;
  type: string;
  type_name: string;
  sys_created_on: string;
}

export interface RelationshipType {
  sys_id: string;
  name: string;
  label: string;
  directed: boolean;
  parent_descriptor: string;
  child_descriptor: string;
}

// Table Hierarchy
export interface TableHierarchy {
  root: TableNode;
  nodeMap: Map<string, TableNode>;
  relationshipMap: Map<string, TableRelationship[]>;
}

export interface TableNode {
  table: TableMetadata;
  children: TableNode[];
  parent: TableNode | null;
  depth: number;
  customFieldCount: number;
  totalRecordCount: number;
}

// Audit Types
export interface AuditTest {
  id: string;
  name: string;
  description: string;
  type: 'custom_tables' | 'custom_fields' | 'relationships' | 'compliance';
  enabled: boolean;
}

export interface AuditResult {
  test_id: string;
  test_name: string;
  executed_at: Date;
  status: 'success' | 'error' | 'warning';
  findings_count: number;
  findings: AuditFinding[];
  summary: string;
  risk_score: number;
}

export interface AuditFinding {
  id: string;
  type: 'custom_table' | 'custom_field' | 'relationship_issue' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  table_name?: string;
  field_name?: string;
  recommendation: string;
  impact: string;
  metadata: Record<string, unknown>;
}

export interface CustomTableAuditResult {
  total_cmdb_tables: number;
  custom_tables: CustomTableSummary[];
  by_creator: Record<string, number>;
  by_date_range: Record<string, number>;
  risk_assessment: RiskAssessment;
}

export interface CustomTableSummary {
  name: string;
  label: string;
  extends: string;
  created_by: string;
  created_on: string;
  record_count: number;
  custom_field_count: number;
  risk_factors: string[];
  complexity_score: number;
}

export interface CustomFieldAuditResult {
  total_fields_analyzed: number;
  custom_fields: CustomFieldSummary[];
  by_table: Record<string, number>;
  by_type: Record<string, number>;
  risk_assessment: RiskAssessment;
}

export interface CustomFieldSummary {
  element: string;
  table: string;
  label: string;
  type: string;
  created_by: string;
  created_on: string;
  is_reference: boolean;
  reference_table?: string;
  has_business_rules: boolean;
  risk_factors: string[];
  complexity_score: number;
}

export interface RiskAssessment {
  overall_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
  upgrade_impact: 'minimal' | 'moderate' | 'significant' | 'high';
}

export interface RiskFactor {
  factor: string;
  score: number;
  description: string;
  mitigation: string;
}

// API Response Types
export interface ServiceNowResponse<T = ServiceNowRecord> {
  result: T[];
}

export interface ServiceNowRecord {
  sys_id: string;
  sys_created_on: string;
  sys_created_by: string;
  sys_updated_on: string;
  sys_updated_by: string;
  [key: string]: unknown;
}

// Graph Visualization Types
export interface GraphNode {
  id: string;
  label: string;
  type: 'table' | 'relationship';
  table?: TableMetadata;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  strength?: number;
  metadata: Record<string, unknown>;
}

// Enhanced Graph Types for Reference Field Networks
export interface ReferenceGraphNode extends GraphNode {
  referenceCount: number;
  incomingReferences: number;
  outgoingReferences: number;
  customReferenceCount: number;
}

export interface ReferenceGraphEdge extends GraphEdge {
  fieldName: string;
  fieldLabel: string;
  isCustom: boolean;
  isMandatory: boolean;
  usageCount?: number;
  relationshipStrength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    total_tables: number;
    custom_tables: number;
    total_relationships: number;
    generated_at: Date;
  };
}

// UI State Types
export interface FilterState {
  tableTypes: string[];
  relationshipTypes: string[];
  customOnly: boolean;
  searchTerm: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Enhanced Filter State for Reference Networks
export interface ReferenceFilterState extends FilterState {
  mandatoryOnly: boolean;
  targetTables: string[];
  minimumUsageCount?: number;
  relationshipStrengthRange?: {
    min: number;
    max: number;
  };
}

export interface ViewMode {
  type: 'inheritance' | 'relationships' | 'audit' | 'reports';
  subview?: string;
}

// CMDB Audit System Types
export interface TableStatistics {
  table_name: string;
  table_label: string;
  total_references: number;
  custom_references: number;
  standard_references: number;
  incoming_references: number;
  outgoing_references: number;
  mandatory_references: number;
  record_count?: number;
  last_updated: string;
}

export interface TableAuditData {
  table: TableMetadata;
  statistics: TableStatistics;
  fields: FieldMetadata[];
  quality_metrics: DataQualityMetrics;
  audit_kpis: AuditKPI[];
  reference_graph: ReferenceGraphData;
  relationships: ReferenceFieldRelationship[]; // Raw relationships data
  ci_relationships?: CIRelationship[];
}

export interface DataQualityMetrics {
  table_name: string;
  completeness_score: number; // 0-100
  reference_integrity_score: number;
  field_usage_stats: FieldUsageStats[];
  null_value_percentages: Record<string, number>;
  data_consistency_issues: DataConsistencyIssue[];
  generated_at: Date;
}

export interface FieldUsageStats {
  field_name: string;
  field_label: string;
  usage_percentage: number;
  null_count: number;
  populated_count: number;
  unique_values_count?: number;
}

export interface DataConsistencyIssue {
  type: 'missing_reference' | 'orphaned_reference' | 'invalid_data' | 'duplicate_reference';
  field_name: string;
  severity: 'low' | 'medium' | 'high';
  count: number;
  description: string;
  sample_records?: string[];
}

export interface AuditKPI {
  id: string;
  name: string;
  value: number | string;
  unit?: string;
  description: string;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  benchmark?: number;
}

export interface ReferenceGraphData {
  center_table: TableMetadata;
  connected_tables: TableMetadata[];
  reference_edges: ReferenceGraphEdge[];
  graph_metrics: GraphMetrics;
}

export interface GraphMetrics {
  total_connections: number;
  custom_connections: number;
  complexity_score: number;
  centrality_score: number;
  cluster_coefficient: number;
}

// Enhanced Table List Types
export interface TableListItem {
  table: TableMetadata;
  statistics: TableStatistics;
  audit_status: 'compliant' | 'warning' | 'non_compliant';
  last_analyzed: Date;
  priority_score: number; // 0-100, higher = more important to audit
}

export interface TableListFilter {
  search_term?: string;
  table_types?: ('base' | 'extended' | 'custom')[];
  audit_status?: ('compliant' | 'warning' | 'non_compliant')[];
  min_references?: number;
  max_references?: number;
  custom_only?: boolean;
  has_issues?: boolean;
  created_after?: Date;
  priority_range?: {min: number; max: number};
}

export interface TableListSortOptions {
  field: 'name' | 'label' | 'total_references' | 'custom_references' | 'priority_score' | 'last_analyzed';
  direction: 'asc' | 'desc';
}

// Audit Dashboard State Types
export interface AuditDashboardState {
  selectedTable?: string;
  tableList: {
    items: TableListItem[];
    loading: boolean;
    error?: string;
    filters: TableListFilter;
    sort: TableListSortOptions;
    pagination: {
      page: number;
      per_page: number;
      total: number;
    };
  };
  tableDetail: {
    data?: TableAuditData;
    loading: boolean;
    error?: string;
  };
  globalStats: {
    total_cmdb_tables: number;
    total_custom_tables: number;
    total_references: number;
    average_quality_score: number;
    tables_needing_attention: number;
  };
}

// Force Graph Specific Types
export interface ForceGraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'center' | 'connected';
  table: TableMetadata;
  reference_count: number;
  custom_reference_count: number;
  is_custom: boolean;
  size: number;
  color: string;
}

export interface ForceGraphEdge extends d3.SimulationLinkDatum<ForceGraphNode> {
  id: string;
  source_table: string;
  target_table: string;
  field_name: string;
  field_label: string;
  is_custom: boolean;
  is_mandatory: boolean;
  strength: number;
  color: string;
  width: number;
}

export interface ForceGraphConfig {
  width: number;
  height: number;
  charge: number;
  distance: number;
  collision_radius: number;
  center_force: number;
  show_labels: boolean;
  highlight_custom: boolean;
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
}

export interface CacheMetadata {
  lastStructureUpdate: Date;
  lastDataUpdate: Date;
  tableCount: number;
  relationshipCount: number;
}