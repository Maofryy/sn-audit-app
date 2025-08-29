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
    ReferenceFieldRelationship,
    ReferenceNetworkData,
    ReferenceFieldFilter,
    ReferenceGraphNode,
    ReferenceGraphEdge,
} from "../types";
import { makeAuthenticatedRequest, testConnection as authTestConnection } from "./authService";

export class ServiceNowService {
    private requestCache = new Map<string, Promise<unknown>>();
    private cacheTimeout = 5000; // 5 seconds deduplication window

    // Test connection using the authentication service
    async testConnection(): Promise<{ success: boolean; error?: string; responseTime?: number; mode?: string }> {
        return authTestConnection();
    }

    // Request deduplication wrapper
    private async deduplicatedRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
        if (this.requestCache.has(key)) {
            return this.requestCache.get(key);
        }

        const promise = requestFn().finally(() => {
            // Clear from cache after timeout
            setTimeout(() => {
                this.requestCache.delete(key);
            }, this.cacheTimeout);
        });

        this.requestCache.set(key, promise);
        return promise;
    }

    async getCurrentUser(): Promise<ServiceNowRecord | null> {
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
    private async makeRequest<T = ServiceNowRecord>(endpoint: string, options: RequestInit = {}): Promise<ServiceNowResponse<T>> {
        const response = await makeAuthenticatedRequest(endpoint, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    // CMDB Table Discovery Methods - Enhanced for complete hierarchy
    async getCMDBTables(): Promise<TableMetadata[]> {
        const cacheKey = 'cmdb-tables-7gen';
        
        return this.deduplicatedRequest(cacheKey, async () => {
            const fields = "sys_id,name,label,super_class,sys_created_by,sys_created_on,sys_updated_on,sys_updated_by";

            const query = this.buildCMDBInheritanceQuery();
            
            const response = await this.makeRequest<ServiceNowRecord>(
                `/api/now/table/sys_db_object?sysparm_query=${query}&sysparm_limit=10000&sysparm_fields=${fields}&sysparm_display_value=all`
            );

            const tables = response.result.map((record) => this.mapToTableMetadata(record));

            // Log maximum generation depth found
            this.logMaxGenerationDepth(tables);

            return tables;
        });
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

    async getCustomTables(cmdbTables?: TableMetadata[]): Promise<TableMetadata[]> {
        // Reuse provided CMDB tables to avoid duplicate API calls
        const allTables = cmdbTables || await this.getCMDBTables();

        // Filter for custom tables (created after implementation or with custom prefixes)
        return allTables.filter((table) => this.isCustomTable(table));
    }

    async getCustomFields(tableName?: string): Promise<FieldMetadata[]> {
        let query = this.buildCMDBInheritanceQuery('sys_dictionary');
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
        const cmdbQuery = this.buildCMDBInheritanceQuery('sys_dictionary');
        const response = await this.makeRequest<ServiceNowRecord>(`/api/now/table/sys_dictionary?sysparm_query=internal_type=reference^${cmdbQuery}&sysparm_limit=5000&sysparm_fields=${fields}`);

        return response.result.map((record) => this.mapToFieldMetadata(record));
    }

    // Enhanced Reference Field Methods for Story 2.2
    async getReferenceFieldRelationships(filter?: ReferenceFieldFilter): Promise<ReferenceFieldRelationship[]> {
        const cacheKey = `reference-relationships-${JSON.stringify(filter || {})}`;
        
        return this.deduplicatedRequest(cacheKey, async () => {
            const cmdbQuery = this.buildCMDBInheritanceQuery('sys_dictionary');
            let query = `internal_type=reference^${cmdbQuery}`;
            
            // Apply filters to the query
            if (filter?.tableNames?.length) {
                const tableFilter = filter.tableNames.map(name => `table=${name}`).join('^OR');
                query += `^(${tableFilter})`;
            }
            
            if (filter?.customOnly) {
                const customPrefixes = filter.customOnly ? 
                    '^(elementSTARTSWITHu_^ORelementSTARTSWITHx_^ORelementSTARTSWITHcustom_)' : '';
                query += customPrefixes;
            }
            
            if (filter?.mandatoryOnly) {
                query += '^mandatory=true';
            }
            
            if (filter?.createdAfter) {
                const dateStr = filter.createdAfter.toISOString().split('T')[0];
                query += `^sys_created_on>${dateStr}`;
            }
            
            if (filter?.createdBy?.length) {
                const creatorFilter = filter.createdBy.map(creator => `sys_created_by=${creator}`).join('^OR');
                query += `^(${creatorFilter})`;
            }

            if (filter?.targetTables?.length) {
                const targetFilter = filter.targetTables.map(table => `reference=${table}`).join('^OR');
                query += `^(${targetFilter})`;
            }

            const fields = "sys_id,element,table,column_label,internal_type,mandatory,sys_created_by,sys_created_on,reference";
            const response = await this.makeRequest<ServiceNowRecord>(
                `/api/now/table/sys_dictionary?sysparm_query=${encodeURIComponent(query)}&sysparm_limit=10000&sysparm_fields=${fields}&sysparm_display_value=all`
            );

            const relationships: ReferenceFieldRelationship[] = [];
            
            for (const record of response.result) {
                const fieldMetadata = this.mapToFieldMetadata(record);
                
                if (fieldMetadata.reference_table && fieldMetadata.table) {
                    // Apply client-side filters that couldn't be done in the query
                    if (filter?.searchTerm) {
                        const searchLower = filter.searchTerm.toLowerCase();
                        const matchesSearch = 
                            fieldMetadata.element.toLowerCase().includes(searchLower) ||
                            fieldMetadata.column_label.toLowerCase().includes(searchLower) ||
                            fieldMetadata.table.toLowerCase().includes(searchLower) ||
                            fieldMetadata.reference_table.toLowerCase().includes(searchLower);
                        
                        if (!matchesSearch) continue;
                    }

                    const relationship: ReferenceFieldRelationship = {
                        sys_id: fieldMetadata.sys_id,
                        source_table: fieldMetadata.table,
                        target_table: fieldMetadata.reference_table,
                        field_name: fieldMetadata.element,
                        field_label: fieldMetadata.column_label,
                        field_type: fieldMetadata.type,
                        is_mandatory: fieldMetadata.mandatory,
                        is_custom: fieldMetadata.is_custom,
                        created_by: fieldMetadata.sys_created_by,
                        created_on: fieldMetadata.sys_created_on,
                        relationship_strength: this.calculateRelationshipStrength(fieldMetadata),
                    };

                    relationships.push(relationship);
                }
            }

            // Sort by relationship strength (strongest first) and then by table name
            return relationships.sort((a, b) => {
                if (b.relationship_strength !== a.relationship_strength) {
                    return b.relationship_strength - a.relationship_strength;
                }
                return a.source_table.localeCompare(b.source_table);
            });
        });
    }

    async getReferenceNetworkData(filter?: ReferenceFieldFilter): Promise<ReferenceNetworkData> {
        const cacheKey = `reference-network-${JSON.stringify(filter || {})}`;
        
        return this.deduplicatedRequest(cacheKey, async () => {
            const [tables, relationships] = await Promise.all([
                filter?.tableNames?.length ? 
                    this.getCMDBTables().then(allTables => 
                        allTables.filter(t => filter.tableNames!.includes(t.name))
                    ) : 
                    this.getCMDBTables(),
                this.getReferenceFieldRelationships(filter)
            ]);

            // Filter tables to only include those that participate in relationships
            const participatingTables = new Set<string>();
            relationships.forEach(rel => {
                participatingTables.add(rel.source_table);
                participatingTables.add(rel.target_table);
            });

            const filteredTables = tables.filter(table => 
                participatingTables.has(table.name)
            );

            // Calculate relationship type distribution
            const relationshipTypes: Record<string, number> = {};
            relationships.forEach(rel => {
                const key = rel.is_custom ? 'custom_references' : 'standard_references';
                relationshipTypes[key] = (relationshipTypes[key] || 0) + 1;
                
                if (rel.is_mandatory) {
                    relationshipTypes['mandatory_references'] = (relationshipTypes['mandatory_references'] || 0) + 1;
                }
            });

            return {
                tables: filteredTables,
                relationships,
                metadata: {
                    total_tables: filteredTables.length,
                    total_references: relationships.length,
                    custom_references: relationships.filter(r => r.is_custom).length,
                    generated_at: new Date(),
                    relationship_types: relationshipTypes,
                },
            };
        });
    }

    async generateReferenceNetworkGraph(filter?: ReferenceFieldFilter): Promise<{ nodes: ReferenceGraphNode[]; edges: ReferenceGraphEdge[] }> {
        const networkData = await this.getReferenceNetworkData(filter);
        
        // Create enhanced nodes with reference statistics
        const nodeStats = new Map<string, {
            incoming: number;
            outgoing: number;
            customIncoming: number;
            customOutgoing: number;
        }>();

        // Initialize node stats
        networkData.tables.forEach(table => {
            nodeStats.set(table.name, {
                incoming: 0,
                outgoing: 0,
                customIncoming: 0,
                customOutgoing: 0,
            });
        });

        // Calculate reference statistics
        networkData.relationships.forEach(rel => {
            const sourceStats = nodeStats.get(rel.source_table);
            const targetStats = nodeStats.get(rel.target_table);

            if (sourceStats) {
                sourceStats.outgoing++;
                if (rel.is_custom) sourceStats.customOutgoing++;
            }

            if (targetStats) {
                targetStats.incoming++;
                if (rel.is_custom) targetStats.customIncoming++;
            }
        });

        // Create enhanced nodes
        const nodes: ReferenceGraphNode[] = networkData.tables.map(table => {
            const stats = nodeStats.get(table.name) || { incoming: 0, outgoing: 0, customIncoming: 0, customOutgoing: 0 };
            
            return {
                id: table.name,
                label: table.label,
                type: "table" as const,
                table,
                referenceCount: stats.incoming + stats.outgoing,
                incomingReferences: stats.incoming,
                outgoingReferences: stats.outgoing,
                customReferenceCount: stats.customIncoming + stats.customOutgoing,
                metadata: {
                    isCustom: table.is_custom,
                    recordCount: table.record_count,
                    tableType: table.table_type,
                    stats,
                },
            };
        });

        // Create enhanced edges
        const edges: ReferenceGraphEdge[] = networkData.relationships.map(rel => ({
            id: `${rel.source_table}-${rel.target_table}-${rel.field_name}`,
            source: rel.source_table,
            target: rel.target_table,
            type: "references",
            label: rel.field_label || rel.field_name,
            strength: rel.relationship_strength,
            fieldName: rel.field_name,
            fieldLabel: rel.field_label,
            isCustom: rel.is_custom,
            isMandatory: rel.is_mandatory,
            relationshipStrength: rel.relationship_strength,
            metadata: {
                relationshipType: "reference",
                fieldType: rel.field_type,
                createdBy: rel.created_by,
                createdOn: rel.created_on,
            },
        }));

        return { nodes, edges };
    }

    // Get usage statistics for reference fields (if data available)
    async getReferenceFieldUsage(tableName: string, fieldName: string): Promise<number | null> {
        try {
            const response = await this.makeRequest<{stats: {count: number}}>(
                `/api/now/stats/${tableName}?sysparm_count=true&sysparm_query=${fieldName}ISNOTEMPTY`
            );
            
            return response.result?.stats?.count || 0;
        } catch (error) {
            return null;
        }
    }

    // Enhanced reference field analysis methods
    async analyzeReferenceFieldComplexity(relationships: ReferenceFieldRelationship[]): Promise<{
        highComplexityTables: string[];
        circularReferences: string[][];
        isolatedTables: string[];
        hubTables: string[];
    }> {
        const incomingCounts = new Map<string, number>();
        const outgoingCounts = new Map<string, number>();
        const allTables = new Set<string>();

        // Count relationships
        relationships.forEach(rel => {
            allTables.add(rel.source_table);
            allTables.add(rel.target_table);
            
            outgoingCounts.set(rel.source_table, (outgoingCounts.get(rel.source_table) || 0) + 1);
            incomingCounts.set(rel.target_table, (incomingCounts.get(rel.target_table) || 0) + 1);
        });

        // Identify high complexity tables (>10 references total)
        const highComplexityTables = Array.from(allTables).filter(table => {
            const totalRefs = (incomingCounts.get(table) || 0) + (outgoingCounts.get(table) || 0);
            return totalRefs > 10;
        });

        // Identify hub tables (>5 incoming references)
        const hubTables = Array.from(allTables).filter(table => 
            (incomingCounts.get(table) || 0) > 5
        );

        // Identify isolated tables (no references)
        const isolatedTables = Array.from(allTables).filter(table =>
            (incomingCounts.get(table) || 0) === 0 && (outgoingCounts.get(table) || 0) === 0
        );

        // Simple circular reference detection (direct cycles)
        const circularReferences: string[][] = [];
        const relationshipMap = new Map<string, string[]>();
        
        relationships.forEach(rel => {
            if (!relationshipMap.has(rel.source_table)) {
                relationshipMap.set(rel.source_table, []);
            }
            relationshipMap.get(rel.source_table)!.push(rel.target_table);
        });

        // Check for direct circular references
        relationships.forEach(rel => {
            const reverseRefs = relationshipMap.get(rel.target_table) || [];
            if (reverseRefs.includes(rel.source_table)) {
                const cycle = [rel.source_table, rel.target_table];
                if (!circularReferences.some(existing => 
                    existing.length === 2 && existing.includes(cycle[0]) && existing.includes(cycle[1])
                )) {
                    circularReferences.push(cycle);
                }
            }
        });

        return {
            highComplexityTables,
            circularReferences,
            isolatedTables,
            hubTables,
        };
    }

    // Table Hierarchy Building
    async buildTableHierarchy(cmdbTables?: TableMetadata[]): Promise<TableHierarchy> {
        const tables = cmdbTables || await this.getCMDBTables();

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
                return 20;
            }

            // Cycle detection
            if (path.has(node.table.name)) {
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
        const createInteractiveTree = (node: TableNode): Record<string, unknown> => {
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

        return {
            root,
            nodeMap,
            relationshipMap,
        };
    }

    // Graph Data Generation
    async generateGraphData(includeReferences: boolean = true, cmdbTables?: TableMetadata[]): Promise<GraphData> {
        const tables = cmdbTables || await this.getCMDBTables();
        const [relationships, referenceFields] = await Promise.all([this.getCIRelationships(), includeReferences ? this.getReferenceFields() : Promise.resolve([])]);

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


    // Alternative: Batch query approach for extreme performance (if needed)
    // Use this for 1000+ tables or when single query becomes too slow
    private async getCMDBTablesBatch(): Promise<TableMetadata[]> {
        const fields = "sys_id,name,label,super_class,sys_created_by,sys_created_on,sys_updated_on,sys_updated_by";
        const batchSize = 2000;
        const allCmdbTables: TableMetadata[] = [];
        let currentGeneration: string[] = ['cmdb_ci', 'cmdb'];
        
        while (currentGeneration.length > 0) {
            // Build query for current generation
            const parentQuery = currentGeneration
                .map(parent => `super_class.name=${parent}`)
                .join('^OR');
            
            const response = await this.makeRequest<ServiceNowRecord>(
                `/api/now/table/sys_db_object?sysparm_query=${parentQuery}&sysparm_limit=${batchSize}&sysparm_fields=${fields}&sysparm_display_value=all`
            );
            
            const generationTables = response.result.map(r => this.mapToTableMetadata(r));
            
            if (generationTables.length === 0) break;
            
            allCmdbTables.push(...generationTables);
            currentGeneration = generationTables.map(t => t.name);
        }
        
        return allCmdbTables;
    }

    // Generation depth analysis and logging
    private logMaxGenerationDepth(tables: TableMetadata[]): void {
        const tableMap = new Map<string, TableMetadata>();
        const sysIdMap = new Map<string, TableMetadata>();

        // Build lookup maps
        tables.forEach(table => {
            tableMap.set(table.name, table);
            sysIdMap.set(table.sys_id, table);
        });

        let maxDepth = 0;
        let deepestTable = '';
        const depthDistribution = new Map<number, number>();

        // Calculate depth for each table
        const calculateDepth = (table: TableMetadata, visited = new Set<string>()): number => {
            if (visited.has(table.sys_id)) return 0; // Cycle detected
            visited.add(table.sys_id);

            // Root tables
            if (table.name === 'cmdb_ci' || table.name === 'cmdb') {
                return 0;
            }

            if (!table.super_class) return 0;

            // Find parent
            let parent = sysIdMap.get(table.super_class);
            if (!parent) {
                parent = tableMap.get(table.super_class);
            }

            if (!parent) return 0;

            const parentDepth = calculateDepth(parent, new Set(visited));
            return parentDepth + 1;
        };

        tables.forEach(table => {
            const depth = calculateDepth(table);
            
            if (depth > maxDepth) {
                maxDepth = depth;
                deepestTable = table.name;
            }

            // Track depth distribution
            depthDistribution.set(depth, (depthDistribution.get(depth) || 0) + 1);
        });

    }

    // Utility Methods
    private buildCMDBInheritanceQuery(context: 'sys_db_object' | 'sys_dictionary' = 'sys_db_object'): string {
        if (context === 'sys_db_object') {
            // For sys_db_object table queries
            const generationQueries = ['name=cmdb_ci'];
            for (const i of Array.from({length: 8}, (_, k) => k + 1)) {
                const depth = 'super_class.'.repeat(i);
                generationQueries.push(`${depth}name=cmdb_ci`);
            }
            return generationQueries.join('^OR');
        } else {
            // For sys_dictionary table queries - need to join with sys_db_object
            const generationQueries = ['table.name=cmdb_ci'];
            for (const i of Array.from({length: 8}, (_, k) => k + 1)) {
                const depth = 'super_class.'.repeat(i);
                generationQueries.push(`table.${depth}name=cmdb_ci`);
            }
            return generationQueries.join('^OR');
        }
    }

    private mapToTableMetadata(record: ServiceNowRecord): TableMetadata {
        // Helper function to extract value from ServiceNow response objects
        const getValue = (field: unknown): string | null => {
            if (!field) return null;
            if (typeof field === "string") return field;
            if (typeof field === "object" && field !== null) {
                const obj = field as Record<string, unknown>;
                return (obj.display_value as string) || (obj.value as string) || null;
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
            table_type: this.determineTableType({ name, sys_created_by } as ServiceNowRecord),
            extends_hierarchy: [], // Will be populated by hierarchy building
        };
    }

    private mapToFieldMetadata(record: ServiceNowRecord): FieldMetadata {
        // Helper function to extract value from ServiceNow response objects
        const getValue = (field: unknown): string | null => {
            if (!field) return null;
            if (typeof field === "string") return field;
            if (typeof field === "object" && field !== null) {
                const obj = field as Record<string, unknown>;
                return (obj.display_value as string) || (obj.value as string) || null;
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
        const systemUsers = ["system", "admin", "ServiceNow", "maint", "glideapp"];
        
        // First check: naming pattern (most reliable indicator)
        if (customPrefixes.some((prefix) => table.name?.startsWith(prefix))) {
            return true;
        }
        
        // If table name clearly indicates it's a base ServiceNow table, not custom
        const baseTablePatterns = [
            /^cmdb_/, /^sys_/, /^task/, /^incident/, /^problem/, /^change_/, 
            /^sc_/, /^kb_/, /^hr_/, /^alm_/, /^ast_/, /^core_/, /^cmn_/
        ];
        
        if (baseTablePatterns.some(pattern => pattern.test(table.name || ''))) {
            return false;
        }

        // Check creation metadata - but be more conservative
        // Only consider truly custom if created by non-system user AND has custom prefix
        if (table.sys_created_by && 
            !systemUsers.includes(table.sys_created_by) &&
            table.name?.match(/^(u_|x_|custom_)/)) {
            return true;
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

        if (this.isCustomTable(record as Partial<TableMetadata>)) {
            return "custom";
        }

        return "extended";
    }

    // Helper method to calculate relationship strength for graph layout
    private calculateRelationshipStrength(field: FieldMetadata): number {
        let strength = 0.5; // Base strength for reference fields
        
        // Mandatory fields have stronger relationships
        if (field.mandatory) {
            strength += 0.3;
        }
        
        // Custom fields are considered less critical for layout
        if (field.is_custom) {
            strength -= 0.2;
        }
        
        // System/core tables have stronger relationships
        const coreTablePatterns = [/^cmdb_ci/, /^sys_/, /^core_/, /^cmn_/];
        if (coreTablePatterns.some(pattern => pattern.test(field.table))) {
            strength += 0.2;
        }
        
        // Normalize to 0-1 range
        return Math.max(0.1, Math.min(1.0, strength));
    }

    // Record count methods
    async getRecordCount(tableName: string): Promise<number> {
        const response = await this.makeRequest<{stats: {count: number}}>(`/api/now/stats/${tableName}?sysparm_count=true`);

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
