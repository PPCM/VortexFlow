#!/bin/bash

echo "🔐 Test authentification et API /admin/users"

# 1. Login et sauvegarde des cookies
echo "📝 Authentification..."
curl -X POST "http://192.168.5.30:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@admin.com", "password": "VortexFlow2024!"}' \
  -c cookies.txt \
  -s | jq '.'

# 2. Test de l'API /admin/users avec les cookies
echo -e "\n📋 Test API /admin/users..."
curl -X GET "http://192.168.5.30:5000/api/admin/users" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -s | jq '.'

# 3. Nettoyage
rm -f cookies.txt
