// VortexFlow Frontend - Éditeur de Graphiques
// Interface d'édition DOT avec Monaco Editor et aperçu 3D

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  CardActions,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  Save,
  PlayArrow,
  Stop,
  Refresh,
  Settings,
  Code,
  Visibility,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import { useGraph } from '../../context/GraphContext';
import { useWebSocket } from '../../services/websocket';
import { Graph, DOTValidationResult, SimulationConfig } from '../../types';
import LoadingPage from '../common/LoadingPage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`editor-tabpanel-${index}`}
      aria-labelledby={`editor-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ height: '100%' }}>{children}</Box>}
    </div>
  );
};

const GraphEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    state,
    loadGraph,
    saveGraph,
    createGraph,
    validateDot,
    parseDot,
    simulationState,
    startSimulation,
    stopSimulation,
  } = useGraph();
  const { connect, disconnect, isConnected } = useWebSocket();

  // États locaux
  const [currentTab, setCurrentTab] = useState(0);
  const [dotContent, setDotContent] = useState('');
  const [graphName, setGraphName] = useState('');
  const [graphDescription, setGraphDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationResult, setValidationResult] = useState<DOTValidationResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [realTimePreview, setRealTimePreview] = useState(true);

  const isNewGraph = id === 'new';
  const currentGraph = state.currentGraph;

  // =====================================
  // Effets
  // =====================================
  useEffect(() => {
    if (!isNewGraph && id) {
      loadGraph(Number(id));
    } else {
      // Initialiser un nouveau graphique
      setDotContent(`digraph NewGraph {
  rankdir=LR;
  node [shape=circle, style=filled, fillcolor=lightblue];
  edge [color=gray];
  
  A -> B;
  B -> C;
  A -> C;
}`);
      setGraphName('Nouveau Graphique');
      setGraphDescription('');
      setIsPublic(false);
    }
  }, [id, isNewGraph, loadGraph]);

  useEffect(() => {
    if (currentGraph) {
      setGraphName(currentGraph.name);
      setGraphDescription(currentGraph.description || '');
      setIsPublic(currentGraph.is_public);
      setDotContent(currentGraph.dot_content || '');
    }
  }, [currentGraph]);

  useEffect(() => {
    // Connecter WebSocket pour collaboration temps réel
    if (id && !isNewGraph) {
      connect();
    }
    
    return () => {
      if (isConnected()) {
        disconnect();
      }
    };
  }, [id, isNewGraph, connect, disconnect, isConnected]);

  // Auto-validation du DOT
  useEffect(() => {
    if (dotContent && realTimePreview) {
      const timer = setTimeout(async () => {
        try {
          const result = await validateDot(dotContent);
          setValidationResult(result);
        } catch (error) {
          console.error('Erreur de validation:', error);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [dotContent, realTimePreview, validateDot]);

  // =====================================
  // Gestionnaires d'événements
  // =====================================
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleDotContentChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setDotContent(value);
      setHasUnsavedChanges(true);
    }
  }, []);

  const handleSave = async () => {
    try {
      const graphData = {
        name: graphName,
        description: graphDescription,
        is_public: isPublic,
        dot_content: dotContent,
      };

      if (isNewGraph) {
        const success = await createGraph(graphData);
        if (success) {
          // Recharger pour obtenir le nouvel ID
          // TODO: createGraph devrait retourner l'objet créé
          navigate('/graphs');
        }
      } else if (currentGraph) {
        await saveGraph({ ...graphData, id: currentGraph.id });
      }
      
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleValidate = async () => {
    try {
      const result = await validateDot(dotContent);
      setValidationResult(result);
    } catch (error) {
      console.error('Erreur de validation:', error);
    }
  };

  const handleStartSimulation = async () => {
    if (currentGraph) {
      // TODO: Créer un objet SimulationConfig avec les paramètres par défaut
      const config: SimulationConfig = {
        particleCount: 10,
        particleSpeed: 1.0,
        particleSize: 5,
        particleColor: '#ff6b6b',
        flowRate: 1.0,
        isRunning: true,
        isPaused: false,
        showTrails: true,
        trailLength: 10
      };
      await startSimulation(config);
    }
  };

  const handleStopSimulation = async () => {
    await stopSimulation();
  };

  const handlePreview = () => {
    if (currentGraph) {
      navigate(`/graphs/${currentGraph.id}/view`);
    }
  };

  // =====================================
  // Rendu conditionnel
  // =====================================
  if (state.loading && !isNewGraph) {
    return <LoadingPage message="Chargement du graphique..." />;
  }

  // =====================================
  // Composant de validation
  // =====================================
  const ValidationStatus: React.FC = () => {
    if (!validationResult) return null;

    const { isValid, errors, warnings } = validationResult;
    
    return (
      <Box sx={{ mb: 2 }}>
        {isValid ? (
          <Alert severity="success" icon={<CheckCircle />}>
            DOT valide - Prêt pour la visualisation
          </Alert>
        ) : (
          <Alert severity="error" icon={<Error />}>
            Erreurs de syntaxe DOT détectées
          </Alert>
        )}
        
        {errors && errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="subtitle2">Erreurs:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
        
        {warnings && warnings.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            <Typography variant="subtitle2">Avertissements:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}
      </Box>
    );
  };

  // =====================================
  // Rendu
  // =====================================
  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {isNewGraph ? 'Nouveau Graphique' : `Éditer: ${graphName}`}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Valider DOT">
            <IconButton onClick={handleValidate} color="primary">
              <CheckCircle />
            </IconButton>
          </Tooltip>
          
          {!isNewGraph && (
            <>
              <Tooltip title="Aperçu">
                <IconButton onClick={handlePreview} color="info">
                  <Visibility />
                </IconButton>
              </Tooltip>
              
              {simulationState?.config.isRunning ? (
                <Tooltip title="Arrêter simulation">
                  <IconButton onClick={handleStopSimulation} color="error">
                    <Stop />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Démarrer simulation">
                  <IconButton onClick={handleStartSimulation} color="success">
                    <PlayArrow />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
          
          <Tooltip title="Paramètres">
            <IconButton onClick={() => setSettingsOpen(true)}>
              <Settings />
            </IconButton>
          </Tooltip>
          
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
          >
            Sauvegarder
          </Button>
        </Box>
      </Box>

      {/* Contenu principal */}
      <Box sx={{ display: 'flex', gap: 2, flexGrow: 1 }}>
        {/* Panneau de gauche - Métadonnées */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' } }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Propriétés
            </Typography>
            
            <TextField
              fullWidth
              label="Nom du graphique"
              value={graphName}
              onChange={(e) => {
                setGraphName(e.target.value);
                setHasUnsavedChanges(true);
              }}
              margin="normal"
              size="small"
            />
            
            <TextField
              fullWidth
              label="Description"
              value={graphDescription}
              onChange={(e) => {
                setGraphDescription(e.target.value);
                setHasUnsavedChanges(true);
              }}
              margin="normal"
              size="small"
              multiline
              rows={3}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(e) => {
                    setIsPublic(e.target.checked);
                    setHasUnsavedChanges(true);
                  }}
                />
              }
              label="Public"
              sx={{ mt: 2 }}
            />
            
            <Divider sx={{ my: 2 }} />
            
            <ValidationStatus />
            
            {simulationState?.config.isRunning && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Simulation en cours...
              </Alert>
            )}
          </Paper>
        </Box>

        {/* Panneau principal - Éditeur et aperçu */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 75%' } }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Tabs value={currentTab} onChange={handleTabChange}>
              <Tab icon={<Code />} label="Code DOT" />
              <Tab icon={<Visibility />} label="Aperçu 3D" />
            </Tabs>
            
            <Box sx={{ flexGrow: 1, p: 0 }}>
              <TabPanel value={currentTab} index={0}>
                <Editor
                  height="100%"
                  defaultLanguage="dot"
                  value={dotContent}
                  onChange={handleDotContentChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                  }}
                />
              </TabPanel>
              
              <TabPanel value={currentTab} index={1}>
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(45deg, rgba(0,255,136,0.1), rgba(255,107,53,0.1))',
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Aperçu 3D - À implémenter avec Three.js
                  </Typography>
                </Box>
              </TabPanel>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Dialog des paramètres */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Paramètres de l'éditeur</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                />
              }
              label="Sauvegarde automatique"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={realTimePreview}
                  onChange={(e) => setRealTimePreview(e.target.checked)}
                />
              }
              label="Aperçu temps réel"
              sx={{ display: 'block', mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GraphEditor;
