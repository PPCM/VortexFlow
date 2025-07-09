#!/bin/bash

# Script de démarrage complet VortexFlow
# Lance le backend et le frontend avec les configurations appropriées

set -e

echo "🌊 Démarrage de VortexFlow..."
echo "=========================================="

# Vérification des prérequis
if [ ! -f "backend/.env" ]; then
    echo "❌ Fichier backend/.env manquant"
    exit 1
fi

if [ ! -f "frontend/.env" ]; then
    echo "❌ Fichier frontend/.env manquant"  
    exit 1
fi

# Arrêt des instances précédentes
echo "🔄 Arrêt des instances précédentes..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
sleep 2

# Démarrage du backend
echo "🚀 Démarrage du backend..."
cd backend
export NODE_OPTIONS="--dns-result-order=ipv4first"
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi
nohup node server.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "⏳ Attente du backend..."
sleep 3

# Vérification du backend
if curl -s "http://${HOST:-192.168.5.30}:5000/api/health" > /dev/null; then
    echo "✅ Backend démarré sur http://${HOST:-192.168.5.30}:5000"
else
    echo "❌ Échec du démarrage du backend"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Démarrage du frontend
echo "🚀 Démarrage du frontend..."
cd frontend
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi
nohup npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "⏳ Attente du frontend..."
sleep 8

# Vérification du frontend
if curl -s "http://${HOST:-192.168.5.30}:3000" > /dev/null; then
    echo "✅ Frontend démarré sur http://${HOST:-192.168.5.30}:3000"
else
    echo "❌ Échec du démarrage du frontend"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 1
fi

echo "=========================================="
echo "🎉 VortexFlow démarré avec succès!"
echo ""
echo "📍 Application: http://${HOST:-192.168.5.30}:3000"
echo "📍 API Backend: http://${HOST:-192.168.5.30}:5000"
echo "🔌 WebSocket: ws://${HOST:-192.168.5.30}:5000"
echo ""
echo "👤 Admin Login:"
echo "   Email: admin@admin.com"
echo "   Password: VortexFlow2024!"
echo ""
echo "📝 Logs disponibles dans:"
echo "   Backend: logs/backend.log"
echo "   Frontend: logs/frontend.log"
echo ""
echo "🛑 Pour arrêter: ./stop-vortexflow.sh"
echo "=========================================="

# Sauvegarde des PIDs pour pouvoir les arrêter plus tard
echo $BACKEND_PID > logs/backend.pid
echo $FRONTEND_PID > logs/frontend.pid
