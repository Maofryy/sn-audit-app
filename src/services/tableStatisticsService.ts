import { TableStatistics, TableMetadata, FieldMetadata, TableListItem, TableListFilter, DataQualityMetrics, FieldUsageStats, DataConsistencyIssue, AuditKPI } from "../types";
import { makeAuthenticatedRequest } from "./authService";
import { serviceNowService } from "./serviceNowService";

// 🧪 TESTING CONFIGURATION
const TESTING_MODE = true; // Set to false to load all CMDB tables
const TEST_TABLES = ["cmdb_ci", "cmdb_ci_patches", "u_test_custom_cmdb_table"]; // Tables to test with

export class TableStatisticsService {
    private statisticsCache = new Map<string, { data: TableStatistics; timestamp: Date }>();
    private cacheTimeout = 300000; // 5 minutes cache for statistics

    /**
     * Get comprehensive statistics for all CMDB tables using Aggregate API
     */
    async getAllTableStatistics(): Promise<TableStatistics[]> {
        const cacheKey = "all-table-statistics";

        // Check cache first
        const cached = this.statisticsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
            return Array.isArray(cached.data) ? cached.data : [cached.data];
        }

        try {
            // Get CMDB tables
            const allCmdbTables = await serviceNowService.getCMDBTables();

            // Apply testing mode restrictions if enabled
            const cmdbTables = TESTING_MODE ? allCmdbTables.filter((table) => TEST_TABLES.includes(table.name)) : allCmdbTables;

            if (TESTING_MODE) {
                console.log(`🧪 TESTING MODE: Restricted to ${cmdbTables.length} tables:`, TEST_TABLES);
                console.log(
                    "📋 Found tables:",
                    cmdbTables.map((t) => t.name)
                );
            } else {
                console.log(`📊 Production mode: Loading ${cmdbTables.length} CMDB tables`);
            }

            // Get reference field statistics for CMDB tables in parallel
            const statisticsPromises = cmdbTables.map((table) => this.getTableStatistics(table.name));

            const allStatistics = await Promise.all(statisticsPromises);

            // Cache the results
            this.statisticsCache.set(cacheKey, {
                data: allStatistics as any,
                timestamp: new Date(),
            });

            return allStatistics;
        } catch (error) {
            console.error("Error fetching all table statistics:", error);
            throw new Error(`Failed to fetch table statistics: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Get statistics for a specific table using multiple ServiceNow APIs
     */
    async getTableStatistics(tableName: string): Promise<TableStatistics> {
        const cacheKey = `table-stats-${tableName}`;

        // Check cache first
        const cached = this.statisticsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
            return cached.data;
        }

        try {
            // Get table metadata
            const tableMetadata = await this.getTableMetadata(tableName);

            // Get reference statistics using parallel requests
            const [outgoingReferences, incomingReferences, recordCount] = await Promise.all([
                this.getOutgoingReferences(tableName),
                this.getIncomingReferences(tableName),
                this.getTableRecordCount(tableName),
            ]);

            // Calculate statistics
            const customOutgoing = outgoingReferences.filter((ref) => this.isCustomField(ref));
            const customIncoming = incomingReferences.filter((ref) => this.isCustomField(ref));
            const mandatoryReferences = outgoingReferences.filter((ref) => ref.mandatory);

            const statistics: TableStatistics = {
                table_name: tableName,
                table_label: tableMetadata?.label || tableName,
                total_references: outgoingReferences.length + incomingReferences.length,
                custom_references: customOutgoing.length + customIncoming.length,
                standard_references: outgoingReferences.length + incomingReferences.length - (customOutgoing.length + customIncoming.length),
                incoming_references: incomingReferences.length,
                outgoing_references: outgoingReferences.length,
                mandatory_references: mandatoryReferences.length,
                record_count: recordCount,
                last_updated: new Date().toISOString(),
            };

            // Cache the result
            this.statisticsCache.set(cacheKey, {
                data: statistics,
                timestamp: new Date(),
            });

            return statistics;
        } catch (error) {
            console.error(`Error fetching statistics for table ${tableName}:`, error);
            throw new Error(`Failed to fetch statistics for ${tableName}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Get basic field analysis for a specific table (simplified)
     */
    async getBasicFieldAnalysis(tableName: string): Promise<DataQualityMetrics> {
        try {
            // Get table fields - focus on dictionary structure only
            const fields = await serviceNowService.getTableSchema(tableName);
            const referenceFields = fields.filter((field) => field.type === "reference");

            console.log(`📋 Found ${fields.length} total fields, ${referenceFields.length} reference fields for ${tableName}`);

            // Simplified analysis - no record data fetching
            return {
                table_name: tableName,
                completeness_score: 100, // Placeholder - focus on structure not data
                reference_integrity_score: 100, // Placeholder
                field_usage_stats: [], // Skip usage stats for now
                null_value_percentages: {}, // Skip data analysis
                data_consistency_issues: [], // Skip consistency checks
                generated_at: new Date(),
            };
        } catch (error) {
            console.error(`Error getting field analysis for ${tableName}:`, error);
            throw new Error(`Failed to get field analysis: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Generate basic audit KPIs for a specific table (simplified)
     */
    async generateBasicKPIs(tableName: string, statistics: TableStatistics, fields: any[]): Promise<AuditKPI[]> {
        const kpis: AuditKPI[] = [];

        // Total Fields KPI
        kpis.push({
            id: `${tableName}_total_fields`,
            name: "Total Fields",
            value: fields.length,
            description: "Total number of fields in this table dictionary",
            status: fields.length > 50 ? "warning" : "good",
        });

        // Reference Fields KPI
        const referenceFields = fields.filter((f) => f.type === "reference");
        kpis.push({
            id: `${tableName}_reference_fields`,
            name: "Reference Fields",
            value: referenceFields.length,
            description: "Number of reference fields pointing to other tables",
            status: referenceFields.length > 15 ? "warning" : "good",
        });

        // Custom Fields KPI
        const customFields = fields.filter((f) => f.is_custom);
        const customRatio = fields.length > 0 ? (customFields.length / fields.length) * 100 : 0;
        kpis.push({
            id: `${tableName}_custom_fields`,
            name: "Custom Fields",
            value: customFields.length,
            unit: `(${Math.round(customRatio)}%)`,
            description: "Number and percentage of custom fields",
            status: customRatio > 40 ? "critical" : customRatio > 20 ? "warning" : "good",
        });

        // Mandatory Fields KPI
        const mandatoryFields = fields.filter((f) => f.mandatory);
        kpis.push({
            id: `${tableName}_mandatory_fields`,
            name: "Mandatory Fields",
            value: mandatoryFields.length,
            description: "Number of mandatory fields in table",
            status: mandatoryFields.length > 10 ? "warning" : "good",
        });

        return kpis;
    }

    /**
     * Get filtered and sorted table list for the main view
     */
    async getFilteredTableList(filters: TableListFilter = {}): Promise<TableListItem[]> {
        try {
            const allStatistics = await this.getAllTableStatistics();
            const cmdbTables = await serviceNowService.getCMDBTables();

            // Create table lookup for metadata
            const tableMap = new Map(cmdbTables.map((table) => [table.name, table]));

            // Build table list items
            let tableListItems: TableListItem[] = allStatistics
                .map((stats) => {
                    const table = tableMap.get(stats.table_name);
                    if (!table) return null;

                    return {
                        table,
                        statistics: stats,
                        audit_status: this.calculateAuditStatus(stats),
                        last_analyzed: new Date(stats.last_updated),
                        priority_score: this.calculatePriorityScore(stats, table),
                    };
                })
                .filter((item) => item !== null) as TableListItem[];

            // Apply filters
            if (filters.search_term) {
                const searchLower = filters.search_term.toLowerCase();
                tableListItems = tableListItems.filter((item) => item.table.name.toLowerCase().includes(searchLower) || item.table.label.toLowerCase().includes(searchLower));
            }

            if (filters.table_types?.length) {
                tableListItems = tableListItems.filter((item) => filters.table_types!.includes(item.table.table_type));
            }

            if (filters.audit_status?.length) {
                tableListItems = tableListItems.filter((item) => filters.audit_status!.includes(item.audit_status));
            }

            if (filters.custom_only) {
                tableListItems = tableListItems.filter((item) => item.table.is_custom);
            }

            if (filters.min_references !== undefined) {
                tableListItems = tableListItems.filter((item) => item.statistics.total_references >= filters.min_references!);
            }

            if (filters.max_references !== undefined) {
                tableListItems = tableListItems.filter((item) => item.statistics.total_references <= filters.max_references!);
            }

            if (filters.has_issues) {
                tableListItems = tableListItems.filter((item) => item.audit_status === "warning" || item.audit_status === "non_compliant");
            }

            return tableListItems;
        } catch (error) {
            console.error("Error getting filtered table list:", error);
            throw new Error(`Failed to get table list: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    // Private helper methods

    private async getTableMetadata(tableName: string): Promise<TableMetadata | null> {
        try {
            const response = await makeAuthenticatedRequest(`/api/now/table/sys_db_object?sysparm_query=name=${tableName}&sysparm_limit=1&sysparm_fields=sys_id,name,label`);

            if (!response.ok) return null;

            const data = await response.json();
            return data.result?.[0]
                ? {
                      sys_id: data.result[0].sys_id,
                      name: data.result[0].name,
                      label: data.result[0].label || data.result[0].name,
                      super_class: null,
                      sys_scope: "",
                      sys_created_on: "",
                      sys_created_by: "",
                      sys_updated_on: "",
                      sys_updated_by: "",
                      is_custom: false,
                      table_type: "extended",
                      extends_hierarchy: [],
                  }
                : null;
        } catch {
            return null;
        }
    }

    private async getOutgoingReferences(tableName: string): Promise<FieldMetadata[]> {
        const response = await makeAuthenticatedRequest(
            `/api/now/table/sys_dictionary?sysparm_query=name=${tableName}^internal_type=reference&sysparm_limit=1000&sysparm_fields=sys_id,element,column_label,mandatory,reference,sys_created_by`
        );

        if (!response.ok) return [];

        const data = await response.json();
        return (
            data.result?.map((record: any) => ({
                sys_id: record.sys_id,
                element: record.element,
                table: tableName,
                column_label: record.column_label || record.element,
                type: "reference",
                mandatory: record.mandatory === "true",
                sys_created_on: "",
                sys_created_by: record.sys_created_by || "",
                is_custom: this.isCustomFieldName(record.element),
                reference_table: record.reference,
            })) || []
        );
    }

    private async getIncomingReferences(tableName: string): Promise<FieldMetadata[]> {
        const response = await makeAuthenticatedRequest(
            `/api/now/table/sys_dictionary?sysparm_query=reference.name=${tableName}^internal_type=reference&sysparm_limit=1000&sysparm_fields=sys_id,element,table,column_label,mandatory,sys_created_by`
        );

        if (!response.ok) return [];

        const data = await response.json();
        return (
            data.result?.map((record: any) => ({
                sys_id: record.sys_id,
                element: record.element,
                table: record.table,
                column_label: record.column_label || record.element,
                type: "reference",
                mandatory: record.mandatory === "true",
                sys_created_on: "",
                sys_created_by: record.sys_created_by || "",
                is_custom: this.isCustomFieldName(record.element),
                reference_table: tableName,
            })) || []
        );
    }

    private async getTableRecordCount(tableName: string): Promise<number | undefined> {
        try {
            const response = await makeAuthenticatedRequest(`/api/now/stats/${tableName}?sysparm_count=true`);

            if (!response.ok) return undefined;

            const data = await response.json();
            return data.result?.stats?.count || 0;
        } catch {
            return undefined;
        }
    }

    private async getFieldUsageStats(tableName: string, fieldName: string): Promise<FieldUsageStats> {
        try {
            // Get total count
            const totalResponse = await makeAuthenticatedRequest(`/api/now/stats/${tableName}?sysparm_count=true`);

            let totalCount = 0;
            if (totalResponse.ok) {
                const totalData = await totalResponse.json();
                totalCount = totalData.result?.stats?.count || 0;
            }

            // Get populated count
            const populatedResponse = await makeAuthenticatedRequest(`/api/now/stats/${tableName}?sysparm_count=true&sysparm_query=${fieldName}ISNOTEMPTY`);

            let populatedCount = 0;
            if (populatedResponse.ok) {
                const populatedData = await populatedResponse.json();
                populatedCount = populatedData.result?.stats?.count || 0;
            }

            const nullCount = totalCount - populatedCount;
            const usagePercentage = totalCount > 0 ? (populatedCount / totalCount) * 100 : 0;

            return {
                field_name: fieldName,
                field_label: fieldName, // Will be enhanced with actual label if available
                usage_percentage: usagePercentage,
                null_count: nullCount,
                populated_count: populatedCount,
            };
        } catch (error) {
            // Return default stats if API calls fail
            return {
                field_name: fieldName,
                field_label: fieldName,
                usage_percentage: 0,
                null_count: 0,
                populated_count: 0,
            };
        }
    }

    private async getDataConsistencyIssues(tableName: string, referenceFields: FieldMetadata[]): Promise<DataConsistencyIssue[]> {
        const issues: DataConsistencyIssue[] = [];

        // For now, return basic analysis
        // In a full implementation, this would check for:
        // - Orphaned references (references to non-existent records)
        // - Missing required references
        // - Duplicate references where they shouldn't exist

        return issues;
    }

    private calculateCompletenessScore(fieldStats: FieldUsageStats[]): number {
        if (fieldStats.length === 0) return 100;

        const totalUsage = fieldStats.reduce((sum, stat) => sum + stat.usage_percentage, 0);
        return totalUsage / fieldStats.length;
    }

    private calculateReferenceIntegrityScore(issues: DataConsistencyIssue[]): number {
        // Base score is 100, deduct points for issues
        let score = 100;

        issues.forEach((issue) => {
            switch (issue.severity) {
                case "critical":
                    score -= 20;
                    break;
                case "high":
                    score -= 10;
                    break;
                case "medium":
                    score -= 5;
                    break;
                case "low":
                    score -= 1;
                    break;
            }
        });

        return Math.max(0, score);
    }

    private calculateAuditStatus(statistics: TableStatistics): "compliant" | "warning" | "non_compliant" {
        const customRatio = statistics.total_references > 0 ? (statistics.custom_references / statistics.total_references) * 100 : 0;

        if (customRatio > 50) return "non_compliant";
        if (customRatio > 25 || statistics.total_references > 20) return "warning";
        return "compliant";
    }

    private calculatePriorityScore(statistics: TableStatistics, table: TableMetadata): number {
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
    }

    private isCustomField(field: FieldMetadata): boolean {
        return field.is_custom || this.isCustomFieldName(field.element);
    }

    private isCustomFieldName(fieldName: string): boolean {
        const customPrefixes = ["u_", "x_", "custom_"];
        return customPrefixes.some((prefix) => fieldName.startsWith(prefix));
    }

    /**
     * Clear all cached statistics
     */
    clearCache(): void {
        this.statisticsCache.clear();
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.statisticsCache.size,
            keys: Array.from(this.statisticsCache.keys()),
        };
    }
}

export const tableStatisticsService = new TableStatisticsService();
