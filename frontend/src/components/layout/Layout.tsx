// VortexFlow Frontend - Layout Principal
// Structure principale avec navigation et sidebar

import React, { useState, ReactNode } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  AccountTree,
  Person,
  Settings,
  Logout,
  AdminPanelSettings,
  Add,
  Notifications,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, usePermissions } from '../../context/AuthContext';

// =====================================
// Types
// =====================================
interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  path: string;
  requiredRole?: 'viewer' | 'editor' | 'admin';
}

// =====================================
// Configuration Navigation
// =====================================
const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: <Dashboard />,
    path: '/dashboard',
  },
  {
    id: 'graphs',
    label: 'Graphiques',
    icon: <AccountTree />,
    path: '/graphs',
  },
  {
    id: 'profile',
    label: 'Profil',
    icon: <Person />,
    path: '/profile',
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: <AdminPanelSettings />,
    path: '/admin',
    requiredRole: 'admin',
  },
];

// =====================================
// Constantes
// =====================================
const DRAWER_WIDTH = 280;

// =====================================
// Composant Principal
// =====================================
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { user, hasRole } = usePermissions();

  // États locaux
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  // =====================================
  // Contenu du Drawer
  // =====================================
  const drawerContent = (
    <Box sx={{ overflow: 'auto' }}>
      {/* Logo et titre */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(45deg, #00ff88, #ff6b35)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          VortexFlow
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Visualisation 3D
        </Typography>
      </Box>

      <Divider />

      {/* Navigation principale */}
      <List sx={{ px: 2, py: 1 }}>
        {navigationItems.map((item) => {
          // Vérifier les permissions
          if (item.requiredRole && !hasRole(item.requiredRole)) {
            return null;
          }

          const isActive = location.pathname === item.path;

          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  minHeight: 48,
                  backgroundColor: isActive ? 'primary.main' : 'transparent',
                  color: isActive ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    backgroundColor: isActive ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'inherit',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Actions rapides */}
      {hasRole('editor') && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ px: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 2 }}>
              Actions rapides
            </Typography>
            <ListItem disablePadding sx={{ mt: 1 }}>
              <ListItemButton
                onClick={() => handleNavigation('/graphs/create')}
                sx={{
                  borderRadius: 2,
                  minHeight: 48,
                  border: '1px dashed',
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  <Add />
                </ListItemIcon>
                <ListItemText
                  primary="Nouveau Graphique"
                  primaryTypographyProps={{ fontSize: '0.95rem' }}
                />
              </ListItemButton>
            </ListItem>
          </Box>
        </>
      )}
    </Box>
  );

  // =====================================
  // Menu utilisateur
  // =====================================
  const userMenu = (
    <Menu
      anchorEl={userMenuAnchorEl}
      open={Boolean(userMenuAnchorEl)}
      onClose={handleUserMenuClose}
      PaperProps={{
        sx: { minWidth: 200, mt: 1 },
      }}
    >
      <MenuItem onClick={() => { handleUserMenuClose(); navigate('/profile'); }}>
        <ListItemIcon><Person fontSize="small" /></ListItemIcon>
        <ListItemText>Profil</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={() => { handleUserMenuClose(); navigate('/settings'); }}>
        <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
        <ListItemText>Paramètres</ListItemText>
      </MenuItem>
      
      <Divider />
      
      <MenuItem onClick={handleLogout}>
        <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
        <ListItemText>Déconnexion</ListItemText>
      </MenuItem>
    </Menu>
  );

  // =====================================
  // Rendu
  // =====================================
  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          backgroundColor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Titre de la page */}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, color: 'text.primary' }}>
            {navigationItems.find(item => item.path === location.pathname)?.label || 'VortexFlow'}
          </Typography>

          {/* Actions de la barre */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton color="inherit" sx={{ color: 'text.primary' }}>
                <Badge badgeContent={3} color="error">
                  <Notifications />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Avatar utilisateur */}
            <Tooltip title={user?.username || 'Utilisateur'}>
              <IconButton onClick={handleUserMenuOpen}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: 'primary.main',
                    fontSize: '0.875rem',
                  }}
                >
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {userMenu}

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        {/* Drawer mobile */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              backgroundColor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Drawer desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              backgroundColor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Contenu principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Toolbar /> {/* Espaceur pour l'AppBar */}
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
