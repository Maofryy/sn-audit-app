# ServiceNow CMDB Architecture Research

## Overview

This document contains comprehensive research on ServiceNow Configuration Management Database (CMDB) architecture, table inheritance patterns, and relationship structures.

## Core CMDB Tables

### sys_db_object - The Foundation
- **Purpose**: Contains metadata for every table in the ServiceNow database
- **Key Fields**:
  - `name`: Database table name
  - `label`: Human-readable table name
  - `super_class`: Parent table (inheritance relationship)
  - `sys_created_on`: Table creation timestamp
- **Access**: Navigate to `sys_db_object.list` or `https://instance.service-now.com/sys_db_object_list.do`

### CMDB Base Tables Hierarchy

```
cmdb (Base Configuration Item)
└── cmdb_ci (Configuration Item) - Parent for all CI tables
    ├── cmdb_ci_hardware (Hardware)
    │   └── cmdb_ci_computer (Computer)
    │       ├── cmdb_ci_server (Server)
    │       │   ├── cmdb_ci_win_server (Windows Server)
    │       │   └── cmdb_ci_linux_server (Linux Server)
    │       └── cmdb_ci_workstation (Workstation)
    ├── cmdb_ci_software (Software)
    ├── cmdb_ci_service (Service)
    └── cmdb_ci_network_gear (Network Equipment)
```

### Table Inheritance Mechanism

**Key Principles**:
1. **Inheritance**: Child tables inherit all fields from parent tables
2. **Data Storage**: Records exist in both child and parent tables simultaneously
3. **Field Access**: Parent table fields accessible from child table queries
4. **Specialization**: Child tables add specific fields while maintaining parent structure

**Example**: A Windows Server record:
- Stored in `cmdb_ci_win_server` (specific fields)
- Also exists in `cmdb_ci_server` (server fields)
- Also exists in `cmdb_ci_computer` (computer fields)
- Also exists in `cmdb_ci_hardware` (hardware fields)
- Also exists in `cmdb_ci` (base CI fields)

## CMDB Relationships

### cmdb_rel_ci Table - Relationship Storage
- **Purpose**: Stores all relationships between Configuration Items
- **Structure**: Parent/Child format with relationship types
- **Key Fields**:
  - `parent`: Reference to parent CI
  - `child`: Reference to child CI
  - `type`: Relationship type (e.g., "Runs on", "Contains", "Depends on")
- **Access**: Navigate to `cmdb_rel_ci.list`

### Relationship Types
- **Dependent Relationships**: Used by Identification and Reconciliation Engine (IRE)
  - Example: "Tomcat Runs On Hardware"
- **Non-dependent Relationships**: Informational only, can be deleted without affecting CI identification

### Reference Fields vs. cmdb_rel_ci
- **Reference Fields**: Direct field references to other tables (stored in table schema)
- **cmdb_rel_ci**: Explicit relationship records for CI-to-CI connections
- **Both contribute to the complete relationship map**

## Customization Identification

### Identifying Custom Tables
**Query Strategy**:
```sql
-- Custom CMDB tables (extending cmdb_ci hierarchy)
SELECT name, label, super_class, sys_created_on, sys_created_by
FROM sys_db_object 
WHERE super_class LIKE 'cmdb%' 
AND name NOT IN (out_of_box_table_list)
```

**Out-of-box vs Custom Indicators**:
- Table naming patterns (custom tables often have prefixes like `u_`, `x_`)
- Creation date (post-implementation dates indicate customization)
- Creator (non-system users indicate custom development)

### Identifying Custom Fields
**Query Strategy**:
```sql
-- Custom fields in CMDB tables
SELECT element, column_label, table, type, sys_created_on
FROM sys_dictionary 
WHERE table LIKE 'cmdb%'
AND element NOT IN (out_of_box_fields_list)
```

**Custom Field Indicators**:
- Field naming patterns (custom fields often prefixed with `u_`, `x_`)
- Creation metadata
- Field types not standard for the table class

## Data Dictionary Structure

### sys_dictionary Table
- **Purpose**: Defines all fields across all tables
- **Key for Customization**: Contains creation metadata for field-level auditing
- **Fields of Interest**:
  - `table`: Table name
  - `element`: Field name
  - `column_label`: Field display name
  - `type`: Field data type
  - `sys_created_on`: Field creation date

## Performance Considerations

### Query Optimization
- **Large Datasets**: CMDB can contain millions of records
- **Inheritance Queries**: Querying parent tables returns child records
- **Relationship Traversal**: Complex relationships require optimized queries
- **API Rate Limits**: ServiceNow enforces API throttling

### Recommended Approaches
1. **Batch Processing**: Request data in manageable chunks
2. **Caching**: Cache table structure and relationship metadata
3. **Progressive Loading**: Load basic structure first, details on demand
4. **Index Utilization**: Use indexed fields for filtering (sys_id, name, etc.)

## API Access Patterns

### Table Structure Discovery
```javascript
// Get all CMDB tables
GET /api/now/table/sys_db_object?sysparm_query=super_classLIKEcmdb

// Get table hierarchy
GET /api/now/table/sys_db_object?sysparm_query=name=cmdb_ci_server&sysparm_display_value=true
```

### Relationship Discovery
```javascript
// Get relationships for a CI
GET /api/now/table/cmdb_rel_ci?sysparm_query=parent={ci_sys_id}

// Get all relationship types
GET /api/now/table/cmdb_rel_type
```

### Field Metadata
```javascript
// Get table schema
GET /api/now/table/sys_dictionary?sysparm_query=table=cmdb_ci_server

// Get custom fields
GET /api/now/table/sys_dictionary?sysparm_query=table=cmdb_ci_server^sys_created_on>2023-01-01
```

## Integration Challenges

### Authentication
- Basic Auth for development/testing
- OAuth for production integrations
- Session-based auth for embedded solutions

### Data Volume
- Enterprise CMDB can have 100K+ CIs
- Relationship graphs can be highly complex
- Real-time updates vs. periodic synchronization

### Schema Variations
- Different ServiceNow versions have schema differences
- Customer customizations create unique schemas
- Plugin installations modify base schema

## Best Practices

### Development
1. **Schema First**: Always query table structure before data
2. **Error Handling**: Implement robust error handling for API failures
3. **Caching Strategy**: Cache metadata aggressively, data conservatively
4. **Progressive Enhancement**: Build features incrementally

### User Experience
1. **Loading States**: Show progress for long-running operations
2. **Data Visualization**: Use appropriate chart types for different data
3. **Search and Filter**: Provide multiple ways to navigate large datasets
4. **Export Capabilities**: Allow users to export audit results

This research forms the foundation for implementing the CMDB audit application's core functionality.