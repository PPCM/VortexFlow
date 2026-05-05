# VortexFlow - Architecture d'Authentification

## 🔐 Système d'Authentification

VortexFlow utilise un **système de sessions serveur** avec Redis, **pas de JWT**. Cette approche offre plusieurs avantages :

### ✅ **Avantages des Sessions Serveur**

1. **Sécurité renforcée**
   - Sessions stockées côté serveur dans Redis
   - Révocation instantanée possible
   - Pas de token exposé côté client

2. **Gestion simplifiée**
   - Pas de renouvellement de tokens
   - Expiration automatique
   - Nettoyage automatique des sessions expirées

3. **Performance**
   - Redis ultra-rapide pour le stockage des sessions
   - Pas de vérification cryptographique à chaque requête

### 🏗️ **Architecture**

```
Client Browser
     ↓ (Cookie de session)
Express App + express-session
     ↓ (Session ID)
Redis Store
     ↓ (Session data)
{
  userId: 123,
  role: 'editor',
  email: 'user@example.com',
  loginTime: 1625097600000
}
```

### 🔧 **Configuration**

#### Variables d'environnement
```env
# Sessions
SESSION_SECRET=your-super-secret-session-key
SESSION_NAME=vortexflow-session
SESSION_MAX_AGE=86400000  # 24 heures

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Code de configuration
```javascript
// server.js
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: process.env.SESSION_NAME,
  resave: false,
  saveUninitialized: false,
  store: new RedisStore({ client: redisClient }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE)
  }
}));
```

### 🛡️ **Middleware d'Authentification**

#### `requireAuth` - Vérification de connexion
```javascript
const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
```

#### `requireRole` - Vérification de rôle
```javascript
const requireRole = (requiredRole) => (req, res, next) => {
  const userRole = req.session?.user?.role;
  if (!hasPermission(userRole, requiredRole)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
```

### 🚪 **Flux d'Authentification**

#### 1. **Connexion** (`POST /api/auth/login`)
```javascript
// Vérification des identifiants
const user = await User.findOne({ where: { email } });
const validPassword = await bcrypt.compare(password, user.password);

if (validPassword) {
  // Création de la session
  req.session.userId = user.id;
  req.session.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  };
  
  res.json({ user: req.session.user });
}
```

#### 2. **Vérification** (Middleware sur routes protégées)
```javascript
// Chaque requête vérifie automatiquement
if (req.session?.userId) {
  // Utilisateur connecté
} else {
  // Redirection ou erreur 401
}
```

#### 3. **Déconnexion** (`POST /api/auth/logout`)
```javascript
req.session.destroy((err) => {
  if (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
  res.clearCookie(process.env.SESSION_NAME);
  res.json({ message: 'Logged out successfully' });
});
```

### 👥 **Système de Rôles**

#### Hiérarchie des rôles
```
admin > editor > viewer
```

#### Permissions
- **viewer** : Lecture seule des graphiques partagés
- **editor** : Création, modification, partage de graphiques
- **admin** : Gestion des utilisateurs + toutes les permissions

#### Vérification des permissions
```javascript
const roleHierarchy = {
  viewer: 1,
  editor: 2,
  admin: 3
};

function hasPermission(userRole, requiredRole) {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
```

### 🔄 **Gestion des Sessions**

#### Expiration automatique
- Sessions expirées automatiquement après `SESSION_MAX_AGE`
- Nettoyage automatique par Redis TTL

#### Révocation manuelle
```javascript
// Déconnexion forcée d'un utilisateur (admin)
const sessions = await redis.keys('sess:*');
for (const sessionKey of sessions) {
  const sessionData = await redis.get(sessionKey);
  if (sessionData.userId === targetUserId) {
    await redis.del(sessionKey);
  }
}
```

### 🛠️ **Outils de Développement**

#### Vérification des sessions actives
```bash
# Redis CLI
redis-cli
> KEYS sess:*
> GET sess:abc123def456  # Voir le contenu d'une session
```

#### Debug des sessions
```javascript
// Middleware de debug
app.use((req, res, next) => {
  console.log('Session:', req.session);
  next();
});
```

### 🔒 **Sécurité**

#### Mesures de protection
- **HttpOnly cookies** : Pas d'accès JavaScript côté client
- **Secure cookies** : HTTPS uniquement en production
- **SameSite** : Protection CSRF
- **Rotation des secrets** : Recommandée périodiquement

#### Configuration de production
```javascript
cookie: {
  secure: true,           // HTTPS uniquement
  httpOnly: true,         // Pas d'accès JS
  sameSite: 'strict',     // Protection CSRF
  maxAge: 24 * 60 * 60 * 1000  // 24h
}
```

### ❌ **Pourquoi pas JWT ?**

1. **Complexité inutile** pour une application traditionnelle
2. **Révocation difficile** des tokens
3. **Stockage côté client** moins sécurisé
4. **Gestion d'expiration** plus complexe
5. **Sessions serveur** parfaitement adaptées à notre cas d'usage

---

**VortexFlow utilise des sessions serveur avec Redis pour une authentification simple, sécurisée et performante.** 🔐✨
