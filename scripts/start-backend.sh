#!/bin/bash

# Resolve project root (parent of scripts/) so the script works from any cwd.
cd "$(dirname "$0")/.."

# Script de démarrage du backend VortexFlow avec configuration IPv4

# Export des variables d'environnement depuis le fichier .env
export NODE_OPTIONS="--dns-result-order=ipv4first"

# Chargement du fichier .env
if [ -f backend/.env ]; then
    export $(grep -v '^#' backend/.env | xargs)
fi

echo "🚀 Démarrage du backend VortexFlow..."
echo "📍 Serveur: http://${HOST:-192.168.5.30}:${PORT:-5000}"
echo "🔧 NODE_OPTIONS: $NODE_OPTIONS"

# Démarrage du serveur
cd backend && node server.js
