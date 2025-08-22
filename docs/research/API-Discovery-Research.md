# ServiceNow API Discovery Research

## Overview

This document outlines comprehensive research on ServiceNow APIs, authentication methods, rate limiting, and integration patterns for the CMDB Audit application.

## ServiceNow REST API Structure

### Base API Endpoints

```
Base URL: https://{instance}.service-now.com
Table API: /api/now/table/{table_name}
Aggregate API: /api/now/stats/{table_name}
Attachment API: /api/now/attachment
Import Set API: /api/now/import/{import_table}
```

### Core CMDB APIs

#### Table Structure Discovery
```javascript
// Get all database tables
GET /api/now/table/sys_db_object

// Get CMDB-specific tables
GET /api/now/table/sys_db_object?sysparm_query=super_classLIKEcmdb

// Get table inheritance chain
GET /api/now/table/sys_db_object?sysparm_query=name={table_name}&sysparm_display_value=true
```

#### Field Metadata Discovery
```javascript
// Get all fields for a table
GET /api/now/table/sys_dictionary?sysparm_query=table={table_name}

// Get custom fields (created after implementation)
GET /api/now/table/sys_dictionary?sysparm_query=table={table_name}^sys_created_on>{date}

// Get field with specific properties
GET /api/now/table/sys_dictionary?sysparm_query=table={table_name}^elementSTARTSWITHu_
```

#### CI Relationship Discovery
```javascript
// Get relationships for a specific CI
GET /api/now/table/cmdb_rel_ci?sysparm_query=parent={ci_sys_id}
GET /api/now/table/cmdb_rel_ci?sysparm_query=child={ci_sys_id}

// Get all relationship types
GET /api/now/table/cmdb_rel_type

// Get relationships between specific CI types
GET /api/now/table/cmdb_rel_ci?sysparm_query=parent.sys_class_name={class_name}
```

#### CMDB Data Access
```javascript
// Get CIs from base table (includes all child types)
GET /api/now/table/cmdb_ci?sysparm_limit=100

// Get specific CI type
GET /api/now/table/cmdb_ci_server?sysparm_limit=100

// Get CI with related data
GET /api/now/table/cmdb_ci/{sys_id}?sysparm_display_value=true&sysparm_exclude_reference_link=true
```

## Authentication Methods

### Basic Authentication (Development)
```javascript
const credentials = btoa(`${username}:${password}`);
headers: {
  'Authorization': `Basic ${credentials}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

### OAuth 2.0 (Production)
```javascript
// Token endpoint
POST /oauth_token.do

// Request headers with token
headers: {
  'Authorization': `Bearer ${access_token}`,
  'Content-Type': 'application/json'
}
```

### Session-based (Embedded Apps)
```javascript
// Use session token for embedded applications
headers: {
  'X-UserToken': session_token,
  'X-Requested-With': 'XMLHttpRequest'
}
```

## Query Parameters

### Essential Parameters
- `sysparm_query`: Encoded query string for filtering
- `sysparm_limit`: Maximum number of records (default: 10,000)
- `sysparm_offset`: Starting record for pagination
- `sysparm_display_value`: Return display values instead of sys_ids
- `sysparm_fields`: Comma-separated list of fields to return
- `sysparm_exclude_reference_link`: Exclude reference links from response

### Advanced Parameters
- `sysparm_view`: Use predefined view for field selection
- `sysparm_suppress_pagination_header`: Remove pagination info from response
- `sysparm_no_count`: Skip total count calculation for better performance

## Rate Limiting and Performance

### API Rate Limits
- **Default Limits**: 5,000 requests per hour per user
- **Burst Limits**: 100 requests per minute
- **Administrative Limits**: Can be configured per instance
- **Enforcement**: HTTP 429 status code when exceeded

### Performance Optimization

#### Batch Requests
```javascript
// Use sysparm_limit for larger batches
GET /api/now/table/cmdb_ci?sysparm_limit=1000

// Implement pagination for large datasets
function* paginateAPI(endpoint, batchSize = 1000) {
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(`${endpoint}?sysparm_limit=${batchSize}&sysparm_offset=${offset}`);
    const data = await response.json();
    
    yield data.result;
    
    hasMore = data.result.length === batchSize;
    offset += batchSize;
  }
}
```

#### Selective Field Loading
```javascript
// Only request needed fields
GET /api/now/table/cmdb_ci?sysparm_fields=sys_id,name,sys_class_name,install_status

// Use display values when needed
GET /api/now/table/cmdb_ci?sysparm_display_value=install_status,operational_status
```

#### Caching Strategy
```javascript
// Cache table structure (changes infrequently)
const tableStructureCache = new Map();

// Cache CI data with TTL
const ciDataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

## Error Handling

### Common HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid query syntax)
- `401`: Unauthorized (authentication failed)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (table/record doesn't exist)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

### Error Response Format
```json
{
  "error": {
    "message": "Invalid table name",
    "detail": "Table 'invalid_table' does not exist"
  },
  "status": "failure"
}
```

### Retry Logic Implementation
```javascript
async function apiRequestWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Network error - linear backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Security Considerations

### Data Protection
- **Credentials**: Never log or expose authentication credentials
- **HTTPS Only**: Always use HTTPS for API communications
- **Token Storage**: Securely store and handle access tokens
- **Cross-Origin**: Configure CORS properly for web applications

### Permission Requirements
- **Table Access**: Requires `read` permission on target tables
- **Field Visibility**: Respects field-level security settings
- **Row-level Security**: Honors ACL rules for record access

## Advanced Integration Patterns

### Real-time Updates
```javascript
// Poll for changes using sys_updated_on
const lastSync = localStorage.getItem('lastSyncTime');
GET /api/now/table/cmdb_ci?sysparm_query=sys_updated_on>${lastSync}
```

### Bulk Data Export
```javascript
// Export large datasets efficiently
async function exportCMDBData() {
  const tables = await getCMDBTables();
  
  for (const table of tables) {
    const generator = paginateAPI(`/api/now/table/${table.name}`);
    
    for await (const batch of generator) {
      await processBatch(batch);
    }
  }
}
```

### Delta Synchronization
```javascript
// Track changes for incremental updates
class CMDBSyncManager {
  async syncChanges() {
    const lastSync = this.getLastSyncTime();
    const changes = await this.getChangedRecords(lastSync);
    
    await this.processChanges(changes);
    this.updateLastSyncTime();
  }
  
  async getChangedRecords(since) {
    return await apiRequest(
      `/api/now/table/cmdb_ci?sysparm_query=sys_updated_on>=${since}`
    );
  }
}
```

## Integration Testing

### Test Data Requirements
- Test instance with representative CMDB data
- Known custom tables and fields for validation
- Various relationship types and hierarchies

### Automated Testing Patterns
```javascript
describe('ServiceNow API Integration', () => {
  test('should fetch CMDB table structure', async () => {
    const tables = await serviceNowService.getCMDBTables();
    expect(tables).toContain(expect.objectContaining({
      name: 'cmdb_ci',
      label: 'Configuration Item'
    }));
  });
  
  test('should identify custom tables', async () => {
    const customTables = await auditService.getCustomTables();
    expect(customTables.every(table => 
      table.name.startsWith('u_') || table.name.startsWith('x_')
    )).toBe(true);
  });
});
```

## Best Practices Summary

1. **Authentication**: Use appropriate auth method for deployment context
2. **Rate Limiting**: Implement exponential backoff for 429 errors
3. **Pagination**: Always paginate large datasets
4. **Caching**: Cache structure data, refresh CI data periodically
5. **Error Handling**: Comprehensive error handling with retry logic
6. **Performance**: Use field selection and batch processing
7. **Security**: Protect credentials and respect ServiceNow security model
8. **Testing**: Automated tests for API integration reliability

This API research provides the foundation for robust ServiceNow integration in the CMDB audit application.