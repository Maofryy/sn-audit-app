import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  BarChart3, 
  FileText,
  GitBranch,
  Settings,
  ArrowLeft,
  Activity
} from 'lucide-react';
import { IntelligentTableSearch } from './IntelligentTableSearch';
import { TableDetailView } from './TableDetailView';
import { AuditDataTable } from './AuditDataTable';
import { tableStatisticsService } from '../services/tableStatisticsService';
import { serviceNowService } from '../services/serviceNowService';

interface CMDBAuditDashboardProps {
  className?: string;
}

export function CMDBAuditDashboard({ className }: CMDBAuditDashboardProps) {
  // State management
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [tableAuditData, setTableAuditData] = useState<any>(null);

  // Handle table selection
  const handleTableSelect = (tableName: string) => {
    console.log('🎯 Table selected for audit:', tableName);
    setSelectedTable(tableName);
    setActiveTab('details');
    setTableAuditData(null); // Clear previous data
  };

  // Handle back to overview
  const handleBackToOverview = () => {
    setSelectedTable(null);
    setActiveTab('overview');
    setTableAuditData(null);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Dashboard Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedTable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToOverview}
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-6 w-6" />
                  CMDB Reference Fields Audit
                  {selectedTable && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-lg">{selectedTable}</span>
                    </>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTable 
                    ? `Detailed audit analysis for ${selectedTable}` 
                    : 'Search and select CMDB tables for comprehensive reference fields analysis'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Live Data
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      {!selectedTable ? (
        // Overview Mode - Intelligent Search
        <IntelligentTableSearch 
          onTableSelect={handleTableSelect}
        />
      ) : (
        // Detail Mode - Selected Table Analysis
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="fields" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Fields
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analysis
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTableSelect(selectedTable)}
                disabled={loading}
                className="flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                Refresh Data
              </Button>
            </div>
          </div>

          <TabsContent value="details" className="space-y-4">
            <TableDetailView 
              tableName={selectedTable}
              onClose={handleBackToOverview}
            />
          </TabsContent>

          <TabsContent value="fields" className="space-y-4">
            {tableAuditData ? (
              <AuditDataTable
                tableName={tableAuditData.tableName}
                fields={tableAuditData.fields}
                qualityMetrics={tableAuditData.qualityMetrics}
                onFieldSelect={(field) => {
                  console.log('Field selected:', field);
                  // Could open a field detail modal here
                }}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Loading Field Data</h3>
                  <p className="text-muted-foreground">
                    Please wait while we load the field configuration data...
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Data Quality Analysis
                  <Badge variant="outline">Coming Soon</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Advanced Analytics</h3>
                  <p className="mb-4">
                    This section will include comprehensive data quality metrics, 
                    trend analysis, and detailed audit recommendations.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">Planned features:</p>
                    <ul className="text-sm space-y-1">
                      <li>• Data completeness trends over time</li>
                      <li>• Reference integrity health scores</li>
                      <li>• Custom vs standard field analysis</li>
                      <li>• Upgrade impact assessment</li>
                      <li>• Compliance reporting</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}