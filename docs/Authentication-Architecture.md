# Authentication Architecture - ServiceNow CMDB Audit App

## Overview

The ServiceNow CMDB Audit App implements a dual authentication system that automatically adapts based on the deployment environment:

- **Development Mode**: Basic Authentication using credentials from `.env` file
- **Production Mode**: ServiceNow session token authentication using `window.g_ck` or token endpoint

## Architecture Components

### Environment Detection

The application automatically detects the runtime environment using multiple indicators in this priority order:

```typescript
function detectEnvironment(): Environment {
  // 1. Vite dev mode check (highest priority)
  if (import.meta.env.DEV) return "development";
  
  // 2. ServiceNow environment detection (for built apps in ServiceNow)
  if (window.g_ck || window.NOW || window.g_user) return "production";
  if (hostname.includes("service-now.com")) return "production";
  
  // 3. Explicit environment variable override
  if (import.meta.env.VITE_ENV_MODE) return import.meta.env.VITE_ENV_MODE;
  
  // 4. Default to development for safety
  return "development";
}
```

**Key Behavior:**
- **`npm run dev`** → Always "development" mode
- **Built app in ServiceNow** → "production" mode (detects ServiceNow globals/domain)  
- **Built app elsewhere** → "development" mode (safe fallback)
- **Override available** → `VITE_ENV_MODE="production"` forces production mode

### Authentication Modes

#### Development Mode (`npm run dev`)

**Configuration:**
- Uses basic authentication with HTTP headers
- Credentials loaded from `.env` file
- Makes full HTTP requests to ServiceNow instance

**Environment Variables Required:**
```bash
VITE_APP_USER="your-username"
VITE_APP_PASSWORD="your-password" 
VITE_INSTANCE_URL="https://your-instance.service-now.com/"
```

**Request Headers:**
```javascript
{
  'Authorization': 'Basic ' + btoa(username + ':' + password),
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

#### Production Mode (`npm run build`)

**Configuration:**
- Uses ServiceNow session token authentication
- Leverages `window.g_ck` global variable when available
- Falls back to custom token endpoint if needed
- Makes relative URL requests within ServiceNow

**Primary Token Source - ServiceNow g_ck Global:**
```javascript
// Automatically uses window.g_ck if available
const token = window.g_ck;
```

**Fallback Token Endpoint:**
```javascript
// Custom scoped app endpoint for token retrieval
GET /api/x_snc_cmdb_audit/app/get-token
```

**Request Headers:**
```javascript
{
  'X-UserToken': sessionToken,
  'X-Requested-With': 'XMLHttpRequest',
  'Content-Type': 'application/json'
}
```

## Implementation Details

### Authentication Service

The `AuthService` class handles authentication configuration and request management:

```typescript
class AuthService {
  async getAuthConfig(): Promise<AuthConfig> {
    if (isProduction()) {
      // Use session token authentication
      const token = await getSessionToken();
      return {
        headers: {
          'X-UserToken': token,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        },
        baseUrl: '', // Relative URLs
        isSessionAuth: true
      };
    } else {
      // Use basic authentication from .env
      const credentials = btoa(`${username}:${password}`);
      return {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        baseUrl: instanceUrl, // Full URLs
        isSessionAuth: false
      };
    }
  }
}
```

### Token Manager

The `TokenManager` handles session token lifecycle in production mode:

```typescript
class TokenManager {
  async getToken(): Promise<string> {
    // 1. Check for valid cached token
    if (this.isTokenValid()) return this.cachedToken.token;
    
    // 2. Try ServiceNow g_ck global
    if (window.g_ck) return window.g_ck;
    
    // 3. Fetch from token endpoint
    return await this.fetchTokenFromEndpoint();
  }
  
  private async fetchTokenFromEndpoint(): Promise<string> {
    const response = await fetch('/api/x_snc_cmdb_audit/app/get-token', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    const data = await response.json();
    return data.result?.token || data.token;
  }
}
```

### Request Flow

#### Development Mode Flow
1. Application starts with `npm run dev`
2. Environment detected as "development"
3. Credentials loaded from `.env` file
4. API requests use basic auth to full ServiceNow URLs
5. CORS handled by development server configuration

#### Production Mode Flow
1. Application deployed to ServiceNow platform
2. Environment detected as "production" via ServiceNow globals
3. Session token retrieved from `window.g_ck`
4. API requests use session token with relative URLs
5. ServiceNow handles authentication and CORS internally

## Security Considerations

### Development Mode Security
- Credentials stored in `.env` file (not committed to version control)
- Basic auth only used over HTTPS
- Development server configuration handles CORS
- Credentials encrypted in memory during session

### Production Mode Security
- No credential storage - uses ServiceNow session
- Leverages ServiceNow's built-in security model
- Session token automatically managed by ServiceNow
- Respects ServiceNow ACLs and role-based permissions

### Error Handling

```typescript
interface AuthError {
  code: 'TOKEN_EXPIRED' | 'TOKEN_FETCH_FAILED' | 'AUTH_FAILED' | 'NETWORK_ERROR';
  message: string;
  originalError?: Error;
}

// Automatic retry logic for token refresh
async makeAuthenticatedRequest(endpoint: string, retryCount = 0): Promise<Response> {
  try {
    const response = await fetch(url, requestOptions);
    
    if (response.status === 401 && retryCount < maxRetries) {
      // Refresh token and retry
      await refreshSessionToken();
      return this.makeAuthenticatedRequest(endpoint, retryCount + 1);
    }
    
    return response;
  } catch (error) {
    throw this.createAuthError('NETWORK_ERROR', 'Network error occurred', error);
  }
}
```

## User Experience

### Connection Test Component

The application provides clear feedback about the authentication mode:

- **Development Mode Display:**
  - Shows "Development (Basic Auth)" badge
  - Displays configured instance URL
  - Indicates credential configuration status
  - Provides debug information panel

- **Production Mode Display:**
  - Shows "Production (Session)" badge
  - Indicates automatic session handling
  - No manual credential input required

### Environment Transparency

Users can see exactly which authentication method is being used:

```typescript
const getModeBadge = () => {
  if (authStatus.isSessionAuth) {
    return <Badge variant="default">Production (Session)</Badge>;
  } else {
    return <Badge variant="secondary">Development (Basic Auth)</Badge>;
  }
};
```

## Deployment Considerations

### Development Setup
1. Create `.env` file with ServiceNow credentials
2. Start development server with `npm run dev`
3. Application automatically uses basic authentication
4. Test connection validates credentials

### Production Deployment
1. Build application with `npm run build`
2. Deploy to ServiceNow as scoped application
3. Application automatically detects ServiceNow environment
4. Uses session-based authentication seamlessly

### Migration Path
- Same codebase works in both environments
- No code changes needed between development and production
- Environment detection handles authentication mode automatically
- Consistent API interface regardless of authentication method

This architecture provides a seamless development experience while ensuring secure, production-ready authentication when deployed to ServiceNow.