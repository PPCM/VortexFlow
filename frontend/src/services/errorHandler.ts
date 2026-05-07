// VortexFlow Frontend - Gestionnaire d'Erreurs API
// Middleware pour la gestion centralisée des erreurs d'API et réseau

import { AxiosError, AxiosResponse } from 'axios';

// =====================================
// Types d'erreurs
// =====================================
export interface APIError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
  timestamp: Date;
  requestId?: string;
}

export interface ErrorContext {
  endpoint?: string;
  method?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
}

// =====================================
// Classes d'erreurs personnalisées
// =====================================
export class VortexFlowError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly timestamp: Date;
  public readonly context?: ErrorContext;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: any,
    context?: ErrorContext
  ) {
    super(message);
    this.name = 'VortexFlowError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
  }
}

export class NetworkError extends VortexFlowError {
  constructor(message: string = 'Erreur de connexion réseau', context?: ErrorContext) {
    super(message, 'NETWORK_ERROR', undefined, undefined, context);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends VortexFlowError {
  constructor(message: string = 'Authentification requise', context?: ErrorContext) {
    super(message, 'AUTH_ERROR', 401, undefined, context);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends VortexFlowError {
  constructor(message: string = 'Accès non autorisé', context?: ErrorContext) {
    super(message, 'AUTHORIZATION_ERROR', 403, undefined, context);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends VortexFlowError {
  constructor(message: string, details?: any, context?: ErrorContext) {
    super(message, 'VALIDATION_ERROR', 400, details, context);
    this.name = 'ValidationError';
  }
}

export class ServerError extends VortexFlowError {
  constructor(message: string = 'Erreur serveur interne', statusCode: number = 500, context?: ErrorContext) {
    super(message, 'SERVER_ERROR', statusCode, undefined, context);
    this.name = 'ServerError';
  }
}

// =====================================
// Gestionnaire d'erreurs principal
// =====================================
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: ((error: VortexFlowError) => void)[] = [];

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // =====================================
  // Gestion des erreurs Axios
  // =====================================
  public handleAxiosError(error: AxiosError, context?: ErrorContext): VortexFlowError {
    const mergedContext: ErrorContext = {
      endpoint: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...context,
    };

    let vortexError: VortexFlowError;

    if (error.response) {
      // Erreur de réponse du serveur
      const { status, data } = error.response;
      const errorData = data as any; // Typage temporaire pour les propriétés d'erreur
      
      switch (status) {
        case 400:
          vortexError = new ValidationError(
            errorData?.message || 'Données invalides',
            errorData?.errors || errorData?.details,
            mergedContext
          );
          break;
          
        case 401:
          vortexError = new AuthenticationError(
            errorData?.message || 'Authentification requise',
            mergedContext
          );
          break;
          
        case 403:
          vortexError = new AuthorizationError(
            errorData?.message || 'Accès non autorisé',
            mergedContext
          );
          break;
          
        case 404:
          vortexError = new VortexFlowError(
            errorData?.message || 'Ressource non trouvée',
            'NOT_FOUND',
            404,
            errorData,
            mergedContext
          );
          break;
          
        case 422:
          vortexError = new ValidationError(
            errorData?.message || 'Données non traitables',
            errorData?.errors || errorData?.details,
            mergedContext
          );
          break;
          
        case 429:
          vortexError = new VortexFlowError(
            errorData?.message || 'Trop de requêtes, veuillez patienter',
            'RATE_LIMIT',
            429,
            errorData,
            mergedContext
          );
          break;
          
        case 500:
        case 502:
        case 503:
        case 504:
          vortexError = new ServerError(
            errorData?.message || 'Erreur serveur, veuillez réessayer plus tard',
            status,
            mergedContext
          );
          break;
          
        default:
          vortexError = new VortexFlowError(
            errorData?.message || `Erreur HTTP ${status}`,
            'HTTP_ERROR',
            status,
            errorData,
            mergedContext
          );
      }
    } else if (error.request) {
      // Erreur de réseau (pas de réponse)
      vortexError = new NetworkError(
        'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
        mergedContext
      );
    } else {
      // Erreur de configuration de la requête
      vortexError = new VortexFlowError(
        'Erreur de configuration de la requête',
        'REQUEST_CONFIG_ERROR',
        undefined,
        { originalMessage: error.message },
        mergedContext
      );
    }

    this.logError(vortexError);
    this.notifyListeners(vortexError);
    
    return vortexError;
  }

  // =====================================
  // Gestion des erreurs génériques
  // =====================================
  public handleError(error: unknown, context?: ErrorContext): VortexFlowError {
    let vortexError: VortexFlowError;

    if (error instanceof VortexFlowError) {
      vortexError = error;
    } else if (error instanceof Error) {
      vortexError = new VortexFlowError(
        error.message,
        'GENERIC_ERROR',
        undefined,
        { originalError: error.name, stack: error.stack },
        context
      );
    } else {
      vortexError = new VortexFlowError(
        'Une erreur inconnue s\'est produite',
        'UNKNOWN_ERROR',
        undefined,
        { originalError: error },
        context
      );
    }

    this.logError(vortexError);
    this.notifyListeners(vortexError);
    
    return vortexError;
  }

  // =====================================
  // Logging d'erreurs
  // =====================================
  private logError(error: VortexFlowError): void {
    const logData = {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: error.timestamp.toISOString(),
      context: error.context,
      details: error.details,
      stack: error.stack,
    };

    // Log en développement
    if (import.meta.env.MODE === 'development') {
      console.group(`🚨 VortexFlow Error - ${error.code}`);
      console.error('Error:', error.message);
      console.log('Details:', logData);
      console.groupEnd();
    }

    // Envoi vers un service de monitoring en production
    this.sendToMonitoringService(logData);
  }

  private sendToMonitoringService(errorData: any): void {
    try {
      // TODO: Intégrer avec Sentry, LogRocket, ou autre service de monitoring
      if (import.meta.env.MODE === 'production') {
        // Exemple d'envoi vers un endpoint de logging
        fetch('/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorData),
        }).catch(() => {
          // Ignorer les erreurs de logging pour éviter les boucles infinies
        });
      }
    } catch {
      // Ignorer les erreurs de logging
    }
  }

  // =====================================
  // Système d'écoute d'erreurs
  // =====================================
  public addErrorListener(listener: (error: VortexFlowError) => void): () => void {
    this.errorListeners.push(listener);
    
    // Retourner une fonction de nettoyage
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(error: VortexFlowError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  // =====================================
  // Utilitaires de récupération d'erreurs
  // =====================================
  public isRetryableError(error: VortexFlowError): boolean {
    return [
      'NETWORK_ERROR',
      'SERVER_ERROR',
      'RATE_LIMIT',
    ].includes(error.code) || (error.statusCode !== undefined && error.statusCode >= 500);
  }

  public shouldRedirectToLogin(error: VortexFlowError): boolean {
    return error.code === 'AUTH_ERROR' || error.statusCode === 401;
  }

  public getUserFriendlyMessage(error: VortexFlowError): string {
    const friendlyMessages: Record<string, string> = {
      'NETWORK_ERROR': 'Problème de connexion. Vérifiez votre connexion internet.',
      'AUTH_ERROR': 'Votre session a expiré. Veuillez vous reconnecter.',
      'AUTHORIZATION_ERROR': 'Vous n\'avez pas les permissions nécessaires.',
      'VALIDATION_ERROR': 'Les données saisies ne sont pas valides.',
      'NOT_FOUND': 'La ressource demandée n\'existe pas.',
      'RATE_LIMIT': 'Trop de requêtes. Veuillez patienter avant de réessayer.',
      'SERVER_ERROR': 'Erreur du serveur. Veuillez réessayer plus tard.',
    };

    return friendlyMessages[error.code] || error.message || 'Une erreur inattendue s\'est produite.';
  }
}

// =====================================
// Instance singleton
// =====================================
export const errorHandler = ErrorHandler.getInstance();

// =====================================
// Hook React pour la gestion d'erreurs
// =====================================
export const useErrorHandler = () => {
  const handleError = (error: unknown, context?: ErrorContext) => {
    return errorHandler.handleError(error, context);
  };

  const handleAxiosError = (error: AxiosError, context?: ErrorContext) => {
    return errorHandler.handleAxiosError(error, context);
  };

  return {
    handleError,
    handleAxiosError,
    isRetryableError: errorHandler.isRetryableError.bind(errorHandler),
    shouldRedirectToLogin: errorHandler.shouldRedirectToLogin.bind(errorHandler),
    getUserFriendlyMessage: errorHandler.getUserFriendlyMessage.bind(errorHandler),
  };
};

// =====================================
// Configuration des intercepteurs Axios
// =====================================
export const setupAxiosErrorInterceptor = (axiosInstance: any) => {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      const vortexError = errorHandler.handleAxiosError(error);
      return Promise.reject(vortexError);
    }
  );
};

export default errorHandler;
