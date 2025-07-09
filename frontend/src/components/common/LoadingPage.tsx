// VortexFlow Frontend - Page de Chargement
// Composant d'affichage pendant les chargements

import React from 'react';
import { Box, CircularProgress, Typography, Fade } from '@mui/material';

interface LoadingPageProps {
  message?: string;
  fullscreen?: boolean;
}

const LoadingPage: React.FC<LoadingPageProps> = ({ 
  message = 'Chargement...', 
  fullscreen = true 
}) => {
  return (
    <Fade in timeout={300}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: fullscreen ? '100vh' : '200px',
          backgroundColor: fullscreen ? 'background.default' : 'transparent',
          gap: 3,
        }}
      >
        <CircularProgress 
          size={60} 
          thickness={4}
          sx={{ 
            color: 'primary.main',
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            }
          }} 
        />
        <Typography 
          variant="h6" 
          color="text.secondary"
          sx={{ fontWeight: 300 }}
        >
          {message}
        </Typography>
      </Box>
    </Fade>
  );
};

export default LoadingPage;
