# 💻 VortexFlow Backend - Guide de Développement

**Version:** 1.0.0  
**Status:** ✅ Production Ready  
**Date:** 2025-07-07

## 🎯 Vue d'Ensemble

Guide complet pour contribuer au développement du backend VortexFlow, incluant l'architecture, les standards de code, les tests et les bonnes pratiques.

## 🏗️ Architecture du Projet

### 📁 Structure des Dossiers
```
backend/
├── src/                          # Code source principal
│   ├── controllers/              # Contrôleurs de routes
│   ├── middleware/               # Middleware personnalisés
│   ├── models/                   # Modèles Sequelize
│   ├── routes/                   # Définition des routes
│   ├── services/                 # Services métier
│   ├── utils/                    # Utilitaires et helpers
│   └── validators/               # Validateurs express-validator
├── docs/                         # Documentation complète
├── scripts/                      # Scripts d'automatisation
├── logs/                         # Fichiers de logs
├── uploads/                      # Fichiers uploadés
├── server.js                     # Point d'entrée principal
├── package.json                  # Dépendances et scripts
└── .env                         # Variables d'environnement
```

### 🔧 Technologies Principales
- **Runtime:** Node.js v22.16.0
- **Framework:** Express.js
- **ORM:** Sequelize (PostgreSQL)
- **Cache:** Redis + RedisStore
- **WebSocket:** Socket.IO
- **Validation:** express-validator
- **Logging:** Winston
- **Tests:** Bash scripts + curl (Jest recommandé)

## 🚀 Installation et Démarrage

### 1. Prérequis
```bash
# Node.js v18+
node --version

# PostgreSQL en cours d'exécution
pg_isready

# Redis en cours d'exécution
redis-cli ping
```

### 2. Installation
```bash
# Clone du projet
git clone https://github.com/your-username/vortexflow.git
cd vortexflow/backend

# Installation des dépendances
npm install

# Configuration environnement
cp .env.example .env
# Éditer .env avec vos paramètres
```

### 3. Base de Données
```bash
# Création base de données PostgreSQL
createdb vortexflow

# Migration et seeds (si disponibles)
npm run db:migrate
npm run db:seed
```

### 4. Démarrage Développement
```bash
# Démarrage avec validation
./start-validated.sh

# Ou démarrage simple
npm run dev

# Ou avec nodemon
npx nodemon server.js
```

## 🧪 Tests et Validation

### Tests Automatisés
```bash
# Suite de tests complète
./run-final-tests.sh

# Tests spécifiques
curl -s http://localhost:5000/api/public/health | jq

# Validation Redis
./validate-redis.sh
```

### Tests Manuels avec Postman/Insomnia
```json
{
  "name": "VortexFlow API Tests",
  "requests": [
    {
      "name": "Health Check",
      "method": "GET",
      "url": "http://localhost:5000/api/public/health"
    },
    {
      "name": "Login Admin",
      "method": "POST",
      "url": "http://localhost:5000/api/auth/login",
      "body": {
        "email": "admin@admin.com",
        "password": "VortexFlow2024!"
      }
    }
  ]
}
```

## 📋 Standards de Développement

### 🎨 Style de Code
```javascript
// Utilisation d'async/await
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware pattern
const validateSession = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Service pattern
class GraphService {
  static async createGraph(userId, graphData) {
    const graph = await Graph.create({
      ...graphData,
      created_by: userId
    });
    return graph;
  }
}
```

### 🔍 Gestion d'Erreurs
```javascript
// Wrapper async pour gestion automatique d'erreurs
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware d'erreur global
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
    
  res.status(status).json({
    error: true,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};
```

### 📊 Logging
```javascript
// Utilisation du logger Winston
const { logger } = require('./src/utils/logger');

// Différents niveaux de logs
logger.error('Critical error occurred', { error, userId, action });
logger.warn('Warning condition detected', { condition, context });
logger.info('User action completed', { userId, action, duration });
logger.debug('Debug information', { data, state });

// Logs structurés
logger.info('API Request', {
  method: req.method,
  url: req.url,
  userId: req.session?.userId,
  ip: req.ip,
  userAgent: req.get('User-Agent')
});
```

## 🔧 Ajout de Nouvelles Fonctionnalités

### 1. Création d'un Nouveau Endpoint

#### Étape 1: Modèle (si nécessaire)
```javascript
// src/models/NewModel.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NewModel = sequelize.define('NewModel', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    }
  });

  return NewModel;
};
```

#### Étape 2: Contrôleur
```javascript
// src/controllers/newController.js
const { NewModel } = require('../models');
const { logger } = require('../utils/logger');
const asyncHandler = require('../middleware/asyncHandler');

const newController = {
  // GET /api/new
  getAll: asyncHandler(async (req, res) => {
    const items = await NewModel.findAll();
    res.json({ items });
  }),

  // POST /api/new
  create: asyncHandler(async (req, res) => {
    const item = await NewModel.create(req.body);
    logger.info('New item created', { itemId: item.id, userId: req.session.userId });
    res.status(201).json(item);
  })
};

module.exports = newController;
```

#### Étape 3: Validation
```javascript
// src/validators/newValidator.js
const { body } = require('express-validator');

const newValidator = {
  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be between 1 and 255 characters')
  ]
};

module.exports = newValidator;
```

#### Étape 4: Routes
```javascript
// src/routes/new.js
const express = require('express');
const router = express.Router();
const newController = require('../controllers/newController');
const newValidator = require('../validators/newValidator');
const { validateSession } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

// Routes protégées
router.use(validateSession);

router.get('/', newController.getAll);
router.post('/', newValidator.create, handleValidationErrors, newController.create);

module.exports = router;
```

#### Étape 5: Intégration dans server.js
```javascript
// server.js
const newRoutes = require('./src/routes/new');
app.use('/api/new', newRoutes);
```

### 2. Ajout d'un Middleware

```javascript
// src/middleware/customMiddleware.js
const customMiddleware = (options = {}) => {
  return (req, res, next) => {
    // Logique du middleware
    req.customData = options.data;
    next();
  };
};

module.exports = customMiddleware;
```

### 3. Création d'un Service

```javascript
// src/services/customService.js
const { logger } = require('../utils/logger');

class CustomService {
  static async processData(data) {
    try {
      // Logique métier
      const processed = await this.complexOperation(data);
      logger.info('Data processed successfully', { dataId: data.id });
      return processed;
    } catch (error) {
      logger.error('Error processing data', { error, dataId: data.id });
      throw error;
    }
  }

  static async complexOperation(data) {
    // Implémentation complexe
    return data;
  }
}

module.exports = CustomService;
```

## 🔍 Debugging et Profiling

### Debug avec VSCode
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug VortexFlow Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "node"
    }
  ]
}
```

### Profiling Performance
```javascript
// Middleware de profiling
const profilingMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) { // Log requêtes lentes
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`
      });
    }
  });
  
  next();
};
```

### Monitoring Mémoire
```javascript
// Monitoring mémoire périodique
setInterval(() => {
  const memUsage = process.memoryUsage();
  logger.debug('Memory usage', {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  });
}, 60000); // Chaque minute
```

## 📚 Ressources et Documentation

### 🔗 Liens Utiles
- **Express.js:** https://expressjs.com/
- **Sequelize:** https://sequelize.org/
- **Redis:** https://redis.io/documentation
- **Socket.IO:** https://socket.io/docs/
- **Winston:** https://github.com/winstonjs/winston

### 📖 Documentation Interne
- `docs/API_DOCUMENTATION.md` - Documentation API complète
- `docs/AUTHENTICATION.md` - Guide d'authentification
- `docs/DEPLOYMENT.md` - Guide de déploiement
- `docs/CONFIGURATION.md` - Configuration détaillée

### 🛠️ Scripts Utiles
```bash
# Développement
npm run dev                    # Démarrage développement
npm run test                   # Tests automatisés
npm run lint                   # Linting du code
npm run format                 # Formatage du code

# Base de données
npm run db:migrate            # Migrations
npm run db:seed              # Seeds
npm run db:reset             # Reset complet

# Production
npm run build                # Build production
npm run start                # Démarrage production
```

## 🤝 Contribution

### Workflow Git
```bash
# Branche de fonctionnalité
git checkout -b feature/new-feature
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Pull request et merge
```

### Standards de Commit
```
feat: nouvelle fonctionnalité
fix: correction de bug
docs: documentation
style: formatage, pas de changement de code
refactor: refactoring sans changement de fonctionnalité
test: ajout ou modification de tests
chore: tâches de maintenance
```

### Checklist avant Commit
- [ ] Code testé localement
- [ ] Tests automatisés passent
- [ ] Documentation mise à jour
- [ ] Logs appropriés ajoutés
- [ ] Variables sensibles protégées
- [ ] Performance acceptable

---

**💻 Avec ce guide, vous êtes prêt à contribuer efficacement au développement de VortexFlow Backend !**

*Guide de développement VortexFlow v1.0.0 - Dernière mise à jour: 2025-07-07*
