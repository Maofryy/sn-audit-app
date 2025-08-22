import { useState, useEffect } from 'react';
import { ConnectionStatus } from '../types';
import { serviceNowService } from '../services/serviceNowService';
import { getAuthStatus, isDevelopmentMode } from '../services/authService';
import { getEnvironmentInfo } from '../utils/environment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Loader2, Wifi, Settings, Info } from 'lucide-react';

export function ConnectionTest() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    testing: false
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    responseTime?: number;
    mode?: string;
  } | null>(null);

  const [authStatus, setAuthStatus] = useState(getAuthStatus());
  const [environmentInfo, setEnvironmentInfo] = useState(getEnvironmentInfo());

  useEffect(() => {
    // Update auth status and environment info on component mount
    setAuthStatus(getAuthStatus());
    setEnvironmentInfo(getEnvironmentInfo());
  }, []);

  const testConnection = async () => {
    setStatus({ connected: false, testing: true });
    setTestResult(null);

    try {
      const result = await serviceNowService.testConnection();
      setTestResult(result);
      setStatus({
        connected: result.success,
        testing: false,
        error: result.error,
        lastTested: new Date()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTestResult({ success: false, error: errorMessage });
      setStatus({
        connected: false,
        testing: false,
        error: errorMessage,
        lastTested: new Date()
      });
    }
  };

  const getStatusBadge = () => {
    if (status.testing) {
      return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Testing...</Badge>;
    }
    if (status.connected) {
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Connected</Badge>;
    }
    if (status.error) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Wifi className="h-3 w-3" /> Not tested</Badge>;
  };

  const getModeBadge = () => {
    if (authStatus.isSessionAuth) {
      return <Badge variant="default" className="gap-1"><Settings className="h-3 w-3" /> Production (Session)</Badge>;
    } else {
      return <Badge variant="secondary" className="gap-1"><Settings className="h-3 w-3" /> Development (Basic Auth)</Badge>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            ServiceNow Connection Test
          </CardTitle>
          <CardDescription>
            Test your ServiceNow connection. Authentication method is automatically determined based on the environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Mode Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Authentication Mode</h4>
              {getModeBadge()}
            </div>
            <div className="text-sm text-muted-foreground">
              {authStatus.isSessionAuth ? (
                <div>
                  <p>🔒 <strong>Production Mode:</strong> Using ServiceNow session token (g_ck) for authentication.</p>
                  <p className="mt-1">• Credentials are handled automatically via ServiceNow session</p>
                  <p>• No manual credential input required</p>
                </div>
              ) : (
                <div>
                  <p>🔧 <strong>Development Mode:</strong> Using basic authentication from environment variables.</p>
                  <p className="mt-1">• Credentials loaded from .env file</p>
                  <p>• Target instance: {environmentInfo.baseUrl || 'Not configured'}</p>
                  {environmentInfo.hasCredentials ? (
                    <p className="text-green-600">• ✓ Credentials configured</p>
                  ) : (
                    <p className="text-red-600">• ⚠ Credentials missing in .env file</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              Status: {getStatusBadge()}
            </div>
            <Button 
              onClick={testConnection}
              disabled={status.testing || (!authStatus.ready && !environmentInfo.hasCredentials)}
              className="min-w-[120px]"
            >
              {status.testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
          </div>

          {testResult && (
            <Card className={`mt-4 ${testResult.success ? 'border-green-200' : 'border-red-200'}`}>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                    </span>
                    {testResult.mode && (
                      <Badge variant="outline" className="ml-2">
                        {testResult.mode}
                      </Badge>
                    )}
                  </div>
                  
                  {testResult.error && (
                    <p className="text-sm text-red-600 ml-6">{testResult.error}</p>
                  )}
                  
                  {testResult.responseTime && (
                    <p className="text-sm text-muted-foreground ml-6">
                      Response time: {testResult.responseTime}ms
                    </p>
                  )}
                  
                  {testResult.success && (
                    <div className="ml-6 text-sm space-y-1">
                      <p className="text-green-600">
                        ✓ Successfully connected to ServiceNow instance using {testResult.mode} mode.
                      </p>
                      <p className="text-green-600">
                        ✓ The CMDB audit app is ready to analyze your ServiceNow configuration.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {status.lastTested && (
            <p className="text-xs text-muted-foreground text-center">
              Last tested: {status.lastTested.toLocaleString()}
            </p>
          )}

          {/* Environment Debug Info (Development Mode Only) */}
          {isDevelopmentMode() && (
            <details className="mt-4">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                <Info className="inline h-3 w-3 mr-1" />
                Debug Information (Development Mode)
              </summary>
              <div className="mt-2 p-3 bg-muted rounded text-xs space-y-1">
                <p><strong>Mode:</strong> {environmentInfo.mode}</p>
                <p><strong>Base URL:</strong> {environmentInfo.baseUrl}</p>
                <p><strong>Use Session Auth:</strong> {environmentInfo.useSessionAuth ? 'Yes' : 'No'}</p>
                <p><strong>Has ServiceNow Globals:</strong> {environmentInfo.hasServiceNowGlobals ? 'Yes' : 'No'}</p>
                <p><strong>Hostname:</strong> {environmentInfo.hostname}</p>
                <p><strong>Has Credentials:</strong> {environmentInfo.hasCredentials ? 'Yes' : 'No'}</p>
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}