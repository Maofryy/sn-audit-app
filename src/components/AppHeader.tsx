import { useState } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { CheckCircle, XCircle, Loader2, Wifi, Settings, Info, AlertCircle } from 'lucide-react';
import { isDevelopmentMode } from '../services/authService';

export function AppHeader() {
  const { state, testConnection } = useConnection();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getStatusBadge = () => {
    if (state.status.testing) {
      return (
        <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setIsDialogOpen(true)}>
          <Loader2 className="h-3 w-3 animate-spin" /> Testing...
        </Badge>
      );
    }
    if (state.status.connected) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 cursor-pointer" onClick={() => setIsDialogOpen(true)}>
          <CheckCircle className="h-3 w-3" /> Connected
        </Badge>
      );
    }
    if (state.status.error) {
      return (
        <Badge variant="destructive" className="gap-1 cursor-pointer" onClick={() => setIsDialogOpen(true)}>
          <XCircle className="h-3 w-3" /> Connection Failed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => setIsDialogOpen(true)}>
        <Wifi className="h-3 w-3" /> Not Connected
      </Badge>
    );
  };

  const getModeBadge = () => {
    if (state.authStatus.isSessionAuth) {
      return <Badge variant="default" className="gap-1"><Settings className="h-3 w-3" /> Production</Badge>;
    } else {
      return <Badge variant="secondary" className="gap-1"><Settings className="h-3 w-3" /> Development</Badge>;
    }
  };

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">ServiceNow CMDB Audit App</h1>
              <p className="text-muted-foreground mt-1">
                CMDB structure visualization, audit management, and compliance reporting
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {getModeBadge()}
              {getStatusBadge()}
              {state.status.error && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testConnection}
                  disabled={state.status.testing}
                  className="gap-1"
                >
                  <Wifi className="h-3 w-3" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              ServiceNow Connection Status
            </DialogTitle>
            <DialogDescription>
              Connection details and authentication information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current Status */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Current Status</h4>
                {getStatusBadge()}
              </div>
              {state.status.lastTested && (
                <p className="text-xs text-muted-foreground">
                  Last tested: {state.status.lastTested.toLocaleString()}
                </p>
              )}
            </div>

            {/* Authentication Mode Info */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Authentication Mode</h4>
                {getModeBadge()}
              </div>
              <div className="text-sm text-muted-foreground">
                {state.authStatus.isSessionAuth ? (
                  <div>
                    <p>🔒 <strong>Production Mode:</strong> Using ServiceNow session token (g_ck) for authentication.</p>
                    <p className="mt-1">• Credentials are handled automatically via ServiceNow session</p>
                    <p>• No manual credential input required</p>
                  </div>
                ) : (
                  <div>
                    <p>🔧 <strong>Development Mode:</strong> Using basic authentication from environment variables.</p>
                    <p className="mt-1">• Credentials loaded from .env file</p>
                    <p>• Target instance: {state.environmentInfo.baseUrl || 'Not configured'}</p>
                    {state.environmentInfo.hasCredentials ? (
                      <p className="text-green-600">• ✓ Credentials configured</p>
                    ) : (
                      <p className="text-red-600">• ⚠ Credentials missing in .env file</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Connection Result */}
            {state.testResult && (
              <div className={`p-4 rounded-lg border ${state.testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {state.testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`font-medium ${state.testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {state.testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                    </span>
                    {state.testResult.mode && (
                      <Badge variant="outline" className="ml-2">
                        {state.testResult.mode}
                      </Badge>
                    )}
                  </div>
                  
                  {state.testResult.error && (
                    <p className="text-sm text-red-600 ml-6">{state.testResult.error}</p>
                  )}
                  
                  {state.testResult.responseTime && (
                    <p className="text-sm text-muted-foreground ml-6">
                      Response time: {state.testResult.responseTime}ms
                    </p>
                  )}
                  
                  {state.testResult.success && (
                    <div className="ml-6 text-sm space-y-1">
                      <p className="text-green-600">
                        ✓ Successfully connected to ServiceNow instance using {state.testResult.mode} mode.
                      </p>
                      <p className="text-green-600">
                        ✓ The CMDB audit app is ready to analyze your ServiceNow configuration.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Close
              </Button>
              <Button 
                onClick={testConnection}
                disabled={state.status.testing || (!state.authStatus.ready && !state.environmentInfo.hasCredentials)}
              >
                {state.status.testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>

            {/* Environment Debug Info (Development Mode Only) */}
            {isDevelopmentMode() && (
              <details className="mt-4">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  <Info className="inline h-3 w-3 mr-1" />
                  Debug Information (Development Mode)
                </summary>
                <div className="mt-2 p-3 bg-muted rounded text-xs space-y-1">
                  <p><strong>Mode:</strong> {state.environmentInfo.mode}</p>
                  <p><strong>Base URL:</strong> {state.environmentInfo.baseUrl}</p>
                  <p><strong>Use Session Auth:</strong> {state.environmentInfo.useSessionAuth ? 'Yes' : 'No'}</p>
                  <p><strong>Has ServiceNow Globals:</strong> {state.environmentInfo.hasServiceNowGlobals ? 'Yes' : 'No'}</p>
                  <p><strong>Hostname:</strong> {state.environmentInfo.hostname}</p>
                  <p><strong>Has Credentials:</strong> {state.environmentInfo.hasCredentials ? 'Yes' : 'No'}</p>
                </div>
              </details>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}