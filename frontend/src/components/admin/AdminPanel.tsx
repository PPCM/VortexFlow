// VortexFlow Frontend - Panneau d'Administration
// Interface de gestion des utilisateurs et du système

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Avatar,
  Menu,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Edit,
  Delete,
  Block,
  CheckCircle,
  Warning,
  Error,
  People,
  Storage,
  Timeline,
  Security,
  MoreVert,
  Refresh,
  Download,
  Upload,
  Settings,
  Visibility,
  AdminPanelSettings,
  PlayArrow,
  HealthAndSafety,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api';
import { User, SystemStats, SystemLogs } from '../../types';
import LoadingPage from '../common/LoadingPage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const { state } = useAuth();
  const canAdmin = () => state.user?.role === 'admin';

  // États locaux
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Données
  const [users, setUsers] = useState<User[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLogs[]>([]);

  // Dialogs et menus
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Données du formulaire utilisateur
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    role: 'viewer' as 'viewer' | 'editor' | 'admin',
    is_active: true,
  });

  // =====================================
  // Effets (appelés avant toute condition)
  // =====================================
  useEffect(() => {
    if (canAdmin()) {
      loadAdminData();
    }
  }, [canAdmin]);

  // =====================================
  // Vérification des permissions
  // =====================================
  if (!canAdmin()) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8 }}>
        <AdminPanelSettings sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="error">
          Accès non autorisé
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vous n'avez pas les permissions pour accéder au panneau d'administration.
        </Typography>
      </Box>
    );
  }

  // =====================================
  // Fonctions de chargement des données
  // =====================================
  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData, logsData] = await Promise.all([
        apiService.getUsers(),
        apiService.getSystemStats(),
        apiService.getSystemLogs('50'),
      ]);
      
      setUsers(usersData.data.data);
      setSystemStats(statsData.data);
      setSystemLogs(logsData.data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors du chargement des données' });
    } finally {
      setLoading(false);
    }
  };

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, userId: number) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedUserId(userId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedUserId(null);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserFormData({
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active ?? true,
    });
    setUserDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        await apiService.deleteUser(userId);
        await loadAdminData();
        setMessage({ type: 'success', text: 'Utilisateur supprimé avec succès' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Erreur lors de la suppression' });
      }
    }
    handleMenuClose();
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await apiService.updateUser(userId, { is_active: !currentStatus });
      await loadAdminData();
      setMessage({ 
        type: 'success', 
        text: `Utilisateur ${!currentStatus ? 'activé' : 'désactivé'} avec succès` 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la modification du statut' });
    }
    handleMenuClose();
  };

  const handleSaveUser = async () => {
    try {
      if (selectedUser) {
        await apiService.updateUser(selectedUser.id, userFormData);
      } else {
        await apiService.createUser({ ...userFormData, password: 'password123' });
      }
      
      await loadAdminData();
      setUserDialogOpen(false);
      setSelectedUser(null);
      setMessage({ 
        type: 'success', 
        text: selectedUser ? 'Utilisateur modifié avec succès' : 'Utilisateur créé avec succès' 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    }
  };

  // =====================================
  // Composants internes
  // =====================================
  const StatsCards: React.FC = () => {
    if (!systemStats) return null;

    return (
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {systemStats.total_users}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Utilisateurs
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Timeline sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {systemStats.total_graphs}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Graphiques
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PlayArrow sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {systemStats.active_simulations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Simulations
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <HealthAndSafety sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {systemStats.system_health}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Santé Système
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };

  const UsersTable: React.FC = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Utilisateur</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Rôle</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell>Inscription</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ mr: 2, backgroundColor: 'primary.main' }}>
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="body2">
                    {user.username}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Chip
                  label={user.role}
                  color={
                    user.role === 'admin' ? 'error' : 
                    user.role === 'editor' ? 'warning' : 'default'
                  }
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={user.is_active ? 'Actif' : 'Inactif'}
                  color={user.is_active ? 'success' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <IconButton
                  onClick={(e) => handleMenuOpen(e, user.id)}
                  size="small"
                >
                  <MoreVert />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const SystemLogsList: React.FC = () => (
    <List>
      {systemLogs.map((log, index) => (
        <React.Fragment key={index}>
          <ListItem>
            <ListItemIcon>
              {log.level === 'error' ? (
                <Error color="error" />
              ) : log.level === 'warning' ? (
                <Warning color="warning" />
              ) : (
                <CheckCircle color="success" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={log.message}
              secondary={`${new Date(log.timestamp).toLocaleString()} - ${log.source}`}
            />
          </ListItem>
          {index < systemLogs.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </List>
  );

  // =====================================
  // Rendu conditionnel
  // =====================================
  if (loading && users.length === 0) {
    return <LoadingPage message="Chargement du panneau d'administration..." />;
  }

  // =====================================
  // Rendu
  // =====================================
  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Administration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestion des utilisateurs et du système
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={loadAdminData}
          disabled={loading}
        >
          Actualiser
        </Button>
      </Box>

      {/* Message de statut */}
      {message && (
        <Alert
          severity={message.type}
          onClose={() => setMessage(null)}
          sx={{ mb: 3 }}
        >
          {message.text}
        </Alert>
      )}

      {/* Statistiques */}
      <StatsCards />

      {/* Onglets */}
      <Card>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Utilisateurs" />
          <Tab label="Système" />
          <Tab label="Journaux" />
        </Tabs>
        
        {loading && <LinearProgress />}
        
        <Box sx={{ p: 3 }}>
          <TabPanel value={currentTab} index={0}>
            <Box sx={{ mb: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  setSelectedUser(null);
                  setUserFormData({
                    username: '',
                    email: '',
                    role: 'viewer',
                    is_active: true,
                  });
                  setUserDialogOpen(true);
                }}
              >
                Ajouter un utilisateur
              </Button>
            </Box>
            <UsersTable />
          </TabPanel>
          
          <TabPanel value={currentTab} index={1}>
            <Typography variant="h6" gutterBottom>
              Configuration du système
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Paramètres de configuration à implémenter
            </Typography>
          </TabPanel>
          
          <TabPanel value={currentTab} index={2}>
            <Typography variant="h6" gutterBottom>
              Journaux système
            </Typography>
            <SystemLogsList />
          </TabPanel>
        </Box>
      </Card>

      {/* Menu contextuel */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          const user = users.find(u => u.id === selectedUserId);
          if (user) handleEditUser(user);
        }}>
          <Edit sx={{ mr: 1 }} />
          Modifier
        </MenuItem>
        
        <MenuItem onClick={() => {
          const user = users.find(u => u.id === selectedUserId);
          if (user && selectedUserId) {
            handleToggleUserStatus(selectedUserId, user.is_active ?? true);
          }
        }}>
          <Block sx={{ mr: 1 }} />
          {users.find(u => u.id === selectedUserId)?.is_active ? 'Désactiver' : 'Activer'}
        </MenuItem>
        
        <MenuItem
          onClick={() => selectedUserId && handleDeleteUser(selectedUserId)}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog d'édition d'utilisateur */}
      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedUser ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom d'utilisateur"
            value={userFormData.username}
            onChange={(e) => setUserFormData(prev => ({ ...prev, username: e.target.value }))}
            margin="normal"
          />
          
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={userFormData.email}
            onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
            margin="normal"
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Rôle</InputLabel>
            <Select
              value={userFormData.role}
              label="Rôle"
              onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value as any }))}
            >
              <MenuItem value="viewer">Viewer</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSaveUser} variant="contained">
            {selectedUser ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPanel;
