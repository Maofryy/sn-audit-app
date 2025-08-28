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

export interface ViewMode {
  type: 'inheritance' | 'relationships' | 'audit' | 'reports';
  subview?: string;
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