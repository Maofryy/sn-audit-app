import { createContext, useContext, useReducer, ReactNode, useEffect, useCallback } from 'react';
import { ConnectionStatus } from '../types';
import { serviceNowService } from '../services/serviceNowService';
import { getAuthStatus, isDevelopmentMode } from '../services/authService';
import { getEnvironmentInfo } from '../utils/environment';

// Connection State Types
export interface ConnectionState {
  status: ConnectionStatus;
  authStatus: ReturnType<typeof getAuthStatus>;
  environmentInfo: ReturnType<typeof getEnvironmentInfo>;
  testResult: {
    success: boolean;
    error?: string;
    responseTime?: number;
    mode?: string;
  } | null;
  isInitialized: boolean;
}

// Action Types
export type ConnectionAction =
  | { type: 'SET_TESTING'; payload: boolean }
  | { type: 'SET_CONNECTION_RESULT'; payload: { success: boolean; error?: string; responseTime?: number; mode?: string } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'REFRESH_AUTH_STATUS' }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'RESET_CONNECTION' };

// Initial State
const initialState: ConnectionState = {
  status: {
    connected: false,
    testing: false
  },
  authStatus: getAuthStatus(),
  environmentInfo: getEnvironmentInfo(),
  testResult: null,
  isInitialized: false
};

// Reducer
function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
  switch (action.type) {
    case 'SET_TESTING':
      return {
        ...state,
        status: {
          ...state.status,
          testing: action.payload,
          connected: action.payload ? false : state.status.connected
        },
        testResult: action.payload ? null : state.testResult
      };

    case 'SET_CONNECTION_RESULT':
      return {
        ...state,
        status: {
          connected: action.payload.success,
          testing: false,
          error: action.payload.error,
          lastTested: new Date()
        },
        testResult: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        status: {
          ...state.status,
          connected: false,
          testing: false,
          error: action.payload,
          lastTested: new Date()
        },
        testResult: {
          success: false,
          error: action.payload
        }
      };

    case 'REFRESH_AUTH_STATUS':
      return {
        ...state,
        authStatus: getAuthStatus(),
        environmentInfo: getEnvironmentInfo()
      };

    case 'SET_INITIALIZED':
      return {
        ...state,
        isInitialized: action.payload
      };

    case 'RESET_CONNECTION':
      return {
        ...state,
        status: {
          connected: false,
          testing: false
        },
        testResult: null
      };

    default:
      return state;
  }
}

// Context
const ConnectionContext = createContext<{
  state: ConnectionState;
  dispatch: React.Dispatch<ConnectionAction>;
  testConnection: () => Promise<void>;
  refreshAuthStatus: () => void;
} | null>(null);

// Provider Component
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(connectionReducer, initialState);

  const testConnection = useCallback(async () => {
    dispatch({ type: 'SET_TESTING', payload: true });

    try {
      const result = await serviceNowService.testConnection();
      dispatch({ type: 'SET_CONNECTION_RESULT', payload: result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  const refreshAuthStatus = useCallback(() => {
    dispatch({ type: 'REFRESH_AUTH_STATUS' });
  }, []);

  // Auto-connect on initialization
  useEffect(() => {
    const initializeConnection = async () => {
      // Refresh auth status first
      refreshAuthStatus();
      
      // Wait a bit for auth status to settle
      setTimeout(async () => {
        await testConnection();
        dispatch({ type: 'SET_INITIALIZED', payload: true });
      }, 100);
    };

    if (!state.isInitialized) {
      initializeConnection();
    }
  }, [state.isInitialized, testConnection, refreshAuthStatus]);

  return (
    <ConnectionContext.Provider value={{ state, dispatch, testConnection, refreshAuthStatus }}>
      {children}
    </ConnectionContext.Provider>
  );
}

// Custom Hook
export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}

// Helper Hook for Actions
export function useConnectionActions() {
  const { testConnection, refreshAuthStatus, dispatch } = useConnection();

  const resetConnection = useCallback(() => 
    dispatch({ type: 'RESET_CONNECTION' }), [dispatch]);

  return {
    testConnection,
    refreshAuthStatus,
    resetConnection
  };
}

// Selector Hook for Performance
export function useConnectionSelector<T>(selector: (state: ConnectionState) => T): T {
  const { state } = useConnection();
  return selector(state);
}