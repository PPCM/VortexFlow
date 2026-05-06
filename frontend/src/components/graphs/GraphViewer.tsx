// VortexFlow Frontend - Visualiseur 3D
// Interface de visualisation interactive avec Three.js

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Slider,
  FormControlLabel,
  Switch,
  Alert,
  Fab,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Pause,
  Refresh,
  Settings,
  Info,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  Fullscreen,
  FullscreenExit,
  Edit,
  Share,
  Download,
  Upload,
  Visibility,
  VisibilityOff,
  Speed,
  AccountTree,
  ScatterPlot,
  ThreeDRotation,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useGraph } from '../../context/GraphContext';
import { useWebSocket } from '../../services/websocket';
import { usePermissions } from '../../context/AuthContext';
import { SimulationConfig } from '../../types';
import LoadingPage from '../common/LoadingPage';
import GraphRenderer3D from './GraphRenderer3D';

/**
 * Quick DOT counter — extracts node and edge counts directly from a DOT
 * source string without going through the backend parser. Strips comments
 * and string literals so they don't poison the regexes.
 */
const countDotElements = (dot: string | undefined): { nodes: number; edges: number } => {
  if (!dot) return { nodes: 0, edges: 0 };
  const stripped = dot
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/"([^"\\]|\\.)*"/g, '""');

  const edges = (stripped.match(/->|--/g) || []).length;

  // Collect identifiers used as edge endpoints (the most reliable signal that
  // a token is a node — bare attribute keys would be filtered out otherwise).
  const nodeIds = new Set<string>();
  const edgeRe = /([a-zA-Z_][\w]*|"[^"]*")\s*(?:->|--)\s*([a-zA-Z_][\w]*|"[^"]*")/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = edgeRe.exec(stripped)) !== null) {
    nodeIds.add(m[1]);
    nodeIds.add(m[2]);
  }
  // Plus standalone node declarations: `name [attrs]` or `name;` at statement
  // boundaries. Match anything not preceded by an edge operator.
  const declRe = /(^|[\n;{])\s*([a-zA-Z_][\w]*)\s*(?:\[|;)/g;
  // eslint-disable-next-line no-cond-assign
  while ((m = declRe.exec(stripped)) !== null) {
    const id = m[2];
    // Skip DOT keywords and the graph header.
    if (!/^(graph|digraph|subgraph|node|edge|strict)$/i.test(id)) {
      nodeIds.add(id);
    }
  }
  return { nodes: nodeIds.size, edges };
};

const GraphViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, loadGraph, simulationState, startSimulation, stopSimulation, pauseSimulation } = useGraph();
  const { connect, disconnect, isConnected } = useWebSocket();
  const { canEdit } = usePermissions();

  // Références
  const viewerRef = useRef<HTMLDivElement>(null);

  // États locaux
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);
  const [viewSettings, setViewSettings] = useState({
    showNodes: true,
    showEdges: true,
    showLabels: true,
    nodeSize: 50,
    linkDistance: 100,
    forceStrength: 300,
    showStats: true,
    backgroundColor: '#1a1a1a',
    nodeColor: '#00ff88',
    edgeColor: '#ff6b35',
  });

  const currentGraph = state.currentGraph;

  // =====================================
  // Effets
  // =====================================
  useEffect(() => {
    if (id) {
      // Backend graph IDs are UUIDs (strings); don't coerce.
      loadGraph(id as any);
    }
  }, [id, loadGraph]);

  useEffect(() => {
    // Connecter WebSocket pour simulation temps réel
    if (id) {
      connect();
    }
    
    return () => {
      if (isConnected()) {
        disconnect();
      }
    };
  }, [id, connect, disconnect, isConnected]);

  useEffect(() => {
    // Initialiser la visualisation 3D
    if (currentGraph && viewerRef.current) {
      initializeVisualization();
    }
  }, [currentGraph]);

  // =====================================
  // Initialisation de la visualisation 3D
  // =====================================
  const initializeVisualization = () => {
    // Placeholder pour l'intégration Three.js + 3d-force-graph
    console.log('Initialisation de la visualisation 3D:', currentGraph);
    
    // TODO: Implémenter avec Three.js et 3d-force-graph
    // - Créer la scène Three.js
    // - Parser les données du graphique
    // - Configurer les forces de simulation
    // - Ajouter les contrôles d'interaction
    // - Gérer les événements de sélection
  };

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleStartSimulation = async () => {
    if (currentGraph) {
      const defaultConfig: SimulationConfig = {
        particleCount: 100,
        particleSpeed: 1.0,
        particleSize: 2,
        particleColor: '#00ff00',
        flowRate: 10,
        isRunning: true,
        showTrails: true,
        trailLength: 20
      };
      await startSimulation(defaultConfig);
    }
  };

  const handleStopSimulation = async () => {
    await stopSimulation();
  };

  const handleToggleSimulation = async () => {
    if (simulationState && simulationState.config.isRunning) {
      await handleStopSimulation();
    } else {
      await handleStartSimulation();
    }
  };

  const handlePauseSimulation = async () => {
    await pauseSimulation();
  };

  const handleResetView = () => {
    // Réinitialiser la caméra et la position du graphique
    console.log('Reset view');
  };

  const handleFullscreen = () => {
    if (!fullscreen) {
      if (viewerRef.current?.requestFullscreen) {
        viewerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setFullscreen(!fullscreen);
  };

  const handleEdit = () => {
    if (currentGraph) {
      navigate(`/graphs/${currentGraph.id}/edit`);
    }
  };

  const handleShare = () => {
    // Implémenter le partage
    console.log('Share graph');
  };

  const handleExport = () => {
    // Implémenter l'export (PNG, SVG, etc.)
    console.log('Export graph');
  };

  const handleSettingsChange = (key: string, value: any) => {
    setViewSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // =====================================
  // Rendu conditionnel
  // =====================================
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

  // =====================================
  // Composants internes
  // =====================================
  const GraphStats: React.FC = () => {
    // The backend only ships the DOT source (`dotCode`), not pre-parsed graph
    // data. Counts must be derived from the DOT string itself. Memoize so the
    // regex sweep doesn't re-run on every render.
    const dot = (currentGraph as any)?.dotCode
      || (currentGraph as any)?.dot_code
      || (currentGraph as any)?.dot_content
      || '';
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { nodes: nodeCount, edges: edgeCount } = useMemo(() => countDotElements(dot), [dot]);

    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Typography variant="h6" gutterBottom>
            Statistiques
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip
              icon={<ScatterPlot />}
              label={`${nodeCount} nœuds`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<AccountTree />}
              label={`${edgeCount} arêtes`}
              color="secondary"
              variant="outlined"
            />
          </Box>
          
          {simulationState && simulationState.config.isRunning && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Simulation active
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const ViewControls: React.FC = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Contrôles de vue
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={viewSettings.showNodes}
              onChange={(e) => handleSettingsChange('showNodes', e.target.checked)}
            />
          }
          label="Afficher les nœuds"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={viewSettings.showEdges}
              onChange={(e) => handleSettingsChange('showEdges', e.target.checked)}
            />
          }
          label="Afficher les arêtes"
          sx={{ display: 'block' }}
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={viewSettings.showLabels}
              onChange={(e) => handleSettingsChange('showLabels', e.target.checked)}
            />
          }
          label="Afficher les labels"
          sx={{ display: 'block' }}
        />
        
        <Divider sx={{ my: 2 }} />
        
        <Typography gutterBottom>Taille des nœuds</Typography>
        <Slider
          value={viewSettings.nodeSize}
          onChange={(_, value) => handleSettingsChange('nodeSize', value)}
          min={10}
          max={100}
          valueLabelDisplay="auto"
        />
        
        <Typography gutterBottom sx={{ mt: 2 }}>Force de simulation</Typography>
        <Slider
          value={viewSettings.forceStrength}
          onChange={(_, value) => handleSettingsChange('forceStrength', value)}
          min={100}
          max={1000}
          valueLabelDisplay="auto"
        />
        
        <Typography gutterBottom sx={{ mt: 2 }}>Distance des liens</Typography>
        <Slider
          value={viewSettings.linkDistance}
          onChange={(_, value) => handleSettingsChange('linkDistance', value)}
          min={50}
          max={300}
          valueLabelDisplay="auto"
        />
      </CardContent>
    </Card>
  );

  // =====================================
  // Rendu
  // =====================================
  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* En-tête */}
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
          {/* Contrôles de simulation */}
          {simulationState && simulationState.config.isRunning ? (
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
          
          {/* Contrôles de vue */}
          <Tooltip title="Réinitialiser vue">
            <IconButton onClick={handleResetView}>
              <CenterFocusStrong />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Plein écran">
            <IconButton onClick={handleFullscreen}>
              {fullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
          
          {/* Actions */}
          {canEdit() && (
            <Tooltip title="Éditer">
              <IconButton onClick={handleEdit} color="secondary">
                <Edit />
              </IconButton>
            </Tooltip>
          )}
          
          <Tooltip title="Partager">
            <IconButton onClick={handleShare}>
              <Share />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Exporter">
            <IconButton onClick={handleExport}>
              <Download />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Paramètres">
            <IconButton
              onClick={(e) => setSettingsMenuAnchor(e.currentTarget)}
            >
              <Settings />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Zone de visualisation */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Paper
          ref={viewerRef}
          sx={{
            height: '100%',
            background: viewSettings.backgroundColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Vrai rendu 3D — partage le même composant que l'onglet APERÇU 3D
              de l'éditeur. Backend renvoie le DOT sous .dotCode (camelCase),
              avec un fallback sur .dot_code par sécurité. */}
          <Box sx={{ width: '100%', height: '100%' }}>
            <GraphRenderer3D
              dotContent={
                (currentGraph as any).dotCode
                || (currentGraph as any).dot_code
                || (currentGraph as any).dot_content
                || ''
              }
              isValid={true}
              isSimulationRunning={simulationState?.config?.isRunning ?? false}
              onToggleSimulation={handleToggleSimulation}
            />
          </Box>
        </Paper>
        
        {/* FAB pour panneau d'informations */}
        <Fab
          color="primary"
          sx={{ position: 'absolute', bottom: 16, left: 16 }}
          onClick={() => setSidebarOpen(true)}
        >
          <Info />
        </Fab>
      </Box>

      {/* Panneau latéral */}
      <Drawer
        anchor="right"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 350,
            p: 2,
          },
        }}
      >
        <Typography variant="h6" gutterBottom>
          Informations du graphique
        </Typography>
        
        <GraphStats />
        <ViewControls />
      </Drawer>

      {/* Menu des paramètres */}
      <Menu
        anchorEl={settingsMenuAnchor}
        open={Boolean(settingsMenuAnchor)}
        onClose={() => setSettingsMenuAnchor(null)}
      >
        <MenuItem onClick={() => setSidebarOpen(true)}>
          <Info sx={{ mr: 1 }} />
          Informations
        </MenuItem>
        <MenuItem onClick={() => setViewSettings({ ...viewSettings, showStats: !viewSettings.showStats })}>
          <Visibility sx={{ mr: 1 }} />
          {viewSettings.showStats ? 'Masquer' : 'Afficher'} les statistiques
        </MenuItem>
        <MenuItem onClick={handleResetView}>
          <Refresh sx={{ mr: 1 }} />
          Réinitialiser la vue
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default GraphViewer;
