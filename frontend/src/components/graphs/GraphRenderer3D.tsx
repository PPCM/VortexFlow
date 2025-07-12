// VortexFlow Frontend - Rendu 3D des Graphiques DOT avec 3d-force-graph
// Composant de visualisation 3D avancé avec flèches, particules et texte

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Box, Typography, Alert, CircularProgress, Button, Paper, Tooltip, Card, CardContent } from '@mui/material';
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
  
  // État pour stocker les données du graphique
  const [currentGraphData, setCurrentGraphData] = useState<{nodes: ForceGraphNode[], links: ForceGraphLink[]}>({nodes: [], links: []});
  
  // Effet pour détecter les dimensions du conteneur
  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (graphRef.current) {
        const rect = graphRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: rect.height || 600
        });
      }
    };
    
    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (graphRef.current) {
      resizeObserver.observe(graphRef.current);
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
        


      // Configuration des liens avec flèches et particules
      graph
        .linkLabel('name')
        .linkColor('color')
        .linkWidth(2)
        .linkDirectionalArrowLength(showArrows ? 4 : 0)
        .linkDirectionalArrowRelPos(1)
        .linkDirectionalArrowColor('#ff6b6b');
        
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

      // Configuration des forces physiques
      const linkForce = graph.d3Force('link');
      if (linkForce) {
        linkForce.distance(30);
      }
      
      const chargeForce = graph.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(-120);
      }
      
      const centerForce = graph.d3Force('center');
      if (centerForce) {
        centerForce.strength(0.1);
      }

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
  }, [dotContent, isValid, dimensions.width, dimensions.height, showArrows, showParticles, emitParticles]);

  // État pour les overlays de texte
  const [textOverlays, setTextOverlays] = useState<Array<{id: string, x: number, y: number, text: string, type: 'node' | 'link'}>>([]);
  
  // Fonction pour mettre à jour les positions des overlays
  const updateTextOverlays = useCallback(() => {
    if (!forceGraphRef.current || !currentGraphData.nodes.length) return;
    
    const overlays: Array<{id: string, x: number, y: number, text: string, type: 'node' | 'link'}> = [];
    
    // Overlays pour les nœuds
    if (showNodeText) {
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
    }
    
    // Overlays pour les liens
    if (showLinkText) {
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
    }
    
    setTextOverlays(overlays);
  }, [currentGraphData, showNodeText, showLinkText, dimensions.width, dimensions.height]);
  
  // Mise à jour des overlays quand le graphique bouge
  useEffect(() => {
    if (!forceGraphRef.current) return;
    
    const graph = forceGraphRef.current;
    let animationFrame: number;
    
    const updateLoop = () => {
      updateTextOverlays();
      animationFrame = requestAnimationFrame(updateLoop);
    };
    
    if (showNodeText || showLinkText) {
      updateLoop();
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [updateTextOverlays, showNodeText, showLinkText]);

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
      {/* Panneau de contrôles */}
      <Paper 
        elevation={3} 
        sx={{ 
          position: 'absolute', 
          top: 10, 
          left: 10, 
          zIndex: 10, 
          p: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.9)'
        }}
      >
        <Typography variant="h6" gutterBottom>Contrôles 3D</Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button 
            variant={showArrows ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowArrows(!showArrows)}
          >
            🏹 Flèches directionnelles
          </Button>
          
          <Button 
            variant={showParticles ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowParticles(!showParticles)}
          >
            ✨ Particules sur liens
          </Button>
          
          <Button 
            variant={showNodeText ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowNodeText(!showNodeText)}
          >
            🏷️ Texte des nœuds
          </Button>
          
          <Button 
            variant={showLinkText ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowLinkText(!showLinkText)}
          >
            📝 Texte des liens
          </Button>
          
          <Button 
            variant={emitParticles ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setEmitParticles(!emitParticles)}
          >
            🎆 Émission particules
          </Button>
        </Box>

        {/* Statistiques */}
        {renderStats.nodes > 0 && (
          <Card sx={{ mt: 2, backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography variant="caption" display="block">
                📊 Nœuds: {renderStats.nodes}
              </Typography>
              <Typography variant="caption" display="block">
                🔗 Liens: {renderStats.links}
              </Typography>
              <Typography variant="caption" display="block">
                ⚡ FPS: {renderStats.fps || 'N/A'}
              </Typography>
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
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' }
        }}
      />
      
      {/* Overlays de texte permanent */}
      {textOverlays.map((overlay) => (
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
