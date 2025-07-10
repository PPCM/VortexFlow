/**
 * VortexFlow Frontend - Service d'Administration
 * API calls pour la gestion administrative du système
 */

import { apiService } from './api';

export interface AdminStats {
  overview: {
    totalUsers: number;
    totalGraphs: number;
    totalSimulations: number;
    activeSimulations: number;
    recentUsers: number;
    todayActivity: number;
  };
  breakdown: {
    usersByRole: Record<string, number>;
    graphsByStatus: {
      public: number;
      private: number;
    };
    simulationsByStatus: Record<string, number>;
  };
}

export interface UserWithStats {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'viewer' | 'editor' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  stats: {
    totalGraphs: number;
    totalSimulations: number;
    lastActivity: string | null;
  };
}

export interface GraphWithStats {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_id: number;
  User: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  stats: {
    totalSimulations: number;
  };
}

export interface SimulationWithDetails {
  id: number;
  graph_id: number;
  user_id: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  start_time: string;
  end_time?: string;
  created_at: string;
  updated_at: string;
  User: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  Graph: {
    id: number;
    name: string;
    description: string;
  };
}

export interface ActivityLogEntry {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id?: number;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
  created_at: string;
  User: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface SystemInfo {
  version: string;
  nodeVersion: string;
  environment: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  platform: string;
  architecture: string;
  database: {
    host: string;
    port: string;
    name: string;
  };
  redis: {
    host: string;
    port: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const adminService = {
  /**
   * Récupérer les statistiques globales du système
   */
  async getStats(): Promise<AdminStats> {
    const response = await apiService.client.get('/admin/stats');
    return response.data.data;
  },

  /**
   * Récupérer la liste paginée des utilisateurs
   */
  async getUsers(params: PaginationParams & {
    role?: string;
    status?: 'active' | 'inactive';
  } = {}): Promise<PaginatedResponse<UserWithStats>> {
    const response = await apiService.client.get('/admin/users', { params });
    console.log('🔍 Structure réponse API:', response.data);
    console.log('🔍 response.data.data:', response.data.data);
    console.log('🔍 response.data.data.users:', response.data.data?.users);
    return {
      data: response.data.data.users,
      pagination: response.data.data.pagination
    };
  },

  /**
   * Modifier un utilisateur
   */
  async updateUser(id: number, updates: Partial<{
    role: string;
    is_active: boolean;
    first_name: string;
    last_name: string;
    email: string;
  }>): Promise<UserWithStats> {
    const response = await apiService.client.put(`/admin/users/${id}`, updates);
    return response.data.data;
  },

  /**
   * Créer un nouvel utilisateur
   */
  async createUser(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: 'viewer' | 'editor' | 'admin';
  }): Promise<UserWithStats> {
    const response = await apiService.client.post('/admin/users', userData);
    return response.data.data;
  },

  /**
   * Désactiver un utilisateur
   */
  async deleteUser(id: number): Promise<void> {
    await apiService.client.delete(`/admin/users/${id}`);
  },

  /**
   * Supprimer définitivement un utilisateur
   */
  async permanentDeleteUser(id: number): Promise<void> {
    await apiService.client.delete(`/admin/users/${id}/permanent`);
  },

  /**
   * Réinitialiser le mot de passe d'un utilisateur
   */
  async resetUserPassword(id: number, newPassword: string): Promise<void> {
    await apiService.client.post(`/admin/users/${id}/reset-password`, {
      new_password: newPassword
    });
  },

  /**
   * Actions en masse sur les utilisateurs
   */
  async bulkUserAction(action: 'activate' | 'deactivate' | 'delete' | 'permanent_delete', userIds: number[]): Promise<{ affected_count: number }> {
    const response = await apiService.client.post('/admin/users/bulk-action', {
      action,
      user_ids: userIds
    });
    return response.data.data;
  },

  /**
   * Récupérer la liste paginée des graphiques
   */
  async getGraphs(params: PaginationParams & {
    userId?: number;
    isPublic?: boolean;
  } = {}): Promise<PaginatedResponse<GraphWithStats>> {
    const response = await apiService.client.get('/admin/graphs', { params });
    return {
      data: response.data.data.graphs,
      pagination: response.data.data.pagination
    };
  },

  /**
   * Supprimer un graphique
   */
  async deleteGraph(id: number): Promise<void> {
    await apiService.client.delete(`/admin/graphs/${id}`);
  },

  /**
   * Récupérer la liste paginée des simulations
   */
  async getSimulations(params: PaginationParams & {
    status?: string;
    userId?: number;
    graphId?: number;
  } = {}): Promise<PaginatedResponse<SimulationWithDetails>> {
    const response = await apiService.client.get('/admin/simulations', { params });
    return {
      data: response.data.data.simulations,
      pagination: response.data.data.pagination
    };
  },

  /**
   * Arrêter une simulation
   */
  async stopSimulation(id: number): Promise<SimulationWithDetails> {
    const response = await apiService.client.post(`/admin/simulations/${id}/stop`);
    return response.data.data;
  },

  /**
   * Récupérer le journal d'activité
   */
  async getActivityLog(params: PaginationParams & {
    userId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<PaginatedResponse<ActivityLogEntry>> {
    const response = await apiService.client.get('/admin/activity', { params });
    return {
      data: response.data.data.activities,
      pagination: response.data.data.pagination
    };
  },

  /**
   * Récupérer les informations système
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await apiService.client.get('/admin/system');
    return response.data.data;
  },

  /**
   * Créer une sauvegarde du système
   */
  async createBackup(): Promise<void> {
    await apiService.client.post('/admin/backup');
  },

  /**
   * Obtenir les rôles disponibles
   */
  getRoles(): Array<{ value: string; label: string }> {
    return [
      { value: 'viewer', label: 'Utilisateur' },
      { value: 'editor', label: 'Éditeur' },
      { value: 'admin', label: 'Administrateur' }
    ];
  },

  /**
   * Obtenir les statuts de simulation disponibles
   */
  getSimulationStatuses(): Array<{ value: string; label: string }> {
    return [
      { value: 'running', label: 'En cours' },
      { value: 'paused', label: 'En pause' },
      { value: 'completed', label: 'Terminée' },
      { value: 'failed', label: 'Échouée' }
    ];
  },

  /**
   * Formater la durée d'uptime
   */
  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) {
      return `${days}j ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  },

  /**
   * Formater la taille mémoire
   */
  formatMemorySize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
};
