// VortexFlow Frontend - Page 404
// Page d'erreur pour les routes non trouvées

import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowBack } from '@mui/icons-material';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          gap: 4,
        }}
      >
        {/* Code d'erreur stylisé */}
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '4rem', md: '8rem' },
            fontWeight: 700,
            background: 'linear-gradient(45deg, #00ff88, #ff6b35)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}
        >
          404
        </Typography>

        {/* Message d'erreur */}
        <Box sx={{ maxWidth: 600 }}>
          <Typography 
            variant="h4" 
            color="text.primary" 
            gutterBottom
            sx={{ fontWeight: 500, mb: 2 }}
          >
            Page non trouvée
          </Typography>
          
          <Typography 
            variant="body1" 
            color="text.secondary"
            sx={{ fontSize: '1.1rem', lineHeight: 1.6 }}
          >
            La page que vous recherchez semble avoir été déplacée, supprimée 
            ou n'existe pas. Vérifiez l'URL ou retournez à l'accueil.
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Home />}
            onClick={() => navigate('/dashboard')}
            sx={{
              minWidth: 160,
              height: 48,
              borderRadius: 2,
            }}
          >
            Accueil
          </Button>
          
          <Button
            variant="outlined"
            size="large"
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            sx={{
              minWidth: 160,
              height: 48,
              borderRadius: 2,
            }}
          >
            Retour
          </Button>
        </Box>

        {/* Graphique décoratif */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            height: '100%',
            opacity: 0.03,
            background: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 10 0 L 0 0 0 10' fill='none' stroke='%2300ff88' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E")`,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      </Box>
    </Container>
  );
};

export default NotFoundPage;
