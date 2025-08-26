import { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { TableMetadata, FieldMetadata, FilterState, ViewMode } from '../types';

// Graph State Types
export type GraphViewType = 'inheritance' | 'references' | 'ci-relationships';

export interface GraphState {
  // Current view and navigation
  activeView: GraphViewType;
  isFullscreen: boolean;
  
  // Selected items
  selectedTables: string[];
  selectedTableDetails: TableMetadata | null;
  
  // Search and filtering
  searchTerm: string;
  filterState: FilterState;
  
  // Data state
  isLoading: boolean;
  error: string | null;
  
  // Graph visualization state
  zoomLevel: number;
  isPanning: boolean;
  
  // Performance tracking
  nodeCount: number;
  edgeCount: number;
  renderTime: number;
}

// Action Types
export type GraphAction =
  | { type: 'SET_ACTIVE_VIEW'; payload: GraphViewType }
  | { type: 'TOGGLE_FULLSCREEN' }
  | { type: 'SET_SELECTED_TABLES'; payload: string[] }
  | { type: 'SET_SELECTED_TABLE_DETAILS'; payload: TableMetadata | null }
  | { type: 'SET_SEARCH_TERM'; payload: string }
  | { type: 'UPDATE_FILTER_STATE'; payload: Partial<FilterState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ZOOM_LEVEL'; payload: number }
  | { type: 'SET_PANNING'; payload: boolean }
  | { type: 'SET_GRAPH_STATS'; payload: { nodeCount: number; edgeCount: number; renderTime?: number } }
  | { type: 'RESET_VIEW' }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'NAVIGATE_TO_TABLE'; payload: { tableName: string; targetView?: GraphViewType } }
  | { type: 'NAVIGATE_TO_CI'; payload: { ciId: string; targetView?: GraphViewType } };

// Initial State
const initialState: GraphState = {
  activeView: 'inheritance',
  isFullscreen: false,
  selectedTables: [],
  selectedTableDetails: null,
  searchTerm: '',
  filterState: {
    tableTypes: [],
    relationshipTypes: [],
    customOnly: false,
    searchTerm: ''
  },
  isLoading: false,
  error: null,
  zoomLevel: 1,
  isPanning: false,
  nodeCount: 0,
  edgeCount: 0,
  renderTime: 0
};

// Reducer
function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'SET_ACTIVE_VIEW':
      return {
        ...state,
        activeView: action.payload,
        selectedTables: [], // Clear selections when changing views
        selectedTableDetails: null,
        error: null
      };

    case 'TOGGLE_FULLSCREEN':
      return {
        ...state,
        isFullscreen: !state.isFullscreen
      };

    case 'SET_SELECTED_TABLES':
      return {
        ...state,
        selectedTables: action.payload
      };

    case 'SET_SELECTED_TABLE_DETAILS':
      return {
        ...state,
        selectedTableDetails: action.payload
      };

    case 'SET_SEARCH_TERM':
      return {
        ...state,
        searchTerm: action.payload,
        filterState: {
          ...state.filterState,
          searchTerm: action.payload
        }
      };

    case 'UPDATE_FILTER_STATE':
      return {
        ...state,
        filterState: {
          ...state.filterState,
          ...action.payload
        }
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error // Clear error when loading starts
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false // Stop loading when error occurs
      };

    case 'SET_ZOOM_LEVEL':
      return {
        ...state,
        zoomLevel: Math.max(0.1, Math.min(5, action.payload)) // Clamp between 0.1 and 5
      };

    case 'SET_PANNING':
      return {
        ...state,
        isPanning: action.payload
      };

    case 'SET_GRAPH_STATS':
      return {
        ...state,
        nodeCount: action.payload.nodeCount,
        edgeCount: action.payload.edgeCount,
        renderTime: action.payload.renderTime || state.renderTime
      };

    case 'RESET_VIEW':
      return {
        ...state,
        zoomLevel: 1,
        isPanning: false,
        selectedTables: [],
        selectedTableDetails: null,
        searchTerm: '',
        filterState: {
          ...state.filterState,
          searchTerm: ''
        }
      };

    case 'CLEAR_SELECTIONS':
      return {
        ...state,
        selectedTables: [],
        selectedTableDetails: null
      };

    case 'NAVIGATE_TO_TABLE':
      return {
        ...state,
        activeView: action.payload.targetView || state.activeView,
        selectedTables: [action.payload.tableName],
        selectedTableDetails: null,
        searchTerm: action.payload.tableName,
        filterState: {
          ...state.filterState,
          searchTerm: action.payload.tableName
        }
      };

    case 'NAVIGATE_TO_CI':
      return {
        ...state,
        activeView: action.payload.targetView || 'ci-relationships',
        selectedTables: [action.payload.ciId],
        selectedTableDetails: null,
        searchTerm: action.payload.ciId,
        filterState: {
          ...state.filterState,
          searchTerm: action.payload.ciId
        }
      };

    default:
      return state;
  }
}

// Context
const GraphContext = createContext<{
  state: GraphState;
  dispatch: React.Dispatch<GraphAction>;
} | null>(null);

// Provider Component
export function GraphProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(graphReducer, initialState);

  return (
    <GraphContext.Provider value={{ state, dispatch }}>
      {children}
    </GraphContext.Provider>
  );
}

// Custom Hook
export function useGraph() {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return context;
}

// Helper Hook for Actions
export function useGraphActions() {
  const { dispatch } = useGraph();

  // Memoize all action functions to prevent infinite re-renders
  const setActiveView = useCallback((view: GraphViewType) => 
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: view }), [dispatch]);
    
  const toggleFullscreen = useCallback(() => 
    dispatch({ type: 'TOGGLE_FULLSCREEN' }), [dispatch]);
    
  const setSelectedTables = useCallback((tables: string[]) => 
    dispatch({ type: 'SET_SELECTED_TABLES', payload: tables }), [dispatch]);
    
  const setSelectedTableDetails = useCallback((table: TableMetadata | null) => 
    dispatch({ type: 'SET_SELECTED_TABLE_DETAILS', payload: table }), [dispatch]);
    
  const setSearchTerm = useCallback((term: string) => 
    dispatch({ type: 'SET_SEARCH_TERM', payload: term }), [dispatch]);
    
  const updateFilters = useCallback((filters: Partial<FilterState>) => 
    dispatch({ type: 'UPDATE_FILTER_STATE', payload: filters }), [dispatch]);
    
    
  const setZoomLevel = useCallback((level: number) => 
    dispatch({ type: 'SET_ZOOM_LEVEL', payload: level }), [dispatch]);
    
  const setPanning = useCallback((panning: boolean) => 
    dispatch({ type: 'SET_PANNING', payload: panning }), [dispatch]);
    
  const setGraphStats = useCallback((stats: { nodeCount: number; edgeCount: number; renderTime?: number }) =>
    dispatch({ type: 'SET_GRAPH_STATS', payload: stats }), [dispatch]);
    
  const resetView = useCallback(() => 
    dispatch({ type: 'RESET_VIEW' }), [dispatch]);
    
  const clearSelections = useCallback(() => 
    dispatch({ type: 'CLEAR_SELECTIONS' }), [dispatch]);
    
  const zoomIn = useCallback(() => 
    dispatch({ type: 'SET_ZOOM_LEVEL', payload: 0 }), [dispatch]); // Will be calculated in component
  const zoomOut = useCallback(() => 
    dispatch({ type: 'SET_ZOOM_LEVEL', payload: 0 }), [dispatch]); // Will be calculated in component
    
  const navigateToTable = useCallback((tableName: string, targetView?: GraphViewType) => 
    dispatch({ type: 'NAVIGATE_TO_TABLE', payload: { tableName, targetView } }), [dispatch]);
    
  const navigateToCI = useCallback((ciId: string, targetView?: GraphViewType) => 
    dispatch({ type: 'NAVIGATE_TO_CI', payload: { ciId, targetView } }), [dispatch]);

  return {
    setActiveView,
    toggleFullscreen,
    setSelectedTables,
    setSelectedTableDetails,
    setSearchTerm,
    updateFilters,
    setZoomLevel,
    setPanning,
    setGraphStats,
    resetView,
    clearSelections,
    zoomIn,
    zoomOut,
    navigateToTable,
    navigateToCI,
  };
}

// Selector Hook for Performance
export function useGraphSelector<T>(selector: (state: GraphState) => T): T {
  const { state } = useGraph();
  return selector(state);
}