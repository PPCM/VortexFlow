// VortexFlow Frontend - Context d'Authentification
// Gestion globale de l'état d'authentification

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthState, LoginCredentials, RegisterData } from '../types';
import { apiService } from '../services/api';

// =====================================
// Types pour le Context
// =====================================
interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

// =====================================
// Actions Redux-like
// =====================================
type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'LOGOUT' };

// =====================================
// Reducer
// =====================================
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
        error: null,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    case 'LOGOUT':
      return {
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      };
    
    default:
      return state;
  }
};

// =====================================
// État Initial
// =====================================
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

// =====================================
// Context
// =====================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =====================================
// Provider Component
// =====================================
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // =====================================
  // Vérification de la session au démarrage
  // =====================================
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const response = await apiService.getCurrentUser();
        
        if (response.success && response.data) {
          dispatch({ type: 'SET_USER', payload: response.data });
        } else {
          dispatch({ type: 'LOGOUT' });
        }
      } catch (error) {
        console.log('Aucune session active');
        dispatch({ type: 'LOGOUT' });
      }
    };

    checkAuthStatus();
  }, []);

  // =====================================
  // Fonction de Connexion
  // =====================================
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiService.login(credentials);
      
      if (response.success && response.data) {
        dispatch({ type: 'SET_USER', payload: response.data });
        
        // Stocker des informations de session si nécessaire
        localStorage.setItem('vortexflow_last_login', new Date().toISOString());
        
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur de connexion' });
        return false;
      }
    } catch (error: any) {
      const errorMessage = apiService.handleApiError(error);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    }
  };

  // =====================================
  // Fonction d'Inscription
  // =====================================
  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await apiService.register(userData);
      
      if (response.success && response.data) {
        dispatch({ type: 'SET_USER', payload: response.data });
        
        // Stocker des informations de session
        localStorage.setItem('vortexflow_last_login', new Date().toISOString());
        
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Erreur d\'inscription' });
        return false;
      }
    } catch (error: any) {
      const errorMessage = apiService.handleApiError(error);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    }
  };

  // =====================================
  // Fonction de Déconnexion
  // =====================================
  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      // Nettoyer le state et le localStorage
      dispatch({ type: 'LOGOUT' });
      localStorage.removeItem('vortexflow_last_login');
      
      // Rediriger vers la page de connexion
      window.location.href = '/login';
    }
  };

  // =====================================
  // Rafraîchir les Informations Utilisateur
  // =====================================
  const refreshUser = async (): Promise<void> => {
    try {
      const response = await apiService.getCurrentUser();
      
      if (response.success && response.data) {
        dispatch({ type: 'SET_USER', payload: response.data });
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      dispatch({ type: 'LOGOUT' });
    }
  };

  // =====================================
  // Effacer les Erreurs
  // =====================================
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // =====================================
  // Valeur du Context
  // =====================================
  const contextValue: AuthContextType = {
    state,
    login,
    register,
    logout,
    refreshUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// =====================================
// Hook pour utiliser le Context
// =====================================
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// =====================================
// HOC pour protéger les routes
// =====================================
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'viewer' | 'editor' | 'admin';
  fallback?: ReactNode;
}

export const ProtectedRoute = ({ 
  children, 
  requiredRole,
  fallback = <div>Accès non autorisé</div> 
}: ProtectedRouteProps): React.ReactElement | null => {
  const { state } = useAuth();

  // Affichage de chargement
  if (state.loading) {
    return <div>Chargement...</div>;
  }

  // Non authentifié
  if (!state.isAuthenticated || !state.user) {
    return <>{fallback}</>;
  }

  // Vérification du rôle si requis
  if (requiredRole) {
    const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
    const userRole = roleHierarchy[state.user.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRole < requiredRoleLevel) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

// =====================================
// Hook pour les permissions
// =====================================
export const usePermissions = () => {
  const { state } = useAuth();

  const hasRole = (role: 'viewer' | 'editor' | 'admin'): boolean => {
    if (!state.user) return false;
    
    const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
    const userRole = roleHierarchy[state.user.role];
    const requiredRoleLevel = roleHierarchy[role];

    return userRole >= requiredRoleLevel;
  };

  const canEdit = (): boolean => hasRole('editor');
  const canAdmin = (): boolean => hasRole('admin');
  const canView = (): boolean => hasRole('viewer');

  return {
    hasRole,
    canEdit,
    canAdmin,
    canView,
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  };
};

export default AuthContext;
