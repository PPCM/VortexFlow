// VortexFlow Frontend - Page de Connexion
// Interface d'authentification utilisateur

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
  Divider,
  Fade,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoginCredentials } from '../../types';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, state } = useAuth();

  // États locaux
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleInputChange = (field: keyof LoginCredentials) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
    
    // Effacer l'erreur de validation pour ce champ
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Validation simple
    const errors: Record<string, string> = {};
    
    if (!credentials.email) {
      errors.email = 'L\'email est requis';
    } else if (!/\S+@\S+\.\S+/.test(credentials.email)) {
      errors.email = 'Format d\'email invalide';
    }
    
    if (!credentials.password) {
      errors.password = 'Le mot de passe est requis';
    } else if (credentials.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Tentative de connexion
    const success = await login(credentials);
    
    if (success) {
      // Récupérer la page de redirection stockée ou aller au dashboard par défaut
      const redirectPath = sessionStorage.getItem('vortexflow_redirect_after_login');
      
      if (redirectPath && redirectPath !== '/login' && redirectPath !== '/register') {
        sessionStorage.removeItem('vortexflow_redirect_after_login');
        navigate(redirectPath);
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleDemoLogin = async () => {
    const demoCredentials: LoginCredentials = {
      email: 'admin@admin.com',
      password: 'admin123',
    };
    
    const success = await login(demoCredentials);
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
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='50' height='50' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 50 0 L 0 0 0 50' fill='none' stroke='%2300ff8820' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E")`,
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
              border: '1px solid rgba(0, 255, 136, 0.2)',
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
                    background: 'linear-gradient(45deg, #00ff88, #ff6b35)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1,
                  }}
                >
                  VortexFlow
                </Typography>
                <Typography variant="h5" color="text.primary" gutterBottom>
                  Connexion
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Accédez à votre espace de visualisation 3D
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
                  label="Adresse email"
                  type="email"
                  value={credentials.email}
                  onChange={handleInputChange('email')}
                  error={!!validationErrors.email}
                  helperText={validationErrors.email}
                  margin="normal"
                  variant="outlined"
                  autoComplete="email"
                  autoFocus
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label="Mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={handleInputChange('password')}
                  error={!!validationErrors.password}
                  helperText={validationErrors.password}
                  margin="normal"
                  variant="outlined"
                  autoComplete="current-password"
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
                        borderColor: 'primary.main',
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
                  startIcon={<LoginIcon />}
                  sx={{
                    mt: 3,
                    mb: 2,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(45deg, #00ff88, #00cc6a)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #00cc6a, #009955)',
                    },
                  }}
                >
                  {state.loading ? 'Connexion...' : 'Se connecter'}
                </Button>

                {/* Lien d'inscription */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Pas encore de compte ?{' '}
                    <Link
                      component={RouterLink}
                      to="/register"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      Créer un compte
                    </Link>
                  </Typography>
                </Box>

                {/* Divider */}
                <Divider sx={{ my: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    ou
                  </Typography>
                </Divider>

                {/* Connexion démo */}
                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  onClick={handleDemoLogin}
                  disabled={state.loading}
                  sx={{
                    height: 48,
                    borderRadius: 2,
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.dark',
                      backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    },
                  }}
                >
                  Connexion démo (Admin)
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
};

export default LoginPage;
