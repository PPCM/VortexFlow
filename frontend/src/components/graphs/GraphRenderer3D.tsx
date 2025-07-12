// VortexFlow Frontend - Rendu 3D des Graphiques DOT avec 3d-force-graph
// Composant de visualisation 3D avancé avec flèches, particules et texte

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Paper, 
  Typography, 
  Tooltip, 
  CircularProgress, 
  Alert,
  Slider
} from '@mui/material';
import { 
  Settings as SettingsIcon, 
  ArrowRightAlt as ArrowIcon, 
  ScatterPlot as ParticlesIcon, 
  Label as LabelIcon, 
  Link as LinkIcon, 
  AutoFixHigh as EffectsIcon, 
  ExpandLess as ExpandLessIcon, 
  ExpandMore as ExpandMoreIcon, 
  BarChart as StatsIcon, 
  Speed as SpeedIcon, 
  AccountTree as NodesIcon 
} from '@mui/icons-material';
import ForceGraph3D from '3d-force-graph';
import { GraphData, GraphNode, GraphEdge } from '../../types';

// =====================================
// Types pour le rendu 3D
// =====================================
interface GraphRenderer3DProps {
  dotContent: string;
  isValid: boolean;
  parsedData?: GraphData;
}

// Types pour 3d-force-graph
interface ForceGraphNode {
  id: string;
  name: string;
  group: number;
  x?: number;
  y?: number;
  z?: number;
  val?: number;
  color?: string;
}

interface ForceGraphLink {
  source: string;
  target: string;
  value?: number;
  color?: string;
  name?: string;
}

// =====================================
// Utilitaires de parsing DOT vers 3D
// =====================================
class DotTo3DConverter {
  static parseDotToGraphData(dotContent: string): { nodes: ForceGraphNode[], links: ForceGraphLink[] } {
    const nodes: ForceGraphNode[] = [];
    const links: ForceGraphLink[] = [];
    const nodeMap = new Map<string, ForceGraphNode>();
    
    // Nettoyer le contenu DOT et supprimer tout ce qui n'est pas essentiel
    let cleanContent = dotContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Commentaires /* */
      .replace(/\/\/.*$/gm, '') // Commentaires //
      .replace(/digraph\s+\w+\s*{/gi, '') // Supprimer 'digraph nom {'
      .replace(/graph\s+\w+\s*{/gi, '') // Supprimer 'graph nom {'
      .replace(/}/g, '') // Supprimer les accolades fermantes
      .replace(/;/g, '') // Supprimer les points-virgules
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
    
    console.log('Contenu DOT nettoyé:', cleanContent);
    
    // Mots-clés DOT à exclure complètement
    const dotKeywords = new Set([
      'digraph', 'graph', 'subgraph', 'node', 'edge', 'strict',
      'cluster', 'rank', 'rankdir', 'label', 'style', 'color',
      'shape', 'size', 'width', 'height', 'fontname', 'fontsize',
      'bgcolor', 'margin', 'pad', 'nodesep', 'ranksep', 'splines',
      'overlap', 'concentrate', 'compound', 'lhead', 'ltail'
    ]);
    
    // 1. D'abord extraire TOUTES les arêtes pour identifier les nœuds connectés
    const edgeRegex = /([A-Za-z]\w*)\s*->\s*([A-Za-z]\w*)(?:\s*\[([^\]]*)\])?/g;
    const connectedNodes = new Set<string>();
    let edgeMatch;
    
    // Reset regex
    edgeRegex.lastIndex = 0;
    while ((edgeMatch = edgeRegex.exec(cleanContent)) !== null) {
      const sourceId = edgeMatch[1];
      const targetId = edgeMatch[2];
      const attrsString = edgeMatch[3] || '';
      
      // Ignorer si c'est un mot-clé DOT
      if (dotKeywords.has(sourceId.toLowerCase()) || dotKeywords.has(targetId.toLowerCase())) {
        continue;
      }
      
      connectedNodes.add(sourceId);
      connectedNodes.add(targetId);
      
      // Créer les nœuds s'ils n'existent pas
      if (!nodeMap.has(sourceId)) {
        nodeMap.set(sourceId, {
          id: sourceId,
          name: sourceId,
          group: nodeMap.size % 5 + 1,
          val: 8,
          color: `hsl(${(nodeMap.size * 60) % 360}, 70%, 50%)`
        });
      }
      
      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, {
          id: targetId,
          name: targetId,
          group: nodeMap.size % 5 + 1,
          val: 8,
          color: `hsl(${(nodeMap.size * 60) % 360}, 70%, 50%)`
        });
      }
      
      // Parser les attributs de l'arête
      const attrs = this.parseAttributes(attrsString);
      
      links.push({
        source: sourceId,
        target: targetId,
        value: parseFloat(attrs.weight || '1'),
        color: attrs.color || '#999999',
        name: attrs.name || attrs.label || `${sourceId} → ${targetId}`
      });
    }
    
    // 2. Ensuite traiter les définitions de nœuds avec attributs
    const nodeWithAttrsRegex = /([A-Za-z]\w*)\s*\[([^\]]*)\]/g;
    let nodeMatch;
    
    nodeWithAttrsRegex.lastIndex = 0;
    while ((nodeMatch = nodeWithAttrsRegex.exec(cleanContent)) !== null) {
      const nodeId = nodeMatch[1];
      const attrsString = nodeMatch[2];
      
      // Ignorer si c'est un mot-clé DOT
      if (dotKeywords.has(nodeId.toLowerCase())) {
        continue;
      }
      
      // Parser les attributs
      const attrs = this.parseAttributes(attrsString);
      
      // Mettre à jour le nœud existant ou en créer un nouveau
      const existingNode = nodeMap.get(nodeId);
      const node: ForceGraphNode = {
        id: nodeId,
        name: attrs.name || attrs.label || nodeId,
        group: existingNode?.group || (nodeMap.size % 5 + 1),
        val: parseFloat(attrs.size || '8'),
        color: attrs.color || existingNode?.color || `hsl(${(nodeMap.size * 60) % 360}, 70%, 50%)`
      };
      
      nodeMap.set(nodeId, node);
      connectedNodes.add(nodeId);
    }
    
    console.log('Nœuds traités:', Array.from(nodeMap.keys()));
    console.log('Liens créés:', links.length);
    
    // Convertir la Map en tableau
    nodes.push(...Array.from(nodeMap.values()));
    
    return { nodes, links };
  }
  
  private static parseAttributes(attrsString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    if (!attrsString) return attrs;
    
    // Parser les attributs du format: key="value", key=value, key="value with spaces"
    const attrRegex = /([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
    let match;
    
    while ((match = attrRegex.exec(attrsString)) !== null) {
      const key = match[1];
      const value = match[2] || match[3]; // Valeur avec ou sans guillemets
      attrs[key] = value;
    }
    
    return attrs;
  }
}

// =====================================
// Composant Principal
// =====================================
const GraphRenderer3D: React.FC<GraphRenderer3DProps> = ({
  dotContent,
  isValid,
  parsedData
}) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const forceGraphRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [renderStats, setRenderStats] = useState({
    nodes: 0,
    links: 0,
    fps: 0
  });
  

  // État pour les contrôles de rendu
  const [showArrows, setShowArrows] = useState(true);
  const [showParticles, setShowParticles] = useState(false);
  const [showNodeText, setShowNodeText] = useState(false);
  const [showLinkText, setShowLinkText] = useState(false);
  const [emitParticles, setEmitParticles] = useState(false);
  const [linkCurvature, setLinkCurvature] = useState(0.2); // Intensité des courbes (0 = droite, 1 = très courbée)
  const [linkWidth, setLinkWidth] = useState(0); // Épaisseur des liens (0 = filet minimal, 8 = épais)
  
  // Génération d'un ID unique basé sur le contenu DOT pour la mémorisation
  const graphId = React.useMemo(() => {
    // Hash simple du contenu DOT pour créer un ID unique
    let hash = 0;
    const str = dotContent.trim();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en entier 32 bits
    }
    return `graph_${Math.abs(hash)}`;
  }, [dotContent]);

  // État pour savoir si c'est le premier chargement
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Fonction pour charger la position et l'état sauvegardés
  const loadSavedState = useCallback(() => {
    const savedPosition = localStorage.getItem(`vortex_controls_position_${graphId}`);
    const savedMinimized = localStorage.getItem(`vortex_controls_minimized_${graphId}`);
    
    return {
      position: savedPosition ? JSON.parse(savedPosition) : { x: 10, y: 10 },
      minimized: savedMinimized ? JSON.parse(savedMinimized) : false
    };
  }, [graphId]);

  // État pour la position du panneau de contrôles déplaçable avec mémorisation
  const [controlsPosition, setControlsPosition] = useState(() => loadSavedState().position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isControlsMinimized, setIsControlsMinimized] = useState(() => loadSavedState().minimized);
  
  // Références pour manipulation DOM directe (sans React)
  const controlsPanelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(controlsPosition);
  const isDraggingRef = useRef(false);

  // Synchroniser la référence et le DOM avec l'état
  useEffect(() => {
    positionRef.current = controlsPosition;
    // Mettre à jour le DOM directement sans re-render
    if (controlsPanelRef.current && !isDraggingRef.current) {
      controlsPanelRef.current.style.transform = `translate(${controlsPosition.x}px, ${controlsPosition.y}px)`;
    }
  }, [controlsPosition]);
  
  // Sauvegarder la position quand elle change (avec debounce pour éviter trop d'écritures)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(`vortex_controls_position_${graphId}`, JSON.stringify(controlsPosition));
    }, 100); // Debounce de 100ms
    
    return () => clearTimeout(timeoutId);
  }, [controlsPosition, graphId]);

  // Sauvegarder l'état minimisé quand il change
  useEffect(() => {
    localStorage.setItem(`vortex_controls_minimized_${graphId}`, JSON.stringify(isControlsMinimized));
  }, [isControlsMinimized, graphId]);
  
  // Effet pour restaurer la position sauvegardée quand le graphId change
  useEffect(() => {
    const savedState = loadSavedState();
    setControlsPosition(savedState.position);
    setIsControlsMinimized(savedState.minimized);
    setIsInitialLoad(true);
  }, [graphId, loadSavedState]);
  
  // Taille du panneau pour les contraintes
  const PANEL_WIDTH = 260;
  const PANEL_HEIGHT = isControlsMinimized ? 60 : 500;
  
  // État pour stocker les données du graphique
  const [currentGraphData, setCurrentGraphData] = useState<{nodes: ForceGraphNode[], links: ForceGraphLink[]}>({nodes: [], links: []});
  
  // Fonction pour contraindre la position dans les limites
  const constrainPosition = useCallback((x: number, y: number, skipIfValid = false) => {
    const containerWidth = dimensions.width || 800;
    const containerHeight = dimensions.height || 600;
    
    // Si skipIfValid est true et la position est déjà valide, ne pas la changer
    if (skipIfValid && x >= 0 && y >= 0 && 
        x <= containerWidth - PANEL_WIDTH && y <= containerHeight - PANEL_HEIGHT) {
      return { x, y };
    }
    
    // Contraindre X (ne pas dépasser les bords)
    let constrainedX = Math.max(0, Math.min(x, containerWidth - PANEL_WIDTH));
    // Contraindre Y (ne pas dépasser les bords)
    let constrainedY = Math.max(0, Math.min(y, containerHeight - PANEL_HEIGHT));
    
    return { x: constrainedX, y: constrainedY };
  }, [dimensions.width, dimensions.height, PANEL_WIDTH, PANEL_HEIGHT]);
  
  // Gestion du drag & drop avec manipulation DOM directe (pas de React setState pendant le drag)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current && controlsPanelRef.current) {
        e.preventDefault();
        e.stopPropagation();
        
        // Calcul direct des nouvelles coordonnées
        const containerWidth = dimensions.width || 800;
        const containerHeight = dimensions.height || 600;
        
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Application des contraintes
        const constrainedX = Math.max(0, Math.min(newX, containerWidth - PANEL_WIDTH));
        const constrainedY = Math.max(0, Math.min(newY, containerHeight - PANEL_HEIGHT));
        
        // Mise à jour DOM directe - ULTRA FLUIDE car pas de React
        controlsPanelRef.current.style.transform = `translate(${constrainedX}px, ${constrainedY}px)`;
        
        // Mettre à jour la référence pour la sauvegarde finale
        positionRef.current = { x: constrainedX, y: constrainedY };
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = false;
        setIsDragging(false);
        // Sauvegarder la position finale dans React state
        setControlsPosition(positionRef.current);
      }
    };
    
    if (isDragging) {
      isDraggingRef.current = true;
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      isDraggingRef.current = false;
    };
  }, [isDragging, dragOffset, dimensions.width, dimensions.height, PANEL_WIDTH, PANEL_HEIGHT]);
  
  // Effet pour synchroniser la position DOM initiale avec React state
  useEffect(() => {
    if (controlsPanelRef.current && !isDragging) {
      controlsPanelRef.current.style.transform = `translate(${controlsPosition.x}px, ${controlsPosition.y}px)`;
      positionRef.current = controlsPosition;
    }
  }, [controlsPosition, isDragging]);
  
  // Effet pour ajuster la position quand les dimensions changent (sauf au chargement initial et pendant le drag)
  useEffect(() => {
    // Ne pas appliquer les contraintes au chargement initial pour préserver la position sauvegardée
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    
    // Ne pas ajuster pendant le drag pour éviter les conflits
    if (isDragging) {
      return;
    }
    
    // Seulement ajuster si la position actuelle sort des limites
    const constrainedPos = constrainPosition(controlsPosition.x, controlsPosition.y, true);
    if (constrainedPos.x !== controlsPosition.x || constrainedPos.y !== controlsPosition.y) {
      setControlsPosition(constrainedPos);
    }
  }, [dimensions.width, dimensions.height, constrainPosition, controlsPosition, isInitialLoad, isDragging]);
  
  // Effet pour détecter les dimensions du conteneur
  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (graphRef.current) {
        // Chercher le conteneur parent de l'onglet "Aperçu 3D" pour obtenir l'espace réel disponible
        let tabPanelContainer = graphRef.current.closest('[role="tabpanel"]');
        if (!tabPanelContainer) {
          // Fallback: chercher le conteneur parent avec flexGrow (Box principal de l'onglet)
          tabPanelContainer = graphRef.current.closest('div[style*="flex-grow"]');
        }
        if (!tabPanelContainer) {
          // Fallback final: utiliser le conteneur direct
          tabPanelContainer = graphRef.current;
        }
        
        // Utiliser des limites absolues pour éviter tout débordement
        const maxAllowedWidth = Math.min(
          tabPanelContainer.clientWidth,
          window.innerWidth - 100 // Marge de sécurité
        );
        const maxAllowedHeight = Math.min(
          tabPanelContainer.clientHeight,
          window.innerHeight - 200 // Marge de sécurité
        );
        
        const width = maxAllowedWidth;
        const height = maxAllowedHeight;
        
        console.log('3D Container dimensions calculated:', { width, height, container: tabPanelContainer.tagName });
        
        console.log('3D Container dimensions:', { 
          width, 
          height, 
          container: tabPanelContainer.tagName,
          classes: tabPanelContainer.className,
          role: (tabPanelContainer as HTMLElement).getAttribute('role')
        });
        
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateDimensions);
    });

    if (graphRef.current) {
      // Observer le conteneur parent plutôt que le conteneur direct
      let observeTarget = graphRef.current.closest('[role="tabpanel"]') || graphRef.current;
      resizeObserver.observe(observeTarget);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Initialisation du graphique 3D
  const initializeGraph = useCallback(() => {
    if (!graphRef.current || !isValid) return;

    try {
      setLoading(true);
      setError(null);

      // Parser le contenu DOT
      const graphData = DotTo3DConverter.parseDotToGraphData(dotContent);
      
      if (graphData.nodes.length === 0) {
        setError('Aucun nœud détecté dans le graphique DOT');
        return;
      }
      
      // Sauvegarder les données du graphique pour les overlays
      setCurrentGraphData(graphData);
      
      // Créer ou réinitialiser le graphique 3D
      if (forceGraphRef.current) {
        forceGraphRef.current._destructor();
      }

      // Créer l'instance ForceGraph3D avec le container DOM
      const graph = ForceGraph3D()(graphRef.current!)
        .width(dimensions.width)
        .height(dimensions.height)
        .backgroundColor('#0a0a0a')
        .graphData(graphData);
      
      // Sauvegarder la référence pour le nettoyage
      forceGraphRef.current = graph;

      // Configuration des nœuds avec texte
      graph
        .nodeLabel('name')
        .nodeVal('val')
        .nodeColor('color');
        


      // Configuration des liens avec courbes et flèches
      graph
        .linkLabel('name')
        .linkColor('color')
        .linkWidth(linkWidth) // Vraie épaisseur, 0 = invisible comme dans l'exemple du framework
        // Courbes pour les liens
        .linkCurvature(linkCurvature) // Courbure dynamique contrôlée
        .linkCurveRotation(Math.PI / 4) // Rotation de la courbe
        // Flèches directionnelles - facteur multiplicateur avec minimum
        .linkDirectionalArrowLength(showArrows ? Math.max(3.5, linkWidth * 3.5) : 0) // Flèches : minimum 3.5, sinon 3.5x l'épaisseur
        .linkDirectionalArrowRelPos(1.0) // Position à 100% du lien pour toucher parfaitement
        .linkDirectionalArrowColor((link: any) => link.color || '#ff6b6b')
        .linkDirectionalArrowResolution(8); // Résolution des flèches
        
      // Tooltips simples (le texte permanent est géré par Canvas)
      graph.nodeLabel((node: any) => node.name || node.id || '')
           .linkLabel((link: any) => link.name || link.id || '')
           .nodeAutoColorBy('group');

      // Particules pour les liens
      if (showParticles) {
        graph.linkDirectionalParticles(4)
          .linkDirectionalParticleSpeed(0.01)
          .linkDirectionalParticleWidth(2)
          .linkDirectionalParticleColor('#4fc3f7');
      }

      // Émission de particules depuis les nœuds (simplifiée)
      if (emitParticles) {
        graph.d3Force('charge')?.strength(-200);
        // L'émission de particules sera implémentée plus tard
        console.log('Mode émission de particules activé');
      }

      // Événements d'interaction
      graph
        .onNodeClick((node: any) => {
          console.log('Node clicked:', node);
          // Animation de zoom vers le nœud
          const distance = 40;
          const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
          graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node,
            3000
          );
        })
        .onNodeHover((node: any) => {
          document.body.style.cursor = node ? 'pointer' : 'default';
        })
        .onLinkHover((link: any) => {
          if (link && showLinkText) {
            graph.linkLabel(() => link.name || '');
          }
        });

      // Laisser le framework 3d-force-graph gérer l'espacement naturellement
      // Pas de configuration forcée des forces physiques

      forceGraphRef.current = graph;

      // Stats de rendu
      const updateStats = () => {
        setRenderStats({
          nodes: graphData.nodes.length,
          links: graphData.links.length,
          fps: Math.round(graph.renderer().info.render.frame / 60)
        });
      };
      
      graph.onEngineStop(updateStats);
      updateStats();

    } catch (err) {
      console.error('Erreur lors de l\'initialisation du graphique 3D:', err);
      setError('Erreur lors du rendu 3D: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dotContent, isValid, dimensions.width, dimensions.height]);

  // Effet pour redimensionner le graphique 3D quand les dimensions changent
  useEffect(() => {
    if (forceGraphRef.current && dimensions.width > 0 && dimensions.height > 0) {
      forceGraphRef.current
        .width(dimensions.width)
        .height(dimensions.height);
    }
  }, [dimensions.width, dimensions.height]);

  // Fonctions de mise à jour spécifiques pour éviter le redessin complet
  const updateLinkProperties = useCallback(() => {
    if (!forceGraphRef.current) return;
    
    forceGraphRef.current
      .linkWidth(linkWidth)
      .linkCurvature(linkCurvature)
      .linkDirectionalArrowLength(showArrows ? Math.max(3.5, linkWidth * 3.5) : 0);
  }, [linkWidth, linkCurvature, showArrows]);

  const updateParticleProperties = useCallback(() => {
    if (!forceGraphRef.current) return;
    
    forceGraphRef.current
      .linkDirectionalParticles(showParticles ? (emitParticles ? 4 : 1) : 0)
      .linkDirectionalParticleSpeed(0.008)
      .linkDirectionalParticleWidth(2);
  }, [showParticles, emitParticles]);

  // Effets pour mettre à jour les propriétés sans redessin
  useEffect(() => {
    updateLinkProperties();
  }, [updateLinkProperties]);

  useEffect(() => {
    updateParticleProperties();
  }, [updateParticleProperties]);

  // État pour les overlays de texte
  const [textOverlays, setTextOverlays] = useState<Array<{id: string, x: number, y: number, text: string, type: 'node' | 'link'}>>([]);
  
  // Fonction pour mettre à jour les positions des overlays
  const updateTextOverlays = useCallback(() => {
    if (!forceGraphRef.current || !currentGraphData.nodes.length) return;
    
    const overlays: Array<{id: string, x: number, y: number, text: string, type: 'node' | 'link'}> = [];
    
    // Générer TOUS les overlays de nœuds (le filtrage se fait au rendu)
    currentGraphData.nodes.forEach((node: ForceGraphNode) => {
      const label = node.name || node.id || '';
      if (label && node.x !== undefined && node.y !== undefined) {
        // Projection 3D vers 2D (approximation)
        const screenPos = forceGraphRef.current!.graph2ScreenCoords ? 
          forceGraphRef.current!.graph2ScreenCoords(node.x, node.y, node.z || 0) :
          { x: node.x * 10 + dimensions.width/2, y: -node.y * 10 + dimensions.height/2 };
        
        overlays.push({
          id: `node-${node.id}`,
          x: screenPos.x,
          y: screenPos.y - 20, // Au-dessus du nœud
          text: label,
          type: 'node'
        });
      }
    });
    
    // Générer TOUS les overlays de liens (le filtrage se fait au rendu)
    currentGraphData.links.forEach((link: ForceGraphLink, index: number) => {
      const label = (link as any).name || (link as any).id || `Link ${index + 1}`;
      if (label && link.source && link.target) {
        const source = typeof link.source === 'object' ? link.source : currentGraphData.nodes.find((n: ForceGraphNode) => n.id === link.source);
        const target = typeof link.target === 'object' ? link.target : currentGraphData.nodes.find((n: ForceGraphNode) => n.id === link.target);
        
        if (source && target && source.x !== undefined && target.x !== undefined && source.y !== undefined && target.y !== undefined) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          const midZ = ((source.z || 0) + (target.z || 0)) / 2;
          
          const screenPos = forceGraphRef.current!.graph2ScreenCoords ? 
            forceGraphRef.current!.graph2ScreenCoords(midX, midY, midZ) :
            { x: midX * 10 + dimensions.width/2, y: -midY * 10 + dimensions.height/2 };
          
          overlays.push({
            id: `link-${index}`,
            x: screenPos.x,
            y: screenPos.y,
            text: label,
            type: 'link'
          });
        }
      }
    });
    
    setTextOverlays(overlays);
  }, [currentGraphData, dimensions.width, dimensions.height]);
  
  // Mise à jour des overlays quand le graphique bouge
  useEffect(() => {
    if (!forceGraphRef.current) return;
    
    const graph = forceGraphRef.current;
    let animationFrame: number;
    
    const updateLoop = () => {
      updateTextOverlays();
      animationFrame = requestAnimationFrame(updateLoop);
    };
    
    // Toujours mettre à jour les overlays si des données existent
    // Le filtrage se fait au niveau du rendu selon showNodeText/showLinkText
    if (currentGraphData.nodes.length > 0) {
      updateLoop();
    } else {
      setTextOverlays([]);
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [updateTextOverlays, currentGraphData.nodes.length]);

  // Effet pour initialiser/réinitialiser le graphique
  useEffect(() => {
    if (isValid && dotContent) {
      initializeGraph();
    }
    
    return () => {
      if (forceGraphRef.current) {
        forceGraphRef.current._destructor();
      }
    };
  }, [initializeGraph, isValid, dotContent]);

  // Interface de rendu
  if (!isValid) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Code DOT invalide</Typography>
        <Typography>Corrigez les erreurs de syntaxe pour voir l'aperçu 3D</Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Panneau de contrôles déplaçable avec manipulation DOM directe */}
      <Paper 
        elevation={3} 
        ref={controlsPanelRef}
        onMouseDown={(e) => {
          setIsDragging(true);
          setDragOffset({
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y
          });
        }}
        sx={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          // Position initiale uniquement, sera écrasée par manipulation DOM pendant drag
          transform: !isDragging ? `translate(${controlsPosition.x}px, ${controlsPosition.y}px)` : undefined,
          width: `${PANEL_WIDTH}px`,
          minHeight: `${PANEL_HEIGHT}px`,
          maxHeight: `${PANEL_HEIGHT}px`,
          zIndex: 10, 
          p: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          overflow: 'hidden',
          // Pas de transition pendant le drag pour performance maximale
          transition: isDragging ? 'none' : 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          mb: isControlsMinimized ? 0 : 2
        }}>
          <Box sx={{ cursor: 'inherit', display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
            <Typography variant="h6" sx={{ 
              cursor: 'inherit', 
              mb: 0, 
              whiteSpace: 'nowrap', 
              fontWeight: 600,
              color: 'text.secondary',
              textShadow: 'none'
            }}>
              Contrôles 3D
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            onClick={(e) => {
              e.stopPropagation();
              setIsControlsMinimized(!isControlsMinimized);
            }}
            sx={{ 
              minWidth: '32px', 
              height: '32px',
              p: 0,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.1)'
              }
            }}
          >
            {isControlsMinimized ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Button>
        </Box>
        
        {!isControlsMinimized && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
          <Button 
            variant={showArrows ? 'contained' : 'outlined'}
            size="small"
            startIcon={<ArrowIcon />}
            onClick={() => setShowArrows(!showArrows)}
            sx={{ 
              justifyContent: 'flex-start',
              textAlign: 'left',
              '& .MuiButton-startIcon': {
                marginRight: 1.5,
                width: '16px',
                display: 'flex',
                justifyContent: 'center'
              }
            }}
          >
            Flèches directionnelles
          </Button>
          
          {/* Contrôle de l'intensité des courbes */}
          <Box 
            sx={{ px: 2, pb: 1 }}
            onMouseDown={(e) => {
              // Empêcher le drag du panneau uniquement pour les sliders
              if (e.target instanceof HTMLElement && 
                  (e.target.closest('.MuiSlider-root') || e.target.classList.contains('MuiSlider-thumb'))) {
                e.stopPropagation();
              }
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.85rem' }}>
              Intensité des courbes: {Math.round(linkCurvature * 100)}%
            </Typography>
            <Slider
              value={linkCurvature}
              onChange={(_, value) => setLinkCurvature(value as number)}
              min={0}
              max={0.8}
              step={0.1}
              size="small"
              sx={{
                color: 'primary.main',
                '& .MuiSlider-thumb': {
                  width: 16,
                  height: 16
                },
                '& .MuiSlider-track': {
                  border: 'none'
                }
              }}
            />
          </Box>
          
          {/* Contrôle de l'épaisseur des liens */}
          <Box 
            sx={{ px: 2, pb: 1 }}
            onMouseDown={(e) => {
              // Empêcher le drag du panneau uniquement pour les sliders
              if (e.target instanceof HTMLElement && 
                  (e.target.closest('.MuiSlider-root') || e.target.classList.contains('MuiSlider-thumb'))) {
                e.stopPropagation();
              }
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.85rem' }}>
              Épaisseur des liens: {linkWidth === 0 ? 'Filet' : `${linkWidth}px`}
            </Typography>
            <Slider
              value={linkWidth}
              onChange={(_, value) => setLinkWidth(value as number)}
              min={0}
              max={8}
              step={1}
              size="small"
              sx={{
                color: 'secondary.main',
                '& .MuiSlider-thumb': {
                  width: 16,
                  height: 16
                },
                '& .MuiSlider-track': {
                  border: 'none'
                }
              }}
            />
          </Box>
          
          <Button 
            variant={showParticles ? 'contained' : 'outlined'}
            size="small"
            startIcon={<ParticlesIcon />}
            onClick={() => setShowParticles(!showParticles)}
            sx={{ 
              justifyContent: 'flex-start',
              textAlign: 'left',
              '& .MuiButton-startIcon': {
                marginRight: 1.5,
                width: '16px',
                display: 'flex',
                justifyContent: 'center'
              }
            }}
          >
            Particules sur liens
          </Button>
          
          <Button 
            variant={showNodeText ? 'contained' : 'outlined'}
            size="small"
            startIcon={<LabelIcon />}
            onClick={() => setShowNodeText(!showNodeText)}
            sx={{ 
              justifyContent: 'flex-start',
              textAlign: 'left',
              '& .MuiButton-startIcon': {
                marginRight: 1.5,
                width: '16px',
                display: 'flex',
                justifyContent: 'center'
              }
            }}
          >
            Texte des nœuds
          </Button>
          
          <Button 
            variant={showLinkText ? 'contained' : 'outlined'}
            size="small"
            startIcon={<LinkIcon />}
            onClick={() => setShowLinkText(!showLinkText)}
            sx={{ 
              justifyContent: 'flex-start',
              textAlign: 'left',
              '& .MuiButton-startIcon': {
                marginRight: 1.5,
                width: '16px',
                display: 'flex',
                justifyContent: 'center'
              }
            }}
          >
            Texte des liens
          </Button>
          
          <Button 
            variant={emitParticles ? 'contained' : 'outlined'}
            size="small"
            startIcon={<EffectsIcon />}
            onClick={() => setEmitParticles(!emitParticles)}
            sx={{ 
              justifyContent: 'flex-start',
              textAlign: 'left',
              '& .MuiButton-startIcon': {
                marginRight: 1.5,
                width: '16px',
                display: 'flex',
                justifyContent: 'center'
              }
            }}
          >
            Émission particules
          </Button>
        </Box>
        )}

        {/* Statistiques */}
        {!isControlsMinimized && renderStats.nodes > 0 && (
          <Card sx={{ mt: 2, backgroundColor: 'rgba(255, 255, 255, 0.85)', border: '1px solid rgba(0, 0, 0, 0.2)', boxShadow: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <StatsIcon sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Statistiques
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <NodesIcon sx={{ fontSize: '1rem', color: 'success.main' }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                    Nœuds: <strong style={{ color: '#2e7d32' }}>{renderStats.nodes}</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <LinkIcon sx={{ fontSize: '1rem', color: 'info.main' }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                    Liens: <strong style={{ color: '#0288d1' }}>{renderStats.links}</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <SpeedIcon sx={{ fontSize: '1rem', color: 'warning.main' }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                    FPS: <strong style={{ color: '#f57c00' }}>{renderStats.fps || 'N/A'}</strong>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
      </Paper>

      {/* Zone de rendu 3D */}
      <Box
        ref={graphRef}
        sx={{
          width: '100%',
          height: '100%',
          maxWidth: '100vw',
          maxHeight: '100vh',
          minWidth: 0,
          minHeight: 0,
          boxSizing: 'border-box',
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'grab',
          position: 'relative',
          containIntrinsicSize: 'none',
          contain: 'layout size',
          '&:active': { cursor: 'grabbing' },
          // Contraintes très strictes sur le contenu 3D
          '& > *': {
            maxWidth: '100% !important',
            maxHeight: '100% !important',
            width: '100% !important',
            height: '100% !important',
            boxSizing: 'border-box !important',
            overflow: 'hidden !important'
          }
        }}
      />
      
      {/* Overlays de texte permanent */}
      {textOverlays
        .filter(overlay => 
          (overlay.type === 'node' && showNodeText) || 
          (overlay.type === 'link' && showLinkText)
        )
        .map((overlay) => (
        <Typography
          key={overlay.id}
          sx={{
            position: 'absolute',
            left: `${overlay.x}px`,
            top: `${overlay.y}px`,
            color: overlay.type === 'node' ? '#ffffff' : '#cccccc',
            fontSize: overlay.type === 'node' ? '12px' : '10px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 50,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {overlay.text}
        </Typography>
      ))}

      {/* Indicateur de chargement */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            zIndex: 100
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress color="primary" sx={{ mb: 2 }} />
            <Typography>Génération du rendu 3D...</Typography>
          </Box>
        </Box>
      )}

      {/* Affichage d'erreur */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            position: 'absolute', 
            bottom: 10, 
            left: 10, 
            right: 10,
            zIndex: 10 
          }}
        >
          {error}
        </Alert>
      )}

      {/* Aide contextuelle */}
      <Tooltip 
        title="🖱️ Clic gauche: rotation • Molette: zoom • Clic droit: pan • Clic sur nœud: focus"
        placement="top"
      >
        <Paper 
          sx={{ 
            position: 'absolute', 
            bottom: 10, 
            right: 10, 
            p: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.9)'
          }}
        >
          <Typography variant="caption">💡 Aide</Typography>
        </Paper>
      </Tooltip>
    </Box>
  );
};

export default GraphRenderer3D;
