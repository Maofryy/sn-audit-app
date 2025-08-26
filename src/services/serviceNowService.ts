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
    GraphEdge,
} from "../types";
import { makeAuthenticatedRequest, testConnection as authTestConnection } from "./authService";

export class ServiceNowService {
    // Test connection using the authentication service
    async testConnection(): Promise<{ success: boolean; error?: string; responseTime?: number; mode?: string }> {
        return authTestConnection();
    }

    async getCurrentUser(): Promise<any> {
        const response = await makeAuthenticatedRequest("/api/now/table/sys_user/me", {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.status}`);
        }

        const data = await response.json();
        return data.result || null;
    }

    // Core API method using authentication service
    private async makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<ServiceNowResponse<T>> {
        const response = await makeAuthenticatedRequest(endpoint, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    // CMDB Table Discovery Methods - Enhanced for complete hierarchy
    async getCMDBTables(): Promise<TableMetadata[]> {
        const fields = "sys_id,name,label,super_class,sys_created_by,sys_created_on,sys_updated_on,sys_updated_by";

        // Get all CMDB-related tables with no limit
        const response = await this.makeRequest<ServiceNowRecord>(
            `/api/now/table/sys_db_object?sysparm_query=super_class.name=cmdb_ci^ORname=cmdb_ci^ORsuper_class.super_class.name=cmdb_ci&sysparm_limit=10000&sysparm_fields=${fields}&sysparm_display_value=all`
        );

        const allTables = response.result;

        const tables = allTables.map((record) => this.mapToTableMetadata(record));


        return tables;
    }

    async getAllTables(): Promise<TableMetadata[]> {
        const fields = "sys_id,name,label,super_class,sys_created_by,sys_created_on,sys_updated_on,sys_updated_by";
        const response = await this.makeRequest<ServiceNowRecord>(`/api/now/table/sys_db_object?sysparm_limit=10000&sysparm_fields=${fields}&sysparm_display_value=all`);

        return response.result.map((record) => this.mapToTableMetadata(record));
    }

    async getTableSchema(tableName: string): Promise<FieldMetadata[]> {
        const fields = "sys_id,element,table,column_label,internal_type,max_length,mandatory,sys_created_by,sys_created_on,reference";
        const response = await this.makeRequest<ServiceNowRecord>(`/api/now/table/sys_dictionary?sysparm_query=table=${tableName}&sysparm_limit=1000&sysparm_fields=${fields}`);

        return response.result.map((record) => this.mapToFieldMetadata(record));
    }

    async getCustomTables(): Promise<TableMetadata[]> {
        // Get all CMDB tables
        const allTables = await this.getCMDBTables();

        // Filter for custom tables (created after implementation or with custom prefixes)
        return allTables.filter((table) => this.isCustomTable(table));
    }

    async getCustomFields(tableName?: string): Promise<FieldMetadata[]> {
        let query = "tableLIKEcmdb";
        if (tableName) {
            query = `table=${tableName}`;
        }

        const fields = "sys_id,element,table,column_label,internal_type,max_length,mandatory,sys_created_by,sys_created_on,reference";
        const response = await this.makeRequest<ServiceNowRecord>(`/api/now/table/sys_dictionary?sysparm_query=${query}&sysparm_limit=10000&sysparm_fields=${fields}`);

        const allFields = response.result.map((record) => this.mapToFieldMetadata(record));

        // Filter for custom fields
        return allFields.filter((field) => this.isCustomField(field));
    }

    // CMDB Relationship Methods
    async getCIRelationships(parentId?: string, childId?: string): Promise<CIRelationship[]> {
        let query = "";
        if (parentId) query += `parent=${parentId}`;
        if (childId) query += `${query ? "^" : ""}child=${childId}`;

        const endpoint = `/api/now/table/cmdb_rel_ci${query ? `?sysparm_query=${query}&sysparm_limit=1000` : "?sysparm_limit=1000"}`;
        const response = await this.makeRequest<ServiceNowRecord>(endpoint);

        return response.result.map((record) => ({
            sys_id: record.sys_id,
            parent: record.parent,
            child: record.child,
            type: record.type,
            type_name: record.type_name || "",
            sys_created_on: record.sys_created_on,
        }));
    }

    async getRelationshipTypes(): Promise<RelationshipType[]> {
        const response = await this.makeRequest<ServiceNowRecord>("/api/now/table/cmdb_rel_type?sysparm_limit=1000");

        return response.result.map((record) => ({
            sys_id: record.sys_id,
            name: record.name,
            label: record.label || record.name,
            directed: record.directed === "true",
            parent_descriptor: record.parent_descriptor || "",
            child_descriptor: record.child_descriptor || "",
        }));
    }

    async getReferenceFields(): Promise<FieldMetadata[]> {
        const fields = "sys_id,element,table,column_label,internal_type,max_length,mandatory,sys_created_by,sys_created_on,reference";
        const response = await this.makeRequest<ServiceNowRecord>(`/api/now/table/sys_dictionary?sysparm_query=internal_type=reference^tableLIKEcmdb&sysparm_limit=5000&sysparm_fields=${fields}`);

        return response.result.map((record) => this.mapToFieldMetadata(record));
    }

    // Table Hierarchy Building
    async buildTableHierarchy(): Promise<TableHierarchy> {
        const tables = await this.getCMDBTables();

        const nodeMap = new Map<string, TableNode>();
        const sysIdToNodeMap = new Map<string, TableNode>();
        const relationshipMap = new Map<string, TableRelationship[]>();

        // Create nodes and build sys_id to node mapping
        const nodes: TableNode[] = tables.map((table) => ({
            table,
            children: [],
            parent: null,
            depth: 0,
            customFieldCount: 0,
            totalRecordCount: table.record_count || 0,
        }));

        // Build node maps - CRITICAL: Both name and sys_id lookups
        nodes.forEach((node) => {
            nodeMap.set(node.table.name, node);
            sysIdToNodeMap.set(node.table.sys_id, node);
        });

        // Build parent-child relationships with cycle detection
        const processedNodes = new Set<string>();
        const processingNodes = new Set<string>();

        const calculateDepth = (node: TableNode, path: Set<string> = new Set()): number => {
            // Prevent infinite recursion - max depth limit
            if (path.size > 20) {
                console.warn(`Maximum depth exceeded for table: ${node.table.name}`);
                return 20;
            }

            // Cycle detection
            if (path.has(node.table.name)) {
                console.warn(`Circular reference detected in hierarchy for table: ${node.table.name}`);
                return path.size;
            }

            if (!node.table.super_class) {
                return 0; // Root node
            }

            // FIXED: Look up parent by sys_id first, then by name as fallback
            let parent = sysIdToNodeMap.get(node.table.super_class);
            if (!parent) {
                parent = nodeMap.get(node.table.super_class);
            }
            
            if (!parent) {
                return 0; // No valid parent
            }

            path.add(node.table.name);
            const parentDepth = calculateDepth(parent, path);
            path.delete(node.table.name);

            return parentDepth + 1;
        };

        // First pass: establish parent-child relationships - FIXED LOGIC
        let relationshipsFound = 0;
        let relationshipsSkipped = 0;

        nodes.forEach((node) => {
            if (node.table.super_class) {
                // CRITICAL FIX: super_class contains sys_id, not table name
                let parent = sysIdToNodeMap.get(node.table.super_class);
                
                // Fallback: if super_class was already resolved to table name
                if (!parent) {
                    parent = nodeMap.get(node.table.super_class);
                }

                if (parent && parent.table.sys_id !== node.table.sys_id) {
                    // Prevent self-reference by sys_id
                    node.parent = parent;
                    parent.children.push(node);
                    relationshipsFound++;
                } else if (!parent) {
                    relationshipsSkipped++;
                }
            }
        });


        // Second pass: calculate depths safely
        nodes.forEach((node) => {
            if (!processedNodes.has(node.table.name)) {
                node.depth = calculateDepth(node);
                processedNodes.add(node.table.name);
            }
        });


        // Find root (cmdb_ci or cmdb)
        const root = nodeMap.get("cmdb_ci") || nodeMap.get("cmdb");
        if (!root) {
            throw new Error("Could not find CMDB root table (cmdb_ci or cmdb)");
        }

        // Interactive tree structure log - click to expand children
        const createInteractiveTree = (node: TableNode): any => {
            return {
                name: node.table.name,
                label: node.table.label,
                sys_id: node.table.sys_id,
                super_class: node.table.super_class,
                depth: node.depth,
                childCount: node.children.length,
                children: node.children.length > 0 ? 
                    `Click to expand ${node.children.length} children` : 
                    [],
                _childrenData: node.children.map(createInteractiveTree)
            };
        };

        const interactiveTree = createInteractiveTree(root);
        console.log("🌳 CMDB Hierarchy - Click objects to expand:", {
            totalTables: tables.length,
            relationships: relationshipsFound,
            rootTable: interactiveTree
        });

        return {
            root,
            nodeMap,
            relationshipMap,
        };
    }

    // Graph Data Generation
    async generateGraphData(includeReferences: boolean = true): Promise<GraphData> {
        const [tables, relationships, referenceFields] = await Promise.all([this.getCMDBTables(), this.getCIRelationships(), includeReferences ? this.getReferenceFields() : Promise.resolve([])]);

        const nodes: GraphNode[] = tables.map((table) => ({
            id: table.name,
            label: table.label,
            type: "table",
            table,
            metadata: {
                isCustom: table.is_custom,
                recordCount: table.record_count,
                tableType: table.table_type,
            },
        }));

        const edges: GraphEdge[] = [];

        // Add inheritance relationships
        tables.forEach((table) => {
            if (table.super_class) {
                edges.push({
                    id: `${table.super_class}-${table.name}`,
                    source: table.super_class,
                    target: table.name,
                    type: "extends",
                    label: "extends",
                    strength: 1,
                    metadata: {
                        relationshipType: "inheritance",
                    },
                });
            }
        });

        // Add reference field relationships
        if (includeReferences) {
            referenceFields.forEach((field) => {
                if (field.reference_table) {
                    edges.push({
                        id: `${field.table}-${field.reference_table}-${field.element}`,
                        source: field.table,
                        target: field.reference_table,
                        type: "references",
                        label: field.element,
                        strength: 0.5,
                        metadata: {
                            relationshipType: "reference",
                            fieldName: field.element,
                        },
                    });
                }
            });
        }

        return {
            nodes,
            edges,
            metadata: {
                total_tables: tables.length,
                custom_tables: tables.filter((t) => t.is_custom).length,
                total_relationships: edges.length,
                generated_at: new Date(),
            },
        };
    }

    // Utility Methods
    private mapToTableMetadata(record: ServiceNowRecord): TableMetadata {
        // Helper function to extract value from ServiceNow response objects
        const getValue = (field: any): string | null => {
            if (!field) return null;
            if (typeof field === "string") return field;
            if (typeof field === "object") {
                return field.display_value || field.value || null;
            }
            return null;
        };

        // Extract values from ServiceNow response format
        const sys_id = getValue(record.sys_id);
        const name = getValue(record.name);
        const label = getValue(record.label) || getValue(record.sys_name) || name;

        // FIXED: For super_class, preserve sys_id value for proper linking
        let super_class: string | null = null;
        if (record.super_class) {
            if (typeof record.super_class === "object") {
                // CRITICAL: Use sys_id (value) for linking, not display_value (table name)
                super_class = record.super_class.value || record.super_class.display_value || null;
            } else {
                super_class = record.super_class;
            }
        }

        const sys_created_on = getValue(record.sys_created_on);
        const sys_created_by = getValue(record.sys_created_by);
        const sys_updated_on = getValue(record.sys_updated_on);
        const sys_updated_by = getValue(record.sys_updated_by);

        return {
            sys_id: sys_id || "",
            name: name || "",
            label: label || name || "",
            super_class: super_class,
            sys_created_on: sys_created_on || "",
            sys_created_by: sys_created_by || "",
            sys_updated_on: sys_updated_on || "",
            sys_updated_by: sys_updated_by || "",
            is_custom: this.isCustomTable({
                name: name,
                sys_created_by: sys_created_by,
                sys_created_on: sys_created_on,
            } as TableMetadata),
            table_type: this.determineTableType({ name, sys_created_by } as any),
            extends_hierarchy: [], // Will be populated by hierarchy building
        };
    }

    private mapToFieldMetadata(record: ServiceNowRecord): FieldMetadata {
        // Helper function to extract value from ServiceNow response objects
        const getValue = (field: any): string | null => {
            if (!field) return null;
            if (typeof field === "string") return field;
            if (typeof field === "object") {
                return field.display_value || field.value || null;
            }
            return null;
        };

        // Extract values from ServiceNow response format
        const sys_id = getValue(record.sys_id);
        const element = getValue(record.element);
        const table = getValue(record.table);
        const column_label = getValue(record.column_label) || element;
        const type = getValue(record.internal_type) || getValue(record.type);
        const max_length_str = getValue(record.max_length);
        const mandatory = getValue(record.mandatory) === "true";
        const sys_created_on = getValue(record.sys_created_on);
        const sys_created_by = getValue(record.sys_created_by);
        const reference_table = getValue(record.reference);

        return {
            sys_id: sys_id || "",
            element: element || "",
            table: table || "",
            column_label: column_label || element || "",
            type: type || "",
            max_length: max_length_str ? parseInt(max_length_str) : undefined,
            mandatory: mandatory,
            sys_created_on: sys_created_on || "",
            sys_created_by: sys_created_by || "",
            is_custom: this.isCustomField({
                element: element,
                sys_created_by: sys_created_by,
                sys_created_on: sys_created_on,
            } as FieldMetadata),
            reference_table: reference_table || undefined,
        };
    }

    private isCustomTable(table: Partial<TableMetadata>): boolean {
        // Custom table indicators
        const customPrefixes = ["u_", "x_", "custom_"];
        const systemUsers = ["system", "admin", "ServiceNow"];

        // Check naming pattern
        if (customPrefixes.some((prefix) => table.name?.startsWith(prefix))) {
            return true;
        }

        // Check creation metadata
        if (table.sys_created_by && !systemUsers.includes(table.sys_created_by)) {
            return true;
        }

        // Check creation date (tables created after typical implementation timeframe)
        if (table.sys_created_on) {
            const createdDate = new Date(table.sys_created_on);
            const cutoffDate = new Date("2020-01-01"); // Adjust based on when ServiceNow was implemented
            return createdDate > cutoffDate;
        }

        return false;
    }

    private isCustomField(field: Partial<FieldMetadata>): boolean {
        // Custom field indicators
        const customPrefixes = ["u_", "x_", "custom_"];
        const systemUsers = ["system", "admin", "ServiceNow"];

        // Check naming pattern
        if (customPrefixes.some((prefix) => field.element?.startsWith(prefix))) {
            return true;
        }

        // Check creation metadata
        if (field.sys_created_by && !systemUsers.includes(field.sys_created_by)) {
            return true;
        }

        return false;
    }

    private determineTableType(record: ServiceNowRecord): "base" | "extended" | "custom" {
        if (record.name === "cmdb" || record.name === "cmdb_ci") {
            return "base";
        }

        if (this.isCustomTable(record as any)) {
            return "custom";
        }

        return "extended";
    }

    // Record count methods
    async getRecordCount(tableName: string): Promise<number> {
        const response = await this.makeRequest<any>(`/api/now/stats/${tableName}?sysparm_count=true`);

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
