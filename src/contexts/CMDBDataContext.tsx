import React, { createContext, useContext, ReactNode } from 'react';
import { useCMDBTables } from '../hooks/useServiceNowData';
import { TableMetadata } from '../types';

interface CMDBDataContextValue {
  tables: TableMetadata[] | undefined;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
}

const CMDBDataContext = createContext<CMDBDataContextValue | null>(null);

interface CMDBDataProviderProps {
  children: ReactNode;
}

export function CMDBDataProvider({ children }: CMDBDataProviderProps) {
  const { data: tables, isLoading, error, isSuccess } = useCMDBTables();

  const value: CMDBDataContextValue = {
    tables,
    isLoading,
    error,
    isSuccess,
  };

  return (
    <CMDBDataContext.Provider value={value}>
      {children}
    </CMDBDataContext.Provider>
  );
}

export function useCMDBData(): CMDBDataContextValue {
  const context = useContext(CMDBDataContext);
  if (!context) {
    throw new Error('useCMDBData must be used within a CMDBDataProvider');
  }
  return context;
}