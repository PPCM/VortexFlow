# VortexFlow - Guide de Déploiement et Configuration

## 🚀 Démarrage Rapide

```bash
# Démarrage complet de l'application
./start-vortexflow.sh

# Arrêt de l'application
./stop-vortexflow.sh
```

## 📋 Prérequis

- Node.js v18+ 
- PostgreSQL
- Redis
- npm ou yarn

## 🔧 Configuration

### Variables d'Environnement

#### Backend (`backend/.env`)
```bash
# Configuration Serveur
NODE_ENV=development
PORT=5000
HOST=192.168.5.30
NODE_OPTIONS=--dns-result-order=ipv4first  # Important pour IPv4

# Base de Données
DATABASE_URL=postgresql://user:password@host:5432/vortexflow
DB_HOST=DESKTOP-43H5NAN
DB_PORT=5432
DB_NAME=vortexflow
DB_USER=vortexflow_user
DB_PASSWORD=vortexflow_password

# Redis
REDIS_URL=redis://host:6379
REDIS_HOST=DESKTOP-43H5NAN
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Session & Sécurité
SESSION_SECRET=your-super-secret-session-key
BCRYPT_SALT_ROUNDS=12

# Admin par défaut
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=VortexFlow2024!

# Frontend URL
FRONTEND_URL=http://192.168.5.30:3000
```

#### Frontend (`frontend/.env`)
```bash
# Configuration Serveur
PORT=3000
HOST=192.168.5.30

# API Backend
REACT_APP_API_URL=http://192.168.5.30:5000/api
REACT_APP_WS_URL=ws://192.168.5.30:5000
```

## 🔥 Résolution du Problème IPv6/IPv4

**Problème**: Node.js se lie par défaut à IPv6 (`::1`) au lieu d'IPv4.

**Solutions implémentées**:

1. **Variable d'environnement dans `.env`**:
   ```bash
   NODE_OPTIONS=--dns-result-order=ipv4first
   ```

2. **Scripts npm avec dotenv** (`backend/package.json`):
   ```json
   {
     "scripts": {
       "start": "node server.js",
       "start:env": "node -r dotenv/config server.js",
       "dev:env": "nodemon -r dotenv/config server.js"
     }
   }
   ```

3. **Scripts shell automatisés**:
   - `start-backend.sh`: Export NODE_OPTIONS + variables .env
   - `start-vortexflow.sh`: Démarrage complet automatisé

## 📡 Architecture Réseau

```
Frontend (React)     Backend (Node.js)     Services
    :3000         →       :5000         →  PostgreSQL :5432
192.168.5.30            192.168.5.30        Redis :6379
                          ↕️
                    WebSocket :5000
```

## 🔒 Authentification

- **Admin par défaut**: `admin@admin.com` / `VortexFlow2024!`
- **Sessions**: Redis avec cookies sécurisés
- **Middleware**: `validateSession` pour routes protégées

## 🌐 WebSocket Integration

- **URL**: `ws://192.168.5.30:5000`
- **Events**: `start_simulation`, `stop_simulation`, `pause_simulation`
- **CORS**: Configuré pour `192.168.5.30:3000`

## 📊 Dashboard Stats API

```javascript
GET /api/dashboard/stats
Response: {
  totalGraphs: number,
  activeSimulations: number,
  totalUsers: number,
  recentActivity: Array
}
```

## 🛠️ Scripts de Gestion

```bash
# Démarrage manuel backend
cd backend && NODE_OPTIONS="--dns-result-order=ipv4first" node server.js

# Démarrage manuel frontend  
cd frontend && npm start

# Démarrage avec variables .env
cd backend && npm run start:env
cd frontend && npm start

# Démarrage automatisé (recommandé)
./start-vortexflow.sh
./stop-vortexflow.sh
```

## 🔍 Diagnostic

```bash
# Vérification backend
curl http://192.168.5.30:5000/api/health

# Vérification frontend
curl http://192.168.5.30:3000

# Logs en temps réel
tail -f logs/backend.log
tail -f logs/frontend.log

# Processus actifs
ps aux | grep "node server.js"
ps aux | grep "react-scripts"
```

## 📝 Résumé des Corrections

✅ **Binding IPv4**: `NODE_OPTIONS="--dns-result-order=ipv4first"`  
✅ **Middleware Auth**: `requireAuth` → `validateSession`  
✅ **API Signatures**: Types TypeScript corrigés  
✅ **CORS Configuration**: Support `192.168.5.30:3000`  
✅ **Scripts Automatisés**: Démarrage/arrêt simplifié  
✅ **Variables d'Environnement**: Configuration centralisée dans `.env`

## 🎯 URLs de Production

- **Application**: http://192.168.5.30:3000
- **API Backend**: http://192.168.5.30:5000/api  
- **WebSocket**: ws://192.168.5.30:5000
- **Health Check**: http://192.168.5.30:5000/api/health
