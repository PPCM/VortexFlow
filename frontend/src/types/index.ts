// VortexFlow Frontend - Types TypeScript
// Types pour l'application de visualisation 3D de graphiques DOT

// =====================================
// Types Utilisateur et Authentification
// =====================================
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  is_active?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: 'viewer' | 'editor' | 'admin';
}

// =====================================
// Types Graphiques DOT
// =====================================
export interface GraphNode {
  id: string;
  label: string;
  color?: string;
  shape?: string;
  size?: number;
  position?: { x?: number; y?: number; z?: number };
  data?: any;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  weight?: number;
  style?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: {
    title?: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
  };
}

export interface Graph {
  id: number;
  name: string;
  description?: string;
  dot_content: string;
  data: GraphData;
  user_id: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  view_count?: number;
}

export interface DOTValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  parsedGraph?: GraphData;
}

// =====================================
// Types Simulation et Animation
// =====================================
export interface SimulationParticle {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  color: string;
  size: number;
  lifetime: number;
  path: string[]; // IDs des nœuds du chemin
}

export interface SimulationConfig {
  particleCount: number;
  particleSpeed: number;
  particleSize: number;
  particleColor: string;
  flowRate: number;
  isRunning: boolean;
  isPaused?: boolean;
  showTrails: boolean;
  trailLength: number;
}

export interface SimulationState {
  config: SimulationConfig;
  particles: SimulationParticle[];
  statistics: {
    totalParticles: number;
    activeParticles: number;
    totalFlows: number;
    averageSpeed: number;
  };
}

// =====================================
// Types Interface Utilisateur
// =====================================
export interface ViewportSettings {
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    fov: number;
  };
  controls: {
    enablePan: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
  };
  lighting: {
    ambientLight: { intensity: number; color: string };
    directionalLight: { intensity: number; color: string; position: { x: number; y: number; z: number } };
  };
}

export interface EditorSettings {
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  fontSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  autoComplete: boolean;
  syntaxHighlighting: boolean;
  lineNumbers: boolean;
  minimap: boolean;
}

export interface UIState {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  currentView: 'editor' | 'graph' | '3d' | 'simulation';
  splitPaneSize: number;
  loading: boolean;
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

// =====================================
// Types API et Réponses
// =====================================
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GraphFilters {
  search?: string;
  userId?: number;
  isPublic?: boolean;
  sortBy?: 'name' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// =====================================
// Types WebSocket et Temps Réel
// =====================================
export interface SocketEvent {
  type: 'simulation_update' | 'graph_update' | 'user_joined' | 'user_left' | 'system_message';
  data: any;
  timestamp: Date;
  user?: Pick<User, 'id' | 'username'>;
}

export interface RoomInfo {
  id: string;
  name: string;
  users: User[];
  activeGraph?: Graph;
  isSimulationRunning: boolean;
}

// =====================================
// Types Configuration et Préférences
// =====================================
export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
  };
  websocket: {
    url: string;
    reconnectAttempts: number;
    reconnectDelay: number;
  };
  features: {
    enableSimulation: boolean;
    enableCollaboration: boolean;
    enable3DVisualization: boolean;
    enableExport: boolean;
  };
  limits: {
    maxNodes: number;
    maxEdges: number;
    maxFileSize: number;
  };
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'en' | 'fr' | 'es' | 'de';
  editorSettings: EditorSettings;
  viewportSettings: ViewportSettings;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
}

// =====================================
// Types Import/Export
// =====================================
export interface ExportOptions {
  format: 'json' | 'dot' | 'svg' | 'png' | 'pdf';
  includeMetadata: boolean;
  resolution?: number; // Pour les formats image
  compression?: boolean;
}

export interface ImportResult {
  success: boolean;
  graph?: Graph;
  errors?: string[];
  warnings?: string[];
}

// =====================================
// Types Performance et Statistiques
// =====================================
export interface PerformanceMetrics {
  renderTime: number;
  frameRate: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
  particleCount: number;
}

export interface SystemStats {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    load: number[];
  };
  database: {
    connections: number;
    queries: number;
    avgResponseTime: number;
  };
  redis: {
    memoryUsage: number;
    connectedClients: number;
    keyCount: number;
  };
  users: {
    total: number;
    online: number;
    registered24h: number;
  };
  graphs: {
    total: number;
    created24h: number;
    avgSize: number;
  };
  memory_usage: number;
  cpu_usage: number;
  active_connections: number;
  requests_per_minute: number;
  total_users: number;
  total_graphs: number;
  active_simulations: number;
  system_health: 'healthy' | 'warning' | 'critical';
}

export interface SystemHealth {
  backend: {
    status: 'online' | 'offline' | 'degraded';
    responseTime: number;
    uptime: number;
  };
  database: {
    status: 'online' | 'offline' | 'degraded';
    connectionCount: number;
  };
  redis: {
    status: 'online' | 'offline' | 'degraded';
    memoryUsage: number;
  };
}

// =====================================
// Types d'Erreurs
// =====================================
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: number;
  context?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// =====================================
// Types Utilitaires
// =====================================
export type Theme = 'light' | 'dark';
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
export type Permission = 'read' | 'write' | 'delete' | 'admin';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// =====================================
// Types Redux/State Management
// =====================================
export interface RootState {
  auth: AuthState;
  graphs: {
    list: Graph[];
    current: Graph | null;
    loading: boolean;
    error: string | null;
  };
  simulation: SimulationState;
  ui: UIState;
  preferences: UserPreferences;
}

// =====================================
// Props des Composants
// =====================================
export interface GraphVisualizationProps {
  graph: Graph;
  simulation?: SimulationState;
  viewport?: ViewportSettings;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onBackgroundClick?: () => void;
}

export interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  settings?: EditorSettings;
  readonly?: boolean;
  language?: string;
}

export interface SimulationControlsProps {
  config: SimulationConfig;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

// =====================================
// Types Système et Administration
// =====================================
export interface SystemStats {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    load: number[];
  };
  database: {
    connections: number;
    queries: number;
    avgResponseTime: number;
  };
  redis: {
    memoryUsage: number;
    connectedClients: number;
    keyCount: number;
  };
  users: {
    total: number;
    online: number;
    registered24h: number;
  };
  graphs: {
    total: number;
    created24h: number;
    avgSize: number;
  };
}

export interface SystemLogs {
  id: number;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug' | 'warning';
  message: string;
  source: string;
  userId?: number;
  ip?: string;
  metadata?: Record<string, any>;
}
