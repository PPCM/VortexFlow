// VortexFlow Frontend - Liste des Graphiques
// Interface de gestion et navigation des graphiques

import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Fab,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Search,
  Add,
  FilterList,
  Visibility,
  Edit,
  Delete,
  FileCopy,
  Share,
  MoreVert,
  Public,
  Lock,
  PlayArrow,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGraph } from '../../context/GraphContext';
import { usePermissions } from '../../context/AuthContext';
import { GraphFilters } from '../../types';
import LoadingPage from '../common/LoadingPage';

const GraphList: React.FC = () => {
  const navigate = useNavigate();
  const { state, loadGraphs, deleteGraph, duplicateGraph } = useGraph();
  const { canEdit, canAdmin } = usePermissions();

  // États locaux
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<GraphFilters>({});
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedGraphId, setSelectedGraphId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');

  // =====================================
  // Effets
  // =====================================
  useEffect(() => {
    loadGraphs(filters);
  }, [loadGraphs, filters]);

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    // Appliquer la recherche avec un délai (debounce)
    setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        search: event.target.value || undefined,
      }));
    }, 500);
  };

  const handleFilterChange = (key: keyof GraphFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, graphId: number) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedGraphId(graphId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedGraphId(null);
  };

  const handleView = (id: number) => {
    navigate(`/graphs/${id}/view`);
  };

  const handleEdit = (id: number) => {
    navigate(`/graphs/${id}/edit`);
  };

  const handleDelete = async () => {
    if (selectedGraphId) {
      await deleteGraph(selectedGraphId);
      setDeleteDialogOpen(false);
      handleMenuClose();
    }
  };

  const handleDuplicate = async () => {
    if (selectedGraphId && duplicateName) {
      await duplicateGraph(selectedGraphId, duplicateName);
      setDuplicateDialogOpen(false);
      setDuplicateName('');
      handleMenuClose();
    }
  };

  const handleCreateNew = () => {
    navigate('/graphs/create');
  };

  // =====================================
  // Rendu conditionnel
  // =====================================
  if (state.loading) {
    return <LoadingPage message="Chargement des graphiques..." />;
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
            Graphiques
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez vos visualisations 3D
          </Typography>
        </Box>
        
        {canEdit() && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateNew}
            size="large"
            sx={{ borderRadius: 2 }}
          >
            Nouveau Graphique
          </Button>
        )}
      </Box>

      {/* Erreur */}
      {state.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {state.error}
        </Alert>
      )}

      {/* Barre de recherche et filtres */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' } }}>
              <TextField
                fullWidth
                placeholder="Rechercher des graphiques..."
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                variant="outlined"
                size="small"
              />
            </Box>
            
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(16.666% - 8px)' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Visibilité</InputLabel>
                <Select
                  value={filters.isPublic ?? ''}
                  label="Visibilité"
                  onChange={(e) => handleFilterChange('isPublic', e.target.value === '' ? undefined : e.target.value === 'true')}
                >
                  <MenuItem value="">Tous</MenuItem>
                  <MenuItem value="true">Public</MenuItem>
                  <MenuItem value="false">Privé</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(16.666% - 8px)' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Trier par</InputLabel>
                <Select
                  value={filters.sortBy || 'updated_at'}
                  label="Trier par"
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <MenuItem value="updated_at">Date de modification</MenuItem>
                  <MenuItem value="created_at">Date de création</MenuItem>
                  <MenuItem value="name">Nom</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(16.666% - 8px)' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Ordre</InputLabel>
                <Select
                  value={filters.sortOrder || 'desc'}
                  label="Ordre"
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                >
                  <MenuItem value="desc">Décroissant</MenuItem>
                  <MenuItem value="asc">Croissant</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Liste des graphiques */}
      {state.graphs.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {state.graphs.map((graph) => (
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)', lg: '1 1 calc(25% - 18px)' } }} key={graph.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                {/* Aperçu du graphique */}
                <Box
                  sx={{
                    height: 160,
                    background: 'linear-gradient(45deg, rgba(0,255,136,0.1), rgba(255,107,53,0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Aperçu 3D
                  </Typography>
                  
                  {/* Indicateur de visibilité */}
                  <Chip
                    icon={graph.is_public ? <Public /> : <Lock />}
                    label={graph.is_public ? 'Public' : 'Privé'}
                    size="small"
                    color={graph.is_public ? 'success' : 'default'}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                  />
                </Box>

                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom noWrap>
                    {graph.name}
                  </Typography>
                  
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      mb: 2,
                    }}
                  >
                    {graph.description || 'Aucune description'}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip
                      label={`${(graph.data?.nodes || []).length} nœuds`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`${(graph.data?.edges || []).length} arêtes`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    Modifié le {new Date(graph.updated_at).toLocaleDateString()}
                  </Typography>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Box>
                    <Tooltip title="Voir">
                      <IconButton
                        size="small"
                        onClick={() => handleView(graph.id)}
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    
                    {canEdit() && (
                      <Tooltip title="Éditer">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(graph.id)}
                          color="secondary"
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="Simuler">
                      <IconButton
                        size="small"
                        onClick={() => handleView(graph.id)}
                        color="success"
                      >
                        <PlayArrow />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, graph.id)}
                  >
                    <MoreVert />
                  </IconButton>
                </CardActions>
              </Card>
            </Box>
          ))}
        </Box>
      ) : (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Search sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Aucun graphique trouvé
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm ? 'Essayez de modifier vos critères de recherche' : 'Commencez par créer votre premier graphique'}
            </Typography>
            {canEdit() && !searchTerm && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateNew}
              >
                Créer un graphique
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* FAB pour création rapide */}
      {canEdit() && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={handleCreateNew}
        >
          <Add />
        </Fab>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); selectedGraphId && handleView(selectedGraphId); }}>
          <Visibility sx={{ mr: 1 }} />
          Voir
        </MenuItem>
        
        {canEdit() && (
          <MenuItem onClick={() => { handleMenuClose(); selectedGraphId && handleEdit(selectedGraphId); }}>
            <Edit sx={{ mr: 1 }} />
            Éditer
          </MenuItem>
        )}
        
        {canEdit() && (
          <MenuItem onClick={() => { handleMenuClose(); setDuplicateDialogOpen(true); }}>
            <FileCopy sx={{ mr: 1 }} />
            Dupliquer
          </MenuItem>
        )}
        
        <MenuItem onClick={() => { handleMenuClose(); /* Implémenter partage */ }}>
          <Share sx={{ mr: 1 }} />
          Partager
        </MenuItem>
        
        {canEdit() && (
          <MenuItem onClick={() => { handleMenuClose(); setDeleteDialogOpen(true); }} sx={{ color: 'error.main' }}>
            <Delete sx={{ mr: 1 }} />
            Supprimer
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Supprimer le graphique</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer ce graphique ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de duplication */}
      <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)}>
        <DialogTitle>Dupliquer le graphique</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom du nouveau graphique"
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleDuplicate} variant="contained" disabled={!duplicateName}>
            Dupliquer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GraphList;
