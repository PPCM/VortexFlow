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
  Tooltip
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
  Person as PersonIcon
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
    search: '', 
    role: '', 
    status: undefined as 'active' | 'inactive' | undefined
  });

  // Chargement initial
  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === 1) loadUsers();
    else if (activeTab === 2) loadGraphs();
    else if (activeTab === 3) loadSimulations();
    else if (activeTab === 4) loadActivities();
    else if (activeTab === 5) loadSystemInfo();
  }, [activeTab, userFilters]);

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
      const data = await adminService.getUsers(userFilters);
      setUsers(data);
    } catch (err: any) {
      showSnackbar('Erreur lors du chargement des utilisateurs', 'error');
      console.error(err);
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
    if (!users) return null;

    return (
      <Box>
        {/* Filtres */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Rechercher..."
            value={userFilters.search}
            onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value, page: 1 })}
            size="small"
            sx={{ minWidth: 200 }}
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
          <Button variant="contained" onClick={loadUsers}>
            <RefreshIcon sx={{ mr: 1 }} /> Actualiser
          </Button>
        </Box>

        {/* Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Utilisateur</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rôle</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Statistiques</TableCell>
                <TableCell>Dernière activité</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2 }}>
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
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      color={user.role === 'admin' ? 'error' : user.role === 'editor' ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Actif' : 'Inactif'}
                      color={user.is_active ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {user.stats.totalGraphs} graphiques
                    </Typography>
                    <Typography variant="body2">
                      {user.stats.totalSimulations} simulations
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {user.stats.lastActivity ? new Date(user.stats.lastActivity).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Modifier">
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Désactiver">
                      <IconButton onClick={() => handleDeleteUser(user.id)} size="small" color="error">
                        <BlockIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={users.pagination.pages}
            page={users.pagination.page}
            onChange={(_, page) => {
              setUserFilters({ ...userFilters, page });
            }}
            color="primary"
          />
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
    </Box>
  );
};

export default AdminPanel;
