// VortexFlow Frontend - Context des Graphiques
// Gestion globale des graphiques et données 3D

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { Graph, GraphData, GraphNode, GraphEdge, GraphFilters, SimulationState, SimulationConfig } from '../types';
import { apiService } from '../services/api';
import { webSocketService } from '../services/websocket';

// =====================================
// Types pour le Context
// =====================================
interface GraphState {
  graphs: Graph[];
  currentGraph: Graph | null;
  graphData: GraphData | null;
  simulation: SimulationState | null;
  loading: boolean;
  error: string | null;
  filters: GraphFilters;
  selectedNodes: string[];
  selectedEdges: string[];
}

interface GraphContextType {
  state: GraphState;
  // Actions graphiques
  loadGraphs: (filters?: GraphFilters) => Promise<void>;
  loadGraph: (id: number) => Promise<void>;
  createGraph: (graphData: Partial<Graph>) => Promise<boolean>;
  updateGraph: (id: number, graphData: Partial<Graph>) => Promise<boolean>;
  saveGraph: (graphData: Partial<Graph>) => Promise<boolean>;
  deleteGraph: (id: number) => Promise<boolean>;
  duplicateGraph: (id: number, name: string) => Promise<boolean>;
  
  // Actions DOT
  validateDot: (dotContent: string) => Promise<any>;
  parseDot: (dotContent: string) => Promise<GraphData | null>;
  
  // Actions simulation
  startSimulation: (config: SimulationConfig) => Promise<void>;
  stopSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  updateSimulationConfig: (config: Partial<SimulationConfig>) => Promise<void>;
  
  // État simulation (propriété calculée)
  simulationState: SimulationState | null;
  
  // Actions sélection
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
  clearSelection: () => void;
  
  // Actions utilitaires
  setFilters: (filters: GraphFilters) => void;
  clearError: () => void;
}

// =====================================
// Actions Redux-like
// =====================================
type GraphAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_GRAPHS'; payload: Graph[] }
  | { type: 'SET_CURRENT_GRAPH'; payload: Graph | null }
  | { type: 'SET_GRAPH_DATA'; payload: GraphData | null }
  | { type: 'SET_SIMULATION'; payload: SimulationState | null }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_FILTERS'; payload: GraphFilters }
  | { type: 'SELECT_NODE'; payload: string }
  | { type: 'SELECT_EDGE'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'UPDATE_SIMULATION_CONFIG'; payload: Partial<SimulationConfig> };

// =====================================
// Reducer
// =====================================
const graphReducer = (state: GraphState, action: GraphAction): GraphState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_GRAPHS':
      return { ...state, graphs: action.payload, loading: false };
    
    case 'SET_CURRENT_GRAPH':
      return { ...state, currentGraph: action.payload, loading: false };
    
    case 'SET_GRAPH_DATA':
      return { ...state, graphData: action.payload };
    
    case 'SET_SIMULATION':
      return { ...state, simulation: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    
    case 'SELECT_NODE':
      const nodeSelected = state.selectedNodes.includes(action.payload);
      return {
        ...state,
        selectedNodes: nodeSelected 
          ? state.selectedNodes.filter(id => id !== action.payload)
          : [...state.selectedNodes, action.payload]
      };
    
    case 'SELECT_EDGE':
      const edgeSelected = state.selectedEdges.includes(action.payload);
      return {
        ...state,
        selectedEdges: edgeSelected 
          ? state.selectedEdges.filter(id => id !== action.payload)
          : [...state.selectedEdges, action.payload]
      };
    
    case 'CLEAR_SELECTION':
      return { ...state, selectedNodes: [], selectedEdges: [] };
    
    case 'UPDATE_SIMULATION_CONFIG':
      return {
        ...state,
        simulation: state.simulation ? {
          ...state.simulation,
          config: { ...state.simulation.config, ...action.payload }
        } : null
      };
    
    default:
      return state;
  }
};

// =====================================
// État Initial
// =====================================
const initialState: GraphState = {
  graphs: [],
  currentGraph: null,
  graphData: null,
  simulation: null,
  loading: false,
  error: null,
  filters: {},
  selectedNodes: [],
  selectedEdges: [],
};

// =====================================
// Context
// =====================================
const GraphContext = createContext<GraphContextType | undefined>(undefined);

// =====================================
// Provider Component
// =====================================
interface GraphProviderProps {
  children: ReactNode;
}

export const GraphProvider: React.FC<GraphProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(graphReducer, initialState);

  // =====================================
  // Actions Graphiques
  // =====================================
  const loadGraphs = useCallback(async (filters?: GraphFilters): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.getGraphs(filters);
      
      if (response.success) {
        dispatch({ type: 'SET_GRAPHS', payload: response.data.data });
        if (filters) {
          dispatch({ type: 'SET_FILTERS', payload: filters });
        }
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de chargement' });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
    }
  }, []);

  const loadGraph = useCallback(async (id: number): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.getGraph(id);
      
      if (response.success) {
        dispatch({ type: 'SET_CURRENT_GRAPH', payload: response.data });
        dispatch({ type: 'SET_GRAPH_DATA', payload: response.data.data });
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Graphique non trouvé' });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
    }
  }, []);

  const createGraph = useCallback(async (graphData: Partial<Graph>): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.createGraph(graphData);
      
      if (response.success) {
        dispatch({ type: 'SET_CURRENT_GRAPH', payload: response.data });
        // Recharger la liste des graphiques
        await loadGraphs(state.filters);
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de création' });
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
      return false;
    }
  }, [loadGraphs, state.filters]);

  const updateGraph = useCallback(async (id: number, graphData: Partial<Graph>): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.updateGraph(id, graphData);
      
      if (response.success) {
        dispatch({ type: 'SET_CURRENT_GRAPH', payload: response.data });
        
        // Notifier via WebSocket pour la collaboration
        webSocketService.updateGraph(id, graphData);
        
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de mise à jour' });
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
      return false;
    }
  }, []);

  const saveGraph = useCallback(async (graphData: Partial<Graph>): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Si le graphique a un ID, c'est une mise à jour, sinon c'est une création
      if (graphData.id) {
        return await updateGraph(graphData.id, graphData);
      } else {
        return await createGraph(graphData);
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
      return false;
    }
  }, [updateGraph, createGraph]);

  const deleteGraph = useCallback(async (id: number): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.deleteGraph(id);
      
      if (response.success) {
        // Recharger la liste
        await loadGraphs(state.filters);
        // Effacer le graphique actuel si c'était celui-ci
        if (state.currentGraph?.id === id) {
          dispatch({ type: 'SET_CURRENT_GRAPH', payload: null });
          dispatch({ type: 'SET_GRAPH_DATA', payload: null });
        }
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de suppression' });
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
      return false;
    }
  }, [loadGraphs, state.filters, state.currentGraph]);

  const duplicateGraph = useCallback(async (id: number, name: string): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.duplicateGraph(id, name);
      
      if (response.success) {
        await loadGraphs(state.filters);
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de duplication' });
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
      return false;
    }
  }, [loadGraphs, state.filters]);

  // =====================================
  // Actions DOT
  // =====================================
  const validateDot = useCallback(async (dotContent: string): Promise<any> => {
    try {
      const response = await apiService.validateDot(dotContent);
      return response.data;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
      return null;
    }
  }, []);

  const parseDot = useCallback(async (dotContent: string): Promise<GraphData | null> => {
    try {
      const response = await apiService.parseDot(dotContent);
      
      if (response.success) {
        const graphData = response.data;
        dispatch({ type: 'SET_GRAPH_DATA', payload: graphData });
        return graphData;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de parsing' });
        return null;
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
      return null;
    }
  }, []);

  // =====================================
  // Actions Simulation
  // =====================================
  const startSimulation = useCallback(async (config: SimulationConfig): Promise<void> => {
    if (!state.currentGraph) return;

    try {
      const response = await apiService.startSimulation({
        graphId: state.currentGraph.id.toString(),
        config
      });
      
      if (response.success) {
        const simulationState: SimulationState = {
          config,
          particles: [],
          statistics: {
            totalParticles: 0,
            activeParticles: 0,
            totalFlows: 0,
            averageSpeed: 0,
          }
        };
        
        dispatch({ type: 'SET_SIMULATION', payload: simulationState });
        
        // Démarrer via WebSocket
        webSocketService.startSimulation(state.currentGraph.id, config);
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de démarrage simulation' });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
    }
  }, [state.currentGraph]);

  const stopSimulation = useCallback(async (): Promise<void> => {
    if (!state.currentGraph) return;

    try {
      // TODO: This should use actual sessionId from active simulation session
      await apiService.stopSimulation(state.currentGraph.id.toString());
      
      // Arrêter via WebSocket
      webSocketService.stopSimulation(state.currentGraph.id);
      
      // Mettre à jour le state local
      if (state.simulation) {
        dispatch({ 
          type: 'UPDATE_SIMULATION_CONFIG', 
          payload: { isRunning: false }
        });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
    }
  }, [state.currentGraph, state.simulation]);

  const pauseSimulation = useCallback(async (): Promise<void> => {
    if (!state.currentGraph) return;

    try {
      // TODO: This should use actual sessionId from active simulation session
      await apiService.pauseSimulation(state.currentGraph.id.toString());
      
      // Pause via WebSocket
      webSocketService.pauseSimulation(state.currentGraph.id);
      
      // Mettre à jour le state local
      if (state.simulation) {
        dispatch({ 
          type: 'UPDATE_SIMULATION_CONFIG', 
          payload: { isPaused: true }
        });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
    }
  }, [state.currentGraph, state.simulation]);

  const updateSimulationConfig = useCallback(async (config: Partial<SimulationConfig>): Promise<void> => {
    if (!state.currentGraph) return;

    try {
      // TODO: Implement updateSimulationConfig API method
      // await apiService.updateSimulationConfig(state.currentGraph.id, config);
      
      dispatch({ type: 'UPDATE_SIMULATION_CONFIG', payload: config });
      
      // TODO: Check if WebSocket service has updateSimulationConfig method
      // webSocketService.updateSimulationConfig(state.currentGraph.id, config);
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: apiService.handleApiError(error) });
    }
  }, [state.currentGraph]);

  // =====================================
  // Actions Sélection
  // =====================================
  const selectNode = useCallback((nodeId: string): void => {
    dispatch({ type: 'SELECT_NODE', payload: nodeId });
  }, []);

  const selectEdge = useCallback((edgeId: string): void => {
    dispatch({ type: 'SELECT_EDGE', payload: edgeId });
  }, []);

  const clearSelection = useCallback((): void => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  // =====================================
  // Actions Utilitaires
  // =====================================
  const setFilters = useCallback((filters: GraphFilters): void => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const clearError = useCallback((): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // =====================================
  // Valeur du Context
  // =====================================
  const contextValue: GraphContextType = {
    state,
    loadGraphs,
    loadGraph,
    createGraph,
    updateGraph,
    saveGraph,
    deleteGraph,
    duplicateGraph,
    validateDot,
    parseDot,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    updateSimulationConfig,
    simulationState: state.simulation,
    selectNode,
    selectEdge,
    clearSelection,
    setFilters,
    clearError,
  };

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  );
};

// =====================================
// Hook pour utiliser le Context
// =====================================
export const useGraph = (): GraphContextType => {
  const context = useContext(GraphContext);
  
  if (!context) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  
  return context;
};

export default GraphContext;
