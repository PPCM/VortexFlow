#!/bin/bash

# Resolve project root (parent of scripts/) so the script works from any cwd.
cd "$(dirname "$0")/.."

# Script de démarrage du frontend VortexFlow

# Chargement du fichier .env
if [ -f frontend/.env ]; then
    export $(grep -v '^#' frontend/.env | xargs)
fi

echo "🚀 Démarrage du frontend VortexFlow..."
echo "📍 Application: http://${HOST:-192.168.5.30}:${PORT:-3000}"
echo "🔗 API Backend: ${REACT_APP_API_URL}"
echo "🔌 WebSocket: ${REACT_APP_WS_URL}"

# Démarrage du serveur React
cd frontend && npm start
