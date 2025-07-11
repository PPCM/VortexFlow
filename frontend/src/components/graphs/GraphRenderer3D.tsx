// VortexFlow Frontend - Rendu 3D des Graphiques DOT
// Composant de visualisation 3D utilisant Three.js pour les graphiques DOT

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import { Vector3, Color } from 'three';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { GraphData, GraphNode, GraphEdge } from '../../types';

// =====================================
// Types pour le rendu 3D
// =====================================
interface GraphRenderer3DProps {
  dotContent: string;
  isValid: boolean;
  parsedData?: GraphData;
  width?: number;
  height?: number;
}

interface Node3D {
  id: string;
  position: Vector3;
  label: string;
  color: string;
  size: number;
}

interface Edge3D {
  id: string;
  source: Node3D;
  target: Node3D;
  color: string;
  points: Vector3[];
}

// =====================================
// Utilitaires de parsing DOT vers 3D
// =====================================
class DotTo3DConverter {
  static parseDotToGraphData(dotContent: string): GraphData {
    // Parser simple pour DOT - En production, utiliser une vraie librairie comme viz.js
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Extraire les nœuds (A, B, C etc.)
    const nodeMatches = dotContent.match(/\b[A-Za-z][A-Za-z0-9_]*\b(?=\s*[\[;->])/g);
    const uniqueNodes = Array.from(new Set(nodeMatches || []));
    
    uniqueNodes.forEach((nodeId, index) => {
      // Chercher les attributs du nœud
      const labelMatch = dotContent.match(new RegExp(`${nodeId}\\s*\\[([^\\]]+)\\]`));
      let label = nodeId;
      let color = '#4FC3F7';
      let shape = 'circle';
      
      if (labelMatch) {
        const attributes = labelMatch[1];
        const labelAttr = attributes.match(/label\s*=\s*"([^"]+)"/);
        const colorAttr = attributes.match(/(?:fillcolor|color)\s*=\s*"?([^",\s]+)"?/);
        const shapeAttr = attributes.match(/shape\s*=\s*"?([^",\s]+)"?/);
        
        if (labelAttr) label = labelAttr[1];
        if (colorAttr) color = colorAttr[1];
        if (shapeAttr) shape = shapeAttr[1];
      }
      
      nodes.push({
        id: nodeId,
        label,
        color,
        shape,
        size: 1
      });
    });
    
    // Extraire les arêtes (A -> B, A -- B)
    const edgeMatches = dotContent.match(/\b([A-Za-z][A-Za-z0-9_]*)\s*(?:->|--)\s*([A-Za-z][A-Za-z0-9_]*)/g);
    
    if (edgeMatches) {
      edgeMatches.forEach((edge, index) => {
        const match = edge.match(/\b([A-Za-z][A-Za-z0-9_]*)\s*(?:->|--)\s*([A-Za-z][A-Za-z0-9_]*)/);
        if (match) {
          edges.push({
            id: `edge_${index}`,
            source: match[1],
            target: match[2],
            color: '#90A4AE'
          });
        }
      });
    }
    
    return { nodes, edges };
  }
  
  static convertTo3D(graphData: GraphData): { nodes: Node3D[], edges: Edge3D[] } {
    const nodes3D: Node3D[] = [];
    const edges3D: Edge3D[] = [];
    
    // Disposer les nœuds en cercle ou grille selon le nombre
    const nodeCount = graphData.nodes.length;
    const radius = Math.max(3, nodeCount * 0.5);
    
    graphData.nodes.forEach((node, index) => {
      let position: Vector3;
      
      if (nodeCount <= 8) {
        // Disposition en cercle pour petits graphiques
        const angle = (index / nodeCount) * Math.PI * 2;
        position = new Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0
        );
      } else {
        // Disposition en grille 3D pour graphiques plus larges
        const gridSize = Math.ceil(Math.cbrt(nodeCount));
        const x = (index % gridSize) - gridSize / 2;
        const y = Math.floor(index / gridSize) % gridSize - gridSize / 2;
        const z = Math.floor(index / (gridSize * gridSize)) - gridSize / 2;
        position = new Vector3(x * 2, y * 2, z * 2);
      }
      
      nodes3D.push({
        id: node.id,
        position,
        label: node.label || node.id,
        color: node.color || '#4FC3F7',
        size: node.size || 1
      });
    });
    
    // Créer les arêtes entre les nœuds
    graphData.edges.forEach((edge) => {
      const sourceNode = nodes3D.find(n => n.id === edge.source);
      const targetNode = nodes3D.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        edges3D.push({
          id: edge.id,
          source: sourceNode,
          target: targetNode,
          color: edge.color || '#90A4AE',
          points: [sourceNode.position, targetNode.position]
        });
      }
    });
    
    return { nodes: nodes3D, edges: edges3D };
  }
}

// =====================================
// Componants 3D
// =====================================
const Node3DComponent: React.FC<{ node: Node3D; onClick?: () => void }> = ({ node, onClick }) => {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      const scale = hovered ? 1.2 : 1.0;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });
  
  return (
    <group position={node.position}>
      <Sphere
        ref={meshRef}
        args={[node.size * 0.3]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial color={node.color} />
      </Sphere>
      <Text
        position={[0, node.size * 0.8, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {node.label}
      </Text>
    </group>
  );
};

const Edge3DComponent: React.FC<{ edge: Edge3D }> = ({ edge }) => {
  return (
    <Line
      points={edge.points}
      color={edge.color}
      lineWidth={2}
    />
  );
};

const GraphScene: React.FC<{ nodes: Node3D[], edges: Edge3D[] }> = ({ nodes, edges }) => {
  const { camera } = useThree();
  
  useEffect(() => {
    // Ajuster la caméra selon la taille du graphique
    if (nodes.length > 0) {
      const maxDistance = Math.max(...nodes.map(n => n.position.length()));
      camera.position.set(maxDistance * 1.5, maxDistance * 1.5, maxDistance * 1.5);
    }
  }, [nodes, camera]);
  
  return (
    <>
      {/* Éclairage */}
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      {/* Nœuds */}
      {nodes.map((node) => (
        <Node3DComponent 
          key={node.id} 
          node={node}
          onClick={() => console.log('Node clicked:', node.id)}
        />
      ))}
      
      {/* Arêtes */}
      {edges.map((edge) => (
        <Edge3DComponent key={edge.id} edge={edge} />
      ))}
      
      {/* Contrôles de caméra */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={false}
        maxDistance={50}
        minDistance={2}
      />
    </>
  );
};

// =====================================
// Composant Principal
// =====================================
const GraphRenderer3D: React.FC<GraphRenderer3DProps> = ({
  dotContent,
  isValid,
  parsedData,
  width = 800,
  height = 600
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Convertir le DOT en données 3D
  const { nodes3D, edges3D } = useMemo(() => {
    try {
      setLoading(true);
      setError(null);
      
      // Utiliser les données parsées si disponibles, sinon parser le DOT
      const graphData = parsedData || DotTo3DConverter.parseDotToGraphData(dotContent);
      const result = DotTo3DConverter.convertTo3D(graphData);
      
      setLoading(false);
      return { nodes3D: result.nodes, edges3D: result.edges };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du rendu 3D');
      setLoading(false);
      return { nodes3D: [], edges3D: [] };
    }
  }, [dotContent, parsedData]);
  
  // Rendu conditionnel
  if (!isValid) {
    return (
      <Box sx={{ 
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(45deg, rgba(244,67,54,0.1), rgba(255,87,34,0.1))'
      }}>
        <Alert severity="error">
          <Typography variant="h6">Code DOT invalide</Typography>
          <Typography variant="body2">
            Corrigez les erreurs de syntaxe pour voir l'aperçu 3D
          </Typography>
        </Alert>
      </Box>
    );
  }
  
  if (loading) {
    return (
      <Box sx={{ 
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress />
        <Typography>Génération du rendu 3D...</Typography>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ 
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Alert severity="error">
          <Typography variant="h6">Erreur de rendu</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Box>
    );
  }
  
  if (nodes3D.length === 0) {
    return (
      <Box sx={{ 
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(45deg, rgba(33,150,243,0.1), rgba(156,39,176,0.1))'
      }}>
        <Typography variant="h6" color="text.secondary">
          Aucun nœud détecté dans le code DOT
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ width, height, position: 'relative' }}>
      <Canvas
        camera={{ position: [5, 5, 5], fov: 75 }}
        style={{ 
          background: 'linear-gradient(45deg, rgba(13,25,43,0.9), rgba(27,39,51,0.9))'
        }}
      >
        <GraphScene nodes={nodes3D} edges={edges3D} />
      </Canvas>
      
      {/* Indicateur de nœuds/arêtes */}
      <Box sx={{ 
        position: 'absolute',
        top: 16,
        right: 16,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: 1,
        display: 'flex',
        gap: 2
      }}>
        <Typography variant="caption">
          {nodes3D.length} nœuds
        </Typography>
        <Typography variant="caption">
          {edges3D.length} arêtes
        </Typography>
      </Box>
    </Box>
  );
};

export default GraphRenderer3D;
