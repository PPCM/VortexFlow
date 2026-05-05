#!/bin/bash

# Resolve project root (parent of scripts/) so the script works from any cwd.
cd "$(dirname "$0")/.."

# Commandes de développement VortexFlow

case "$1" in
    "start")
        echo "🚀 Démarrage VortexFlow..."
        ./start-vortexflow.sh
        ;;
    "stop")
        echo "🛑 Arrêt VortexFlow..."
        ./stop-vortexflow.sh
        ;;
    "restart")
        echo "🔄 Redémarrage VortexFlow..."
        ./stop-vortexflow.sh
        sleep 2
        ./start-vortexflow.sh
        ;;
    "status")
        echo "📊 Statut VortexFlow:"
        echo "Backend Health:"
        curl -s http://192.168.5.30:5000/api/health | jq . 2>/dev/null || curl -s http://192.168.5.30:5000/api/health
        echo -e "\nFrontend:"
        curl -s -I http://192.168.5.30:3000 | head -1
        echo -e "\nProcessus actifs:"
        ps aux | grep -E "(node server.js|react-scripts)" | grep -v grep
        ;;
    "logs")
        case "$2" in
            "backend"|"be")
                echo "📝 Logs Backend:"
                tail -f logs/backend.log
                ;;
            "frontend"|"fe")
                echo "📝 Logs Frontend:"
                tail -f logs/frontend.log
                ;;
            *)
                echo "📝 Logs disponibles:"
                echo "  ./dev-commands.sh logs backend"
                echo "  ./dev-commands.sh logs frontend"
                ;;
        esac
        ;;
    "test")
        echo "🧪 Test de l'API:"
        echo "Health Check:"
        curl -s http://192.168.5.30:5000/api/health | jq . 2>/dev/null || curl -s http://192.168.5.30:5000/api/health
        echo -e "\nLogin Admin:"
        curl -X POST -H "Content-Type: application/json" \
             -d '{"email":"admin@admin.com","password":"VortexFlow2024!"}' \
             -c /tmp/test_cookies.txt \
             http://192.168.5.30:5000/api/auth/login | jq . 2>/dev/null
        echo -e "\nDashboard Stats:"
        curl -H "Content-Type: application/json" \
             -b /tmp/test_cookies.txt \
             http://192.168.5.30:5000/api/dashboard/stats | jq . 2>/dev/null
        ;;
    "dev")
        echo "🔧 Mode développement (nodemon):"
        cd backend && npm run dev:env &
        cd frontend && npm start &
        echo "Processus lancés en arrière-plan"
        ;;
    *)
        echo "🌊 VortexFlow - Commandes de développement"
        echo ""
        echo "Usage: ./dev-commands.sh [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  start     Démarre frontend + backend"
        echo "  stop      Arrête tous les processus"  
        echo "  restart   Redémarre l'application"
        echo "  status    Affiche le statut et les processus"
        echo "  logs be   Affiche les logs backend"
        echo "  logs fe   Affiche les logs frontend"
        echo "  test      Teste l'API (health, login, stats)"
        echo "  dev       Mode développement avec nodemon"
        echo ""
        echo "URLs:"
        echo "  Frontend: http://192.168.5.30:3000"
        echo "  Backend:  http://192.168.5.30:5000"
        echo "  Health:   http://192.168.5.30:5000/api/health"
        ;;
esac
