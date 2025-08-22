import { useState } from 'react';
import { ServiceNowInstance, ConnectionStatus } from '../types';
import { serviceNowService } from '../services/serviceNowService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Loader2, Wifi } from 'lucide-react';

export function ConnectionTest() {
  const [instance, setInstance] = useState<ServiceNowInstance>({
    url: '',
    username: '',
    password: '',
    name: 'Test Instance'
  });

  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    testing: false
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    responseTime?: number;
  } | null>(null);

  const handleInputChange = (field: keyof ServiceNowInstance, value: string) => {
    setInstance(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const testConnection = async () => {
    if (!instance.url || !instance.username || !instance.password) {
      setTestResult({ success: false, error: 'Please fill in all fields' });
      return;
    }

    setStatus({ connected: false, testing: true });
    setTestResult(null);

    try {
      const result = await serviceNowService.testConnection(instance);
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

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            ServiceNow Connection Test
          </CardTitle>
          <CardDescription>
            Test your ServiceNow instance connection to ensure the audit app can connect properly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="url">ServiceNow URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://your-instance.service-now.com"
                value={instance.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                disabled={status.testing}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your.username"
                  value={instance.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  disabled={status.testing}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  value={instance.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={status.testing}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              Status: {getStatusBadge()}
            </div>
            <Button 
              onClick={testConnection}
              disabled={status.testing || !instance.url || !instance.username || !instance.password}
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
                    <p className="text-sm text-green-600 ml-6">
                      Successfully connected to ServiceNow instance. The audit app is ready to use.
                    </p>
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
        </CardContent>
      </Card>
    </div>
  );
}