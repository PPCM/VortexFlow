// VortexFlow Frontend - Application Principale
// Configuration du routing, des providers et de la gestion d'erreurs

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, Typography } from '@mui/material';

// Providers globaux
import { AuthProvider } from './context/AuthContext';
import { GraphProvider } from './context/GraphContext';
import { SimulationProvider } from './context/SimulationContext';
import { NotificationProvider } from './components/common/NotificationProvider';
import ErrorBoundary from './components/common/ErrorBoundary';

// Composants de layout
import Navigation from './components/layout/Navigation';
import LoadingPage from './components/common/LoadingPage';

// Pages et composants
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import Dashboard from './components/dashboard/Dashboard';
import GraphList from './components/graphs/GraphList';
import GraphEditor from './components/graphs/GraphEditor';
import GraphViewer from './components/graphs/GraphViewer';
import UserProfile from './components/user/UserProfile';
import AdminPanel from './components/admin/AdminPanel';

// Hooks et utilitaires
import { useAuth } from './context/AuthContext';
import { setupAxiosErrorInterceptor } from './services/errorHandler';
import apiService from './services/api';

// Configuration du thème VortexFlow
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4caf50', // Vert VortexFlow
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff6b35', // Orange VortexFlow
      light: '#ff8a65',
      dark: '#f4511e',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#4caf50 #1a1a1a',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#1a1a1a',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#4caf50',
            borderRadius: '4px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(26, 26, 26, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(76, 175, 80, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
        },
      },
    },
  },
});

// Configuration des intercepteurs d'erreur API
setupAxiosErrorInterceptor(apiService.client);

// =====================================
// Composant de protection des routes
// =====================================
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireAdmin = false,
}) => {
  const { state } = useAuth();
  const { user, loading } = state;
  
  const canAdmin = () => user?.role === 'admin';

  if (loading) {
    return <LoadingPage message="Vérification de l'authentification..." />;
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  // Routes publiques (login/register): si l'utilisateur a déjà une session
  // active, on évite de réafficher le formulaire de connexion en le
  // renvoyant vers le dashboard.
  if (!requireAuth && user) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && !canAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// =====================================
// Composant de layout principal
// =====================================
interface AppLayoutProps {
  children: React.ReactNode;
}

// Chemins sur lesquels on ne montre jamais le menu de gauche, même si une
// session backend est encore valide (cas d'un utilisateur qui revient
// manuellement sur /login pour changer de compte par ex.).
const NO_NAV_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { state } = useAuth();
  const { user } = state;
  const { pathname } = useLocation();
  const hideNav = NO_NAV_PATHS.some((p) => pathname.startsWith(p));

  if (!user || hideNav) {
    return (
      <Box sx={{ minHeight: '100vh' }}>
        {children}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Navigation />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          mt: 8, // Compensation pour la navigation fixe
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

// =====================================
// Composant App principal
// =====================================
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <AuthProvider>
            <GraphProvider>
              <SimulationProvider>
                <NotificationProvider>
                <AppLayout>
                  <Routes>
                    {/* Routes publiques */}
                    <Route
                      path="/login"
                      element={
                        <ProtectedRoute requireAuth={false}>
                          <LoginPage />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/register"
                      element={
                        <ProtectedRoute requireAuth={false}>
                          <RegisterPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Routes protégées */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/graphs"
                      element={
                        <ProtectedRoute>
                          <GraphList />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/graphs/create"
                      element={
                        <ProtectedRoute>
                          <GraphEditor />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/graphs/:id/edit"
                      element={
                        <ProtectedRoute>
                          <GraphEditor />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/graphs/:id/view"
                      element={
                        <ProtectedRoute>
                          <GraphViewer />
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <UserProfile />
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Routes d'administration */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute requireAdmin>
                          <AdminPanel />
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Redirections */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Navigate to="/dashboard" replace />
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Page 404 */}
                    <Route
                      path="*"
                      element={
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '60vh',
                            textAlign: 'center',
                          }}
                        >
                          <Typography
                            variant="h1"
                            sx={{
                              fontSize: '6rem',
                              fontWeight: 'bold',
                              color: 'text.secondary',
                              mb: 2,
                            }}
                          >
                            404
                          </Typography>
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
                              Page non trouvée
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                              La page que vous recherchez n'existe pas.
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </Routes>
                </AppLayout>
                </NotificationProvider>
              </SimulationProvider>
            </GraphProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
