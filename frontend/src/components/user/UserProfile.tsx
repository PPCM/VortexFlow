// VortexFlow Frontend - Profil Utilisateur
// Gestion des préférences et informations personnelles

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  TextField,
  Button,
  Avatar,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Paper,
  Tab,
  Tabs,
  LinearProgress,
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  PhotoCamera,
  Security,
  Notifications,
  Palette,
  Language,
  AccountTree,
  TrendingUp,
  Settings,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useGraph } from '../../context/GraphContext';
import apiService from '../../services/api';

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
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const UserProfile: React.FC = () => {
  const { state: authState, refreshUser } = useAuth();
  const { state: graphState, loadGraphs } = useGraph();
  
  // États locaux
  const [currentTab, setCurrentTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  
  // Données utilisateur
  const [userData, setUserData] = useState({
    // Backend ne renvoie pas `username`; fallback sur fullName/firstName/email.
    username: (authState.user as any)?.username
      || (authState.user as any)?.fullName
      || (authState.user as any)?.firstName
      || authState.user?.email
      || '',
    email: authState.user?.email || '',
    firstName: (authState.user as any)?.firstName || '',
    lastName: (authState.user as any)?.lastName || '',
    bio: '',
  });
  
  // Préférences
  const [preferences, setPreferences] = useState({
    notifications: true,
    emailUpdates: false,
    darkMode: true,
    language: 'fr',
    autoSave: true,
    realTimeCollaboration: true,
  });
  
  // Changement de mot de passe
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Statistiques utilisateur
  const [userStats, setUserStats] = useState({
    totalGraphs: 0,
    publicGraphs: 0,
    privateGraphs: 0,
    totalViews: 0,
    collaborations: 0,
    lastActivity: null as Date | null,
  });

  // =====================================
  // Effets
  // =====================================
  useEffect(() => {
    if (authState.user) {
      setUserData({
        username: authState.user.username,
        email: authState.user.email,
        firstName: authState.user.first_name || '',
        lastName: authState.user.last_name || '',
        bio: authState.user.bio || '',
      });
    }
  }, [authState.user]);

  useEffect(() => {
    // Charger les graphiques de l'utilisateur pour les statistiques
    loadGraphs({ userId: authState.user?.id });
  }, [authState.user, loadGraphs]);

  useEffect(() => {
    // Calculer les statistiques
    if (graphState.graphs) {
      const publicGraphs = graphState.graphs.filter(g => g.is_public).length;
      const privateGraphs = graphState.graphs.length - publicGraphs;
      
      setUserStats({
        totalGraphs: graphState.graphs.length,
        publicGraphs,
        privateGraphs,
        totalViews: graphState.graphs.reduce((sum, g) => sum + (g.view_count || 0), 0),
        collaborations: 0, // À implémenter
        lastActivity: graphState.graphs.length > 0 
          ? new Date(Math.max(...graphState.graphs.map(g => new Date(g.updated_at).getTime())))
          : null,
      });
    }
  }, [graphState.graphs]);

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handlePreferenceChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPreferences(prev => ({
      ...prev,
      [key]: event.target.checked,
    }));
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const response = await apiService.updateUserProfile(userData);
      await refreshUser();
      setEditing(false);
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour du profil' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await apiService.updateUserPreferences(preferences);
      setMessage({ type: 'success', text: 'Préférences sauvegardées' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des préférences' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas' });
      return;
    }
    
    setLoading(true);
    try {
      await apiService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      setPasswordDialogOpen(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors du changement de mot de passe' });
    } finally {
      setLoading(false);
    }
  };

  // =====================================
  // Composants internes
  // =====================================
  const ProfileStats: React.FC = () => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(25% - 12px)' } }}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="primary.main" fontWeight="bold">
            {userStats.totalGraphs}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Graphiques
          </Typography>
        </Paper>
      </Box>
      
      <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(25% - 12px)' } }}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="success.main" fontWeight="bold">
            {userStats.publicGraphs}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Publics
          </Typography>
        </Paper>
      </Box>
      
      <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(25% - 12px)' } }}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="info.main" fontWeight="bold">
            {userStats.totalViews}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vues totales
          </Typography>
        </Paper>
      </Box>
      
      <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(25% - 12px)' } }}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="secondary.main" fontWeight="bold">
            {userStats.collaborations}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Collaborations
          </Typography>
        </Paper>
      </Box>
    </Box>
  );

  // =====================================
  // Rendu
  // =====================================
  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          Mon Profil
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gérez vos informations personnelles et préférences
        </Typography>
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

      {/* Onglets */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Informations" />
          <Tab label="Préférences" />
          <Tab label="Sécurité" />
          <Tab label="Statistiques" />
        </Tabs>
      </Card>

      {/* Contenu des onglets */}
      <TabPanel value={currentTab} index={0}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  mr: 3,
                  backgroundColor: 'primary.main',
                  fontSize: '2rem',
                }}
              >
                {(((authState.user as any)?.fullName as string)
                  || ((authState.user as any)?.firstName as string)
                  || (authState.user?.email as string)
                  || '?').charAt(0).toUpperCase()}
              </Avatar>

              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" gutterBottom>
                  {(authState.user as any)?.fullName
                    || (authState.user as any)?.firstName
                    || authState.user?.email
                    || 'Utilisateur'}
                </Typography>
                <Chip
                  label={authState.user?.role}
                  color="primary"
                  variant="outlined"
                />
              </Box>
              
              <IconButton color="primary">
                <PhotoCamera />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                <TextField
                  fullWidth
                  label="Nom d'utilisateur"
                  value={userData.username}
                  onChange={handleInputChange('username')}
                  disabled={!editing}
                  margin="normal"
                />
              </Box>
              
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                <TextField
                  fullWidth
                  label="Email"
                  value={userData.email}
                  onChange={handleInputChange('email')}
                  disabled={!editing}
                  margin="normal"
                />
              </Box>
              
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                <TextField
                  fullWidth
                  label="Prénom"
                  value={userData.firstName}
                  onChange={handleInputChange('firstName')}
                  disabled={!editing}
                  margin="normal"
                />
              </Box>
              
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                <TextField
                  fullWidth
                  label="Nom"
                  value={userData.lastName}
                  onChange={handleInputChange('lastName')}
                  disabled={!editing}
                  margin="normal"
                />
              </Box>
              
              <Box sx={{ flex: '1 1 100%' }}>
                <TextField
                  fullWidth
                  label="Bio"
                  value={userData.bio}
                  onChange={handleInputChange('bio')}
                  disabled={!editing}
                  margin="normal"
                  multiline
                  rows={3}
                />
              </Box>
            </Box>
          </CardContent>
          
          <CardActions>
            {editing ? (
              <>
                <Button
                  onClick={handleSaveProfile}
                  startIcon={<Save />}
                  variant="contained"
                  disabled={loading}
                >
                  Sauvegarder
                </Button>
                <Button
                  onClick={() => setEditing(false)}
                  startIcon={<Cancel />}
                >
                  Annuler
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setEditing(true)}
                startIcon={<Edit />}
                variant="outlined"
              >
                Modifier
              </Button>
            )}
          </CardActions>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Préférences de l'application
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <Notifications />
                </ListItemIcon>
                <ListItemText
                  primary="Notifications"
                  secondary="Recevoir des notifications dans l'application"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.notifications}
                    onChange={handlePreferenceChange('notifications')}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <Settings />
                </ListItemIcon>
                <ListItemText
                  primary="Sauvegarde automatique"
                  secondary="Sauvegarder automatiquement les modifications"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.autoSave}
                    onChange={handlePreferenceChange('autoSave')}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <AccountTree />
                </ListItemIcon>
                <ListItemText
                  primary="Collaboration temps réel"
                  secondary="Activer la collaboration en temps réel"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.realTimeCollaboration}
                    onChange={handlePreferenceChange('realTimeCollaboration')}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
          
          <CardActions>
            <Button
              onClick={handleSavePreferences}
              startIcon={<Save />}
              variant="contained"
              disabled={loading}
            >
              Sauvegarder les préférences
            </Button>
          </CardActions>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sécurité du compte
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <Security />
                </ListItemIcon>
                <ListItemText
                  primary="Mot de passe"
                  secondary="Dernière modification il y a 30 jours"
                />
                <ListItemSecondaryAction>
                  <Button
                    onClick={() => setPasswordDialogOpen(true)}
                    variant="outlined"
                    size="small"
                  >
                    Modifier
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Statistiques d'utilisation
          </Typography>
          <ProfileStats />
        </Box>
        
        {userStats.lastActivity && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activité récente
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dernière activité : {userStats.lastActivity.toLocaleDateString()}
              </Typography>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* Dialog de changement de mot de passe */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Changer le mot de passe</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Mot de passe actuel"
            type={showPasswords.current ? 'text' : 'password'}
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
            margin="normal"
            InputProps={{
              endAdornment: (
                <IconButton
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  edge="end"
                >
                  {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />
          
          <TextField
            fullWidth
            label="Nouveau mot de passe"
            type={showPasswords.new ? 'text' : 'password'}
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
            margin="normal"
            InputProps={{
              endAdornment: (
                <IconButton
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  edge="end"
                >
                  {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />
          
          <TextField
            fullWidth
            label="Confirmer le nouveau mot de passe"
            type={showPasswords.confirm ? 'text' : 'password'}
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            margin="normal"
            InputProps={{
              endAdornment: (
                <IconButton
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  edge="end"
                >
                  {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleChangePassword} variant="contained" disabled={loading}>
            Changer le mot de passe
          </Button>
        </DialogActions>
      </Dialog>

      {loading && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0 }} />}
    </Box>
  );
};

export default UserProfile;
