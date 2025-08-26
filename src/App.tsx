import { ConnectionProvider, useConnection } from './contexts/ConnectionContext';
import { GraphProvider } from './contexts/GraphContext';
import { CMDBDataProvider } from './contexts/CMDBDataContext';
import { AppHeader } from './components/AppHeader';
import { GraphVisualizationDashboard } from './components/GraphVisualizationDashboard';
import { Loader2, AlertCircle, Wifi } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import './styles/custom-tables.css';

function AppContent() {
  const { state, testConnection } = useConnection();

  // Show loading state during initialization
  if (!state.isInitialized) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">Connecting to ServiceNow...</h3>
                <p className="text-muted-foreground">Testing connection and initializing application</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show connection error state
  if (!state.status.connected && state.status.error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md w-full">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Connection Failed</CardTitle>
                <CardDescription>
                  Unable to connect to ServiceNow instance
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  {state.status.error}
                </p>
                <Button 
                  onClick={testConnection}
                  disabled={state.status.testing}
                  className="w-full"
                >
                  {state.status.testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4 mr-2" />
                      Retry Connection
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  You can also click the connection status in the header to see more details.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Show main application when connected
  return (
    <CMDBDataProvider>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <GraphVisualizationDashboard isConnected={state.status.connected} />
        </main>
      </div>
    </CMDBDataProvider>
  );
}

function App() {
  return (
    <ConnectionProvider>
      <GraphProvider>
        <AppContent />
      </GraphProvider>
    </ConnectionProvider>
  );
}

export default App;