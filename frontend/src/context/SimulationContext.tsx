import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { apiService } from '../services/api';
import { webSocketService } from '../services/websocket';

// =====================================
// Types
// =====================================
interface SimulationSession {
  id: string;
  graphId: string;
  sessionName: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  config: any;
  metrics?: {
    fps: number;
    memoryUsage: number;
    latency: number;
    throughput: number;
  };
}

interface SimulationState {
  sessions: SimulationSession[];
  activeSessions: string[];
  currentSession: SimulationSession | null;
  templates: any[];
  loading: boolean;
  error: string | null;
}

interface SimulationActions {
  loadSessions: (params?: any) => Promise<void>;
  getSession: (sessionId: string) => Promise<void>;
  startSimulation: (data: { graphId: string; sessionName?: string; config?: any }) => Promise<void>;
  stopSimulation: (sessionId: string) => Promise<void>;
  pauseSimulation: (sessionId: string) => Promise<void>;
  resumeSimulation: (sessionId: string) => Promise<void>;
  loadTemplates: () => Promise<void>;
  validateConfig: (config: any) => Promise<boolean>;
  clearError: () => void;
}

// =====================================
// Context
// =====================================
const SimulationContext = createContext<{
  state: SimulationState;
  actions: SimulationActions;
} | null>(null);

// =====================================
// Reducer
// =====================================
type SimulationActionType =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SESSIONS'; payload: SimulationSession[] }
  | { type: 'SET_CURRENT_SESSION'; payload: SimulationSession | null }
  | { type: 'UPDATE_SESSION'; payload: SimulationSession }
  | { type: 'SET_TEMPLATES'; payload: any[] }
  | { type: 'ADD_ACTIVE_SESSION'; payload: string }
  | { type: 'REMOVE_ACTIVE_SESSION'; payload: string };

const initialState: SimulationState = {
  sessions: [],
  activeSessions: [],
  currentSession: null,
  templates: [],
  loading: false,
  error: null,
};

function simulationReducer(state: SimulationState, action: SimulationActionType): SimulationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_SESSIONS':
      return { 
        ...state, 
        sessions: action.payload,
        activeSessions: action.payload.filter(s => s.status === 'running').map(s => s.id)
      };
    
    case 'SET_CURRENT_SESSION':
      return { ...state, currentSession: action.payload };
    
    case 'UPDATE_SESSION':
      const updatedSessions = state.sessions.map(session =>
        session.id === action.payload.id ? action.payload : session
      );
      return {
        ...state,
        sessions: updatedSessions,
        activeSessions: updatedSessions.filter(s => s.status === 'running').map(s => s.id),
        currentSession: state.currentSession?.id === action.payload.id ? action.payload : state.currentSession
      };
    
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    
    case 'ADD_ACTIVE_SESSION':
      return {
        ...state,
        activeSessions: [...state.activeSessions, action.payload]
      };
    
    case 'REMOVE_ACTIVE_SESSION':
      return {
        ...state,
        activeSessions: state.activeSessions.filter(id => id !== action.payload)
      };
    
    default:
      return state;
  }
}

// =====================================
// Provider
// =====================================
export const SimulationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(simulationReducer, initialState);

  // =====================================
  // Actions
  // =====================================
  const actions: SimulationActions = {
    loadSessions: async (params = {}) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const response = await apiService.getSimulationSessions(params);
        if (response.success) {
          dispatch({ type: 'SET_SESSIONS', payload: response.data });
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur lors du chargement des sessions' });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur réseau' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    getSession: async (sessionId: string) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const response = await apiService.getSimulationSession(sessionId);
        if (response.success) {
          dispatch({ type: 'SET_CURRENT_SESSION', payload: response.data });
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur lors du chargement de la session' });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur réseau' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    startSimulation: async (data: { graphId: string; sessionName?: string; config?: any }) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const response = await apiService.startSimulation(data);
        if (response.success) {
          // Ajouter la nouvelle session aux sessions actives
          const newSession = response.data;
          dispatch({ type: 'UPDATE_SESSION', payload: newSession });
          
          // Notifier via WebSocket
          webSocketService.startSimulation(parseInt(data.graphId), data.config || {});
          
          // Recharger les sessions pour avoir les données à jour
          await actions.loadSessions();
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur lors du démarrage de la simulation' });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur réseau' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    stopSimulation: async (sessionId: string) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const response = await apiService.stopSimulation(sessionId);
        if (response.success) {
          // Retirer de la liste des sessions actives
          dispatch({ type: 'REMOVE_ACTIVE_SESSION', payload: sessionId });
          
          // Notifier via WebSocket
          webSocketService.stopSimulation(parseInt(sessionId));
          
          // Recharger les sessions
          await actions.loadSessions();
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur lors de l\'arrêt de la simulation' });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur réseau' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    pauseSimulation: async (sessionId: string) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const response = await apiService.pauseSimulation(sessionId);
        if (response.success) {
          // Retirer de la liste des sessions actives
          dispatch({ type: 'REMOVE_ACTIVE_SESSION', payload: sessionId });
          
          // Notifier via WebSocket
          webSocketService.pauseSimulation(parseInt(sessionId));
          
          // Recharger les sessions
          await actions.loadSessions();
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur lors de la pause de la simulation' });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur réseau' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    resumeSimulation: async (sessionId: string) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const response = await apiService.resumeSimulation(sessionId);
        if (response.success) {
          // Ajouter à la liste des sessions actives
          dispatch({ type: 'ADD_ACTIVE_SESSION', payload: sessionId });
          
          // Recharger les sessions
          await actions.loadSessions();
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur lors de la reprise de la simulation' });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur réseau' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    loadTemplates: async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const response = await apiService.getSimulationTemplates();
        if (response.success) {
          dispatch({ type: 'SET_TEMPLATES', payload: response.data });
        } else {
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur lors du chargement des templates' });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur réseau' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    validateConfig: async (config: any): Promise<boolean> => {
      try {
        const response = await apiService.validateSimulationConfig(config);
        return response.success && response.data.isValid;
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Erreur de validation' });
        return false;
      }
    },

    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    }
  };

  // =====================================
  // WebSocket Callbacks
  // =====================================
  React.useEffect(() => {
    const handleSimulationUpdate = (data: any) => {
      // Mettre à jour la session avec les nouvelles métriques
      if (data.sessionId && data.metrics) {
        const currentSession = state.sessions.find(s => s.id === data.sessionId);
        if (currentSession) {
          dispatch({
            type: 'UPDATE_SESSION',
            payload: {
              ...currentSession,
              metrics: data.metrics
            }
          });
        }
      }
    };

    webSocketService.setCallbacks({
      onSimulationUpdate: handleSimulationUpdate
    });

    return () => {
      webSocketService.removeCallbacks();
    };
  }, [state.sessions]);

  return (
    <SimulationContext.Provider value={{ state, actions }}>
      {children}
    </SimulationContext.Provider>
  );
};

// =====================================
// Hook
// =====================================
export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};

export default SimulationProvider;
