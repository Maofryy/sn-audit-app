import { useState } from 'react';
import { ConnectionTest } from './components/ConnectionTest';
import { GraphVisualizationDashboard } from './components/GraphVisualizationDashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('connection');

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    if (connected && activeTab === 'connection') {
      setActiveTab('visualization');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-foreground">ServiceNow CMDB Audit App</h1>
          <p className="text-muted-foreground mt-1">
            CMDB structure visualization, audit management, and compliance reporting
          </p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="connection">
              ServiceNow Connection
            </TabsTrigger>
            <TabsTrigger value="visualization" disabled={!isConnected}>
              CMDB Visualization
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <ConnectionTest onConnectionChange={handleConnectionChange} />
          </TabsContent>

          <TabsContent value="visualization">
            <GraphVisualizationDashboard isConnected={isConnected} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;