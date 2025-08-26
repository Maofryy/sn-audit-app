import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Database, 
  Search, 
  ExternalLink, 
  Calendar,
  User,
  AlertCircle,
  Loader2,
  Network
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { serviceNowService } from '../services/serviceNowService';
import { ServiceNowRecord } from '../types';
import { useGraphActions } from '../contexts/GraphContext';

interface CIInstancesModalProps {
  tableName: string;
  tableLabel?: string;
  trigger?: React.ReactNode;
  recordCount?: number;
}

export function CIInstancesModal({ 
  tableName, 
  tableLabel, 
  trigger,
  recordCount = 0 
}: CIInstancesModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { navigateToCI } = useGraphActions();

  // Fetch CI instances from the table
  const {
    data: ciInstances,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['ci-instances', tableName, searchTerm],
    queryFn: async () => {
      const query = searchTerm ? `name CONTAINS ${searchTerm} OR display_name CONTAINS ${searchTerm}` : undefined;
      return serviceNowService.getRecords(tableName, query, 50);
    },
    enabled: isOpen && !!tableName,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Database className="h-3 w-3" />
      View CI Instances
      {recordCount > 0 && (
        <Badge variant="secondary" className="ml-1">
          {recordCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            CI Instances: {tableLabel || tableName}
          </DialogTitle>
          <DialogDescription>
            Configuration Items from the <code className="bg-muted px-1 rounded">{tableName}</code> table
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="ci-search" className="sr-only">
                Search CI Instances
              </Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ci-search"
                  placeholder="Search by name or display name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>

          {/* Content */}
          <div className="border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Loading CI instances...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                  <div>
                    <p className="font-medium">Error Loading CI Instances</p>
                    <p className="text-sm text-muted-foreground">
                      {error instanceof Error ? error.message : 'Failed to fetch data'}
                    </p>
                  </div>
                </div>
              </div>
            ) : !ciInstances || ciInstances.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <Database className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                  <div>
                    <p className="font-medium">No CI Instances Found</p>
                    <p className="text-sm text-muted-foreground">
                      {searchTerm 
                        ? `No instances match "${searchTerm}"` 
                        : `No instances found in ${tableName}`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-4 border-b bg-muted/25">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Found {ciInstances.length} instances</span>
                      {searchTerm && (
                        <Badge variant="outline">
                          Filtered by: {searchTerm}
                        </Badge>
                      )}
                    </div>
                    <Badge variant="secondary">
                      Showing {Math.min(50, ciInstances.length)} of {recordCount || ciInstances.length}
                    </Badge>
                  </div>
                </div>

                {/* CI List */}
                <ScrollArea className="h-96">
                  <div className="p-2 space-y-2">
                    {ciInstances.map((ci: ServiceNowRecord) => (
                      <Card key={ci.sys_id} className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            {/* Main info */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {ci.display_name || ci.name || ci.sys_id}
                                </div>
                                {ci.name && ci.display_name && ci.name !== ci.display_name && (
                                  <div className="text-sm text-muted-foreground">
                                    Name: <code className="bg-muted px-1 rounded text-xs">{ci.name}</code>
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  ID: {ci.sys_id}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {ci.state && (
                                  <Badge variant="outline" className="text-xs">
                                    {ci.state}
                                  </Badge>
                                )}
                                {ci.operational_status && (
                                  <Badge variant="outline" className="text-xs">
                                    {ci.operational_status}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Additional details */}
                            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Created: {formatDate(ci.sys_created_on)}
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                By: {ci.sys_created_by}
                              </div>
                            </div>

                            {/* Location/Assignment info if available */}
                            {(ci.location || ci.assigned_to) && (
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                {ci.location && (
                                  <div>
                                    <span className="text-muted-foreground">Location:</span> {ci.location}
                                  </div>
                                )}
                                {ci.assigned_to && (
                                  <div>
                                    <span className="text-muted-foreground">Assigned:</span> {ci.assigned_to}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Relationships indicator */}
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div className="text-xs text-muted-foreground">
                                Table: <code className="bg-muted px-1 rounded">{tableName}</code>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs gap-1"
                                onClick={() => {
                                  setIsOpen(false);
                                  navigateToCI(ci.sys_id, 'ci-relationships');
                                }}
                              >
                                <Network className="h-3 w-3" />
                                View Relationships
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          {/* Footer */}
          {ciInstances && ciInstances.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <div>
                Showing up to 50 instances. Use search to find specific CIs.
              </div>
              <div>
                Total records in table: {recordCount?.toLocaleString() || 'Unknown'}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}