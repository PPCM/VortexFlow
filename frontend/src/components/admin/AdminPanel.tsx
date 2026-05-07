/**
 * VortexFlow Frontend - Panneau d'Administration
 * Interface moderne de gestion administrative du système VortexFlow
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Alert,
  LinearProgress,
  Avatar,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  IconButton,
  Tooltip,
  Checkbox,
  InputAdornment
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  PlayArrow as PlayIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Search as SearchIcon,
  VpnKey as VpnKeyIcon,
  Check as CheckIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

import { 
  adminService, 
  AdminStats,
  UserWithStats,
  GraphWithStats,
  SimulationWithDetails,
  ActivityLogEntry,
  SystemInfo,
  PaginatedResponse
} from '../../services/adminService';

// Import CSS personnalisé
import './AdminPanel.css';

// Import des composants de gestion des utilisateurs
import UserManagementDialog, { UserFormData } from './UserManagementDialog';
import BulkActionsBar from './BulkActionsBar';
import PasswordResetDialog from './PasswordResetDialog';

// Interface pour les panneaux d'onglets
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AdminPanel: React.FC = () => {
  // État principal
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'info' as 'success' | 'error' | 'info' | 'warning' 
  });

  // États des données
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<PaginatedResponse<UserWithStats> | null>(null);
  const [graphs, setGraphs] = useState<PaginatedResponse<GraphWithStats> | null>(null);
  const [simulations, setSimulations] = useState<PaginatedResponse<SimulationWithDetails> | null>(null);
  const [activities, setActivities] = useState<PaginatedResponse<ActivityLogEntry> | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // États des filtres et pagination
  const [userFilters, setUserFilters] = useState({ 
    page: 1, 
    limit: 20,
    search: '', 
    role: '', 
    status: undefined as 'active' | 'inactive' | undefined
  });

  // États pour la gestion des utilisateurs
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [userDialog, setUserDialog] = useState({ open: false, user: null as UserWithStats | null });
  const [passwordDialog, setPasswordDialog] = useState({ open: false, user: null as UserWithStats | null });
  const [userDialogLoading, setUserDialogLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Chargement initial
  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chargement des données quand on change d'onglet
  useEffect(() => {
    if (activeTab === 1) loadUsers();
    else if (activeTab === 2) loadGraphs();
    else if (activeTab === 3) loadSimulations();
    else if (activeTab === 4) loadActivities();
    else if (activeTab === 5) loadSystemInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Rechargement des utilisateurs quand les filtres changent
  useEffect(() => {
    if (activeTab === 1) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilters]);

  // Fonctions de chargement des données
  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getStats();
      setStats(data);
    } catch (err: any) {
      setError('Erreur lors du chargement des statistiques');
      showSnackbar('Impossible de charger les statistiques', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Actualisation complète de toutes les données
  const refreshAllData = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        loadStats(),
        loadUsers(),
        loadGraphs(),
        loadSimulations(),
        loadActivities()
      ]);
      showSnackbar('Données actualisées avec succès', 'success');
    } catch (err: any) {
      showSnackbar('Erreur lors de l\'actualisation', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = {
        ...userFilters,
        limit: userFilters.limit === -1 ? undefined : userFilters.limit // -1 = tout afficher
      };
      const data = await adminService.getUsers(params);
      setUsers(data);
    } catch (err: any) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      if (err.response?.status === 401) {
        showSnackbar('Authentification requise. Veuillez vous reconnecter.', 'error');
      } else {
        showSnackbar(`Erreur lors du chargement des utilisateurs: ${err.message || 'Erreur inconnue'}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGraphs = async () => {
    try {
      setLoading(true);
      const data = await adminService.getGraphs({ page: 1, search: '' });
      setGraphs(data);
    } catch (err: any) {
      showSnackbar('Erreur lors du chargement des graphiques', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSimulations = async () => {
    try {
      setLoading(true);
      const data = await adminService.getSimulations({ page: 1 });
      setSimulations(data);
    } catch (err: any) {
      showSnackbar('Erreur lors du chargement des simulations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await adminService.getActivityLog({ page: 1 });
      setActivities(data);
    } catch (err: any) {
      showSnackbar('Erreur lors du chargement des activités', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      setLoading(true);
      const data = await adminService.getSystemInfo();
      setSystemInfo(data);
    } catch (err: any) {
      showSnackbar('Erreur lors du chargement des informations système', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fonctions utilitaires
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Actions utilisateurs
  const handleDeleteUser = async (id: number) => {
    try {
      await adminService.deleteUser(id);
      showSnackbar('Utilisateur désactivé avec succès', 'success');
      loadUsers();
    } catch (err: any) {
      showSnackbar('Erreur lors de la suppression de l\'utilisateur', 'error');
    }
  };

  const handlePermanentDeleteUser = async (id: number) => {
    try {
      await adminService.permanentDeleteUser(id);
      showSnackbar('Utilisateur supprimé définitivement', 'success');
      loadUsers();
    } catch (err: any) {
      showSnackbar('Erreur lors de la suppression définitive de l\'utilisateur', 'error');
    }
  };

  // Gestion complète des utilisateurs
  const handleCreateUser = () => {
    setUserDialog({ open: true, user: null });
  };

  const handleEditUser = (user: UserWithStats) => {
    setUserDialog({ open: true, user });
  };

  const handleUserSubmit = async (userData: UserFormData) => {
    setUserDialogLoading(true);
    try {
      if (userDialog.user) {
        // Mode édition
        await adminService.updateUser(userDialog.user.id, userData);
        showSnackbar('Utilisateur modifié avec succès', 'success');
      } else {
        // Mode création - password obligatoire
        if (!userData.password) {
          throw new Error('Le mot de passe est requis pour créer un utilisateur');
        }
        await adminService.createUser({
          ...userData,
          password: userData.password
        });
        showSnackbar('Utilisateur créé avec succès', 'success');
      }
      loadUsers();
    } catch (err: any) {
      showSnackbar(
        `Erreur lors de ${userDialog.user ? 'la modification' : 'la création'} de l'utilisateur`, 
        'error'
      );
      throw err; // Pour empêcher la fermeture du dialog
    } finally {
      setUserDialogLoading(false);
    }
  };

  const handlePasswordReset = (user: UserWithStats) => {
    setPasswordDialog({ open: true, user });
  };

  const handlePasswordSubmit = async (newPassword: string) => {
    if (!passwordDialog.user) return;
    
    try {
      await adminService.resetUserPassword(passwordDialog.user.id, newPassword);
      showSnackbar('Mot de passe réinitialisé avec succès', 'success');
    } catch (err: any) {
      showSnackbar('Erreur lors de la réinitialisation du mot de passe', 'error');
      throw err;
    }
  };

  // Gestion de la sélection multiple
  const handleUserSelect = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && users?.data) {
      setSelectedUsers(users.data.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const clearSelection = () => {
    setSelectedUsers([]);
  };

  // Actions en masse
  const handleBulkActivate = async () => {
    setBulkActionLoading(true);
    try {
      await adminService.bulkUserAction('activate', selectedUsers);
      showSnackbar(`${selectedUsers.length} utilisateur(s) activé(s)`, 'success');
      clearSelection();
      loadUsers();
    } catch (err: any) {
      showSnackbar('Erreur lors de l\'activation en masse', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setBulkActionLoading(true);
    try {
      await adminService.bulkUserAction('deactivate', selectedUsers);
      showSnackbar(`${selectedUsers.length} utilisateur(s) désactivé(s)`, 'success');
      clearSelection();
      loadUsers();
    } catch (err: any) {
      showSnackbar('Erreur lors de la désactivation en masse', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    // Confirmation avant suppression définitive
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer définitivement ${selectedUsers.length} utilisateur(s) ? Cette action est irréversible.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setBulkActionLoading(true);
    try {
      await adminService.bulkUserAction('permanent_delete', selectedUsers);
      showSnackbar(`${selectedUsers.length} utilisateur(s) supprimé(s) définitivement`, 'success');
      clearSelection();
      loadUsers();
    } catch (err: any) {
      showSnackbar('Erreur lors de la suppression définitive en masse', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Rendu des cartes de statistiques
  const renderStatsCards = () => {
    if (!stats) return null;

    const cards = [
      {
        title: 'Utilisateurs Total',
        value: stats.overview.totalUsers,
        icon: <PeopleIcon />,
        color: '#1976d2',
        subtitle: `+${stats.overview.recentUsers} cette semaine`
      },
      {
        title: 'Graphiques',
        value: stats.overview.totalGraphs,
        icon: <StorageIcon />,
        color: '#388e3c',
        subtitle: `${stats.breakdown.graphsByStatus.public} publics`
      },
      {
        title: 'Simulations Actives',
        value: stats.overview.activeSimulations,
        icon: <PlayIcon />,
        color: '#f57c00',
        subtitle: `${stats.overview.totalSimulations} au total`
      },
      {
        title: 'Activité Aujourd\'hui',
        value: stats.overview.todayActivity,
        icon: <TimelineIcon />,
        color: '#7b1fa2',
        subtitle: 'Actions utilisateur'
      }
    ];

    return (
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        {cards.map((card, index) => (
          <Card key={index} sx={{ flex: { xs: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }, minWidth: 200 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ backgroundColor: card.color, mr: 2 }}>
                  {card.icon}
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                    {card.value.toLocaleString()}
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {card.title}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {card.subtitle}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  // Rendu de la table des utilisateurs
  const renderUsersTable = () => {
    // Affichage pendant le chargement initial
    if (!users && loading) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Chargement des utilisateurs...
          </Typography>
        </Box>
      );
    }

    // Affichage si aucun utilisateur (première fois ou erreur)
    if (!users) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Aucun utilisateur chargé
          </Typography>
          <Button 
            variant="contained" 
            onClick={loadUsers}
            startIcon={<RefreshIcon />}
          >
            Charger les utilisateurs
          </Button>
        </Box>
      );
    }

    // Affichage si la liste est vide
    if (users.data.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Aucun utilisateur trouvé
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {userFilters.search || userFilters.role || userFilters.status 
              ? 'Essayez de modifier vos filtres de recherche'
              : 'Commencez par créer votre premier utilisateur'
            }
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              onClick={handleCreateUser}
              startIcon={<AddIcon />}
            >
              Créer un utilisateur
            </Button>
            {(userFilters.search || userFilters.role || userFilters.status) && (
              <Button 
                variant="outlined" 
                onClick={() => {
                  setUserFilters({ page: 1, limit: 20, search: '', role: '', status: undefined });
                }}
              >
                Effacer les filtres
              </Button>
            )}
          </Box>
        </Box>
      );
    }

    const isAllSelected = users.data.length > 0 && selectedUsers.length === users.data.length;
    const isSomeSelected = selectedUsers.length > 0 && selectedUsers.length < users.data.length;

    return (
      <Box>


        {/* Filtres */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Rechercher par nom ou email..."
            value={userFilters.search}
            onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value, page: 1 })}
            size="small"
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              )
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Rôle</InputLabel>
            <Select
              value={userFilters.role}
              onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value, page: 1 })}
              label="Rôle"
            >
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="user">Utilisateur</MenuItem>
              <MenuItem value="editor">Éditeur</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Statut</InputLabel>
            <Select
              value={userFilters.status || ''}
              onChange={(e) => {
                const value = e.target.value as string;
                setUserFilters({ 
                  ...userFilters, 
                  status: value === '' ? undefined : value as 'active' | 'inactive',
                  page: 1 
                });
              }}
              label="Statut"
            >
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="active">Actif</MenuItem>
              <MenuItem value="inactive">Inactif</MenuItem>
            </Select>
          </FormControl>

          <Button 
            variant="outlined" 
            onClick={loadUsers}
            disabled={loading}
            startIcon={<RefreshIcon />}
          >
            Actualiser
          </Button>
        </Box>

        {/* Barre d'actions en masse - Permanente et discrète */}
        <Box sx={{ 
          mb: 2, 
          p: 1.5, 
          bgcolor: selectedUsers.length > 0 
            ? 'primary.light' 
            : (theme) => theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.02)' 
              : 'grey.100', 
          borderRadius: 1, 
          border: selectedUsers.length > 0 ? '1px solid' : '1px dashed',
          borderColor: selectedUsers.length > 0 
            ? 'primary.main' 
            : (theme) => theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'grey.300',
          transition: 'all 0.3s ease',
          opacity: selectedUsers.length > 0 ? 1 : 0.7
        }}>
          <BulkActionsBar
            selectedCount={selectedUsers.length}
            onActivate={handleBulkActivate}
            onDeactivate={handleBulkDeactivate}
            onDelete={handleBulkDelete}
            onClear={clearSelection}
            loading={bulkActionLoading}
          />
        </Box>

        {/* Table */}
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.light' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isSomeSelected}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectAll(e.target.checked)}
                      size="small"
                    />
                    Utilisateur
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Rôle</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Statistiques</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Dernière activité</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.data.map((user) => {
                const isSelected = selectedUsers.includes(user.id);
                return (
                  <TableRow 
                    key={user.id}
                    selected={isSelected}
                    hover
                    sx={{
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      },
                      ...(isSelected && {
                        backgroundColor: 'primary.light',
                        '&:hover': {
                          backgroundColor: 'primary.main'
                        }
                      })
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUserSelect(user.id, e.target.checked)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Avatar sx={{ mr: 2, bgcolor: user.role === 'admin' ? 'error.main' : user.role === 'editor' ? 'warning.main' : 'primary.main' }}>
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {user.first_name} {user.last_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {user.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{user.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role.toUpperCase()}
                        color={user.role === 'admin' ? 'error' : user.role === 'editor' ? 'warning' : 'primary'}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'Actif' : 'Inactif'}
                        color={user.is_active ? 'success' : 'error'}
                        size="small"
                        variant={user.is_active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          📊 {user.stats.totalGraphs} graphiques
                        </Typography>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          🧪 {user.stats.totalSimulations} simulations
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {user.stats.lastActivity 
                          ? new Date(user.stats.lastActivity).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })
                          : 'Jamais'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Modifier l'utilisateur">
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditUser(user)}
                            sx={{ color: 'primary.main' }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Réinitialiser le mot de passe">
                          <IconButton 
                            size="small" 
                            onClick={() => handlePasswordReset(user)}
                            sx={{ color: 'warning.main' }}
                          >
                            <VpnKeyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={user.is_active ? 'Désactiver' : 'Activer'}>
                          <IconButton 
                            onClick={() => handleDeleteUser(user.id)} 
                            size="small" 
                            sx={{ color: user.is_active ? 'error.main' : 'success.main' }}
                          >
                            {user.is_active ? <BlockIcon /> : <CheckIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer définitivement">
                          <IconButton 
                            onClick={() => {
                              if (window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action est irréversible.')) {
                                handlePermanentDeleteUser(user.id);
                              }
                            }}
                            size="small" 
                            sx={{ color: 'error.dark' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination avec nouveau layout */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
          {/* Sélecteur Éléments par page - Bas gauche */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Éléments par page</InputLabel>
            <Select
              value={userFilters.limit}
              onChange={(e) => {
                const newLimit = Number(e.target.value);
                setUserFilters({ ...userFilters, limit: newLimit, page: 1 });
              }}
              label="Éléments par page"
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={15}>15</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={30}>30</MenuItem>
              <MenuItem value={40}>40</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={150}>150</MenuItem>
              <MenuItem value={200}>200</MenuItem>
              <MenuItem value={300}>300</MenuItem>
              <MenuItem value={400}>400</MenuItem>
              <MenuItem value={500}>500</MenuItem>
              <MenuItem value={-1}>Tout</MenuItem>
            </Select>
          </FormControl>
          
          {/* Texte d'affichage - Centré */}
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            {users && userFilters.limit === -1 ? (
              `tous les ${users.pagination?.total || 0} utilisateurs`
            ) : users ? (
              `de ${((users.pagination.page - 1) * users.pagination.limit) + 1} à ${Math.min(users.pagination.page * users.pagination.limit, users.pagination.total)} utilisateurs sur ${users.pagination.total} utilisateurs`
            ) : (
              'Chargement...'
            )}
          </Typography>
          
          {/* Pagination - Droite (ou message si une seule page) */}
          {users && userFilters.limit !== -1 && users.pagination && users.pagination.pages > 1 ? (
            <Pagination
              count={users.pagination.pages}
              page={users.pagination.page}
              onChange={(_, page) => {
                setUserFilters({ ...userFilters, page });
              }}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
            />
          ) : (
            <Box sx={{ minWidth: 150 }} /> 
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* En-tête */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider', 
        bgcolor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              🎛️ Panneau d'Administration
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Gestion centralisée de la plateforme VortexFlow
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Actualiser toutes les données">
              <IconButton 
                onClick={refreshAllData} 
                disabled={refreshing}
                color="primary"
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Barre de progression */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Message d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Cartes de statistiques (toujours visibles) */}
      {renderStatsCards()}

      {/* Onglets */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="admin tabs">
          <Tab icon={<DashboardIcon />} label="Vue d'ensemble" />
          <Tab icon={<PeopleIcon />} label="Utilisateurs" />
          <Tab icon={<StorageIcon />} label="Graphiques" />
          <Tab icon={<PlayIcon />} label="Simulations" />
          <Tab icon={<TimelineIcon />} label="Activité" />
          <Tab icon={<SettingsIcon />} label="Système" />
        </Tabs>
      </Box>

      {/* Contenu des onglets */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
            <DashboardIcon /> Tableau de Bord
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setActiveTab(1)}
              startIcon={<PeopleIcon />}
            >
              Gérer Utilisateurs
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setActiveTab(3)}
              startIcon={<PlayIcon />}
            >
              Voir Simulations
            </Button>
          </Box>
        </Box>
        {renderStatsCards()}
        
        {/* Section Raccourcis rapides */}
        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ⚡ Actions Rapides
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setActiveTab(1)}
                startIcon={<PeopleIcon />}
              >
                Gestion Utilisateurs
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setActiveTab(2)}
                startIcon={<StorageIcon />}
              >
                Gestion Graphiques
              </Button>
              <Button
                variant="contained"
                color="warning"
                onClick={() => setActiveTab(3)}
                startIcon={<PlayIcon />}
              >
                Monitoring Simulations
              </Button>
              <Button
                variant="contained"
                color="info"
                onClick={() => setActiveTab(5)}
                startIcon={<SettingsIcon />}
              >
                Paramètres Système
              </Button>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
            <PeopleIcon /> Gestion des Utilisateurs
            {users && (
              <Chip 
                label={`${users.pagination.total || 0} total`} 
                color="primary" 
                variant="outlined" 
                size="small"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            startIcon={<AddIcon />}
            disabled={userDialogLoading}
          >
            Nouvel Utilisateur
          </Button>
        </Box>
        {renderUsersTable()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Box sx={{ display: 'flex', justify: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
            <StorageIcon /> Gestion des Graphiques
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={`${stats?.overview.totalGraphs || 0} graphiques`} 
              color="secondary" 
              variant="outlined"
            />
            <Button
              variant="contained"
              size="small"
              onClick={loadGraphs}
              startIcon={<RefreshIcon />}
              disabled={loading}
            >
              Actualiser
            </Button>
          </Box>
        </Box>
        
        {/* Statistiques graphiques */}
        {stats && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  {stats.breakdown.graphsByStatus.public}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Graphiques Publics
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  {stats.breakdown.graphsByStatus.private}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Graphiques Privés
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}
        
        <Alert severity="info" sx={{ mb: 2 }}>
          💡 Section en développement - Gestion complète des graphiques DOT à venir
        </Alert>
        
        {graphs && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Aperçu des Graphiques</Typography>
              <Typography variant="body2" color="text.secondary">
                {graphs.pagination.total} graphiques trouvés
              </Typography>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Typography variant="h6" gutterBottom>
          Gestion des Simulations
        </Typography>
        <Typography variant="body1">
          {simulations ? `${simulations.pagination.total} simulations au total` : 'Section en cours de développement...'}
        </Typography>
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <Typography variant="h6" gutterBottom>
          Journal d'Activité
        </Typography>
        <Typography variant="body1">
          {activities ? `${activities.pagination.total} entrées d'activité` : 'Section en cours de développement...'}
        </Typography>
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <Box sx={{ display: 'flex', justify: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
            <SettingsIcon /> Paramètres Système
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={loadSystemInfo}
            startIcon={<RefreshIcon />}
            disabled={loading}
          >
            Actualiser Infos
          </Button>
        </Box>
        
        {systemInfo && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Informations serveur */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🖥️ Informations Serveur
                </Typography>
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mt: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Version</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{systemInfo.version}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Node.js</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{systemInfo.nodeVersion}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Environnement</Typography>
                    <Chip label={systemInfo.environment} size="small" color="primary" />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Plateforme</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {systemInfo.platform} ({systemInfo.architecture})
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            {/* Mémoire */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  💾 Utilisation Mémoire
                </Typography>
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mt: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Heap Utilisé</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                      {adminService.formatMemorySize(systemInfo.memory.heapUsed)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Heap Total</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {adminService.formatMemorySize(systemInfo.memory.heapTotal)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">RSS</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {adminService.formatMemorySize(systemInfo.memory.rss)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            {/* Base de données */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🗄️ Bases de Données
                </Typography>
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mt: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">PostgreSQL</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {systemInfo.database.host}:{systemInfo.database.port}
                    </Typography>
                    <Chip label={systemInfo.database.name} size="small" color="success" />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Redis</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {systemInfo.redis.host}:{systemInfo.redis.port}
                    </Typography>
                    <Chip label="Connecté" size="small" color="success" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            {/* Actions système */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔧 Actions Système
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => showSnackbar('Sauvegarde en cours...', 'info')}
                    startIcon={<StorageIcon />}
                  >
                    Créer Sauvegarde
                  </Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={refreshAllData}
                    startIcon={<RefreshIcon />}
                  >
                    Actualiser Cache
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
        
        {!systemInfo && (
          <Alert severity="info">
            💡 Chargement des informations système...
          </Alert>
        )}
      </TabPanel>

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Dialogues de gestion des utilisateurs */}
      <UserManagementDialog
        open={userDialog.open}
        user={userDialog.user}
        onClose={() => setUserDialog({ open: false, user: null })}
        onSubmit={handleUserSubmit}
        onDelete={handlePermanentDeleteUser}
        loading={userDialogLoading}
      />

      <PasswordResetDialog
        open={passwordDialog.open}
        user={passwordDialog.user}
        onClose={() => setPasswordDialog({ open: false, user: null })}
        onSubmit={handlePasswordSubmit}
        loading={userDialogLoading}
      />
    </Box>
  );
};

export default AdminPanel;
