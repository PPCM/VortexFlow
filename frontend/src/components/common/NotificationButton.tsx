// VortexFlow Frontend - Bouton de Notification pour la barre de navigation
// Composant réutilisable pour afficher les notifications dans l'AppBar

import React from 'react';
import {
  IconButton,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Notifications,
} from '@mui/icons-material';
import { useNotifications } from './NotificationProvider';

const NotificationButton: React.FC = () => {
  const { unreadCount, openDrawer } = useNotifications();

  return (
    <Tooltip title="Notifications">
      <IconButton
        color="inherit"
        onClick={openDrawer}
        sx={{
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <Notifications />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default NotificationButton;
