import { ConnectionTest } from './components/ConnectionTest';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-foreground">ServiceNow Audit App</h1>
          <p className="text-muted-foreground mt-1">Connection testing and audit management</p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <ConnectionTest />
      </main>
    </div>
  );
}

export default App;