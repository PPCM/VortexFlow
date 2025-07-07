# VortexFlow Backend

## 🌊 Vue d'ensemble

VortexFlow Backend est une API REST robuste conçue pour gérer la visualisation 3D et la simulation de graphiques DOT avec flux de données animées. Cette application backend offre une architecture modulaire, sécurisée et performante pour la gestion des ressources graphiques, des rôles utilisateurs, des sessions de simulation et du contrôle en temps réel.

## 🚀 Fonctionnalités Principales

### 🔐 Authentification et Autorisation
- **Système multi-rôles** : `viewer`, `editor`, `admin`
- **Sessions serveur sécurisées** avec Redis et express-session (pas de JWT)
- **Chiffrement** des mots de passe avec bcrypt
- **Contrôle d'accès** basé sur les rôles (RBAC)
- **Gestion des sessions** avec expiration automatique

### 📊 Gestion des Graphiques
- **CRUD complet** pour les graphiques DOT
- **Système de versions** avec historique des modifications
- **Partage sécurisé** entre utilisateurs avec niveaux de permission
- **Validation syntaxique** DOT avec extensions VortexFlow
- **Import/Export** en formats DOT et JSON
- **Templates prédéfinis** pour différents types de graphiques

### 🎮 Simulation en Temps Réel
- **Sessions de simulation** avec configurations personnalisées
- **WebSocket** pour contrôle et monitoring en temps réel
- **Moteur de simulation** avec particules et métriques
- **États de session** : running, paused, completed, failed
- **Diffusion d'événements** aux clients connectés

### 👥 Gestion des Utilisateurs (Admin)
- **Interface d'administration** complète
- **Gestion des rôles** et statuts utilisateurs
- **Statistiques** et rapports d'activité
- **Réinitialisation** des mots de passe
- **Audit et logging** des actions

### 📧 Service Email
- **Notifications automatiques** : bienvenue, partage, simulation
- **Templates HTML** responsive et professionnels
- **Configuration SMTP** flexible
- **Gestion des erreurs** et retry logic

### 🔧 Administration Système
- **Health checks** et monitoring
- **Métriques système** et statistiques d'usage
- **Logs centralisés** avec Winston
- **Nettoyage automatique** des données anciennes
- **Tests de configuration** email et services

### 📁 Gestion des Fichiers
- **Upload sécurisé** avec validation de types
- **Nettoyage automatique** des fichiers temporaires
- **Export ZIP** pour graphiques multiples
- **Gestion des quotas** et limites de taille

## 🏗️ Architecture

### Structure des Dossiers
```
backend/
├── src/
│   ├── models/           # Modèles Sequelize (PostgreSQL)
│   ├── routes/           # Routes API RESTful
│   ├── middleware/       # Middlewares (auth, validation, erreurs)
│   ├── utils/           # Utilitaires (logger, validator, setup)
│   ├── services/        # Services (email, etc.)
│   └── websocket/       # Gestionnaires WebSocket
├── uploads/             # Stockage des fichiers uploadés
├── logs/               # Logs de l'application
└── tests/              # Tests unitaires et d'intégration
```

### API Endpoints

#### Authentification (`/api/auth`)
- `POST /register` - Inscription utilisateur
- `POST /login` - Connexion
- `POST /logout` - Déconnexion
- `GET /me` - Profil utilisateur
- `PUT /profile` - Mise à jour profil

#### Graphiques (`/api/graphs`)
- `GET /` - Liste des graphiques (avec filtres, pagination)
- `GET /:id` - Détails d'un graphique
- `POST /` - Création d'un graphique
- `PUT /:id` - Mise à jour d'un graphique
- `DELETE /:id` - Suppression d'un graphique
- `GET /:id/versions` - Versions d'un graphique
- `POST /:id/restore/:version` - Restaurer une version
- `POST /:id/share` - Partager un graphique
- `DELETE /:id/shares/:shareId` - Révoquer un partage
- `POST /:id/duplicate` - Dupliquer un graphique
- `POST /validate-dot` - Valider code DOT
- `GET /dot-examples` - Exemples de code DOT

#### Utilisateurs (`/api/users`) - Admin uniquement
- `GET /` - Liste des utilisateurs
- `GET /:id` - Détails utilisateur
- `PUT /:id/role` - Modifier rôle
- `PUT /:id/status` - Modifier statut
- `DELETE /:id` - Supprimer utilisateur
- `POST /:id/reset-password` - Réinitialiser mot de passe
- `GET /:id/activity` - Activité utilisateur
- `GET /dashboard` - Statistiques dashboard

#### Simulations (`/api/simulation`)
- `GET /sessions` - Sessions de simulation
- `GET /sessions/:id` - Détails session
- `POST /start` - Démarrer simulation
- `POST /:id/stop` - Arrêter simulation
- `POST /:id/pause` - Mettre en pause
- `POST /:id/resume` - Reprendre
- `PUT /:id/config` - Modifier configuration
- `DELETE /:id` - Supprimer session
- `GET /templates` - Templates de simulation
- `POST /validate-config` - Valider configuration

#### Import/Export (`/api/import-export`)
- `POST /import-dot` - Importer fichier DOT
- `POST /import-json` - Importer export JSON
- `GET /export/:id` - Exporter graphique
- `POST /export-multiple` - Exporter plusieurs graphiques (ZIP)

#### Système (`/api/system`) - Admin uniquement
- `GET /health` - Health check
- `GET /stats` - Statistiques système
- `GET /logs` - Logs récents
- `POST /cleanup` - Nettoyage données
- `GET /info` - Informations système
- `POST /test-email` - Test configuration email
- `GET /metrics` - Métriques monitoring

### WebSocket Events

#### Simulation en temps réel
- `join_simulation` - Rejoindre session de simulation
- `leave_simulation` - Quitter session
- `start_simulation` - Démarrer simulation
- `stop_simulation` - Arrêter simulation
- `pause_simulation` - Mettre en pause
- `resume_simulation` - Reprendre
- `update_config` - Modifier configuration

#### Events diffusés
- `simulation_started` - Simulation démarrée
- `simulation_stopped` - Simulation arrêtée
- `simulation_paused` - Simulation en pause
- `simulation_resumed` - Simulation reprise
- `simulation_update` - Mise à jour état
- `simulation_error` - Erreur simulation
- `config_updated` - Configuration modifiée

## 🛠️ Technologies

- **Runtime** : Node.js 18+
- **Framework** : Express.js
- **Base de données** : PostgreSQL avec Sequelize ORM
- **Cache/Sessions** : Redis
- **WebSocket** : Socket.IO
- **Validation** : express-validator, Joi
- **Sécurité** : Helmet, CORS, rate limiting
- **Logging** : Winston
- **Email** : Nodemailer
- **Upload** : Multer
- **Tests** : Jest, Supertest

## 📦 Installation

1. **Cloner le repository**
```bash
git clone <repository-url>
cd VortexFlow/backend
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration environnement**
```bash
cp .env.example .env
# Modifier les variables d'environnement
```

4. **Base de données**
```bash
npm run setup-db
npm run migrate
npm run seed  # Optionnel : données de test
```

5. **Démarrage**
```bash
npm run dev  # Développement
npm start    # Production
```

## ⚙️ Configuration

### Variables d'environnement principales

```env
# Serveur
NODE_ENV=development
PORT=5000
HOST=localhost
FRONTEND_URL=http://localhost:3000

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vortexflow
DB_USER=postgres
DB_PASS=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Sessions
SESSION_SECRET=your-super-secret-key
SESSION_MAX_AGE=86400000

# Admin par défaut
ADMIN_EMAIL=admin@admin.com
ADMIN_PASS=admin123

# JWT (si utilisé)
JWT_SECRET=jwt-secret-key
JWT_EXPIRES_IN=7d

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@vortexflow.com

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Uploads
MAX_FILE_SIZE=10485760
MAX_GRAPHS_PER_USER=100
```

## 🧪 Tests

```bash
npm test              # Tests unitaires
npm run test:watch    # Mode watch
npm run test:integration  # Tests d'intégration
```

## 📝 Logging

Les logs sont organisés par niveaux :
- **error** : Erreurs critiques
- **warn** : Avertissements
- **info** : Informations générales
- **debug** : Debug détaillé

Fichiers de logs :
- `logs/error.log` - Erreurs uniquement
- `logs/combined.log` - Tous les logs
- Console - Développement

## 🔒 Sécurité

- **Validation** stricte des entrées utilisateur
- **Sanitization** des données
- **Rate limiting** par IP
- **Helmet** pour sécuriser les headers
- **CORS** configuré
- **Sessions** sécurisées avec Redis
- **Chiffrement** des mots de passe
- **Audit logging** des actions sensibles

## 🚀 Déploiement

### Docker
```bash
docker build -t vortexflow-backend .
docker run -p 5000:5000 vortexflow-backend
```

### Production
1. Configurer les variables d'environnement de production
2. Installer PM2 pour la gestion des processus
3. Configurer nginx comme reverse proxy
4. Mettre en place SSL/TLS
5. Configurer le monitoring et alertes

## 📊 Monitoring

L'API expose plusieurs endpoints pour le monitoring :
- `/api/system/health` - Health check
- `/api/system/metrics` - Métriques système
- `/api/system/stats` - Statistiques d'usage

Intégrations recommandées :
- **Prometheus** pour les métriques
- **Grafana** pour les dashboards
- **Sentry** pour le tracking d'erreurs

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🏆 Résumé des Fonctionnalités Développées

✅ **API REST complète** avec 40+ endpoints  
✅ **Authentification multi-rôles** sécurisée  
✅ **Gestion complète des graphiques** DOT  
✅ **Système de versions** et partage  
✅ **Validation syntaxique** DOT avancée  
✅ **Import/Export** multi-formats  
✅ **Simulations temps réel** avec WebSocket  
✅ **Administration système** complète  
✅ **Service email** avec templates  
✅ **Gestion des fichiers** sécurisée  
✅ **Monitoring et métriques**  
✅ **Logs centralisés**  
✅ **Tests et documentation**  

## 📚 Documentation Complète

**Toute la documentation détaillée est disponible dans le dossier [`docs/`](./docs/)**

### 📋 Guides Disponibles
- **[📖 Index Documentation](./docs/README.md)** - Vue d'ensemble complète
- **[🚀 API Documentation](./docs/API_DOCUMENTATION.md)** - Référence API REST complète
- **[🔐 Authentication Guide](./docs/AUTHENTICATION.md)** - Authentification et sessions
- **[⚙️ Configuration Guide](./docs/CONFIGURATION.md)** - Variables d'environnement
- **[🐳 Deployment Guide](./docs/DEPLOYMENT.md)** - Déploiement production
- **[💻 Development Guide](./docs/DEVELOPMENT.md)** - Guide de développement
- **[🧪 Test Reports](./docs/TEST_REPORT.md)** - Rapports de validation
- **[🔧 Toolkit Summary](./docs/TOOLKIT_SUMMARY.md)** - Outils et scripts

### 🎯 Démarrage Rapide
```bash
# Consultation de la documentation
cd docs/
ls -la  # Voir tous les guides disponibles

# Démarrage rapide avec validation
./start-validated.sh

# Tests automatisés
./run-final-tests.sh
```

## 🎯 Prochaines Étapes

- **Frontend React** : Interface utilisateur moderne avec Three.js
- **Docker** : Containerisation pour déploiement simplifié
- **Tests unitaires** : Couverture de code avec Jest
- **Monitoring** : Métriques avancées avec Prometheus
- **CI/CD** : Pipeline automatisé avec GitHub Actions

---

**🌊 VortexFlow Backend est maintenant prêt pour la production et l'intégration frontend !**  
**📚 Consultez la documentation complète dans le dossier [`docs/`](./docs/) pour tous les détails.**
