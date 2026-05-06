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
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails
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
  AccountTree as NodesIcon,
  OpenInFull as SpacingIcon,
  RadioButtonUnchecked as NodeSizeIcon,
  ArrowForward as ArrowForwardIcon,
  BlurOn as BlurOnIcon,
  TextFields as TextFieldsIcon,
  FlashOn as FlashOnIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Timeline as CurveIcon,
  LineWeight as WidthIcon,
  Tune as TuneIcon
} from '@mui/icons-material';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { GraphData, GraphNode, GraphEdge } from '../../types';

// Déclaration de type pour THREE.js global
declare global {
  interface Window {
    THREE: any;
  }
}

// =====================================
// Types pour le rendu 3D
// ======================================
interface GraphRenderer3DProps {
  dotContent: string;
  isValid: boolean;
  parsedData?: GraphData;
  // Drives the in-renderer simulation: when true, particles emit along links
  // and the per-node accumulation / stats effect runs.
  isSimulationRunning?: boolean;
  // Optional toggle handler: when provided, the panel's Start/Pause button
  // delegates to the parent (GraphViewer) instead of flipping a local flag,
  // so the toolbar icon and the panel button stay in sync.
  onToggleSimulation?: () => void;
}

// Types pour la gestion des données 3D étendues
interface ForceGraphNode {
  id: string;
  name?: string;
  group?: number;
  val?: number;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
  // Extensions 3D
  geometry?: '3d-box' | '3d-cone' | '3d-cylinder' | '3d-sphere' | '3d-torus';
  dimensions?: any;
  particleGeneration?: number;
  maxParticleProcessing?: number;
  image?: string;
  autoResize?: boolean;
  bloomEffect?: boolean;
}

interface ForceGraphLink {
  source: string;
  target: string;
  value?: number;
  color?: string;
  name?: string;
  // Extensions 3D
  maxParticleFlow?: number;
  particleSpeed?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

// =====================================
// Utilitaires de parsing DOT vers 3D
// =====================================
export class DotTo3DConverter {
  static async parseDotToGraphData(dotContent: string): Promise<{ nodes: ForceGraphNode[], links: ForceGraphLink[], globalSettings?: any }> {
    // Utiliser le backend pour le parsing robuste
    try {
      const apiUrl = 'http://192.168.5.30:5000/api/public/parse-dot';
      console.log(`🔍 Calling backend API: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ dotContent }),
      });
      
      if (response.ok) {
        const backendData = await response.json();
        console.log('✅ Backend parsing successful:', backendData);
        return this.convertBackendDataToGraph(backendData);
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Backend parsing failed (status:', response.status, '):', errorText);
        console.warn('Falling back to frontend parsing');
        return this.parseDotToGraphDataFrontend(dotContent);
      }
    } catch (error) {
      console.warn('⚠️ Backend not available, using frontend parsing. Error:', error instanceof Error ? error.message : String(error));
      console.warn('Full error:', error);
      return this.parseDotToGraphDataFrontend(dotContent);
    }
  }
  
  static parseDotToGraphDataFrontend(dotContent: string): { nodes: ForceGraphNode[], links: ForceGraphLink[], globalSettings?: any } {
    const nodes: ForceGraphNode[] = [];
    const links: ForceGraphLink[] = [];
    const nodeMap = new Map<string, ForceGraphNode>();
    
    // Défaut pour les attributs globaux
    const globalSettings = {
      defaultNodeSize: 6,
      autoColors: true,
      autoResize: true,
      particlesEnabled: true,
      bloomEffect: true
    };
    
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
        name: attrs.name || attrs.label || `${sourceId} → ${targetId}`,
        // Extensions 3D pour les liens
        maxParticleFlow: attrs.maxParticleFlow ? parseInt(attrs.maxParticleFlow) : undefined,
        particleSpeed: attrs.particleSpeed ? parseFloat(attrs.particleSpeed) : undefined,
        style: attrs.style as 'solid' | 'dashed' | 'dotted' || 'solid'
      });
    }
    
    // Nettoyer le contenu DOT en supprimant les commentaires inline
    const contentWithoutComments = cleanContent.replace(/\/\/.*$/gm, '');
    console.log('🧹 Content after removing comments (first 500 chars):', contentWithoutComments.substring(0, 500));
    
    // 2. Parser robuste pour les nœuds avec attributs multi-lignes
    const nodeMatches = this.parseNodesWithAttributes(contentWithoutComments);
    
    for (const { nodeId, attrsString } of nodeMatches) {
      console.log(`🎯 Node ${nodeId} - Captured attrs length:`, attrsString.length);
      console.log(`🎯 Node ${nodeId} - First 100 chars:`, attrsString.substring(0, 100) + '...');
      
      // Ignorer si c'est un mot-clé DOT
      if (dotKeywords.has(nodeId.toLowerCase())) {
        continue;
      }
      
      // Parser les attributs
      const attrs = this.parseAttributes(attrsString);
      
      // Mettre à jour le nœud existant ou en créer un nouveau
      const existingNode = nodeMap.get(nodeId);
      // Debug: log des attributs extraits pour ce nœud
      console.log(`🔍 Nœud ${nodeId} - Attributs extraits:`, {
        attrs,
        geometry: attrs.geometry,
        dimensions: attrs.dimensions,
        particleGeneration: attrs.particleGeneration,
        color: attrs.color
      });
      
      const node: ForceGraphNode = {
        id: nodeId,
        name: attrs.name || attrs.label || nodeId,
        group: existingNode?.group || (nodeMap.size % 5 + 1),
        val: parseFloat(attrs.size || '8'),
        color: attrs.color || existingNode?.color || `hsl(${(nodeMap.size * 60) % 360}, 70%, 50%)`,
        // Extensions 3D pour les nœuds
        geometry: this.parseGeometry(attrs.geometry),
        dimensions: this.parseDimensions(attrs.dimensions),
        particleGeneration: attrs.particleGeneration ? parseInt(attrs.particleGeneration) : undefined,
        maxParticleProcessing: attrs.maxParticleProcessing ? parseInt(attrs.maxParticleProcessing) : undefined,
        image: attrs.image,
        autoResize: attrs.autoResize ? this.parseBoolean(attrs.autoResize) : undefined,
        bloomEffect: attrs.bloomEffect ? this.parseBoolean(attrs.bloomEffect) : undefined
      };
      
      console.log(`✅ Nœud ${nodeId} final:`, node);
      
      nodeMap.set(nodeId, node);
      connectedNodes.add(nodeId);
    }
    
    console.log('Nœuds traités:', Array.from(nodeMap.keys()));
    // Parser les attributs globaux depuis le contenu DOT
    const globalAttrsRegex = /graph\s*\[(.*?)\]/gi;
    let globalMatch;
    while ((globalMatch = globalAttrsRegex.exec(cleanContent)) !== null) {
      const attrs = this.parseAttributes(globalMatch[1]);
      
      // Appliquer les attributs globaux détectés
      if (attrs.defaultNodeSize) {
        globalSettings.defaultNodeSize = parseFloat(attrs.defaultNodeSize) || 6;
      }
      if (attrs.autoColors !== undefined) {
        const parsed = this.parseBoolean(attrs.autoColors);
        if (parsed !== undefined) globalSettings.autoColors = parsed;
      }
      if (attrs.autoResize !== undefined) {
        const parsed = this.parseBoolean(attrs.autoResize);
        if (parsed !== undefined) globalSettings.autoResize = parsed;
      }
      if (attrs.particlesEnabled !== undefined) {
        const parsed = this.parseBoolean(attrs.particlesEnabled);
        if (parsed !== undefined) globalSettings.particlesEnabled = parsed;
      }
      if (attrs.bloomEffect !== undefined) {
        const parsed = this.parseBoolean(attrs.bloomEffect);
        if (parsed !== undefined) globalSettings.bloomEffect = parsed;
      }
    }
    
    console.log('Liens créés:', links.length);
    console.log('🌐 Global settings parsed:', globalSettings);
    
    // Convertir la Map en tableau
    nodes.push(...Array.from(nodeMap.values()));
    
    return { nodes, links, globalSettings };
  }
  
  // Parser robuste pour extraire les nœuds avec leurs attributs complets
  private static parseNodesWithAttributes(content: string): Array<{nodeId: string, attrsString: string}> {
    const results: Array<{nodeId: string, attrsString: string}> = [];
    
    // Trouver tous les débuts de définition de nœuds
    const nodeStartRegex = /([A-Za-z]\w*)\s*\[/g;
    let match;
    
    while ((match = nodeStartRegex.exec(content)) !== null) {
      const nodeId = match[1];
      const startPos = match.index + match[0].length - 1; // Position du '['
      
      // Compter les crochets pour trouver la fermeture correspondante
      let bracketCount = 0;
      let endPos = startPos;
      
      for (let i = startPos; i < content.length; i++) {
        const char = content[i];
        if (char === '[') {
          bracketCount++;
        } else if (char === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            endPos = i;
            break;
          }
        }
      }
      
      if (bracketCount === 0) {
        // Extraire le contenu entre les crochets
        const attrsString = content.substring(startPos + 1, endPos);
        results.push({ nodeId, attrsString });
        console.log(`🔍 Extracted ${nodeId}: ${attrsString.length} chars, ending with: "${attrsString.slice(-20)}"`);
      } else {
        console.warn(`⚠️ Crochets non équilibrés pour le nœud ${nodeId}`);
      }
    }
    
    return results;
  }
  
  // Convertir les données du backend vers le format attendu par le graphique 3D
  static convertBackendDataToGraph(backendData: any): { nodes: ForceGraphNode[], links: ForceGraphLink[], globalSettings?: any } {
    const nodes: ForceGraphNode[] = [];
    const links: ForceGraphLink[] = [];
    
    // Extraire les attributs globaux s'ils existent
    const globalSettings = {
      defaultNodeSize: backendData.globalSettings?.defaultNodeSize || 6,
      autoColors: backendData.globalSettings?.autoColors !== false, // true par défaut
      autoResize: backendData.globalSettings?.autoResize !== false, // true par défaut
      particlesEnabled: backendData.globalSettings?.particlesEnabled !== false, // true par défaut
      bloomEffect: backendData.globalSettings?.bloomEffect !== false // true par défaut
    };
    
    // Convertir les nœuds du backend
    if (backendData.nodes) {
      for (const node of backendData.nodes) {
        nodes.push({
          id: node.id,
          name: node.label || node.name || node.id,
          group: 1,
          val: parseFloat(node.size || '8'),
          color: node.color || '#1976D2',
          geometry: this.parseGeometry(node.geometry),
          dimensions: this.parseDimensions(node.dimensions),
          particleGeneration: node.particleGeneration ? parseInt(node.particleGeneration) : undefined,
          maxParticleProcessing: node.maxParticleProcessing ? parseInt(node.maxParticleProcessing) : undefined,
          image: node.image,
          autoResize: node.autoResize ? this.parseBoolean(node.autoResize) : undefined,
          bloomEffect: node.bloomEffect ? this.parseBoolean(node.bloomEffect) : undefined
        });
      }
    }
    
    // Convertir les liens du backend
    if (backendData.links) {
      for (const link of backendData.links) {
        links.push({
          source: link.source,
          target: link.target,
          name: link.label || '',
          color: link.color || '#888',
          maxParticleFlow: link.maxParticleFlow ? parseInt(link.maxParticleFlow) : undefined,
          particleSpeed: link.particleSpeed ? parseFloat(link.particleSpeed) : undefined,
          style: link.style as 'solid' | 'dashed' | 'dotted' || 'solid'
        });
      }
    }
    
    console.log(`🔄 Converted backend data: ${nodes.length} nodes, ${links.length} links`);
    console.log('🌐 Global settings:', globalSettings);
    return { nodes, links, globalSettings };
  }

  private static parseAttributes(attrsString?: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    if (!attrsString) return attrs;
    
    console.log('🔍 Raw attrsString to parse:', JSON.stringify(attrsString));
    
    // Parser les attributs avec support des objets JSON complexes
    // Regex simplifiée qui capture correctement le contenu entre guillemets
    const attrRegex = /([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
    let match;
    
    while ((match = attrRegex.exec(attrsString)) !== null) {
      const key = match[1];
      // Récupérer la valeur du bon groupe: quoted (2) ou simple (3)
      const value = match[2] || match[3];
      
      // Debug: log des valeurs capturées pour dimensions
      if (key === 'dimensions') {
        console.log('🔍 Parsing dimensions:', {
          key,
          fullMatch: match[0],
          quotedGroup: match[2],
          simpleGroup: match[3],
          finalValue: value
        });
      }
      
      attrs[key] = value;
    }
    
    return attrs;
  }

  // Parser la géométrie 3D depuis la valeur DOT
  private static parseGeometry(geometryValue?: string): '3d-box' | '3d-cone' | '3d-cylinder' | '3d-sphere' | '3d-torus' | undefined {
    if (!geometryValue) return undefined;
    
    const geometry = geometryValue.toLowerCase();
    switch (geometry) {
      case 'box': return '3d-box';
      case 'cone': return '3d-cone';
      case 'cylinder': return '3d-cylinder';
      case 'sphere': return '3d-sphere';
      case 'torus': return '3d-torus';
      default: return undefined;
    }
  }

  // Parser les dimensions JSON depuis la valeur DOT
  private static parseDimensions(dimensionsValue?: string): any {
    if (!dimensionsValue) return undefined;
    
    console.log('📝 Parsing dimensions input:', JSON.stringify(dimensionsValue));
    
    try {
      let cleanValue = dimensionsValue.trim();
      console.log('📝 Cleaned value:', JSON.stringify(cleanValue));
      
      let dimensions: any;
      
      // Si ça ressemble à du JSON (clés entre guillemets), parser comme JSON
      if (cleanValue.includes('"')) {
        console.log('📝 Parsing as JSON (contains quotes)');
        dimensions = JSON.parse(cleanValue);
      } else {
        console.log('📝 Parsing as JS object literal (no quotes)');
        // Convertir la syntaxe JavaScript object literal vers JSON
        // Gérer les clés non-quotées: {width: 1.0} -> {"width": 1.0}
        const jsonString = cleanValue.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
        console.log('📝 Converted to JSON:', JSON.stringify(jsonString));
        dimensions = JSON.parse(jsonString);
      }
      
      console.log('✅ Dimensions parsées avec succès:', dimensions);
      return dimensions;
    } catch (error) {
      console.error('❌ Erreur lors du parsing des dimensions:', {
        input: dimensionsValue,
        error: error instanceof Error ? error.message : String(error)
      });
      // Retourner des dimensions par défaut selon le pattern détecté
      if (dimensionsValue.includes('width') && dimensionsValue.includes('height')) {
        return { width: 2.0, height: 2.0, depth: 2.0 }; // Box par défaut
      } else if (dimensionsValue.includes('radius')) {
        return { radius: 1.0, height: 2.0 }; // Cylinder par défaut
      } else if (dimensionsValue.includes('tube')) {
        return { tube: 0.4, tubularSegments: 12, radialSegments: 8 }; // Torus par défaut
      }
      return undefined;
    }
  }

  // Parser les valeurs booléennes
  private static parseBoolean(value?: string): boolean | undefined {
    if (!value) return undefined;
    
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    return undefined;
  }
}

// =====================================
// Composant Principal
// =====================================
const GraphRenderer3D: React.FC<GraphRenderer3DProps> = ({
  dotContent,
  isValid,
  parsedData,
  isSimulationRunning,
  onToggleSimulation,
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
  const [showParticles, setShowParticles] = useState(true);
  const [showNodeText, setShowNodeText] = useState(true); // Afficher les labels par défaut
  const [showLinkText, setShowLinkText] = useState(true); // Afficher les labels de liens par défaut
  const [linkCurvature, setLinkCurvature] = useState(0.2); // Intensité des courbes (0 = droite, 1 = très courbée)
  const [linkWidth, setLinkWidth] = useState(0); // Liens invisibles par défaut
  const [nodeSpacing, setNodeSpacing] = useState(30); // Espacement entre nœuds (10 = serré, 100 = espacé)
  const [nodeSize, setNodeSize] = useState(6); // Taille des nœuds légèrement plus grande par défaut
  
  // États pour simulation temps réel
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [nodeAccumulation, setNodeAccumulation] = useState<Map<string, number>>(new Map());
  const [simulationStats, setSimulationStats] = useState({
    totalParticles: 0,
    averageLatency: 0,
    bottleneckNodes: 0
  });

  // Mirror the global simulation state (driven by the toolbar) into the
  // renderer's local flag so particles flow and the accumulation effect runs.
  useEffect(() => {
    if (isSimulationRunning === undefined) return;
    setSimulationRunning(isSimulationRunning);
  }, [isSimulationRunning]);
  
  // États pour les accordéons
  const [controlsExpanded, setControlsExpanded] = useState(false); // Accordéon "Contrôles Visuels" fermé par défaut
  const [parametersExpanded, setParametersExpanded] = useState(false); // Accordéon "Paramètres Ajustables" fermé par défaut
  
  // États pour le redimensionnement du panneau
  const [panelSize, setPanelSize] = useState({ width: 320, height: 650 });
  const [isResizing, setIsResizing] = useState(false);
  
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
  
  // Type pour la position
  interface Position {
    x: number;
    y: number;
  }
  
  // État pour stocker les données du graphique
  const [currentGraphData, setCurrentGraphData] = useState<{nodes: ForceGraphNode[], links: ForceGraphLink[]}>({nodes: [], links: []});
  
  // Fonction pour contraindre la position du panneau dans les limites
  const constrainPosition = useCallback((x: number, y: number, allowPartiallyHidden = false): Position => {
    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;
    const currentWidth = panelSize.width;
    const currentHeight = isControlsMinimized ? 60 : panelSize.height;
    
    if (allowPartiallyHidden && 
        x >= -currentWidth * 0.8 && y >= -currentHeight * 0.8 &&
        x <= containerWidth - currentWidth && y <= containerHeight - currentHeight) {
      return { x, y };
    }
    
    let constrainedX = Math.max(0, Math.min(x, containerWidth - currentWidth));
    let constrainedY = Math.max(0, Math.min(y, containerHeight - currentHeight));
    
    return { x: constrainedX, y: constrainedY };
  }, [dimensions.width, dimensions.height, panelSize.width, panelSize.height, isControlsMinimized]);
  
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
        const currentWidth = panelSize.width;
        const currentHeight = isControlsMinimized ? 60 : panelSize.height;
        const constrainedX = Math.max(0, Math.min(newX, containerWidth - currentWidth));
        const constrainedY = Math.max(0, Math.min(newY, containerHeight - currentHeight));
        
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
  }, [isDragging, dragOffset, dimensions.width, dimensions.height, panelSize.width, panelSize.height, isControlsMinimized]);
  
  // Effet pour synchroniser la position DOM initiale avec React state
  useEffect(() => {
    if (controlsPanelRef.current && !isDragging) {
      controlsPanelRef.current.style.transform = `translate(${controlsPosition.x}px, ${controlsPosition.y}px)`;
      positionRef.current = controlsPosition;
    }
  }, [controlsPosition, isDragging]);
  
  // Gestion du redimensionnement
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = graphRef.current?.getBoundingClientRect();
      if (!rect) return;

      const newWidth = Math.max(280, Math.min(600, e.clientX - controlsPosition.x - rect.left));
      const newHeight = Math.max(300, Math.min(800, e.clientY - controlsPosition.y - rect.top));
      
      setPanelSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, controlsPosition]);
  
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

  // Callback pour linkThreeObject qui réagit aux changements de showLinkText
  const linkLabelCallback = useCallback((link: any) => {
    console.log('linkLabelCallback called with:', link, 'showLinkText:', showLinkText); // Debug callback call
    if (!showLinkText) return ''; // Pas de texte si désactivé
    // Vérifier plusieurs sources possibles pour le nom du lien
    const linkText = link.label || link.name || link.id || '';
    console.log('Link label result:', linkText); // Debug result
    return linkText;
  }, [showLinkText]);

  // Callback pour nodeThreeObject qui réagit aux changements de showNodeText
  const nodeThreeObjectCallback = useCallback((node: any) => {
    if (!node.geometry) {
      // Pour les nœuds sans géométrie, créer juste un SpriteText si showNodeText est activé
      if (!showNodeText || !node.name) return undefined; // Pas de texte si désactivé
      const spriteText = new SpriteText(node.name);
      spriteText.textHeight = 2;
      spriteText.color = node.color || '#4fc3f7'; // Couleur du nœud
      // Pas de backgroundColor pour éviter le cadre noir
      
      // depthTest:false + high renderOrder keeps node text always on top of
      // particles and other meshes (otherwise particles passing in front
      // would visually cut the label).
      if (spriteText.material) {
        spriteText.material.depthTest = false;
        spriteText.material.depthWrite = false;
        spriteText.material.transparent = true;
        spriteText.material.alphaTest = 0.1;
      }
      spriteText.renderOrder = 10;

      return spriteText;
    }
    
    // THREE est maintenant importé directement
    if (!THREE) {
      console.warn('THREE.js n\'est pas disponible pour les géométries personnalisées');
      return undefined;
    }
    
    let geometry, material;
    const dimensions = node.dimensions || {};
    
    try {
      // Créer la géométrie selon le type DOT
      switch (node.geometry) {
        case '3d-box':
          geometry = new THREE.BoxGeometry(
            dimensions.width || 8,
            dimensions.height || 8,
            dimensions.depth || 8
          );
          break;
        case '3d-sphere':
          geometry = new THREE.SphereGeometry(
            dimensions.radius || 4,
            16, 16
          );
          break;
        case '3d-cylinder':
          geometry = new THREE.CylinderGeometry(
            dimensions.radius || 4,
            dimensions.radius || 4,
            dimensions.height || 8,
            16
          );
          break;
        case '3d-cone':
          geometry = new THREE.ConeGeometry(
            dimensions.radius || 4,
            dimensions.height || 8,
            16
          );
          break;
        case '3d-torus':
          geometry = new THREE.TorusGeometry(
            dimensions.radius || 4,
            dimensions.tube || 2,
            dimensions.radialSegments || 8,
            dimensions.tubularSegments || 16
          );
          break;
        default:
          console.warn(`Géométrie non supportée: ${node.geometry}`);
          return undefined;
      }
      
      // Opaque material — transparent meshes don't write to the depth buffer,
      // which made faces flicker / vanish when rotating. DoubleSide also avoids
      // backface culling artifacts on torus / cone interiors.
      material = new THREE.MeshLambertMaterial({
        color: node.color || '#4fc3f7',
        side: THREE.DoubleSide,
        emissive: node.bloomEffect ? new THREE.Color(node.color || '#4fc3f7').multiplyScalar(0.1) : 0x000000
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // Ajouter une légère rotation pour plus de dynamisme
      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.y = Math.random() * Math.PI;
      
      // Créer un groupe pour contenir la géométrie et le texte
      const group = new THREE.Group();
      group.add(mesh);
      
      // Ajouter le texte avec SpriteText seulement si showNodeText est activé
      if (showNodeText && node.name) {
        const spriteText = new SpriteText(node.name);
        spriteText.textHeight = 2;
        spriteText.color = node.color || '#4fc3f7'; // Couleur du nœud
        // Pas de backgroundColor pour éviter le cadre noir
        
        // depthTest:false + high renderOrder keeps node text always on top of
        // particles and other meshes (otherwise particles passing in front
        // would visually cut the label).
        if (spriteText.material) {
          spriteText.material.depthTest = false;
          spriteText.material.depthWrite = false;
          spriteText.material.transparent = true;
          spriteText.material.alphaTest = 0.1;
        }
        spriteText.renderOrder = 10;

        // Positionner le texte au-dessus de la géométrie selon le type
        let textYOffset = 6; // Valeur par défaut augmentée pour plus d'espace
        switch (node.geometry) {
          case '3d-box':
            textYOffset = (dimensions.height || 8) / 2 + 5; // +5 pour plus d'espace
            break;
          case '3d-sphere':
            textYOffset = (dimensions.radius || 4) + 5; // +5 pour plus d'espace
            break;
          case '3d-cylinder':
            textYOffset = (dimensions.height || 8) / 2 + 5; // +5 pour plus d'espace
            break;
          case '3d-cone':
            textYOffset = (dimensions.height || 8) / 2 + 5; // +5 pour plus d'espace
            break;
          case '3d-torus':
            textYOffset = (dimensions.radius || 4) + 5; // +5 pour plus d'espace
            break;
        }
        spriteText.position.set(0, textYOffset, 0);
        group.add(spriteText);
      }
      
      return group;
      
    } catch (error) {
      console.error('Erreur lors de la création de la géométrie 3D:', error);
      return undefined;
    }
  }, [showNodeText]);

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
      .linkDirectionalArrowLength(showArrows ? Math.max(20, linkWidth * 8) : 0)
      .linkDirectionalArrowRelPos(0.95)
      .linkDirectionalArrowColor(() => '#FF0000') // Rouge vif pour debug
      .linkDirectionalArrowResolution(12);
  }, [linkWidth, linkCurvature, showArrows]);

  const updateParticleProperties = useCallback(() => {
    if (!forceGraphRef.current) return;
    
    forceGraphRef.current
      // Particles only emit while a simulation is running. Outside of that,
      // every link reports 0 so nothing flows on idle graphs.
      .linkDirectionalParticles((link: any) => {
        if (!showParticles || !simulationRunning) return 0;
        if (link.maxParticleFlow && link.maxParticleFlow > 0) {
          return Math.max(1, Math.min(10, Math.floor(link.maxParticleFlow / 20)));
        }
        return 4;
      })
      // Vitesse basée sur particleSpeed ou contrôle UI
      .linkDirectionalParticleSpeed((link: any) => {
        // Utiliser particleSpeed du DOT si disponible
        if (link.particleSpeed && link.particleSpeed > 0) {
          // Normaliser particleSpeed (0.5-6.0) vers vitesse graphique (0.001-0.02)
          return Math.max(0.001, Math.min(0.02, link.particleSpeed * 0.003));
        }
        
        // Vitesse par défaut
        return 0.008;
      })
      // Largeur des particules proportionnelle au débit
      .linkDirectionalParticleWidth((link: any) => {
        if (link.maxParticleFlow && link.maxParticleFlow > 0) {
          // Particules plus épaisses pour fort débit
          return Math.max(1, Math.min(4, link.maxParticleFlow / 50));
        }
        return 2; // Taille par défaut
      })
      // Force a bright fixed color for particles. We deliberately ignore
      // link.color here: dark link colors (and unlit Lambert fallbacks) made
      // particles render almost black, masking labels behind them.
      .linkDirectionalParticleColor(() => '#ffd54f');
  }, [showParticles, simulationRunning]);

  // Simulation temps réel des accumulations
  useEffect(() => {
    if (!simulationRunning || !currentGraphData?.nodes) return;
    
    // Track in-degree and link traversal time so that even DOT graphs without
    // VortexFlow attributes get meaningful stats once the sim is running.
    const inDegree = new Map<string, number>();
    let traversalTimeSum = 0;
    let traversalTimeCount = 0;
    currentGraphData.links?.forEach((link: any) => {
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
      const speed = link.particleSpeed && link.particleSpeed > 0 ? link.particleSpeed * 0.003 : 0.008;
      traversalTimeSum += 1 / speed;
      traversalTimeCount += 1;
    });
    const avgTraversalMs = traversalTimeCount > 0
      ? Math.round((traversalTimeSum / traversalTimeCount) * 16.67)
      : 0;
    const bottleneckFromTopology = Array.from(inDegree.values()).filter((d) => d > 1).length;

    const interval = setInterval(() => {
      const newAccumulation = new Map<string, number>();
      let vortexParticles = 0;
      let bottleneckCount = 0;

      currentGraphData.nodes.forEach((node: any) => {
        if (node.particleGeneration && node.maxParticleProcessing) {
          const currentAccumulation = nodeAccumulation.get(node.id) || 0;
          const generation = node.particleGeneration;
          const processing = node.maxParticleProcessing;
          const deltaTime = 0.1;
          const newValue = Math.max(0, currentAccumulation + (generation - processing) * deltaTime);
          newAccumulation.set(node.id, newValue);
          vortexParticles += newValue;
          if (generation > processing) bottleneckCount++;
        }
      });

      // Count actual flowing particles in the Three.js scene as a fallback
      // when nodes don't define particleGeneration / maxParticleProcessing.
      let sceneParticles = 0;
      const fg = forceGraphRef.current;
      if (fg && typeof fg.scene === 'function') {
        fg.scene().traverse((obj: any) => {
          if (
            obj.visible
            && obj.geometry
            && obj.geometry.type === 'SphereGeometry'
            && obj.geometry.parameters.radius < 100
          ) {
            sceneParticles++;
          }
        });
      }

      const usingVortex = vortexParticles > 0;
      const totalParticles = usingVortex ? Math.round(vortexParticles) : sceneParticles;
      const averageLatency = usingVortex
        ? Math.round((vortexParticles / currentGraphData.nodes.length) * 10) / 10
        : avgTraversalMs;

      setNodeAccumulation(newAccumulation);
      setSimulationStats({
        totalParticles,
        averageLatency,
        bottleneckNodes: usingVortex ? bottleneckCount : bottleneckFromTopology,
      });

      if (forceGraphRef.current) {
        forceGraphRef.current.nodeVal(undefined);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [simulationRunning, currentGraphData, nodeAccumulation]);

  // One-shot trace: send a single particle from every emitter node and let it
  // cascade through outgoing links so the user can follow the path without
  // particles accumulating. Cycles are short-circuited by a visited set.
  const handleEmitTrace = useCallback(() => {
    const fg = forceGraphRef.current;
    if (!fg || typeof fg.emitParticle !== 'function') return;
    const data = fg.graphData();
    if (!data?.nodes?.length) return;

    const hasVortexEmitters = data.nodes.some((n: any) => n.particleGeneration > 0);
    const isEmitter = (node: any) => (
      hasVortexEmitters ? (node.particleGeneration || 0) > 0 : true
    );

    const visited = new Set<string>();
    const fireFrom = (nodeId: string, depth: number) => {
      if (depth > 15 || visited.has(nodeId)) return;
      visited.add(nodeId);

      data.links.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        if (sourceId !== nodeId) return;
        fg.emitParticle(link);
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        const speed = link.particleSpeed && link.particleSpeed > 0
          ? Math.max(0.001, Math.min(0.02, link.particleSpeed * 0.003))
          : 0.008;
        // 1/speed = ticks until arrival (the engine moves the particle by `speed`
        // of the link's length per tick); ~16.67ms per tick at 60fps.
        const arrivalMs = (1 / speed) * 16.67;
        setTimeout(() => fireFrom(targetId, depth + 1), arrivalMs);
      });
    };

    data.nodes.forEach((node: any) => {
      if (isEmitter(node)) fireFrom(node.id, 0);
    });
  }, []);

  // Fonction pour mettre à jour l'espacement des nœuds
  const updateNodeSpacing = useCallback(() => {
    if (!forceGraphRef.current) return;
    
    // Configuration des forces pour l'espacement
    const graph = forceGraphRef.current;
    if (graph.d3Force) {
      // Force de liaison (distance entre nœuds connectés)
      const linkForce = graph.d3Force('link');
      if (linkForce) {
        linkForce.distance(nodeSpacing * 2); // Doubler l'effet pour plus de visibilité
      }
      
      // Force de charge (répulsion entre tous les nœuds)
      const chargeForce = graph.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(-nodeSpacing * 8); // Augmenter l'effet de répulsion
      }
      
      // Force de centrage pour éviter la dispersion
      const centerForce = graph.d3Force('center');
      if (centerForce) {
        centerForce.strength(0.1); // Force de centrage légère
      }
      
      // Redémarrer la simulation avec plus d'intensité
      graph.d3ReheatSimulation();
      
      // Relancer la simulation avec plus d'itérations pour un effet plus rapide
      setTimeout(() => {
        if (graph.d3Force) {
          graph.d3ReheatSimulation();
        }
      }, 100);
    }
  }, [nodeSpacing]);

  // Fonction pour mettre à jour la taille des nœuds
  const updateNodeSize = useCallback(() => {
    if (!forceGraphRef.current) return;
    
    forceGraphRef.current.nodeVal(nodeSize);
  }, [nodeSize]);

  // Effets pour mettre à jour les propriétés sans redessin
  useEffect(() => {
    updateLinkProperties();
  }, [updateLinkProperties]);

  useEffect(() => {
    updateParticleProperties();
  }, [updateParticleProperties]);

  useEffect(() => {
    updateNodeSpacing();
  }, [updateNodeSpacing]);

  useEffect(() => {
    updateNodeSize();
  }, [updateNodeSize]);

  // Effet pour recréer le graphique quand showNodeText change
  useEffect(() => {
    if (forceGraphRef.current && !isInitialLoad) {
      // Sauvegarder les données actuelles
      const currentData = forceGraphRef.current.graphData();
      
      // Reconfigurer nodeThreeObject avec la nouvelle valeur de showNodeText
      forceGraphRef.current
        .nodeThreeObject(nodeThreeObjectCallback)
        .graphData(currentData); // Re-appliquer les données pour forcer le rendu
    }
  }, [showNodeText, nodeThreeObjectCallback, isInitialLoad]);

  // État pour les overlays de texte
  const [textOverlays, setTextOverlays] = useState<Array<{id: string, x: number, y: number, text: string, type: 'node' | 'link'}>>([]);
  
  // Fonction pour mettre à jour les positions des overlays
  const updateTextOverlays = useCallback(() => {
    if (!forceGraphRef.current || !currentGraphData.nodes.length) return;
    
    const overlays: Array<{id: string, x: number, y: number, text: string, type: 'node' | 'link'}> = [];
    
    // Les overlays de nœuds sont supprimés car nous utilisons SpriteText pour les noms des nœuds
    
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
  
  // Effet pour reconfigurer les labels de liens quand showLinkText change
  useEffect(() => {
    if (forceGraphRef.current && !isInitialLoad) {
      console.log('Reconfiguring link labels due to showLinkText change:', showLinkText);
      
      const currentData = forceGraphRef.current.graphData();
      
      // Reconfigurer linkThreeObject
      forceGraphRef.current
        .linkThreeObject((link: any) => {
          console.log('useEffect linkThreeObject called with:', link, 'showLinkText:', showLinkText);
          if (!showLinkText) return null;
          
          const linkText = link.name || link.label || '';
          if (!linkText) return null;
          
          const sprite = new SpriteText(linkText);
          sprite.color = link.color || '#999999';
          sprite.textHeight = 1.5;
          // Pas de backgroundColor pour éviter le cadre noir
          
          console.log('useEffect created link sprite for:', linkText);
          return sprite;
        })
        .graphData(currentData); // Re-appliquer les données
    }
  }, [showLinkText, isInitialLoad]);
  
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
    let particlePatchInterval: ReturnType<typeof setInterval> | null = null;
    // Fonction d'initialisation du graphique 3D
    const initializeGraph = async () => {
      if (!graphRef.current || !isValid) return;

      try {
        setLoading(true);
        setError(null);

        // Nettoyage de l'instance précédente
        if (forceGraphRef.current) {
          forceGraphRef.current._destructor();
          forceGraphRef.current = null;
        }

        // Parsage du contenu DOT avec le backend
        const graphData = await DotTo3DConverter.parseDotToGraphData(dotContent);

        if (!graphData.nodes.length) {
          setError('Aucun nœud trouvé dans le graphique');
          return;
        }

        setCurrentGraphData({ nodes: graphData.nodes, links: graphData.links });

        // Création de l'instance 3D
        const graph = ForceGraph3D()(graphRef.current!)
          .graphData(graphData)
          .width(dimensions.width)
          .height(dimensions.height)
          .backgroundColor('#1a1a1a')
          .showNavInfo(false)
          .enableNodeDrag(true)
          .enableNavigationControls(true)
          .cooldownTicks(0)
          .onEngineStop(() => {
            console.log('Moteur physique arrêté');
          });

        // Sauvegarder la référence pour le nettoyage
        forceGraphRef.current = graph;

        // Configuration avancée des nœuds avec support des géométries 3D
        graph
          .nodeLabel(() => '') 
          .nodeVal((node: any) => {
            if (node.geometry) {
              return 0; 
            }
            
            let baseSize = nodeSize;
            if (node.particleGeneration) {
              baseSize = Math.max(4, Math.min(12, 4 + node.particleGeneration / 50));
            }
            
            return baseSize;
          })
          .nodeColor((node: any) => node.color || '#4fc3f7')
          .nodeThreeObject(nodeThreeObjectCallback)
          .linkLabel((link: any) => showLinkText && link.name ? link.name : '')
          .linkThreeObjectExtend(true)
          .linkThreeObject((link: any) => {
            if (!showLinkText || !link.name) return;
            
            const sprite = new SpriteText(link.name);
            sprite.color = link.color || '#ffffff';
            sprite.textHeight = 1.5;
            // Pas de backgroundColor pour éviter le cadre noir
            sprite.padding = 1;
            sprite.borderRadius = 1;
            
            // Always render link labels on top of particles / meshes.
            if (sprite.material) {
              sprite.material.depthTest = false;
              sprite.material.depthWrite = false;
              sprite.material.transparent = true;
              sprite.material.alphaTest = 0.1;
              sprite.renderOrder = 10;
            }
            
            return sprite;
          })
          .linkPositionUpdate((sprite: any, { start, end }: any) => {
            if (!sprite || !showLinkText) return;
            
            const middlePos = {
              x: start.x + (end.x - start.x) / 2,
              y: start.y + (end.y - start.y) / 2,
              z: start.z + (end.z - start.z) / 2
            };
            
            Object.assign(sprite.position, middlePos);
          })
          .linkColor((link: any) => link.color || '#999999')
          .linkWidth(linkWidth)
          .linkCurvature(linkCurvature)
          .linkCurveRotation(Math.PI / 4)
          .linkDirectionalArrowLength(showArrows ? Math.max(20, linkWidth * 8) : 0)
          .linkDirectionalArrowRelPos(0.95)
          .linkDirectionalArrowColor(() => '#FF0000') // Rouge vif pour debug
          .linkDirectionalArrowResolution(12)
          .linkOpacity((link: any) => {
            if (link.style === 'dashed') return 0.6;
            if (link.style === 'dotted') return 0.4;
            return 0.8;
          })
          .linkDirectionalParticles((link: any) => {
            if (!showParticles || !simulationRunning) return 0;
            if (link.maxParticleFlow) {
              return Math.min(8, Math.max(1, Math.floor(link.maxParticleFlow / 10)));
            }
            return 4;
          })
          .linkDirectionalParticleSpeed(0.01)
          .linkDirectionalParticleColor(() => '#ffd54f');

        // Stats de rendu
        const updateStats = () => {
          setRenderStats({
            nodes: graphData.nodes.length,
            links: graphData.links.length,
            fps: 60
          });
        };
        
        graph.onEngineStop(updateStats);
        updateStats();

        // 3d-force-graph creates link directional particles with a
        // MeshLambertMaterial that has transparent=true and opacity=undefined,
        // which renders as fully transparent. Walk the scene every 200ms and
        // force them opaque so the particles are visible.
        const sceneRoot = graph.scene();
        particlePatchInterval = setInterval(() => {
          sceneRoot.traverse((obj: any) => {
            if (
              obj.geometry
              && obj.geometry.type === 'SphereGeometry'
              && obj.geometry.parameters.radius < 100
              && obj.material
              && (obj.material.transparent || obj.material.opacity === undefined)
            ) {
              obj.material.transparent = false;
              obj.material.opacity = 1;
              obj.material.needsUpdate = true;
            }
          });
        }, 200);

        // Appliquer les paramètres initiaux
        setTimeout(() => {
          updateNodeSpacing();
          updateLinkProperties();
          updateParticleProperties();
          // Auto-zoom on open. We want a single smooth animation that ends
          // ~2x closer than a default zoomToFit. Trick: snap-fit instantly to
          // read the "fitted" camera distance, snap back, then animate from
          // the original position to half-distance over ~1s. Negative padding
          // is silently dropped by 3d-force-graph, so we compute the target
          // ourselves.
          if (forceGraphRef.current) {
            const padding = Math.max(40, Math.min(dimensions.width, dimensions.height) * 0.12);
            const startCam = forceGraphRef.current.cameraPosition();
            forceGraphRef.current.zoomToFit(0, padding);
            const fitted = forceGraphRef.current.cameraPosition();
            const target = { x: fitted.x * 0.5, y: fitted.y * 0.5, z: fitted.z * 0.5 };
            forceGraphRef.current.cameraPosition(startCam, undefined, 0);
            forceGraphRef.current.cameraPosition(target, undefined, 1000);
          }
        }, 300);

      } catch (err) {
        console.error('Erreur lors de l\'initialisation du graphique 3D:', err);
        setError('Erreur lors du rendu 3D: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (isValid && dotContent) {
      initializeGraph();
    }

    return () => {
      if (particlePatchInterval) clearInterval(particlePatchInterval);
      if (forceGraphRef.current) {
        forceGraphRef.current._destructor();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, dotContent, dimensions.width, dimensions.height]);

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
          width: `${panelSize.width}px`,
          height: `${panelSize.height}px`,
          minWidth: '280px',
          minHeight: '300px',
          maxWidth: '600px',
          maxHeight: '800px',
          zIndex: 10, 
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          cursor: isDragging ? 'grabbing' : (isResizing ? 'nw-resize' : 'grab'),
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          // Pas de transition pendant le drag pour performance maximale
          transition: isDragging ? 'none' : 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }
        }}
      >
        {/* En-tête du panneau - fixe */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 2,
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px 8px 0 0',
          minHeight: '60px'
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
        
        {/* Zone de contenu avec scroll */}
        {!isControlsMinimized && (
          <Box sx={{ 
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 2,
            '&::-webkit-scrollbar': {
              width: '6px'
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              borderRadius: '3px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '3px',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }}>
            {/* Accordéon Contrôles Visuels */}
            <Accordion 
              expanded={controlsExpanded}
              onChange={(_, isExpanded) => setControlsExpanded(isExpanded)}
              sx={{ mb: 1, backgroundColor: 'rgba(240, 240, 240, 0.3)' }}
            >
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                sx={{
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: 'text.secondary'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                    Contrôles Visuels
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant={showArrows ? "contained" : "outlined"}
                    onClick={() => setShowArrows(!showArrows)}
                    startIcon={<ArrowForwardIcon />}
                    size="small"
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Flèches directionnelles
                  </Button>
                  <Button
                    variant={showParticles ? "contained" : "outlined"}
                    onClick={() => setShowParticles(!showParticles)}
                    startIcon={<BlurOnIcon />}
                    size="small"
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Particules sur liens
                  </Button>
                  <Button
                    variant={showNodeText ? "contained" : "outlined"}
                    onClick={() => setShowNodeText(!showNodeText)}
                    startIcon={<TextFieldsIcon />}
                    size="small"
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Texte permanent nœuds
                  </Button>
                  <Button
                    variant={showLinkText ? "contained" : "outlined"}
                    onClick={() => setShowLinkText(!showLinkText)}
                    startIcon={<LinkIcon />}
                    size="small"
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Texte permanent liens
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleEmitTrace}
                    startIcon={<FlashOnIcon />}
                    size="small"
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Émission particules
                  </Button>
                  <Button
                    variant={simulationRunning ? "contained" : "outlined"}
                    onClick={() => {
                      if (onToggleSimulation) onToggleSimulation();
                      else setSimulationRunning(!simulationRunning);
                    }}
                    startIcon={simulationRunning ? <PauseIcon /> : <PlayArrowIcon />}
                    size="small"
                    sx={{
                      justifyContent: 'flex-start',
                      color: simulationRunning ? 'success.main' : 'primary.main'
                    }}
                  >
                    {simulationRunning ? 'Pause' : 'Start'} Simulation
                  </Button>
                  
                  {/* Statistiques temps réel */}
                  {simulationRunning && (
                    <Box sx={{ 
                      mt: 1, 
                      p: 1, 
                      bgcolor: 'background.paper', 
                      borderRadius: 1, 
                      border: '1px solid',
                      borderColor: 'divider'
                    }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Statistiques Temps Réel
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" color="success.main">
                          Particules totales: {simulationStats.totalParticles}
                        </Typography>
                        <Typography variant="caption" color="warning.main">
                          Latence moyenne: {simulationStats.averageLatency}ms
                        </Typography>
                        <Typography variant="caption" color="error.main">
                          Goulots d'étranglement: {simulationStats.bottleneckNodes}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
            
            {/* Accordéon Paramètres Ajustables */}
            <Accordion 
              expanded={parametersExpanded}
              onChange={(_, isExpanded) => setParametersExpanded(isExpanded)}
              sx={{ backgroundColor: 'rgba(240, 240, 240, 0.3)' }}
            >
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                sx={{
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: 'text.secondary'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TuneIcon sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                    Paramètres Ajustables
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Slider intensité courbes */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
                      <LinkIcon sx={{ fontSize: '1rem', color: 'info.main' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary' }}>
                        Courbe des liens: {Math.round(linkCurvature * 100)}%
                      </Typography>
                    </Box>
                    <Slider
                      value={linkCurvature}
                      onChange={(_, value) => setLinkCurvature(value as number)}
                      min={0}
                      max={1}
                      step={0.1}
                      size="small"
                      sx={{
                        color: 'info.main',
                        '& .MuiSlider-thumb': {
                          width: 18,
                          height: 18
                        },
                        '& .MuiSlider-track': {
                          height: 4
                        }
                      }}
                      onMouseDown={(e) => {
                        if (e.target instanceof Element && 
                            (e.target.closest('.MuiSlider-root') || e.target.classList.contains('MuiSlider-thumb'))) {
                          e.stopPropagation();
                        }
                      }}
                    />
                  </Box>
                  
                  {/* Slider épaisseur liens */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
                      <LinkIcon sx={{ fontSize: '1rem', color: 'success.main' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary' }}>
                        Épaisseur: {linkWidth === 0 ? 'filet' : `${linkWidth}px`}
                      </Typography>
                    </Box>
                    <Slider
                      value={linkWidth}
                      onChange={(_, value) => setLinkWidth(value as number)}
                      min={0}
                      max={8}
                      step={0.5}
                      size="small"
                      sx={{
                        color: 'success.main',
                        '& .MuiSlider-thumb': {
                          width: 18,
                          height: 18
                        },
                        '& .MuiSlider-track': {
                          height: 4
                        }
                      }}
                      onMouseDown={(e) => {
                        if (e.target instanceof Element && 
                            (e.target.closest('.MuiSlider-root') || e.target.classList.contains('MuiSlider-thumb'))) {
                          e.stopPropagation();
                        }
                      }}
                    />
                  </Box>
                  
                  {/* Slider espacement nœuds */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
                      <NodesIcon sx={{ fontSize: '1rem', color: 'warning.main' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary' }}>
                        Espacement: {nodeSpacing}px
                      </Typography>
                    </Box>
                    <Slider
                      value={nodeSpacing}
                      onChange={(_, value) => setNodeSpacing(value as number)}
                      min={10}
                      max={100}
                      step={5}
                      size="small"
                      sx={{
                        color: 'warning.main',
                        '& .MuiSlider-thumb': {
                          width: 18,
                          height: 18
                        },
                        '& .MuiSlider-track': {
                          height: 4
                        }
                      }}
                      onMouseDown={(e) => {
                        if (e.target instanceof Element && 
                            (e.target.closest('.MuiSlider-root') || e.target.classList.contains('MuiSlider-thumb'))) {
                          e.stopPropagation();
                        }
                      }}
                    />
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
            
            {/* Statistiques */}
            {renderStats.nodes > 0 && (
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
          </Box>
        )}
        
        {/* Poignée de redimensionnement */}
        <Box
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsResizing(true);
          }}
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '20px',
            height: '20px',
            cursor: 'nw-resize',
            '&::after': {
              content: '""',
              position: 'absolute',
              right: '3px',
              bottom: '3px',
              width: '5px',
              height: '5px',
              borderRight: '2px solid rgba(0, 0, 0, 0.3)',
              borderBottom: '2px solid rgba(0, 0, 0, 0.3)'
            }
          }}
        />
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
      
      {/* Les labels de liens sont maintenant gérés par SpriteText avec linkThreeObjectExtend */}

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
