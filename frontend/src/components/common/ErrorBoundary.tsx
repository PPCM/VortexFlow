// VortexFlow Frontend - Boundary de Gestion d'Erreurs
// Composant de récupération d'erreurs React avec interface utilisateur

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Error,
  Refresh,
  Home,
  BugReport,
  ExpandMore,
  ContentCopy,
  Send,
} from '@mui/icons-material';

// =====================================
// Types et interfaces
// =====================================
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

// =====================================
// Utilitaires d'erreur
// =====================================
class ErrorLogger {
  static log(error: Error, errorInfo: ErrorInfo, errorId: string) {
    // Log vers la console en développement
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Log vers un service externe en production
    try {
      // TODO: Intégrer avec un service de monitoring d'erreurs (Sentry, LogRocket, etc.)
      this.sendToMonitoringService({
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    } catch (logError) {
      console.error('Failed to log error to monitoring service:', logError);
    }
  }

  private static sendToMonitoringService(errorData: any) {
    // Placeholder pour l'envoi vers un service de monitoring
    console.log('Error data for monitoring service:', errorData);
  }
}

// =====================================
// Composant ErrorBoundary
// =====================================
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.generateErrorId();
    
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log l'erreur
    ErrorLogger.log(error, errorInfo, errorId);
    
    // Appeler le callback d'erreur si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleCopyError = () => {
    const errorText = this.getErrorDetailsText();
    navigator.clipboard.writeText(errorText).then(() => {
      // Notification de copie réussie
      console.log('Error details copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy error details:', err);
    });
  };

  private handleReportError = () => {
    const errorText = this.getErrorDetailsText();
    const subject = `VortexFlow Error Report - ${this.state.errorId}`;
    const body = encodeURIComponent(`
Bonjour,

J'ai rencontré une erreur dans VortexFlow:

${errorText}

Merci de votre attention.
    `);
    
    window.open(`mailto:support@vortexflow.dev?subject=${subject}&body=${body}`);
  };

  private getErrorDetailsText(): string {
    const { error, errorInfo, errorId } = this.state;
    
    return `
Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${error?.toString() || 'Unknown error'}

Stack Trace:
${error?.stack || 'No stack trace available'}

Component Stack:
${errorInfo?.componentStack || 'No component stack available'}
    `.trim();
  }

  render() {
    if (this.state.hasError) {
      // Utiliser le fallback personnalisé si fourni
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Interface d'erreur par défaut
      return (
        <Box
          sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Container maxWidth="md">
            <Card
              sx={{
                backdropFilter: 'blur(10px)',
                backgroundColor: 'rgba(26, 26, 26, 0.8)',
                border: '1px solid rgba(255, 107, 53, 0.2)',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                {/* Icône d'erreur */}
                <Error
                  sx={{
                    fontSize: 80,
                    color: 'error.main',
                    mb: 3,
                  }}
                />

                {/* Titre */}
                <Typography
                  variant="h4"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    color: 'error.main',
                  }}
                >
                  Oups ! Une erreur s'est produite
                </Typography>

                {/* Description */}
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  VortexFlow a rencontré une erreur inattendue. 
                  Nos équipes ont été automatiquement notifiées.
                </Typography>

                {/* ID d'erreur */}
                <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                  <Typography variant="body2">
                    <strong>ID d'erreur:</strong> {this.state.errorId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Référencez cet ID si vous contactez le support
                  </Typography>
                </Alert>

                {/* Détails techniques (repliable) */}
                <Accordion sx={{ mb: 3, textAlign: 'left' }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle2">
                      Détails techniques
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Erreur:</strong>
                      </Typography>
                      <Box
                        sx={{
                          p: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 1,
                          mb: 2,
                          overflowX: 'auto',
                        }}
                      >
                        {this.state.error?.toString()}
                      </Box>

                      {this.state.error?.stack && (
                        <>
                          <Typography variant="body2" gutterBottom>
                            <strong>Stack Trace:</strong>
                          </Typography>
                          <Box
                            sx={{
                              p: 1,
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: 1,
                              mb: 2,
                              overflowX: 'auto',
                              maxHeight: 200,
                              overflowY: 'auto',
                            }}
                          >
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                              {this.state.error.stack}
                            </pre>
                          </Box>
                        </>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button
                          size="small"
                          startIcon={<ContentCopy />}
                          onClick={this.handleCopyError}
                          variant="outlined"
                        >
                          Copier les détails
                        </Button>
                        <Button
                          size="small"
                          startIcon={<Send />}
                          onClick={this.handleReportError}
                          variant="outlined"
                          color="secondary"
                        >
                          Signaler l'erreur
                        </Button>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </CardContent>

              <Divider />

              <CardActions sx={{ justifyContent: 'center', p: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.handleRetry}
                  size="large"
                  sx={{ mr: 2 }}
                >
                  Réessayer
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Home />}
                  onClick={this.handleGoHome}
                  size="large"
                >
                  Retour à l'accueil
                </Button>
              </CardActions>
            </Card>

            {/* Informations de contact support */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Besoin d'aide ? Contactez-nous à{' '}
                <a
                  href="mailto:support@vortexflow.dev"
                  style={{ color: '#ff6b35', textDecoration: 'none' }}
                >
                  support@vortexflow.dev
                </a>
              </Typography>
            </Box>
          </Container>
        </Box>
      );
    }

    return this.props.children;
  }
}

// =====================================
// Hook pour capturer les erreurs asynchrones
// =====================================
export const useErrorHandler = () => {
  const handleError = (error: Error) => {
    // Log l'erreur
    console.error('Async error caught:', error);
    
    // Ici, on pourrait déclencher une notification d'erreur
    // ou rediriger vers une page d'erreur
    
    // Pour l'instant, on lance l'erreur pour que ErrorBoundary la capture
    throw error;
  };

  return handleError;
};

// =====================================
// Composant d'erreur de fallback personnalisé
// =====================================
interface FallbackErrorProps {
  error?: Error;
  resetError?: () => void;
  message?: string;
}

export const FallbackError: React.FC<FallbackErrorProps> = ({
  error,
  resetError,
  message = "Une erreur s'est produite",
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      p: 3,
      textAlign: 'center',
    }}
  >
    <Error sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
    <Typography variant="h6" gutterBottom color="error">
      {message}
    </Typography>
    {error && (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {error.message}
      </Typography>
    )}
    {resetError && (
      <Button variant="outlined" onClick={resetError} startIcon={<Refresh />}>
        Réessayer
      </Button>
    )}
  </Box>
);

export default ErrorBoundary;
