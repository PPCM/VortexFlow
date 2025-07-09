// VortexFlow Frontend - Page d'Inscription
// Interface de création de compte utilisateur

import React, { useState } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fade,
} from '@mui/material';
import { Visibility, VisibilityOff, PersonAdd } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RegisterData } from '../../types';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, state } = useAuth();

  // États locaux
  const [userData, setUserData] = useState<RegisterData>({
    username: '',
    email: '',
    password: '',
    role: 'viewer',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleInputChange = (field: keyof RegisterData | 'confirmPassword') => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    
    if (field === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setUserData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
    
    // Effacer l'erreur de validation pour ce champ
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleRoleChange = (event: any) => {
    setUserData(prev => ({
      ...prev,
      role: event.target.value as 'viewer' | 'editor' | 'admin',
    }));
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Validation
    const errors: Record<string, string> = {};
    
    if (!userData.username) {
      errors.username = 'Le nom d\'utilisateur est requis';
    } else if (userData.username.length < 3) {
      errors.username = 'Le nom d\'utilisateur doit contenir au moins 3 caractères';
    }
    
    if (!userData.email) {
      errors.email = 'L\'email est requis';
    } else if (!/\S+@\S+\.\S+/.test(userData.email)) {
      errors.email = 'Format d\'email invalide';
    }
    
    if (!userData.password) {
      errors.password = 'Le mot de passe est requis';
    } else if (userData.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'La confirmation du mot de passe est requise';
    } else if (userData.password !== confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Tentative d'inscription
    const success = await register(userData);
    
    if (success) {
      navigate('/dashboard');
    }
  };

  // =====================================
  // Rendu
  // =====================================
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='50' height='50' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 50 0 L 0 0 0 50' fill='none' stroke='%23ff6b3520' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E")`,
          opacity: 0.5,
        },
      }}
    >
      <Container maxWidth="sm">
        <Fade in timeout={600}>
          <Card
            sx={{
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(26, 26, 26, 0.8)',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              borderRadius: 3,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              {/* En-tête */}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(45deg, #ff6b35, #00ff88)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1,
                  }}
                >
                  VortexFlow
                </Typography>
                <Typography variant="h5" color="text.primary" gutterBottom>
                  Créer un compte
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rejoignez la plateforme de visualisation 3D
                </Typography>
              </Box>

              {/* Erreur globale */}
              {state.error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {state.error}
                </Alert>
              )}

              {/* Formulaire */}
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Nom d'utilisateur"
                  value={userData.username}
                  onChange={handleInputChange('username')}
                  error={!!validationErrors.username}
                  helperText={validationErrors.username}
                  margin="normal"
                  variant="outlined"
                  autoComplete="username"
                  autoFocus
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'secondary.main',
                      },
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label="Adresse email"
                  type="email"
                  value={userData.email}
                  onChange={handleInputChange('email')}
                  error={!!validationErrors.email}
                  helperText={validationErrors.email}
                  margin="normal"
                  variant="outlined"
                  autoComplete="email"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'secondary.main',
                      },
                    },
                  }}
                />

                <FormControl fullWidth margin="normal">
                  <InputLabel>Rôle</InputLabel>
                  <Select
                    value={userData.role}
                    label="Rôle"
                    onChange={handleRoleChange}
                    sx={{
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'secondary.main',
                      },
                    }}
                  >
                    <MenuItem value="viewer">Viewer - Visualisation uniquement</MenuItem>
                    <MenuItem value="editor">Editor - Création et modification</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  value={userData.password}
                  onChange={handleInputChange('password')}
                  error={!!validationErrors.password}
                  helperText={validationErrors.password}
                  margin="normal"
                  variant="outlined"
                  autoComplete="new-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'secondary.main',
                      },
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label="Confirmer le mot de passe"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  error={!!validationErrors.confirmPassword}
                  helperText={validationErrors.confirmPassword}
                  margin="normal"
                  variant="outlined"
                  autoComplete="new-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleToggleConfirmPasswordVisibility}
                          edge="end"
                          size="small"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'secondary.main',
                      },
                    },
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={state.loading}
                  startIcon={<PersonAdd />}
                  sx={{
                    mt: 3,
                    mb: 2,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(45deg, #ff6b35, #e55a2b)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #e55a2b, #cc4d24)',
                    },
                  }}
                >
                  {state.loading ? 'Création du compte...' : 'Créer le compte'}
                </Button>

                {/* Lien de connexion */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Déjà un compte ?{' '}
                    <Link
                      component={RouterLink}
                      to="/login"
                      sx={{
                        color: 'secondary.main',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      Se connecter
                    </Link>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
};

export default RegisterPage;
