#!/bin/bash

# VortexFlow Backend - Validation Redis
# Script de validation de l'intégration Redis

echo "🔍 VortexFlow Backend - Validation Redis"
echo "========================================"
echo ""

# Load environment variables
source .env 2>/dev/null || {
    echo "❌ Fichier .env introuvable"
    exit 1
}

echo "📋 Configuration Redis détectée:"
echo "   Host: ${REDIS_HOST}"
echo "   Port: ${REDIS_PORT}"
echo "   URL: ${REDIS_URL}"
echo ""

# Test Redis connectivity
echo "🔌 Test de connectivité Redis..."
if redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1; then
    echo "✅ Redis accessible et répond au ping"
else
    echo "❌ Redis inaccessible - Vérifiez la configuration"
    exit 1
fi

# Test Redis authentication
echo "🔐 Test d'authentification Redis..."
AUTH_RESULT=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" auth "${REDIS_PASSWORD}" 2>/dev/null)
if [[ "$AUTH_RESULT" == "OK" ]]; then
    echo "✅ Authentification Redis réussie"
else
    echo "❌ Authentification Redis échouée"
    exit 1
fi

# Check Redis memory info
echo "📊 Informations Redis..."
REDIS_INFO=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" info memory 2>/dev/null | grep used_memory_human)
if [ ! -z "$REDIS_INFO" ]; then
    echo "✅ $REDIS_INFO"
else
    echo "⚠️  Impossible de récupérer les infos mémoire Redis"
fi

# Test session storage
echo "🗄️  Test de stockage des sessions..."
SESSION_COUNT=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" keys "sess:*" 2>/dev/null | wc -l)
echo "✅ Sessions actives détectées: $SESSION_COUNT"

# Test Redis commands
echo "⚡ Test des commandes Redis..."
redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" set "test:vortexflow" "redis-ok" > /dev/null 2>&1
TEST_VALUE=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" get "test:vortexflow" 2>/dev/null)
redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" del "test:vortexflow" > /dev/null 2>&1

if [[ "$TEST_VALUE" == "redis-ok" ]]; then
    echo "✅ Commandes SET/GET/DEL fonctionnelles"
else
    echo "❌ Problème avec les commandes Redis de base"
    exit 1
fi

echo ""
echo "🎯 Test du serveur VortexFlow avec Redis..."

# Check if server is running
SERVER_URL="http://${HOST:-localhost}:${PORT:-5000}"
if curl -s "$SERVER_URL/api/public/health" > /dev/null 2>&1; then
    echo "✅ Serveur VortexFlow accessible"
    
    # Check Redis status in health endpoint
    REDIS_STATUS=$(curl -s "$SERVER_URL/api/public/health" | jq -r '.services.redis.status' 2>/dev/null)
    if [[ "$REDIS_STATUS" == "healthy" ]]; then
        echo "✅ Status Redis dans health check: healthy"
        
        REDIS_STORE=$(curl -s "$SERVER_URL/api/public/health" | jq -r '.services.redis.store' 2>/dev/null)
        if [[ "$REDIS_STORE" == "redis" ]]; then
            echo "✅ RedisStore activé pour les sessions"
        else
            echo "⚠️  RedisStore non détecté dans health check"
        fi
    else
        echo "❌ Status Redis dans health check: $REDIS_STATUS"
    fi
else
    echo "⚠️  Serveur VortexFlow non accessible - Démarrez le serveur pour validation complète"
fi

echo ""
echo "🔧 Outils de debugging Redis disponibles:"
echo "   - Connexion directe: redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -a ***"
echo "   - Monitoring: redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -a *** monitor"
echo "   - Sessions: redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -a *** keys 'sess:*'"
echo "   - Infos: redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -a *** info"
echo ""

echo "✅ VALIDATION REDIS TERMINÉE"
echo "🎉 Redis est opérationnel et prêt pour VortexFlow"
echo ""
