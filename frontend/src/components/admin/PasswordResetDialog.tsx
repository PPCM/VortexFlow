/**
 * VortexFlow - Dialogue de Réinitialisation de Mot de Passe
 * Modal pour réinitialiser le mot de passe d'un utilisateur
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  Typography,
  IconButton,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  VpnKey as VpnKeyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Security as SecurityIcon
} from '@mui/icons-material';

import { UserWithStats } from '../../services/adminService';

interface PasswordResetDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
  user: UserWithStats | null;
  loading?: boolean;
}

const PasswordResetDialog: React.FC<PasswordResetDialogProps> = ({
  open,
  onClose,
  onSubmit,
  user,
  loading = false
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (!isSubmitting && !loading) {
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      onClose();
    }
  };

  const validatePasswords = (): boolean => {
    if (!newPassword) {
      setError('Le nouveau mot de passe est requis');
      return false;
    }

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return false;
    }

    // Validation de complexité
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    
    if (!hasLetter || !hasNumber) {
      setError('Le mot de passe doit contenir au moins une lettre et un chiffre');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validatePasswords()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(newPassword);
      handleClose();
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      setError('Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
    setConfirmPassword(password);
    setError('');
  };

  if (!user) return null;

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
          <SecurityIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Réinitialiser le mot de passe
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
        <Box sx={{ mb: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Utilisateur :</strong> {user.first_name} {user.last_name} ({user.email})
            </Typography>
          </Alert>
          
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              ⚠️ Cette action réinitialisera définitivement le mot de passe de l'utilisateur. 
              Il devra utiliser le nouveau mot de passe pour se connecter.
            </Typography>
          </Alert>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 'bold' }}>
              🔐 Nouveau mot de passe
            </Typography>
            
            <TextField
              label="Nouveau mot de passe"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              disabled={isSubmitting || loading}
              sx={{ mb: 2 }}
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

            <TextField
              label="Confirmer le mot de passe"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Button
              variant="outlined"
              onClick={generateRandomPassword}
              disabled={isSubmitting || loading}
              sx={{ mt: 2 }}
              fullWidth
            >
              🎲 Générer un mot de passe aléatoire
            </Button>
          </Box>

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          <Alert severity="info">
            <Typography variant="body2">
              <strong>Exigences du mot de passe :</strong>
            </Typography>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Au moins 6 caractères</li>
              <li>Au moins une lettre</li>
              <li>Au moins un chiffre</li>
              <li>Caractères spéciaux recommandés</li>
            </ul>
          </Alert>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={isSubmitting || loading}
          color="inherit"
        >
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="warning"
          disabled={isSubmitting || loading || !newPassword || !confirmPassword}
          sx={{ minWidth: 150 }}
        >
          {isSubmitting || loading ? 'En cours...' : 'Réinitialiser'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PasswordResetDialog;
