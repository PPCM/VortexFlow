// VortexFlow Frontend - Service WebSocket
// Gestion des connexions temps réel avec Socket.IO

import { io, Socket } from 'socket.io-client';
import { SocketEvent, SimulationState, User } from '../types';

// =====================================
// Configuration WebSocket
// =====================================
const WEBSOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export interface WebSocketCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onSimulationUpdate?: (data: any) => void;
  onGraphUpdate?: (data: any) => void;
  onUserJoined?: (user: User) => void;
  onUserLeft?: (user: User) => void;
  onSystemMessage?: (message: string) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private callbacks: WebSocketCallbacks = {};
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  // =====================================
  // Gestion de la Connexion
  // =====================================
  connect(): void {
    if (this.socket && this.isConnected) {
      return;
    }

    console.log('Connexion WebSocket...', WEBSOCKET_URL);

    this.socket = io(WEBSOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      console.log('Déconnexion WebSocket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Événements de connexion
    this.socket.on('connect', () => {
      console.log('WebSocket connecté:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket déconnecté:', reason);
      this.isConnected = false;
      this.callbacks.onDisconnect?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erreur de connexion WebSocket:', error);
      this.reconnectAttempts++;
      this.callbacks.onError?.(error);
    });

    // Événements métier
    this.socket.on('simulation_update', (data) => {
      this.callbacks.onSimulationUpdate?.(data);
    });

    this.socket.on('graph_update', (data) => {
      this.callbacks.onGraphUpdate?.(data);
    });

    this.socket.on('user_joined', (user) => {
      this.callbacks.onUserJoined?.(user);
    });

    this.socket.on('user_left', (user) => {
      this.callbacks.onUserLeft?.(user);
    });

    this.socket.on('system_message', (message) => {
      this.callbacks.onSystemMessage?.(message);
    });

    // Événements de simulation spécifiques
    this.socket.on('particle_created', (particle) => {
      console.log('Nouvelle particule:', particle);
    });

    this.socket.on('particle_moved', (particle) => {
      console.log('Particule déplacée:', particle);
    });

    this.socket.on('simulation_started', (config) => {
      console.log('Simulation démarrée:', config);
    });

    this.socket.on('simulation_stopped', () => {
      console.log('Simulation arrêtée');
    });

    // Événements de collaboration
    this.socket.on('graph_edited', (data) => {
      console.log('Graphique modifié par:', data.user);
    });

    this.socket.on('cursor_moved', (data) => {
      console.log('Curseur déplacé:', data);
    });
  }

  // =====================================
  // Gestion des Callbacks
  // =====================================
  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  removeCallbacks(): void {
    this.callbacks = {};
  }

  // =====================================
  // Méthodes de Communication
  // =====================================
  joinRoom(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_room', roomId);
      console.log('Rejoint la room:', roomId);
    }
  }

  leaveRoom(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_room', roomId);
      console.log('Quitté la room:', roomId);
    }
  }

  // =====================================
  // Méthodes Simulation
  // =====================================
  startSimulation(graphId: number, config: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('start_simulation', { graphId, config });
    }
  }

  stopSimulation(graphId: number): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop_simulation', { graphId });
    }
  }

  pauseSimulation(graphId: number): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('pause_simulation', { graphId });
    }
  }

  updateSimulationConfig(graphId: number, config: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_simulation_config', { graphId, config });
    }
  }

  // =====================================
  // Méthodes Collaboration
  // =====================================
  updateGraph(graphId: number, changes: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_graph', { graphId, changes });
    }
  }

  sendCursorPosition(graphId: number, position: { x: number; y: number }): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('cursor_position', { graphId, position });
    }
  }

  sendChatMessage(roomId: string, message: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('chat_message', { roomId, message });
    }
  }

  // =====================================
  // Méthodes Utilitaires
  // =====================================
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  getRooms(): string[] {
    // @ts-ignore - Socket.IO internal property
    return this.socket?.rooms ? Array.from(this.socket.rooms) : [];
  }

  // =====================================
  // Gestion des Événements Personnalisés
  // =====================================
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }

  // =====================================
  // Méthodes de Debug
  // =====================================
  getConnectionInfo(): any {
    if (!this.socket) return null;

    return {
      id: this.socket.id,
      connected: this.socket.connected,
      disconnected: this.socket.disconnected,
      rooms: this.getRooms(),
      transport: this.socket.io.engine?.transport?.name,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  enableDebug(): void {
    if (this.socket) {
      this.socket.onAny((event, ...args) => {
        console.log(`WebSocket Event [${event}]:`, args);
      });
    }
  }

  disableDebug(): void {
    if (this.socket) {
      this.socket.offAny();
    }
  }
}

// =====================================
// Hook React pour WebSocket
// =====================================
export const useWebSocket = (callbacks: WebSocketCallbacks = {}) => {
  const wsService = new WebSocketService();
  
  // Configuration des callbacks
  wsService.setCallbacks(callbacks);

  return {
    connect: () => wsService.connect(),
    disconnect: () => wsService.disconnect(),
    joinRoom: (roomId: string) => wsService.joinRoom(roomId),
    leaveRoom: (roomId: string) => wsService.leaveRoom(roomId),
    isConnected: () => wsService.isSocketConnected(),
    emit: (event: string, data?: any) => wsService.emit(event, data),
    on: (event: string, callback: (...args: any[]) => void) => wsService.on(event, callback),
    off: (event: string, callback?: (...args: any[]) => void) => wsService.off(event, callback),
    
    // Méthodes spécifiques
    startSimulation: (graphId: number, config: any) => wsService.startSimulation(graphId, config),
    stopSimulation: (graphId: number) => wsService.stopSimulation(graphId),
    pauseSimulation: (graphId: number) => wsService.pauseSimulation(graphId),
    updateGraph: (graphId: number, changes: any) => wsService.updateGraph(graphId, changes),
    
    // Debug
    getConnectionInfo: () => wsService.getConnectionInfo(),
    enableDebug: () => wsService.enableDebug(),
    disableDebug: () => wsService.disableDebug(),
  };
};

// Instance singleton du service WebSocket
export const webSocketService = new WebSocketService();
export default webSocketService;
