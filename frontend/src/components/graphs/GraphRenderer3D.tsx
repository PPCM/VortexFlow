// VortexFlow Frontend - Rendu 3D des Graphiques DOT avec 3d-force-graph
// Composant de visualisation 3D avancé avec flèches, particules et texte

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  CircularProgress,
  Alert,
  Slider,
  IconButton,
  Drawer,
  Divider,
} from '@mui/material';
import {
  ArrowRightAlt as ArrowIcon,
  ScatterPlot as ParticlesIcon,
  Label as LabelIcon,
  TextFields as TextFieldsIcon,
  FlashOn as FlashOnIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { GraphData } from '../../types';
import { useParticleSimulator } from '../../hooks/useParticleSimulator';

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
  // DES attributes (ADR-006) — consumed by ParticleSimulator
  nodeRole?: 'generator' | 'relay' | 'sink';
  dropPolicy?: 'tail' | 'head' | 'reject';
  queue_size?: number;
  processing_time?: number;
  failure_rate?: number;
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
      // Same env contract as services/api.ts so dev / prod / LAN deployments
      // resolve the same backend without hardcoding any host here.
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const apiUrl = `${apiBase}/public/parse-dot`;
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
      
      const validRoles: Array<NonNullable<ForceGraphNode['nodeRole']>> = [
        'generator',
        'relay',
        'sink',
      ];
      const validDropPolicies: Array<NonNullable<ForceGraphNode['dropPolicy']>> = [
        'tail',
        'head',
        'reject',
      ];
      const node: ForceGraphNode = {
        id: nodeId,
        name: attrs.name || attrs.label || nodeId,
        group: existingNode?.group || (nodeMap.size % 5 + 1),
        val: parseFloat(attrs.size || '8'),
        color: attrs.color || existingNode?.color || `hsl(${(nodeMap.size * 60) % 360}, 70%, 50%)`,
        // Extensions 3D pour les nœuds
        geometry: this.parseGeometry(attrs.geometry),
        dimensions: this.parseDimensions(attrs.dimensions),
        particleGeneration: attrs.particleGeneration ? parseFloat(attrs.particleGeneration) : undefined,
        maxParticleProcessing: attrs.maxParticleProcessing
          ? parseFloat(attrs.maxParticleProcessing)
          : undefined,
        image: attrs.image,
        autoResize: attrs.autoResize ? this.parseBoolean(attrs.autoResize) : undefined,
        bloomEffect: attrs.bloomEffect ? this.parseBoolean(attrs.bloomEffect) : undefined,
        // DES attributes (ADR-006)
        nodeRole: validRoles.includes(attrs.nodeRole as any)
          ? (attrs.nodeRole as ForceGraphNode['nodeRole'])
          : undefined,
        dropPolicy: validDropPolicies.includes(attrs.dropPolicy as any)
          ? (attrs.dropPolicy as ForceGraphNode['dropPolicy'])
          : undefined,
        queue_size: attrs.queue_size ? parseInt(attrs.queue_size, 10) : undefined,
        processing_time: attrs.processing_time ? parseFloat(attrs.processing_time) : undefined,
        failure_rate: attrs.failure_rate ? parseFloat(attrs.failure_rate) : undefined,
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
        // DES attributes pass through as numbers/strings — the simulator
        // applies its own defaults if undefined.
        const validRoles: Array<NonNullable<ForceGraphNode['nodeRole']>> = [
          'generator',
          'relay',
          'sink',
        ];
        const validDropPolicies: Array<NonNullable<ForceGraphNode['dropPolicy']>> = [
          'tail',
          'head',
          'reject',
        ];
        const nodeRole = validRoles.includes(node.nodeRole) ? node.nodeRole : undefined;
        const dropPolicy = validDropPolicies.includes(node.dropPolicy) ? node.dropPolicy : undefined;
        nodes.push({
          id: node.id,
          name: node.label || node.name || node.id,
          group: 1,
          val: parseFloat(node.size || '8'),
          color: node.color || '#1976D2',
          geometry: this.parseGeometry(node.geometry),
          dimensions: this.parseDimensions(node.dimensions),
          particleGeneration: node.particleGeneration ? parseFloat(node.particleGeneration) : undefined,
          maxParticleProcessing: node.maxParticleProcessing ? parseFloat(node.maxParticleProcessing) : undefined,
          image: node.image,
          autoResize: node.autoResize ? this.parseBoolean(node.autoResize) : undefined,
          bloomEffect: node.bloomEffect ? this.parseBoolean(node.bloomEffect) : undefined,
          // DES attributes (ADR-006)
          nodeRole,
          dropPolicy,
          queue_size: node.queue_size ? parseInt(node.queue_size, 10) : undefined,
          processing_time: node.processing_time ? parseFloat(node.processing_time) : undefined,
          failure_rate: node.failure_rate ? parseFloat(node.failure_rate) : undefined,
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
  parsedData: _parsedData,
  isSimulationRunning,
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
  
  // Drawer des paramètres avancés (sliders) — fermé par défaut.
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  // État pour stocker les données du graphique
  const [currentGraphData, setCurrentGraphData] = useState<{nodes: ForceGraphNode[], links: ForceGraphLink[]}>({nodes: [], links: []});

  // DES particle simulator (ADR-006). The hook owns the simulator instance,
  // drives it via rAF, and surfaces stats via React state. We wire its
  // `onParticleReleased` to `emitParticle` on the 3d-force-graph instance so
  // each logical release produces a visible animation.
  const onSimulatorParticleReleased = useCallback((linkId: string) => {
    const fg = forceGraphRef.current;
    if (!fg || typeof fg.emitParticle !== 'function') return;
    // The simulator generates link ids as "<source>-><target>#<counter>".
    // Resolve back to the link object in the live graph to call emitParticle.
    const data = fg.graphData();
    if (!data?.links?.length) return;
    const match = linkId.match(/^(.+)->(.+?)#\d+$/);
    if (!match) return;
    const [, source, target] = match;
    const link = data.links.find((l: any) => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return sId === source && tId === target;
    });
    if (link) fg.emitParticle(link);
  }, []);

  const { stats: simulatorStats, hasGenerators } = useParticleSimulator({
    graphData: currentGraphData,
    isRunning: simulationRunning,
    onParticleReleased: onSimulatorParticleReleased,
  });

  // Visualisation refs (Phase 5).
  //
  // The nodeVal / nodeColor accessors read these refs at render time. We
  // update them on every simulator tick — without forcing a React rerender
  // of the whole component (which would be wasteful) — and then ping the
  // force graph to re-evaluate its accessors.
  //
  // queueStatsByNode  : current queue size + cumulative drops, keyed by node id
  // dropFlashTime     : timestamp (performance.now ms) of the last detected drop
  //                     for that node. Used to colour the node red for ~200ms
  //                     after each drop event.
  // previousDroppedCount : last-seen droppedCount per node, used to detect
  //                     "a new drop happened" by diffing against the current snapshot.
  const queueStatsByNodeRef = useRef<Map<string, { size: number; droppedCount: number }>>(
    new Map()
  );
  const dropFlashTimeRef = useRef<Map<string, number>>(new Map());
  const previousDroppedCountRef = useRef<Map<string, number>>(new Map());

  // Drop flash duration in ms — kept short so it doesn't visually merge into
  // sustained-saturation states.
  const DROP_FLASH_MS = 200;

  // Sync visualisation refs with the simulator's stats stream and ping the
  // force graph so it picks up the new queue sizes (node growth) and colour
  // overrides (saturation halo, drop flash).
  useEffect(() => {
    if (!simulatorStats) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Detect newly-arrived drops by diffing per-node droppedCount.
    for (const [nodeId, q] of simulatorStats.queues) {
      const prev = previousDroppedCountRef.current.get(nodeId) ?? 0;
      if (q.droppedCount > prev) {
        dropFlashTimeRef.current.set(nodeId, now);
      }
      previousDroppedCountRef.current.set(nodeId, q.droppedCount);
    }

    queueStatsByNodeRef.current = new Map(simulatorStats.queues);

    // Re-evaluate the accessors so the node sizes / colours update on screen.
    // Calling .nodeVal(.nodeVal()) is the documented way to force 3d-force-graph
    // to re-run the accessor on every node — cheap (no layout), safe on large
    // graphs because it does not rebuild the scene.
    const fg = forceGraphRef.current;
    if (fg && typeof fg.nodeVal === 'function') {
      try {
        fg.nodeVal(fg.nodeVal());
        fg.nodeColor(fg.nodeColor());
      } catch {
        /* ref is mid-init or being disposed — ignore */
      }
    }
  }, [simulatorStats]);

  // First-render guard: a few downstream effects (showNodeText / showLinkText
  // reconfigure) run only after init completes. Flip the flag once dimensions
  // are known so they fire correctly.
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    if (isInitialLoad) setIsInitialLoad(false);
  }, [dimensions.width, dimensions.height, isInitialLoad]);

  // Track the renderer container size. The container itself is `width:100% / height:100%`
  // so its clientWidth/Height already reflects the real space the renderer must fill.
  // Reading any parent (tabpanel, flexGrow box, window) and applying hard-coded safety
  // margins led to a race: on first mount, parent layout was sometimes not yet committed,
  // so we'd capture partial dimensions and the canvas would render shrunken until reload.
  useLayoutEffect(() => {
    const container = graphRef.current;
    if (!container) return;

    let retryFrames = 0;
    const MAX_RETRY = 60; // cap at ~1s so we don't loop forever if container stays 0×0

    const updateDimensions = () => {
      if (!graphRef.current) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        retryFrames = 0;
        setDimensions((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height }
        );
      } else if (retryFrames < MAX_RETRY) {
        retryFrames += 1;
        requestAnimationFrame(updateDimensions);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateDimensions);
    });
    resizeObserver.observe(container);
    updateDimensions();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
      //
      // When the DES simulator owns emission (hasGenerators === true), this
      // returns 0 — the simulator's onParticleReleased drives emitParticle()
      // explicitly. We keep the legacy continuous flow only as a fallback
      // for graphs that don't declare nodeRole=generator anywhere.
      .linkDirectionalParticles((link: any) => {
        if (!showParticles || !simulationRunning) return 0;
        if (hasGenerators) return 0;
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
  }, [showParticles, simulationRunning, hasGenerators]);

  // Simulation temps réel des accumulations (fallback heuristique).
  // Désactivé quand le DES simulator est en charge (hasGenerators=true) :
  // dans ce cas, les stats viennent directement de simulatorStats via
  // l'effect ci-dessous.
  useEffect(() => {
    if (!simulationRunning || !currentGraphData?.nodes) return;
    if (hasGenerators) return;
    
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
  }, [simulationRunning, currentGraphData, nodeAccumulation, hasGenerators]);

  // Branch real-time stats from the DES simulator into simulationStats so the
  // existing HUD doesn't need to change shape. Only active when the simulator
  // is in charge (hasGenerators === true); otherwise the heuristic effect
  // above continues to populate simulationStats.
  useEffect(() => {
    if (!hasGenerators || !simulatorStats) return;
    // Count "bottleneck" nodes as those with a non-trivial queue size.
    let bottleneckCount = 0;
    for (const q of simulatorStats.queues.values()) {
      if (q.size > 5) bottleneckCount++;
    }
    setSimulationStats({
      totalParticles: simulatorStats.particlesInFlight,
      averageLatency: Number.isNaN(simulatorStats.averageLatencyMs)
        ? 0
        : Math.round(simulatorStats.averageLatencyMs),
      bottleneckNodes: bottleneckCount,
    });
  }, [hasGenerators, simulatorStats]);

  // One-shot trace: send a single particle from every emitter node and let it
  // cascade through outgoing links so the user can follow the path without
  // particles accumulating. Cycles are short-circuited by a visited set.
  //
  // V1 stricte (ADR-006): seuls les nœuds nodeRole=generator émettent. Plus
  // de fallback "tout émetteur" basé sur particleGeneration > 0 — la règle
  // est désormais purement basée sur le rôle. Si aucun nœud n'est generator,
  // le bouton ne fait rien (le UI le signale via hasGenerators).
  const handleEmitTrace = useCallback(() => {
    const fg = forceGraphRef.current;
    if (!fg || typeof fg.emitParticle !== 'function') return;
    const data = fg.graphData();
    if (!data?.nodes?.length) return;

    const isEmitter = (node: any) => node.nodeRole === 'generator';

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
  const [, setTextOverlays] = useState<Array<{id: string, x: number, y: number, text: string, type: 'node' | 'link'}>>([]);
  
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

            // Phase 5 — queue growth. When the DES simulator is in charge
            // and the node has a defined queue_size, scale up the node
            // proportionally to its fill ratio (1× empty → 2× full).
            const qStat = queueStatsByNodeRef.current.get(node.id);
            if (qStat && node.queue_size && node.queue_size > 0) {
              const ratio = Math.min(1, qStat.size / node.queue_size);
              return baseSize * (1 + ratio);
            }

            return baseSize;
          })
          .nodeColor((node: any) => {
            // Phase 5 — colour overrides, evaluated each frame via refs.
            // Priority: drop flash > saturation halo > role tint > user colour.
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const lastFlash = dropFlashTimeRef.current.get(node.id);
            if (lastFlash !== undefined && now - lastFlash < DROP_FLASH_MS) {
              return '#ff1744'; // drop flash, red vif
            }
            const qStat = queueStatsByNodeRef.current.get(node.id);
            if (qStat && node.queue_size && node.queue_size > 0) {
              const ratio = qStat.size / node.queue_size;
              if (ratio >= 1) return '#d32f2f'; // saturated
              if (ratio > 0.8) return '#ff9800'; // near-saturated
            }
            // Role tint applied only when the user did not specify a colour,
            // so explicit DOT colours are always preserved.
            if (!node.color) {
              if (node.nodeRole === 'generator') return '#80cbc4'; // teal
              if (node.nodeRole === 'sink') return '#9fa8da'; // indigo
            }
            return node.color || '#4fc3f7';
          })
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
            // DES simulator owns emission when at least one generator is
            // declared (ADR-006). Continuous flow is a fallback for
            // un-annotated graphs.
            if (hasGenerators) return 0;
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
        // force them opaque so the particles are visible. The patch must keep
        // running for the lifetime of the renderer because handleEmitTrace can
        // spawn new (still-invisible) particles long after the initial render.
        // Cost is negligible — a single scene traversal every 200ms.
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
      {/* Rail latéral immersif: icônes pour les toggles principaux,
          divider, bouton Start/Pause, divider, accès au drawer paramètres. */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          width: 56,
          background: 'rgba(20, 25, 30, 0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 1.5,
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          zIndex: 10,
        }}
      >
        {[
          { title: 'Flèches directionnelles', icon: <ArrowIcon />, on: showArrows, onClick: () => setShowArrows(!showArrows) },
          { title: 'Particules sur liens', icon: <ParticlesIcon />, on: showParticles, onClick: () => setShowParticles(!showParticles) },
          { title: 'Texte permanent nœuds', icon: <TextFieldsIcon />, on: showNodeText, onClick: () => setShowNodeText(!showNodeText) },
          { title: 'Texte permanent liens', icon: <LabelIcon />, on: showLinkText, onClick: () => setShowLinkText(!showLinkText) },
        ].map((b) => (
          <Tooltip key={b.title} title={b.title} placement="right" arrow>
            <IconButton
              size="small"
              onClick={b.onClick}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                color: b.on ? 'success.main' : 'rgba(255, 255, 255, 0.7)',
                background: b.on ? 'rgba(76, 175, 80, 0.18)' : 'transparent',
                boxShadow: b.on ? 'inset 0 0 0 1px rgba(76, 175, 80, 0.3)' : 'none',
                '&:hover': { background: 'rgba(76, 175, 80, 0.15)', color: 'success.main' },
              }}
            >
              {b.icon}
            </IconButton>
          </Tooltip>
        ))}
        <Tooltip title="Émission particules (one-shot)" placement="right" arrow>
          <IconButton
            size="small"
            aria-label="Émission particules"
            onClick={handleEmitTrace}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': { background: 'rgba(255, 152, 0, 0.18)', color: 'warning.main' },
            }}
          >
            <FlashOnIcon />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: '70%', borderColor: 'rgba(255, 255, 255, 0.08)', my: 0.5 }} />

        <Tooltip title="Paramètres avancés" placement="right" arrow>
          <IconButton
            size="small"
            onClick={() => setSettingsDrawerOpen(true)}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': { background: 'rgba(76, 175, 80, 0.15)', color: 'success.main' },
            }}
          >
            <TuneIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats discrètes en haut-droite — toujours visibles, agrandies pendant
          la simulation pour faire ressortir les chiffres temps réel. */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(15, 20, 25, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 1.25,
          px: 1.5,
          py: 1,
          display: 'flex',
          gap: 2.5,
          zIndex: 10,
        }}
      >
        {[
          { k: 'Nœuds', v: renderStats.nodes, color: 'success.main' },
          { k: 'Liens', v: renderStats.links, color: 'info.main' },
          { k: 'FPS', v: renderStats.fps || '—', color: 'warning.main' },
        ].map((s) => (
          <Box key={s.k} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 38 }}>
            <Typography sx={{ fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
              {s.k}
            </Typography>
            <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, fontSize: 16, color: s.color }}>
              {s.v}
            </Typography>
          </Box>
        ))}
        {simulationRunning && (
          <>
            <Box sx={{ width: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
            {[
              { k: 'Particules', v: simulationStats.totalParticles, color: 'success.main' },
              { k: 'Latence', v: `${simulationStats.averageLatency} ms`, color: 'info.main' },
              { k: 'Goulots', v: simulationStats.bottleneckNodes, color: 'error.main' },
              // Phase 5 — drops surface only when the DES simulator is in
              // charge. Heuristic mode (no generators) has no notion of drop.
              ...(hasGenerators && simulatorStats
                ? [{ k: 'Drops', v: simulatorStats.totalDropped, color: 'error.main' }]
                : []),
            ].map((s) => (
              <Box key={s.k} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 38 }}>
                <Typography sx={{ fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                  {s.k}
                </Typography>
                <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, fontSize: 16, color: s.color }}>
                  {s.v}
                </Typography>
              </Box>
            ))}
          </>
        )}
      </Box>

      {/* Drawer des paramètres avancés — déclenché par l'icône ⚙ du rail. */}
      <Drawer
        anchor="right"
        open={settingsDrawerOpen}
        onClose={() => setSettingsDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 320,
            background: 'rgba(20, 25, 30, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#fff',
            borderLeft: '1px solid rgba(76, 175, 80, 0.18)',
            p: 3,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <TuneIcon sx={{ color: 'success.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Paramètres</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Courbe des liens : {Math.round(linkCurvature * 100)}%
            </Typography>
            <Slider
              value={linkCurvature}
              onChange={(_, value) => setLinkCurvature(value as number)}
              min={0}
              max={1}
              step={0.1}
              size="small"
              sx={{ color: 'info.main' }}
            />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Épaisseur des liens : {linkWidth === 0 ? 'filet' : `${linkWidth}px`}
            </Typography>
            <Slider
              value={linkWidth}
              onChange={(_, value) => setLinkWidth(value as number)}
              min={0}
              max={8}
              step={0.5}
              size="small"
              sx={{ color: 'success.main' }}
            />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Espacement des nœuds : {nodeSpacing}px
            </Typography>
            <Slider
              value={nodeSpacing}
              onChange={(_, value) => setNodeSpacing(value as number)}
              min={10}
              max={100}
              step={5}
              size="small"
              sx={{ color: 'warning.main' }}
            />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Taille des nœuds : {nodeSize}
            </Typography>
            <Slider
              value={nodeSize}
              onChange={(_, value) => setNodeSize(value as number)}
              min={2}
              max={20}
              step={1}
              size="small"
              sx={{ color: 'success.main' }}
            />
          </Box>
        </Box>
      </Drawer>

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

      {/* Aide contextuelle — pastille translucide cohérente avec le rail. */}
      <Tooltip
        title="🖱️ Clic gauche: rotation • Molette: zoom • Clic droit: pan • Clic sur nœud: focus"
        placement="top"
      >
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            px: 1.25,
            py: 0.5,
            background: 'rgba(15, 20, 25, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 1,
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'help',
          }}
        >
          <Typography variant="caption">💡 Aide</Typography>
        </Box>
      </Tooltip>
    </Box>
  );
};

export default GraphRenderer3D;
