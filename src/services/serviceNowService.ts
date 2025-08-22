import { 
  ServiceNowInstance, 
  ServiceNowResponse, 
  ServiceNowRecord,
  TableMetadata, 
  FieldMetadata, 
  CIRelationship, 
  RelationshipType,
  TableHierarchy,
  TableNode,
  TableRelationship,
  GraphData,
  GraphNode,
  GraphEdge
} from '../types';
import { makeAuthenticatedRequest, testConnection as authTestConnection } from './authService';

export class ServiceNowService {
  // Test connection using the authentication service
  async testConnection(): Promise<{ success: boolean; error?: string; responseTime?: number; mode?: string }> {
    return authTestConnection();
  }

  async getCurrentUser(): Promise<any> {
    const response = await makeAuthenticatedRequest('/api/now/table/sys_user/me', {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const data = await response.json();
    return data.result || null;
  }

  // Core API method using authentication service
  private async makeRequest<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ServiceNowResponse<T>> {
    const response = await makeAuthenticatedRequest(endpoint, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  // CMDB Table Discovery Methods
  async getCMDBTables(): Promise<TableMetadata[]> {
    const response = await this.makeRequest<ServiceNowRecord>(
      '/api/now/table/sys_db_object?sysparm_query=super_classLIKEcmdb^ORnameLIKEcmdb&sysparm_limit=5000'
    );

    return response.result.map(record => this.mapToTableMetadata(record));
  }

  async getAllTables(): Promise<TableMetadata[]> {
    const response = await this.makeRequest<ServiceNowRecord>(
      '/api/now/table/sys_db_object?sysparm_limit=10000'
    );

    return response.result.map(record => this.mapToTableMetadata(record));
  }

  async getTableSchema(tableName: string): Promise<FieldMetadata[]> {
    const response = await this.makeRequest<ServiceNowRecord>(
      `/api/now/table/sys_dictionary?sysparm_query=table=${tableName}&sysparm_limit=1000`
    );

    return response.result.map(record => this.mapToFieldMetadata(record));
  }

  async getCustomTables(): Promise<TableMetadata[]> {
    // Get all CMDB tables
    const allTables = await this.getCMDBTables();
    
    // Filter for custom tables (created after implementation or with custom prefixes)
    return allTables.filter(table => this.isCustomTable(table));
  }

  async getCustomFields(tableName?: string): Promise<FieldMetadata[]> {
    let query = 'tableLIKEcmdb';
    if (tableName) {
      query = `table=${tableName}`;
    }

    const response = await this.makeRequest<ServiceNowRecord>(
      `/api/now/table/sys_dictionary?sysparm_query=${query}&sysparm_limit=10000`
    );

    const allFields = response.result.map(record => this.mapToFieldMetadata(record));
    
    // Filter for custom fields
    return allFields.filter(field => this.isCustomField(field));
  }

  // CMDB Relationship Methods
  async getCIRelationships(parentId?: string, childId?: string): Promise<CIRelationship[]> {
    let query = '';
    if (parentId) query += `parent=${parentId}`;
    if (childId) query += `${query ? '^' : ''}child=${childId}`;

    const endpoint = `/api/now/table/cmdb_rel_ci${query ? `?sysparm_query=${query}&sysparm_limit=1000` : '?sysparm_limit=1000'}`;
    const response = await this.makeRequest<ServiceNowRecord>(endpoint);

    return response.result.map(record => ({
      sys_id: record.sys_id,
      parent: record.parent,
      child: record.child,
      type: record.type,
      type_name: record.type_name || '',
      sys_created_on: record.sys_created_on
    }));
  }

  async getRelationshipTypes(): Promise<RelationshipType[]> {
    const response = await this.makeRequest<ServiceNowRecord>(
      '/api/now/table/cmdb_rel_type?sysparm_limit=1000'
    );

    return response.result.map(record => ({
      sys_id: record.sys_id,
      name: record.name,
      label: record.label || record.name,
      directed: record.directed === 'true',
      parent_descriptor: record.parent_descriptor || '',
      child_descriptor: record.child_descriptor || ''
    }));
  }

  async getReferenceFields(): Promise<FieldMetadata[]> {
    const response = await this.makeRequest<ServiceNowRecord>(
      '/api/now/table/sys_dictionary?sysparm_query=internal_type=reference^tableLIKEcmdb&sysparm_limit=5000'
    );

    return response.result.map(record => this.mapToFieldMetadata(record));
  }

  // Table Hierarchy Building
  async buildTableHierarchy(): Promise<TableHierarchy> {
    const tables = await this.getCMDBTables();
    const nodeMap = new Map<string, TableNode>();
    const relationshipMap = new Map<string, TableRelationship[]>();

    // Create nodes
    const nodes: TableNode[] = tables.map(table => ({
      table,
      children: [],
      parent: null,
      depth: 0,
      customFieldCount: 0,
      totalRecordCount: table.record_count || 0
    }));

    // Build node map
    nodes.forEach(node => {
      nodeMap.set(node.table.name, node);
    });

    // Build parent-child relationships
    nodes.forEach(node => {
      if (node.table.super_class) {
        const parent = nodeMap.get(node.table.super_class);
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
          node.depth = parent.depth + 1;
        }
      }
    });

    // Find root (cmdb_ci or cmdb)
    const root = nodeMap.get('cmdb_ci') || nodeMap.get('cmdb');
    if (!root) {
      throw new Error('Could not find CMDB root table');
    }

    return {
      root,
      nodeMap,
      relationshipMap
    };
  }

  // Graph Data Generation
  async generateGraphData(includeReferences: boolean = true): Promise<GraphData> {
    const [tables, relationships, referenceFields] = await Promise.all([
      this.getCMDBTables(),
      this.getCIRelationships(),
      includeReferences ? this.getReferenceFields() : Promise.resolve([])
    ]);

    const nodes: GraphNode[] = tables.map(table => ({
      id: table.name,
      label: table.label,
      type: 'table',
      table,
      metadata: {
        isCustom: table.is_custom,
        recordCount: table.record_count,
        tableType: table.table_type
      }
    }));

    const edges: GraphEdge[] = [];

    // Add inheritance relationships
    tables.forEach(table => {
      if (table.super_class) {
        edges.push({
          id: `${table.super_class}-${table.name}`,
          source: table.super_class,
          target: table.name,
          type: 'extends',
          label: 'extends',
          strength: 1,
          metadata: {
            relationshipType: 'inheritance'
          }
        });
      }
    });

    // Add reference field relationships
    if (includeReferences) {
      referenceFields.forEach(field => {
        if (field.reference_table) {
          edges.push({
            id: `${field.table}-${field.reference_table}-${field.element}`,
            source: field.table,
            target: field.reference_table,
            type: 'references',
            label: field.element,
            strength: 0.5,
            metadata: {
              relationshipType: 'reference',
              fieldName: field.element
            }
          });
        }
      });
    }

    return {
      nodes,
      edges,
      metadata: {
        total_tables: tables.length,
        custom_tables: tables.filter(t => t.is_custom).length,
        total_relationships: edges.length,
        generated_at: new Date()
      }
    };
  }

  // Utility Methods
  private mapToTableMetadata(record: ServiceNowRecord): TableMetadata {
    return {
      sys_id: record.sys_id,
      name: record.name,
      label: record.label || record.name,
      super_class: record.super_class || null,
      sys_created_on: record.sys_created_on,
      sys_created_by: record.sys_created_by,
      sys_updated_on: record.sys_updated_on,
      sys_updated_by: record.sys_updated_by,
      is_custom: this.isCustomTable({
        name: record.name,
        sys_created_by: record.sys_created_by,
        sys_created_on: record.sys_created_on
      } as any),
      table_type: this.determineTableType(record),
      extends_hierarchy: [] // Will be populated by hierarchy building
    };
  }

  private mapToFieldMetadata(record: ServiceNowRecord): FieldMetadata {
    return {
      sys_id: record.sys_id,
      element: record.element,
      table: record.table,
      column_label: record.column_label || record.element,
      type: record.internal_type || record.type,
      max_length: record.max_length ? parseInt(record.max_length) : undefined,
      mandatory: record.mandatory === 'true',
      sys_created_on: record.sys_created_on,
      sys_created_by: record.sys_created_by,
      is_custom: this.isCustomField({
        element: record.element,
        sys_created_by: record.sys_created_by,
        sys_created_on: record.sys_created_on
      } as any),
      reference_table: record.reference || undefined
    };
  }

  private isCustomTable(table: Partial<TableMetadata>): boolean {
    // Custom table indicators
    const customPrefixes = ['u_', 'x_', 'custom_'];
    const systemUsers = ['system', 'admin', 'ServiceNow'];
    
    // Check naming pattern
    if (customPrefixes.some(prefix => table.name?.startsWith(prefix))) {
      return true;
    }
    
    // Check creation metadata
    if (table.sys_created_by && !systemUsers.includes(table.sys_created_by)) {
      return true;
    }
    
    // Check creation date (tables created after typical implementation timeframe)
    if (table.sys_created_on) {
      const createdDate = new Date(table.sys_created_on);
      const cutoffDate = new Date('2020-01-01'); // Adjust based on when ServiceNow was implemented
      return createdDate > cutoffDate;
    }
    
    return false;
  }

  private isCustomField(field: Partial<FieldMetadata>): boolean {
    // Custom field indicators
    const customPrefixes = ['u_', 'x_', 'custom_'];
    const systemUsers = ['system', 'admin', 'ServiceNow'];
    
    // Check naming pattern
    if (customPrefixes.some(prefix => field.element?.startsWith(prefix))) {
      return true;
    }
    
    // Check creation metadata
    if (field.sys_created_by && !systemUsers.includes(field.sys_created_by)) {
      return true;
    }
    
    return false;
  }

  private determineTableType(record: ServiceNowRecord): 'base' | 'extended' | 'custom' {
    if (record.name === 'cmdb' || record.name === 'cmdb_ci') {
      return 'base';
    }
    
    if (this.isCustomTable(record as any)) {
      return 'custom';
    }
    
    return 'extended';
  }

  // Record count methods
  async getRecordCount(tableName: string): Promise<number> {
    const response = await this.makeRequest<any>(
      `/api/now/stats/${tableName}?sysparm_count=true`
    );
    
    return response.result?.stats?.count || 0;
  }

  async getRecords(tableName: string, query?: string, limit: number = 100): Promise<ServiceNowRecord[]> {
    let endpoint = `/api/now/table/${tableName}?sysparm_limit=${limit}`;
    if (query) {
      endpoint += `&sysparm_query=${encodeURIComponent(query)}`;
    }
    
    const response = await this.makeRequest<ServiceNowRecord>(endpoint);
    return response.result;
  }
}

export const serviceNowService = new ServiceNowService();