// VortexFlow Frontend - Système de Notifications
// Provider global pour les notifications et messages système

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Typography,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Button,
  Chip,
  Paper,
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Error,
  Warning,
  Info,
  Notifications,
  NotificationsNone,
  Delete,
  MarkAsUnread,
  Circle,
} from '@mui/icons-material';

// =====================================
// Types et interfaces
// =====================================
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  unreadCount: number;
}

// =====================================
// Context
// =====================================
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new (Error as any)('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// =====================================
// Provider Component
// =====================================
interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [currentSnackbar, setCurrentSnackbar] = useState<Notification | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // =====================================
  // Fonctions utilitaires
  // =====================================
  const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const showNotification = useCallback((
    notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => {
    const notification: Notification = {
      ...notificationData,
      id: generateId(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [notification, ...prev]);

    // Afficher dans la snackbar si ce n'est pas persistant
    if (!notification.persistent) {
      setCurrentSnackbar(notification);
      setSnackbarOpen(true);
    }
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    showNotification({ type: 'success', message, title });
  }, [showNotification]);

  const showError = useCallback((message: string, title?: string) => {
    showNotification({ type: 'error', message, title, persistent: true });
  }, [showNotification]);

  const showWarning = useCallback((message: string, title?: string) => {
    showNotification({ type: 'warning', message, title });
  }, [showNotification]);

  const showInfo = useCallback((message: string, title?: string) => {
    showNotification({ type: 'info', message, title });
  }, [showNotification]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // =====================================
  // Calculs dérivés
  // =====================================
  const unreadCount = notifications.filter(n => !n.read).length;

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleSnackbarExited = () => {
    setCurrentSnackbar(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    if (notification.action) {
      notification.action.onClick();
    }
  };

  // =====================================
  // Composants internes
  // =====================================
  const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
    const iconProps = { sx: { mr: 2 } };
    
    switch (type) {
      case 'success':
        return <CheckCircle color="success" {...iconProps} />;
      case 'error':
        return <Error color="error" {...iconProps} />;
      case 'warning':
        return <Warning color="warning" {...iconProps} />;
      case 'info':
      default:
        return <Info color="info" {...iconProps} />;
    }
  };

  const NotificationDrawer: React.FC = () => (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      sx={{
        '& .MuiDrawer-paper': {
          width: 400,
          maxWidth: '90vw',
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Notifications
          </Typography>
          <Box>
            {unreadCount > 0 && (
              <Button size="small" onClick={markAllAsRead} sx={{ mr: 1 }}>
                Tout marquer lu
              </Button>
            )}
            <Button size="small" onClick={clearAll} color="error">
              Tout effacer
            </Button>
          </Box>
        </Box>
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <NotificationsNone sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Aucune notification
          </Typography>
        </Box>
      ) : (
        <List>
          {notifications.map((notification, index) => (
            <React.Fragment key={notification.id}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                <ListItemIcon>
                  <Box sx={{ position: 'relative' }}>
                    <NotificationIcon type={notification.type} />
                    {!notification.read && (
                      <Circle
                        sx={{
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          fontSize: 12,
                          color: 'primary.main',
                        }}
                      />
                    )}
                  </Box>
                </ListItemIcon>
                
                <ListItemText
                  primary={
                    <Box>
                      {notification.title && (
                        <Typography variant="subtitle2" gutterBottom>
                          {notification.title}
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: notification.read ? 'normal' : 'medium',
                        }}
                      >
                        {notification.message}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {notification.timestamp.toLocaleString()}
                      </Typography>
                      <Chip
                        label={notification.type}
                        size="small"
                        color={
                          notification.type === 'error' ? 'error' :
                          notification.type === 'warning' ? 'warning' :
                          notification.type === 'success' ? 'success' : 'info'
                        }
                        variant="outlined"
                      />
                    </Box>
                  }
                />
                
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notification.id);
                    }}
                    size="small"
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
                </ListItemButton>
              </ListItem>
              
              {index < notifications.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Drawer>
  );

  // =====================================
  // Valeur du contexte
  // =====================================
  const contextValue: NotificationContextType = {
    notifications,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    unreadCount,
  };

  // =====================================
  // Rendu
  // =====================================
  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Snackbar pour notifications temporaires */}
      {currentSnackbar && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          TransitionProps={{
            onExited: handleSnackbarExited,
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={currentSnackbar.type}
            variant="filled"
            action={
              currentSnackbar.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={currentSnackbar.action.onClick}
                >
                  {currentSnackbar.action.label}
                </Button>
              ) : undefined
            }
          >
            {currentSnackbar.title && (
              <AlertTitle>{currentSnackbar.title}</AlertTitle>
            )}
            {currentSnackbar.message}
          </Alert>
        </Snackbar>
      )}

      {/* Drawer des notifications */}
      <NotificationDrawer />
      
      {/* Bouton de notification flottant */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1200,
        }}
      >
        <Paper
          elevation={4}
          sx={{
            p: 1,
            cursor: 'pointer',
            borderRadius: '50%',
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
          onClick={() => setDrawerOpen(true)}
        >
          <Badge badgeContent={unreadCount} color="error">
            <Notifications />
          </Badge>
        </Paper>
      </Box>
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
