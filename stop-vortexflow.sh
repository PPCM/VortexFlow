#!/bin/bash

# Script d'arrêt VortexFlow

echo "🛑 Arrêt de VortexFlow..."

# Arrêt via PIDs sauvegardés
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    kill $BACKEND_PID 2>/dev/null && echo "✅ Backend arrêté (PID: $BACKEND_PID)" || echo "⚠️  Backend déjà arrêté"
    rm -f logs/backend.pid
fi

if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    kill $FRONTEND_PID 2>/dev/null && echo "✅ Frontend arrêté (PID: $FRONTEND_PID)" || echo "⚠️  Frontend déjà arrêté"
    rm -f logs/frontend.pid
fi

# Arrêt brutal si nécessaire
pkill -f "node server.js" 2>/dev/null && echo "🔧 Nettoyage processus backend" || true
pkill -f "react-scripts start" 2>/dev/null && echo "🔧 Nettoyage processus frontend" || true

echo "🏁 VortexFlow arrêté"
