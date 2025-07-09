// VortexFlow Frontend - Tableau de Bord
// Page principale avec aperçu des graphiques et statistiques

import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  IconButton,
  Chip,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  Add,
  AccountTree,
  TrendingUp,
  Group,
  People,
  Timeline,
  PlayArrow,
  Visibility,
  Edit,
  MoreVert,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGraph } from '../../context/GraphContext';
import { usePermissions } from '../../context/AuthContext';
import LoadingPage from '../common/LoadingPage';

interface DashboardStats {
  totalGraphs: number;
  activeSimulations: number;
  totalUsers: number;
  recentActivity: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const { state: graphState, loadGraphs } = useGraph();
  const { canEdit, user } = usePermissions();

  // États locaux
  const [stats, setStats] = useState<DashboardStats>({
    totalGraphs: 0,
    activeSimulations: 0,
    totalUsers: 0,
    recentActivity: 0,
  });
  const [loading, setLoading] = useState(true);

  // =====================================
  // Effets
  // =====================================
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        await loadGraphs({ limit: 5 }); // Charger les 5 derniers graphiques
        
        // Simuler des statistiques (à remplacer par de vraies données API)
        setStats({
          totalGraphs: graphState.graphs.length,
          activeSimulations: 2,
          totalUsers: 12,
          recentActivity: 5,
        });
      } catch (error) {
        console.error('Erreur lors du chargement du dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [loadGraphs]);

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleCreateGraph = () => {
    navigate('/graphs/new');
  };

  const handleViewAllGraphs = () => {
    navigate('/graphs');
  };

  const handleViewGraph = (id: number) => {
    navigate(`/graphs/${id}/view`);
  };

  const handleEditGraph = (id: number) => {
    navigate(`/graphs/${id}/edit`);
  };

  // =====================================
  // Rendu conditionnel de chargement
  // =====================================
  if (loading) {
    return <LoadingPage message="Chargement du tableau de bord..." />;
  }

  // =====================================
  // Cartes de statistiques
  // =====================================
  const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactElement;
    color: string;
    trend?: string;
  }> = ({ title, value, icon, color, trend }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              backgroundColor: `${color}.main`,
              color: 'white',
              mr: 2,
            }}
          >
            {icon}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {title}
            </Typography>
          </Box>
        </Box>
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TrendingUp sx={{ color: 'success.main', mr: 1, fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: 'success.main' }}>
              {trend}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // =====================================
  // Rendu
  // =====================================
  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          Bonjour, {user?.username} 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Voici un aperçu de votre activité VortexFlow
        </Typography>
      </Box>

      {/* Statistiques */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 3, 
          mb: 4,
          '& > *': { 
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }
          }
        }}
      >
        <Box>
          <StatCard
            title="Graphiques"
            value={stats.totalGraphs}
            icon={<AccountTree />}
            color="primary"
            trend="+2 cette semaine"
          />
        </Box>
        <Box>
          <StatCard
            title="Simulations Actives"
            value={stats.activeSimulations}
            icon={<PlayArrow />}
            color="secondary"
          />
        </Box>
        <Box>
          <StatCard
            title="Utilisateurs"
            value={stats.totalUsers}
            icon={<People />}
            color="info"
            trend="+1 ce mois"
          />
        </Box>
        <Box>
          <StatCard
            title="Activité Récente"
            value={stats.recentActivity}
            icon={<Timeline />}
            color="success"
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Actions rapides */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Actions rapides
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Créez et gérez vos graphiques 3D
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {canEdit() && (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Add />}
                    onClick={handleCreateGraph}
                    sx={{
                      justifyContent: 'flex-start',
                      height: 56,
                      borderRadius: 2,
                    }}
                  >
                    Créer un nouveau graphique
                  </Button>
                )}
                
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<AccountTree />}
                  onClick={handleViewAllGraphs}
                  sx={{
                    justifyContent: 'flex-start',
                    height: 56,
                    borderRadius: 2,
                  }}
                >
                  Parcourir tous les graphiques
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Graphiques récents */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' } }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Graphiques récents
                </Typography>
                <Button
                  size="small"
                  onClick={handleViewAllGraphs}
                  sx={{ color: 'primary.main' }}
                >
                  Voir tout
                </Button>
              </Box>

              {graphState.graphs.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {graphState.graphs.slice(0, 4).map((graph, index) => (
                    <React.Fragment key={graph.id}>
                      <ListItem
                        sx={{
                          px: 0,
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            borderRadius: 1,
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              backgroundColor: index % 2 === 0 ? 'primary.main' : 'secondary.main',
                              width: 40,
                              height: 40,
                            }}
                          >
                            <AccountTree />
                          </Avatar>
                        </ListItemAvatar>
                        
                        <ListItemText
                          primary={graph.name}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={graph.is_public ? 'Public' : 'Privé'}
                                size="small"
                                color={graph.is_public ? 'success' : 'default'}
                                sx={{ height: 20, fontSize: '0.75rem' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                Modifié {new Date(graph.updated_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                        
                        <ListItemSecondaryAction>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleViewGraph(graph.id)}
                              title="Voir"
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                            
                            {canEdit() && (
                              <IconButton
                                size="small"
                                onClick={() => handleEditGraph(graph.id)}
                                title="Éditer"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                            
                            <IconButton size="small" title="Plus d'options">
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                      
                      {index < Math.min(graphState.graphs.length - 1, 3) && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Paper
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    backgroundColor: 'action.hover',
                    border: '2px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <AccountTree sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    Aucun graphique créé
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Commencez par créer votre premier graphique 3D
                  </Typography>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Activité système (placeholder) */}
        <Box sx={{ width: '100%' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                État du système
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 12px)' } }}>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Utilisation CPU</Typography>
                      <Typography variant="body2" color="text.secondary">23%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={23} sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                </Box>
                
                <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 12px)' } }}>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Mémoire</Typography>
                      <Typography variant="body2" color="text.secondary">67%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={67} color="warning" sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                </Box>
                
                <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 12px)' } }}>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Stockage</Typography>
                      <Typography variant="body2" color="text.secondary">45%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={45} color="success" sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
