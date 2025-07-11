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
  const hasSelection = selectedCount > 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      {/* Section info sélection - Visible seulement si sélection */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {hasSelection && (
          <>
            <Typography variant="body2">
              {`${selectedCount} utilisateur${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`}
            </Typography>
            
            <Tooltip title="Annuler la sélection">
              <IconButton
                onClick={onClear}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Boutons d'actions - toujours visibles */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<ActivateIcon />}
          onClick={onActivate}
          disabled={!hasSelection || loading}
          size="small"
          sx={{
            backgroundColor: hasSelection ? 'success.main' : 'grey.400',
            color: hasSelection ? 'white' : 'grey.600',
            '&:hover': {
              backgroundColor: hasSelection ? 'success.dark' : 'grey.500'
            },
            '&.Mui-disabled': {
              backgroundColor: 'grey.300',
              color: 'grey.500'
            }
          }}
        >
          Activer
        </Button>

        <Button
          variant="contained"
          startIcon={<DeactivateIcon />}
          onClick={onDeactivate}
          disabled={!hasSelection || loading}
          size="small"
          sx={{
            backgroundColor: hasSelection ? 'warning.main' : 'grey.400',
            color: hasSelection ? 'white' : 'grey.600',
            '&:hover': {
              backgroundColor: hasSelection ? 'warning.dark' : 'grey.500'
            },
            '&.Mui-disabled': {
              backgroundColor: 'grey.300',
              color: 'grey.500'
            }
          }}
        >
          Désactiver
        </Button>

        <Button
          variant="contained"
          startIcon={<DeleteIcon />}
          onClick={onDelete}
          disabled={!hasSelection || loading}
          size="small"
          sx={{
            backgroundColor: hasSelection ? 'error.main' : 'grey.400',
            color: hasSelection ? 'white' : 'grey.600',
            '&:hover': {
              backgroundColor: hasSelection ? 'error.dark' : 'grey.500'
            },
            '&.Mui-disabled': {
              backgroundColor: 'grey.300',
              color: 'grey.500'
            }
          }}
        >
          Supprimer
        </Button>
      </Box>
    </Box>
  );
};

export default BulkActionsBar;
