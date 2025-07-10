#!/bin/bash

echo "🔍 Test API Admin Users - VortexFlow"
echo "=================================="

# 1. Login et récupération de cookies
echo "🔐 Étape 1: Authentification..."
curl -s -X POST "http://192.168.5.30:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@admin.com", "password": "VortexFlow2024!"}' \
  -c cookies.txt > login_response.json

echo "✅ Réponse login:"
cat login_response.json | jq -r '.user.email // "Erreur de login"'

# 2. Test de l'API /admin/users
echo -e "\n📋 Étape 2: Test /admin/users..."
curl -s -X GET "http://192.168.5.30:5000/api/admin/users" \
  -H "Content-Type: application/json" \
  -b cookies.txt > users_response.json

echo "✅ Réponse /admin/users:"
cat users_response.json | jq '.'

# 3. Vérification de la structure
echo -e "\n🔍 Étape 3: Analyse de la structure..."
echo "Structure de la réponse:"
cat users_response.json | jq 'keys'

echo -e "\nNombre d'utilisateurs trouvés:"
cat users_response.json | jq '.data.users | length // 0'

# 4. Nettoyage
rm -f cookies.txt login_response.json users_response.json
