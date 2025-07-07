# 🚀 VortexFlow Backend - Guide de Déploiement

**Version:** 1.0.0  
**Status:** ✅ Production Ready  
**Date:** 2025-07-07

## 🎯 Vue d'Ensemble

Ce guide couvre le déploiement complet du backend VortexFlow en environnement de production avec toutes les bonnes pratiques de sécurité et performance.

## 📋 Prérequis

### 🔧 Environnement Système
- **Node.js:** v18+ (recommandé v22.16.0)
- **PostgreSQL:** v13+ (recommandé v15+)
- **Redis:** v6+ (recommandé v7+)
- **RAM:** Minimum 2GB (recommandé 4GB+)
- **Stockage:** Minimum 10GB SSD

### 🌐 Réseau et Sécurité
- **Ports requis:** 5000 (API), 5432 (PostgreSQL), 6379 (Redis)
- **HTTPS:** Certificat SSL/TLS valide
- **Firewall:** Configuration appropriée
- **Load Balancer:** Optionnel pour haute disponibilité

## 🐳 Déploiement Docker (Recommandé)

### 1. Préparation Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  vortexflow-backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@postgres:5432/vortexflow
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: vortexflow
      POSTGRES_USER: vortexflow_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - vortexflow-backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 2. Configuration Nginx
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server vortexflow-backend:5000;
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 3. Déploiement Docker
```bash
# Construction et démarrage
docker-compose up -d --build

# Vérification des services
docker-compose ps
docker-compose logs -f vortexflow-backend

# Health check
curl -s https://your-domain.com/api/public/health | jq
```

## ☁️ Déploiement Cloud

### 🌊 DigitalOcean App Platform
```yaml
# .do/app.yaml
name: vortexflow-backend
services:
- name: backend
  source_dir: /
  github:
    repo: your-username/vortexflow
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  - key: REDIS_URL
    value: ${redis.REDIS_URL}

databases:
- name: db
  engine: PG
  version: "13"

services:
- name: redis
  source_dir: /
  run_command: redis-server
```

### 🚀 Heroku
```bash
# Installation Heroku CLI et connexion
heroku login

# Création application
heroku create vortexflow-backend

# Add-ons
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev

# Variables d'environnement
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET=$(openssl rand -base64 32)

# Déploiement
git push heroku main

# Health check
curl -s https://vortexflow-backend.herokuapp.com/api/public/health
```

### ☁️ AWS EC2
```bash
# Instance t3.medium recommandée
# Ubuntu 22.04 LTS

# Installation Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installation PostgreSQL
sudo apt install postgresql postgresql-contrib

# Installation Redis
sudo apt install redis-server

# Configuration PostgreSQL
sudo -u postgres createuser --createdb vortexflow_user
sudo -u postgres createdb vortexflow

# Configuration Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Déploiement application
git clone https://github.com/your-username/vortexflow.git
cd vortexflow/backend
npm install --production
npm run build

# Service systemd
sudo cp deployment/vortexflow.service /etc/systemd/system/
sudo systemctl enable vortexflow
sudo systemctl start vortexflow
```

## 🔐 Configuration de Sécurité

### 1. Variables d'Environnement Production
```env
# Sécurité critique
NODE_ENV=production
SESSION_SECRET=your-super-secure-random-secret-key-256-bits
JWT_SECRET=another-super-secure-jwt-secret-key

# Base de données sécurisée
DATABASE_URL=postgresql://user:password@localhost:5432/vortexflow
DATABASE_SSL=true

# Redis sécurisé
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=secure-redis-password
REDIS_TLS=true

# HTTPS/SSL
HTTPS_ENABLED=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# Logging et monitoring
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn
MONITORING_ENABLED=true
```

### 2. Sécurisation PostgreSQL
```sql
-- Création utilisateur dédié
CREATE USER vortexflow_user WITH PASSWORD 'secure_password';
CREATE DATABASE vortexflow OWNER vortexflow_user;

-- Permissions minimales
GRANT CONNECT ON DATABASE vortexflow TO vortexflow_user;
GRANT USAGE ON SCHEMA public TO vortexflow_user;
GRANT CREATE ON SCHEMA public TO vortexflow_user;
```

### 3. Sécurisation Redis
```bash
# Configuration Redis sécurisée
echo "requirepass secure-redis-password" >> /etc/redis/redis.conf
echo "bind 127.0.0.1" >> /etc/redis/redis.conf
systemctl restart redis
```

## 📊 Monitoring et Logs

### 1. Health Checks
```bash
# Health check automatisé
#!/bin/bash
HEALTH_URL="https://your-domain.com/api/public/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Backend healthy"
else
    echo "❌ Backend unhealthy - HTTP $RESPONSE"
    # Alertes ici (email, Slack, etc.)
fi
```

### 2. Logs Centralisés
```bash
# Logrotate configuration
sudo nano /etc/logrotate.d/vortexflow

/var/log/vortexflow/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl reload vortexflow
    endscript
}
```

### 3. Métriques avec Prometheus
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'vortexflow-backend'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/system/metrics'
    scrape_interval: 30s
```

## 🔄 CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          rsync -avz --delete ./ user@server:/path/to/app/
          ssh user@server 'cd /path/to/app && npm install && pm2 restart vortexflow'
```

## 🚨 Procédures d'Urgence

### 1. Rollback Rapide
```bash
# Sauvegarde avant déploiement
cp -r /current/app /backup/app-$(date +%Y%m%d-%H%M%S)

# Rollback si problème
cp -r /backup/app-YYYYMMDD-HHMMSS /current/app
systemctl restart vortexflow
```

### 2. Maintenance Mode
```bash
# Activation mode maintenance
export MAINTENANCE_MODE=true
systemctl restart vortexflow

# Désactivation
unset MAINTENANCE_MODE
systemctl restart vortexflow
```

## ✅ Checklist Déploiement

### Pré-déploiement
- [ ] Tests complets passés (8/8)
- [ ] Variables d'environnement configurées
- [ ] Certificats SSL valides
- [ ] Base de données sauvegardée
- [ ] Redis configuré et sécurisé

### Déploiement
- [ ] Application déployée
- [ ] Services démarrés
- [ ] Health checks passés
- [ ] Logs sans erreurs critiques
- [ ] Performance acceptable

### Post-déploiement
- [ ] Monitoring activé
- [ ] Alertes configurées
- [ ] Documentation mise à jour
- [ ] Équipe informée
- [ ] Plan de rollback prêt

---

**🎯 Avec ce guide, VortexFlow Backend est prêt pour un déploiement production robuste et sécurisé !**

*Guide de déploiement VortexFlow v1.0.0 - Dernière mise à jour: 2025-07-07*
