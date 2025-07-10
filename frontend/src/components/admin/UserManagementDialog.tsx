/**
 * VortexFlow - Dialogue de Gestion des Utilisateurs
 * Modal pour créer/éditer des utilisateurs
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  Switch,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Typography,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  VpnKey as VpnKeyIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

import { UserWithStats } from '../../services/adminService';

interface UserManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (userData: UserFormData) => Promise<void>;
  onDelete?: (userId: number) => Promise<void>;
  user?: UserWithStats | null;
  loading?: boolean;
}

export interface UserFormData {
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: 'viewer' | 'editor' | 'admin';
  is_active?: boolean;
}

const UserManagementDialog: React.FC<UserManagementDialogProps> = ({
  open,
  onClose,
  onSubmit,
  onDelete,
  user,
  loading = false
}) => {
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'viewer',
    is_active: true
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditMode = !!user;

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        password: '', // Ne pas pré-remplir le mot de passe en mode édition
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role as 'viewer' | 'editor' | 'admin',
        is_active: user.is_active
      });
    } else {
      // Réinitialiser pour nouveau utilisateur
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'viewer',
        is_active: true
      });
    }
    setErrors({});
  }, [user, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email invalide';
    }

    if (!isEditMode && !formData.password) {
      newErrors.password = 'Mot de passe requis';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Minimum 6 caractères requis';
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Prénom requis';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Nom requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !onDelete) return;
    
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur "${user.first_name} ${user.last_name}" ? Cette action est irréversible.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await onDelete(user.id);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !loading && !isDeleting) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            {isEditMode ? 'Modifier utilisateur' : 'Nouvel utilisateur'}
          </Typography>
        </Box>
        <IconButton 
          onClick={handleClose} 
          disabled={isSubmitting || loading}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Informations personnelles */}
          <Box>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold' }}>
              📋 Informations personnelles
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Prénom"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                error={!!errors.first_name}
                helperText={errors.first_name}
                fullWidth
                disabled={isSubmitting || loading}
              />
              <TextField
                label="Nom"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                error={!!errors.last_name}
                helperText={errors.last_name}
                fullWidth
                disabled={isSubmitting || loading}
              />
            </Box>
          </Box>

          {/* Compte et sécurité */}
          <Box>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold' }}>
              🔐 Compte et sécurité
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={!!errors.email}
                helperText={errors.email}
                fullWidth
                disabled={isSubmitting || loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />
              
              <TextField
                label={isEditMode ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={!!errors.password}
                helperText={errors.password || (isEditMode ? 'Laisser vide pour conserver le mot de passe actuel' : '')}
                fullWidth
                disabled={isSubmitting || loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKeyIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          </Box>

          {/* Rôle et permissions */}
          <Box>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold' }}>
              👤 Rôle et permissions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth disabled={isSubmitting || loading}>
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    role: e.target.value as 'viewer' | 'editor' | 'admin' 
                  })}
                  label="Rôle"
                >
                  <MenuItem value="viewer">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">Utilisateur</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Peut créer et gérer ses propres graphiques
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="editor">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">Éditeur</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Peut gérer tous les graphiques publics
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="admin">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">Administrateur</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Accès complet au système
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {isEditMode && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      disabled={isSubmitting || loading}
                    />
                  }
                  label="Compte actif"
                />
              )}
            </Box>
          </Box>

          {/* Avertissement pour les admins */}
          {formData.role === 'admin' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                ⚠️ Les administrateurs ont un accès complet au système. 
                Assurez-vous de faire confiance à cette personne.
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, gap: 1, justifyContent: 'space-between' }}>
        {/* Actions de suppression */}
        {isEditMode && onDelete && (
          <Button
            onClick={handleDelete}
            startIcon={<DeleteIcon />}
            disabled={isDeleting || isSubmitting || loading}
            sx={{ 
              color: 'error.main',
              '&:hover': { 
                backgroundColor: 'error.light',
                color: 'white'
              }
            }}
          >
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </Button>
        )}
        
        {/* Actions principales */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={isSubmitting || loading || isDeleting}
            color="inherit"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isSubmitting || loading || isDeleting}
            sx={{ minWidth: 120 }}
          >
            {isSubmitting || loading ? 'En cours...' : (isEditMode ? 'Modifier' : 'Créer')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default UserManagementDialog;
