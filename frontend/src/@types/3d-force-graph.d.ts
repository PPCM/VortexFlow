declare module '3d-force-graph' {
  export interface ForceGraphNodeObject {
    id?: string | number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
    fz?: number;
    [key: string]: any;
  }

  export interface ForceGraphLinkObject {
    source?: string | number | ForceGraphNodeObject;
    target?: string | number | ForceGraphNodeObject;
    [key: string]: any;
  }

  export interface ForceGraphData {
    nodes: ForceGraphNodeObject[];
    links: ForceGraphLinkObject[];
  }

  export interface ForceGraph3DInstance {
    (element: HTMLElement): ForceGraph3DInstance;
    width(width?: number): ForceGraph3DInstance;
    height(height?: number): ForceGraph3DInstance;
    backgroundColor(color?: string): ForceGraph3DInstance;
    graphData(data?: ForceGraphData): ForceGraph3DInstance;
    nodeLabel(accessor?: string | ((node: ForceGraphNodeObject) => string)): ForceGraph3DInstance;
    nodeVal(accessor?: string | number | ((node: ForceGraphNodeObject) => number)): ForceGraph3DInstance;
    nodeColor(accessor?: string | ((node: ForceGraphNodeObject) => string)): ForceGraph3DInstance;
    linkDirectionalArrowLength(length?: number | ((link: ForceGraphLinkObject) => number)): ForceGraph3DInstance;
    linkDirectionalArrowColor(color?: string | ((link: ForceGraphLinkObject) => string)): ForceGraph3DInstance;
    linkDirectionalParticles(particles?: number | ((link: ForceGraphLinkObject) => number)): ForceGraph3DInstance;
    linkDirectionalParticleSpeed(speed?: number | ((link: ForceGraphLinkObject) => number)): ForceGraph3DInstance;
    linkDirectionalParticleColor(color?: string | ((link: ForceGraphLinkObject) => string)): ForceGraph3DInstance;
    linkColor(color?: string | ((link: ForceGraphLinkObject) => string)): ForceGraph3DInstance;
    onEngineStop(callback?: () => void): ForceGraph3DInstance;
    renderer(): any;
    _destructor(): void;
    [key: string]: any;
  }

  const ForceGraph3D: () => ForceGraph3DInstance;
  export default ForceGraph3D;
}
