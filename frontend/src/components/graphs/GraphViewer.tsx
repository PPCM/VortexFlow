// VortexFlow Frontend - Visualiseur 3D
// The header keeps the global actions (simulation toggle, fullscreen, edit).
// Per-view controls (display toggles, sliders, stats) live inside the
// renderer's left rail / right drawer.

import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, IconButton, Tooltip } from '@mui/material';
import {
  PlayArrow,
  Stop,
  Pause,
  Fullscreen,
  FullscreenExit,
  Edit,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useGraph } from '../../context/GraphContext';
import { usePermissions } from '../../context/AuthContext';
import { SimulationConfig } from '../../types';
import LoadingPage from '../common/LoadingPage';
import GraphRenderer3D from './GraphRenderer3D';

const GraphViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    state, loadGraph, simulationState, startSimulation, stopSimulation, pauseSimulation,
  } = useGraph();
  const { canEdit } = usePermissions();

  const viewerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const currentGraph = state.currentGraph;

  useEffect(() => {
    if (id) {
      // Backend graph IDs are UUIDs (strings); don't coerce.
      loadGraph(id as any);
    }
  }, [id, loadGraph]);

  const handleStartSimulation = async () => {
    if (!currentGraph) return;
    const defaultConfig: SimulationConfig = {
      particleCount: 100,
      particleSpeed: 1.0,
      particleSize: 2,
      particleColor: '#00ff00',
      flowRate: 10,
      isRunning: true,
      showTrails: true,
      trailLength: 20,
    };
    await startSimulation(defaultConfig);
  };

  const handleStopSimulation = async () => {
    await stopSimulation();
  };

  const handlePauseSimulation = async () => {
    await pauseSimulation();
  };

  const handleFullscreen = () => {
    if (!fullscreen) {
      viewerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  };

  const handleEdit = () => {
    if (currentGraph) {
      navigate(`/graphs/${currentGraph.id}/edit`);
    }
  };

  if (state.loading) {
    return <LoadingPage message="Chargement du graphique..." />;
  }

  if (!currentGraph) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8 }}>
        <Typography variant="h6" color="error">
          Graphique non trouvé
        </Typography>
        <Button onClick={() => navigate('/graphs')} sx={{ mt: 2 }}>
          Retour à la liste
        </Button>
      </Box>
    );
  }

  const isRunning = simulationState?.config?.isRunning ?? false;
  const dotContent = (currentGraph as any).dotCode
    || (currentGraph as any).dot_code
    || (currentGraph as any).dot_content
    || '';

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {(currentGraph as any).title || currentGraph.name || 'Sans titre'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentGraph.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isRunning ? (
            <>
              <Tooltip title="Pause">
                <IconButton onClick={handlePauseSimulation} color="warning">
                  <Pause />
                </IconButton>
              </Tooltip>
              <Tooltip title="Arrêter">
                <IconButton onClick={handleStopSimulation} color="error">
                  <Stop />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Démarrer simulation">
              <IconButton onClick={handleStartSimulation} color="success">
                <PlayArrow />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Plein écran">
            <IconButton onClick={handleFullscreen}>
              {fullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>

          {canEdit() && (
            <Tooltip title="Éditer">
              <IconButton onClick={handleEdit} color="secondary">
                <Edit />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box ref={viewerRef} sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        <GraphRenderer3D dotContent={dotContent} isValid isSimulationRunning={isRunning} />
      </Box>
    </Box>
  );
};

export default GraphViewer;
