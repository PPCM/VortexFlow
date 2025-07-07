# ⚙️ VortexFlow Backend - Guide de Configuration

**Version:** 1.0.0  
**Status:** ✅ Production Ready  
**Date:** 2025-07-07

## 🎯 Vue d'Ensemble

Guide complet pour configurer le backend VortexFlow avec toutes les variables d'environnement, paramètres de sécurité et optimisations de performance.

## 📋 Variables d'Environnement

### 🔧 Configuration Serveur

```env
# Environnement et serveur
NODE_ENV=development                    # development | production | test
HOST=192.168.5.30                      # Adresse IP d'écoute
PORT=5000                              # Port d'écoute
APP_NAME=VortexFlow Backend            # Nom de l'application
APP_VERSION=1.0.0                      # Version de l'application

# CORS et sécurité
CORS_ORIGIN=http://localhost:3000      # URL frontend autorisée
CORS_CREDENTIALS=true                  # Autoriser cookies cross-origin
TRUST_PROXY=false                      # true si derrière proxy/load balancer
```

### 🗄️ Base de Données PostgreSQL

```env
# Configuration principale
DATABASE_URL=postgresql://vortexflow_user:vortexflow_password@DESKTOP-43H5NAN:5432/vortexflow

# Configuration détaillée (alternative)
DB_HOST=DESKTOP-43H5NAN              # Hôte PostgreSQL
DB_PORT=5432                         # Port PostgreSQL
DB_NAME=vortexflow                   # Nom de la base
DB_USER=vortexflow_user              # Utilisateur
DB_PASSWORD=vortexflow_password      # Mot de passe
DB_SSL=false                         # SSL en production: true

# Pool de connexions
DB_POOL_MIN=2                        # Connexions minimum
DB_POOL_MAX=10                       # Connexions maximum
DB_POOL_IDLE=10000                   # Timeout idle (ms)
DB_POOL_ACQUIRE=60000                # Timeout acquire (ms)
```

### 🔄 Redis Configuration

```env
# Configuration principale
REDIS_URL=redis://DESKTOP-43H5NAN:6379    # URL complète Redis
REDIS_HOST=DESKTOP-43H5NAN                # Hôte Redis
REDIS_PORT=6379                           # Port Redis
REDIS_PASSWORD=kSeFpbKQA8nsfZRaht5EzL     # Mot de passe Redis
REDIS_DB=0                                # Numéro de base (0-15)

# Configuration avancée
REDIS_MAX_RETRIES=3                       # Tentatives de reconnexion
REDIS_RETRY_DELAY=3000                    # Délai entre tentatives (ms)
REDIS_CONNECT_TIMEOUT=10000               # Timeout connexion (ms)
REDIS_COMMAND_TIMEOUT=5000                # Timeout commandes (ms)
REDIS_FAMILY=4                            # IPv4 (4) ou IPv6 (6)
```

### 🔐 Sessions et Authentification

```env
# Configuration sessions
SESSION_SECRET=your-super-secret-session-key-change-this-in-production-use-crypto-random
SESSION_NAME=connect.sid               # Nom du cookie de session
SESSION_MAX_AGE=86400000              # Durée session (ms) - 24h par défaut
SESSION_SECURE=false                  # true en HTTPS production
SESSION_HTTP_ONLY=true                # Cookie HTTP uniquement
SESSION_SAME_SITE=lax                 # strict | lax | none

# Configuration Redis pour sessions
SESSION_STORE=redis                   # redis | memory (dev only)
SESSION_PREFIX=sess:                  # Préfixe des clés Redis

# Rotation et sécurité
SESSION_RESAVE=false                  # Ne pas sauver si non modifiée
SESSION_SAVE_UNINITIALIZED=false     # Ne pas sauver si vide
SESSION_ROLLING=true                  # Renouveler à chaque requête
```

### 👤 Utilisateur Admin par Défaut

```env
# Compte administrateur initial
ADMIN_EMAIL=admin@admin.com           # Email admin
ADMIN_PASSWORD=VortexFlow2024!        # Mot de passe admin
ADMIN_FIRST_NAME=Admin                # Prénom
ADMIN_LAST_NAME=User                  # Nom
```

### 📧 Configuration Email (Optionnel)

```env
# Service email (Nodemailer)
EMAIL_SERVICE=gmail                   # gmail | outlook | smtp
EMAIL_HOST=smtp.gmail.com             # Hôte SMTP
EMAIL_PORT=587                        # Port SMTP (587 TLS, 465 SSL)
EMAIL_SECURE=false                    # true pour port 465
EMAIL_USER=your-email@gmail.com       # Email expéditeur
EMAIL_PASSWORD=your-app-password      # Mot de passe application
EMAIL_FROM=VortexFlow <noreply@vortexflow.com>  # Expéditeur par défaut
```

### 📊 Logging et Monitoring

```env
# Configuration logs
LOG_LEVEL=info                        # error | warn | info | verbose | debug
LOG_FORMAT=json                       # json | simple
LOG_FILE_ENABLED=true                 # Logs dans fichiers
LOG_CONSOLE_ENABLED=true              # Logs dans console
LOG_MAX_SIZE=20m                      # Taille max fichier log
LOG_MAX_FILES=14d                     # Rétention logs

# Monitoring externe
SENTRY_DSN=                           # URL Sentry pour erreurs
MONITORING_ENABLED=false              # Monitoring avancé
HEALTH_CHECK_INTERVAL=30000           # Intervalle health check (ms)
```

### ⚡ Performance et Limites

```env
# Rate limiting
RATE_LIMIT_WINDOW=900000              # Fenêtre rate limit (15min)
RATE_LIMIT_MAX=100                    # Requêtes max par fenêtre
RATE_LIMIT_SKIP_SUCCESSFUL=true       # Ignorer requêtes 2xx

# Upload et fichiers
UPLOAD_MAX_SIZE=10485760              # Taille max upload (10MB)
UPLOAD_ALLOWED_TYPES=.dot,.txt        # Types de fichiers autorisés
UPLOAD_DIRECTORY=./uploads            # Dossier uploads

# Timeouts et limites
REQUEST_TIMEOUT=30000                 # Timeout requêtes (ms)
BODY_SIZE_LIMIT=10mb                  # Taille max body
```

### 🔒 Sécurité et HTTPS

```env
# Configuration HTTPS (production)
HTTPS_ENABLED=false                   # true en production
SSL_CERT_PATH=./ssl/cert.pem          # Chemin certificat
SSL_KEY_PATH=./ssl/key.pem            # Chemin clé privée
SSL_CA_PATH=./ssl/ca.pem              # Chemin CA (optionnel)

# Headers de sécurité
HELMET_ENABLED=true                   # Middleware Helmet
CSRF_ENABLED=false                    # Protection CSRF
XSS_PROTECTION=true                   # Protection XSS
```

### 🎮 WebSocket et Temps Réel

```env
# Configuration Socket.IO
SOCKET_ENABLED=true                   # Activer WebSocket
SOCKET_CORS_ORIGIN=http://localhost:3000  # Origin autorisée
SOCKET_PATH=/socket.io                # Chemin Socket.IO
SOCKET_TRANSPORTS=websocket,polling   # Transports autorisés

# Limites Socket.IO
SOCKET_MAX_CONNECTIONS=1000           # Connexions max
SOCKET_PING_TIMEOUT=5000              # Timeout ping (ms)
SOCKET_PING_INTERVAL=25000            # Intervalle ping (ms)
```

## 🔧 Configuration par Environnement

### 📍 Développement (development)
```env
NODE_ENV=development
LOG_LEVEL=debug
DB_SSL=false
REDIS_PASSWORD=simple-dev-password
SESSION_SECURE=false
CORS_ORIGIN=http://localhost:3000
HTTPS_ENABLED=false
```

### 🚀 Production (production)
```env
NODE_ENV=production
LOG_LEVEL=info
DB_SSL=true
REDIS_PASSWORD=super-secure-production-password
SESSION_SECURE=true
CORS_ORIGIN=https://your-domain.com
HTTPS_ENABLED=true
HELMET_ENABLED=true
MONITORING_ENABLED=true
```

### 🧪 Test (test)
```env
NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/vortexflow_test
REDIS_URL=redis://localhost:6379/1
SESSION_STORE=memory
```

## 📋 Validation Configuration

### 🔍 Script de Validation
```bash
#!/bin/bash
# validate-config.sh

echo "🔍 Validation de la configuration VortexFlow"

# Vérification variables critiques
required_vars=(
    "NODE_ENV"
    "DATABASE_URL"
    "REDIS_URL"
    "SESSION_SECRET"
    "ADMIN_EMAIL"
    "ADMIN_PASSWORD"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Variable manquante: $var"
        exit 1
    else
        echo "✅ $var configuré"
    fi
done

# Validation format EMAIL
if [[ ! "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo "❌ Format email admin invalide"
    exit 1
fi

# Validation force mot de passe
if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
    echo "❌ Mot de passe admin trop faible (minimum 8 caractères)"
    exit 1
fi

echo "✅ Configuration validée avec succès"
```

### 🎯 Configuration Health Check
Le health check intègre automatiquement la validation de configuration :

```http
GET /api/public/health
```

Vérifie :
- ✅ Variables d'environnement critiques
- ✅ Connexion base de données
- ✅ Connexion Redis
- ✅ Services externes (email, monitoring)

## 🛠️ Outils de Configuration

### 📝 Générateur .env
```bash
# generate-env.sh
#!/bin/bash

echo "🔧 Générateur de configuration VortexFlow"

# Génération secrets sécurisés
SESSION_SECRET=$(openssl rand -base64 64)
ADMIN_PASSWORD=$(openssl rand -base64 12)
REDIS_PASSWORD=$(openssl rand -base64 32)

cat > .env << EOF
# Configuration générée automatiquement
NODE_ENV=development
HOST=localhost
PORT=5000

# Base de données
DATABASE_URL=postgresql://vortexflow_user:$REDIS_PASSWORD@localhost:5432/vortexflow

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Sessions
SESSION_SECRET=$SESSION_SECRET

# Admin
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Logging
LOG_LEVEL=info
EOF

echo "✅ Fichier .env généré avec succès"
echo "🔑 Mot de passe admin: $ADMIN_PASSWORD"
```

### 🔧 Migration Configuration
```bash
# migrate-config.sh - Migration d'ancienne configuration
#!/bin/bash

if [ -f ".env.old" ]; then
    echo "📦 Migration de l'ancienne configuration..."
    
    # Sauvegarde valeurs importantes
    OLD_SESSION_SECRET=$(grep SESSION_SECRET .env.old | cut -d '=' -f2)
    OLD_ADMIN_PASSWORD=$(grep ADMIN_PASSWORD .env.old | cut -d '=' -f2)
    
    # Génération nouvelle config avec conservation
    cp .env.template .env
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$OLD_SESSION_SECRET/" .env
    sed -i "s/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$OLD_ADMIN_PASSWORD/" .env
    
    echo "✅ Configuration migrée avec succès"
else
    echo "❌ Aucune ancienne configuration trouvée"
fi
```

## 🚨 Troubleshooting Configuration

### ❌ Problèmes Courants

#### Connexion Base de Données
```bash
# Test connexion PostgreSQL
psql "$DATABASE_URL" -c "SELECT version();"

# Vérification utilisateur et permissions
psql "$DATABASE_URL" -c "\du"
```

#### Connexion Redis
```bash
# Test connexion Redis
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping

# Vérification configuration
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD config get "*"
```

#### Sessions et Cookies
```bash
# Vérification sessions Redis
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD keys "sess:*"

# Debug cookies dans requête
curl -v -c cookies.txt -b cookies.txt http://localhost:5000/api/auth/login
```

---

**⚙️ Cette configuration garantit un backend VortexFlow robuste et sécurisé pour tous les environnements !**

*Guide de configuration VortexFlow v1.0.0 - Dernière mise à jour: 2025-07-07*
