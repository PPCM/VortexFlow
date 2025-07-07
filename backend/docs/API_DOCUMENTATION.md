# 🚀 VortexFlow Backend - Documentation API REST

**Version:** 1.0.0  
**Base URL:** `http://192.168.5.30:5000`  
**Status:** ✅ Production Ready

## 🎯 Vue d'Ensemble

L'API VortexFlow fournit une interface REST complète pour la gestion de graphiques DOT avec visualisation 3D, authentification multi-rôles et simulation temps réel.

### 🔐 Authentification
- **Type:** Sessions serveur avec cookies
- **Store:** Redis (persistant)
- **Durée:** 24h par défaut
- **Rôles:** viewer, editor, admin

## 📡 Endpoints API

### 🌐 Routes Publiques (Sans Authentification)

#### Health Check
```http
GET /api/public/health
```
**Description:** Status système et services  
**Réponse:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-07T20:40:00.000Z",
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy", "store": "redis" }
  }
}
```

#### Exemples DOT
```http
GET /api/public/dot-examples
```
**Description:** Collection d'exemples de code DOT  
**Réponse:**
```json
{
  "examples": [
    {
      "name": "Simple Graph",
      "description": "Graphique basique avec 3 nœuds",
      "code": "digraph G { A -> B -> C; }"
    }
  ]
}
```

#### Validation DOT
```http
POST /api/public/validate-dot
Content-Type: application/json

{
  "code": "digraph G { A -> B; }"
}
```
**Description:** Validation syntaxe et sémantique DOT  
**Réponse:**
```json
{
  "valid": true,
  "syntax": { "valid": true },
  "semantic": { "valid": true },
  "nodes": ["A", "B"],
  "edges": [{"from": "A", "to": "B"}]
}
```

### 🔐 Authentification

#### Connexion
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@admin.com",
  "password": "VortexFlow2024!"
}
```
**Réponse:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "admin@admin.com",
    "role": "admin",
    "first_name": "Admin"
  }
}
```

#### Déconnexion
```http
POST /api/auth/logout
```

#### Inscription
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

### 👤 Gestion Utilisateurs (Authentification Requise)

#### Profil Utilisateur
```http
GET /api/users/profile
Cookie: connect.sid=...
```
**Réponse:**
```json
{
  "id": "uuid",
  "email": "admin@admin.com",
  "role": "admin",
  "first_name": "Admin",
  "last_name": "User",
  "last_login": "2025-07-07T20:30:00.000Z"
}
```

#### Mise à Jour Profil
```http
PUT /api/users/profile
Content-Type: application/json

{
  "first_name": "John Updated",
  "preferences": {"theme": "dark"}
}
```

#### Liste Utilisateurs (Admin uniquement)
```http
GET /api/users
```

### 📊 Gestion Graphiques (Authentification Requise)

#### Liste Graphiques
```http
GET /api/graphs
```
**Paramètres optionnels:**
- `page` (int): Page (défaut: 1)
- `limit` (int): Limite par page (défaut: 20)
- `search` (string): Recherche dans titre/description

**Réponse:**
```json
{
  "graphs": [
    {
      "id": "uuid",
      "title": "Mon Graphique",
      "description": "Description du graphique",
      "dot_code": "digraph G { A -> B; }",
      "is_public": false,
      "created_by": "uuid",
      "createdAt": "2025-07-07T20:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

#### Créer Graphique
```http
POST /api/graphs
Content-Type: application/json

{
  "title": "Nouveau Graphique",
  "description": "Description optionnelle",
  "dot_code": "digraph G { A -> B -> C; }",
  "is_public": false
}
```

#### Détails Graphique
```http
GET /api/graphs/:id
```

#### Modifier Graphique
```http
PUT /api/graphs/:id
Content-Type: application/json

{
  "title": "Titre Modifié",
  "dot_code": "digraph G { A -> B -> C -> D; }"
}
```

#### Supprimer Graphique
```http
DELETE /api/graphs/:id
```

### 🎮 Simulation (Authentification Requise)

#### Sessions Simulation
```http
GET /api/simulation/sessions
```

#### Démarrer Simulation
```http
POST /api/simulation/start
Content-Type: application/json

{
  "graph_id": "uuid",
  "settings": {
    "speed": 1.0,
    "particle_count": 100
  }
}
```

#### Arrêter Simulation
```http
POST /api/simulation/stop
Content-Type: application/json

{
  "session_id": "uuid"
}
```

### 📁 Import/Export (Authentification Requise)

#### Upload Fichier DOT
```http
POST /api/import-export/upload
Content-Type: multipart/form-data

Form Data:
- file: fichier.dot
- title: "Titre du graphique"
```

#### Export Graphique
```http
GET /api/import-export/download/:id
```
**Paramètres:**
- `format`: dot, png, svg (défaut: dot)

### ⚙️ Système (Admin Uniquement)

#### Métriques Système
```http
GET /api/system/metrics
```
**Réponse:**
```json
{
  "server": {
    "uptime": 3600,
    "memory": {"used": "150MB", "total": "8GB"},
    "cpu": {"usage": "15%"}
  },
  "database": {
    "connections": 5,
    "queries_per_second": 2.5
  },
  "redis": {
    "connected_clients": 3,
    "memory_usage": "1.2MB"
  }
}
```

#### Logs Application
```http
GET /api/system/logs
```
**Paramètres:**
- `level`: debug, info, warn, error
- `limit`: nombre de logs (défaut: 100)

## 🔧 Codes d'Erreur

### Status HTTP Standards
- **200** - OK
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Internal Server Error

### Format d'Erreur
```json
{
  "error": true,
  "message": "Description de l'erreur",
  "code": "ERROR_CODE",
  "details": {}
}
```

## 🧪 Tests et Validation

### Commandes de Test
```bash
# Suite complète de tests
./run-final-tests.sh

# Test sanité rapide
curl -s http://192.168.5.30:5000/api/public/health | jq
```

### Outils de Debug
```bash
# Connexion avec session
curl -X POST http://192.168.5.30:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"VortexFlow2024!"}' \
  -c cookies.txt

# Test endpoint protégé
curl -s http://192.168.5.30:5000/api/users/profile \
  -b cookies.txt | jq
```

## 🚀 Intégration Frontend

### Headers Recommandés
```javascript
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

### Gestion des Sessions
```javascript
// Axios configuration pour cookies
axios.defaults.withCredentials = true;

// Fetch configuration
fetch('/api/endpoint', {
  credentials: 'include'
});
```

---

**📋 Cette documentation est maintenue à jour avec l'état actuel de l'API.**

*VortexFlow Backend API v1.0.0 - Dernière mise à jour: 2025-07-07*
