# IMPORTANT: Recréer les fichiers .env après git clone

# Dans le répertoire racine:
cp .env.example .env
# Configurer: DATABASE_URL, REDIS_URL, SESSION_SECRET, etc.

# Dans backend/:
cp .env.example .env  
# Configurer: PORT, DATABASE_URL, REDIS_*, SESSION_*, etc.

# Puis installer les dépendances:
cd backend && npm install

