// VortexFlow Frontend - Service API
// Configuration et gestion des appels API vers le backend

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { 
  ApiResponse, 
  PaginatedResponse,
  User, 
  Graph, 
  GraphFilters,
  LoginCredentials, 
  RegisterData,
  ExportOptions,
  ImportResult 
} from '../types';

// =====================================
// Configuration API
// =====================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_TIMEOUT = 10000;

class ApiService {
  public client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      withCredentials: true, // Important pour les sessions
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercepteurs pour les réponses
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Intercepteur de réponse pour gérer les erreurs globalement
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        console.error('API Error:', error);
        
        // Gestion des erreurs d'authentification
        if (error.response?.status === 401) {
          // Rediriger vers login si non authentifié
          window.location.href = '/login';
        }
        
        // Gestion des erreurs serveur
        if (error.response?.status && error.response.status >= 500) {
          console.error('Server Error:', error.response?.data);
        }
        
        return Promise.reject(error);
      }
    );

    // Intercepteur de requête pour ajouter des headers
    this.client.interceptors.request.use(
      (config) => {
        // Ajouter timestamp pour éviter le cache
        config.params = {
          ...config.params,
          _t: Date.now()
        };
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  // =====================================
  // Méthodes Authentification
  // =====================================
  async login(credentials: LoginCredentials): Promise<ApiResponse<User>> {
    const response = await this.client.post('/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterData): Promise<ApiResponse<User>> {
    const response = await this.client.post('/auth/register', userData);
    return response.data;
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async refreshSession(): Promise<ApiResponse<User>> {
    const response = await this.client.post('/auth/refresh');
    return response.data;
  }

  // =====================================
  // Méthodes Gestion des Graphiques
  // =====================================
  async getGraphs(filters?: GraphFilters): Promise<ApiResponse<PaginatedResponse<Graph>>> {
    const response = await this.client.get('/graphs', { params: filters });
    return response.data;
  }

  async getGraph(id: number): Promise<ApiResponse<Graph>> {
    const response = await this.client.get(`/graphs/${id}`);
    return response.data;
  }

  async createGraph(graphData: Partial<Graph>): Promise<ApiResponse<Graph>> {
    const response = await this.client.post('/graphs', graphData);
    return response.data;
  }

  async updateGraph(id: number, graphData: Partial<Graph>): Promise<ApiResponse<Graph>> {
    const response = await this.client.put(`/graphs/${id}`, graphData);
    return response.data;
  }

  async deleteGraph(id: number): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/graphs/${id}`);
    return response.data;
  }

  async duplicateGraph(id: number, name: string): Promise<ApiResponse<Graph>> {
    const response = await this.client.post(`/graphs/${id}/duplicate`, { name });
    return response.data;
  }

  async shareGraph(id: number, isPublic: boolean): Promise<ApiResponse<Graph>> {
    const response = await this.client.patch(`/graphs/${id}/share`, { is_public: isPublic });
    return response.data;
  }

  // =====================================
  // Méthodes Validation DOT
  // =====================================
  async validateDot(dotContent: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/graphs/validate', { dot_content: dotContent });
    return response.data;
  }

  async parseDot(dotContent: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/graphs/parse', { dot_content: dotContent });
    return response.data;
  }

  // =====================================
  // Méthodes Import/Export
  // =====================================
  async exportGraph(id: number, options: ExportOptions): Promise<Blob> {
    const response = await this.client.post(`/import-export/export/${id}`, options, {
      responseType: 'blob'
    });
    return response.data;
  }

  async importGraph(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.client.post('/import-export/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async exportMultipleGraphs(ids: number[], options: ExportOptions): Promise<Blob> {
    const response = await this.client.post('/import-export/export-multiple', 
      { graph_ids: ids, ...options }, 
      { responseType: 'blob' }
    );
    return response.data;
  }

  // =====================================
  // Méthodes Gestion des Utilisateurs
  // =====================================
  async getUsers(page: number = 1, limit: number = 20): Promise<ApiResponse<PaginatedResponse<User>>> {
    const response = await this.client.get('/users', { params: { page, limit } });
    return response.data;
  }

  async getUserById(id: number): Promise<ApiResponse<User>> {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.client.put(`/users/${id}`, userData);
    return response.data;
  }

  // Alias pour compatibility
  async updateUserProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    if (!userData.id) {
      throw new Error('User ID is required for update');
    }
    return this.updateUser(userData.id, userData);
  }

  async updateUserPreferences(preferences: any): Promise<ApiResponse<any>> {
    const response = await this.client.put('/user/preferences', preferences);
    return response.data;
  }

  async deleteUser(id: number): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/users/${id}`);
    return response.data;
  }

  async createUser(userData: RegisterData): Promise<ApiResponse<User>> {
    const response = await this.client.post('/users', userData);
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    const response = await this.client.patch('/users/password', {
      old_password: oldPassword,
      new_password: newPassword
    });
    return response.data;
  }

  // =====================================
  // Méthodes Système et Santé
  // =====================================
  async getSystemHealth(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/system/health');
    return response.data;
  }

  async getSystemStats(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/system/stats');
    return response.data;
  }

  async getSystemLogs(level?: string, limit?: number): Promise<ApiResponse<any>> {
    const response = await this.client.get('/system/logs', { 
      params: { level, limit } 
    });
    return response.data;
  }

  // =====================================
  // Méthodes Simulation
  // =====================================
  async startSimulation(graphId: number, config: any): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/simulation/start/${graphId}`, config);
    return response.data;
  }

  async stopSimulation(graphId: number): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/simulation/stop/${graphId}`);
    return response.data;
  }

  async pauseSimulation(graphId: number): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/simulation/pause/${graphId}`);
    return response.data;
  }

  async getSimulationStatus(graphId: number): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/simulation/status/${graphId}`);
    return response.data;
  }

  async updateSimulationConfig(graphId: number, config: any): Promise<ApiResponse<any>> {
    const response = await this.client.patch(`/simulation/config/${graphId}`, config);
    return response.data;
  }

  // =====================================
  // Méthodes Utilitaires
  // =====================================
  async uploadFile(file: File, path: string = '/upload'): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.client.post(path, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async downloadFile(url: string, filename: string): Promise<void> {
    const response = await this.client.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // =====================================
  // Gestion des Erreurs
  // =====================================
  handleApiError(error: AxiosError): string {
    if (error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
      return (error.response.data as { message: string }).message;
    }
    
    if (error.response?.status === 404) {
      return 'Ressource non trouvée';
    }
    
    if (error.response?.status === 403) {
      return 'Accès non autorisé';
    }
    
    if (error.response?.status === 500) {
      return 'Erreur serveur interne';
    }
    
    if (error.code === 'NETWORK_ERROR') {
      return 'Erreur de connexion réseau';
    }
    
    return 'Une erreur inattendue s\'est produite';
  }
}

// Instance singleton du service API
export const apiService = new ApiService();
export default apiService;
