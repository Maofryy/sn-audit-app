import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { InheritanceTreeView } from './InheritanceTreeView';
import { ReferenceFieldsDisplay } from './ReferenceFieldsDisplay';
import { CMDBAuditDashboard } from './CMDBAuditDashboard';
import { CIRelationshipView } from './CIRelationshipView';
import { useGraph } from '../contexts/GraphContext';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

type GraphViewType = 'inheritance' | 'references' | 'audit' | 'ci-relationships';

interface GraphVisualizationDashboardProps {
  isConnected: boolean;
}

export function GraphVisualizationDashboard({ isConnected }: GraphVisualizationDashboardProps) {
  const [activeView, setActiveView] = useState<GraphViewType>('audit');
  const { state } = useGraph();

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            CMDB Structure Visualization
            <Badge variant="secondary">Requires Connection</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please establish a connection to your ServiceNow instance to view CMDB structure visualizations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-semibold tracking-tight">CMDB Structure Visualization</h2>
          {state.isLoading && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          )}
          {state.error && (
            <div className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3 w-3" />
              Error
            </div>
          )}
          {!state.isLoading && !state.error && state.nodeCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-3 w-3" />
              Ready
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-muted-foreground">
            Explore table inheritance, reference relationships, and CI connections in your CMDB
          </p>
          {state.nodeCount > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">
                {state.nodeCount} nodes
              </Badge>
              {state.edgeCount > 0 && (
                <Badge variant="outline">
                  {state.edgeCount} connections
                </Badge>
              )}
              {state.selectedTables.length > 0 && (
                <Badge variant="secondary">
                  {state.selectedTables.length} selected
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as GraphViewType)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inheritance" className="relative">
            Inheritance
            <Badge variant="secondary" className="ml-2 text-xs">2.1</Badge>
          </TabsTrigger>
          <TabsTrigger value="references" className="relative">
            References
            <Badge variant="secondary" className="ml-2 text-xs">2.2</Badge>
          </TabsTrigger>
          <TabsTrigger value="audit" className="relative">
            Audit System
            <Badge variant="default" className="ml-2 text-xs">New</Badge>
          </TabsTrigger>
          <TabsTrigger value="ci-relationships" className="relative">
            CI Relations
            <Badge variant="secondary" className="ml-2 text-xs">2.3</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inheritance" className="space-y-4">
          <InheritanceTreeView />
        </TabsContent>

        <TabsContent value="references" className="space-y-4">
          <ReferenceFieldsDisplay />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <CMDBAuditDashboard />
        </TabsContent>

        <TabsContent value="ci-relationships" className="space-y-4">
          <CIRelationshipView />
        </TabsContent>
      </Tabs>
    </div>
  );
}