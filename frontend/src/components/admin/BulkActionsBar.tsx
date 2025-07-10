/**
 * VortexFlow - Barre d'Actions en Masse
 * Composant pour les actions groupées sur les utilisateurs
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  Collapse,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as ActivateIcon,
  Block as DeactivateIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface BulkActionsBarProps {
  selectedCount: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onClear: () => void;
  loading?: boolean;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onActivate,
  onDeactivate,
  onDelete,
  onClear,
  loading = false
}) => {
  if (selectedCount === 0) return null;

  return (
    <Collapse in={selectedCount > 0}>
      <Paper
        elevation={3}
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: 'primary.light',
          color: 'primary.contrastText',
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={`${selectedCount} utilisateur${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`}
              sx={{
                backgroundColor: 'white',
                color: 'primary.main',
                fontWeight: 'bold'
              }}
            />
            
            <Divider orientation="vertical" flexItem sx={{ backgroundColor: 'white', opacity: 0.3 }} />
            
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Actions disponibles :
            </Typography>
          </Box>

          <Tooltip title="Annuler la sélection">
            <IconButton
              onClick={onClear}
              size="small"
              sx={{
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<ActivateIcon />}
            onClick={onActivate}
            disabled={loading}
            sx={{
              backgroundColor: 'success.main',
              color: 'white',
              '&:hover': { backgroundColor: 'success.dark' },
              fontWeight: 'bold'
            }}
          >
            Activer
          </Button>

          <Button
            variant="contained"
            startIcon={<DeactivateIcon />}
            onClick={onDeactivate}
            disabled={loading}
            sx={{
              backgroundColor: 'warning.main',
              color: 'white',
              '&:hover': { backgroundColor: 'warning.dark' },
              fontWeight: 'bold'
            }}
          >
            Désactiver
          </Button>

          <Button
            variant="contained"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            disabled={loading}
            sx={{
              backgroundColor: 'error.main',
              color: 'white',
              '&:hover': { backgroundColor: 'error.dark' },
              fontWeight: 'bold'
            }}
          >
            Supprimer
          </Button>
        </Box>

        <Alert 
          severity="info" 
          sx={{ 
            mt: 2, 
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '& .MuiAlert-icon': { color: 'white' },
            '& .MuiAlert-message': { color: 'white' }
          }}
          icon={<WarningIcon />}
        >
          <Typography variant="body2">
            💡 <strong>Conseil :</strong> Les actions en masse s'appliquent uniquement aux utilisateurs sélectionnés. 
            Vous ne pouvez pas effectuer d'actions sur votre propre compte.
          </Typography>
        </Alert>
      </Paper>
    </Collapse>
  );
};

export default BulkActionsBar;
