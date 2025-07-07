#!/bin/bash

# VortexFlow Backend - Navigation Documentation
# Script interactif pour parcourir la documentation

echo "📚 VortexFlow Backend - Navigation Documentation"
echo "=============================================="
echo ""

# Vérification présence dossier docs
if [ ! -d "docs" ]; then
    echo "❌ Dossier docs introuvable"
    exit 1
fi

echo "📋 Documentation disponible :"
echo ""

# Liste des documents avec descriptions
docs=(
    "README.md:Vue d'ensemble et index de toute la documentation"
    "API_DOCUMENTATION.md:Référence complète de l'API REST avec exemples"
    "AUTHENTICATION.md:Guide d'authentification et gestion des sessions"
    "CONFIGURATION.md:Variables d'environnement et configuration détaillée"
    "DEPLOYMENT.md:Guide de déploiement en production"
    "DEVELOPMENT.md:Guide de développement et contribution"
    "FINAL_VALIDATION_REPORT.md:Rapport final de validation du backend"
    "REDIS_INTEGRATION_REPORT.md:Rapport d'intégration Redis détaillé"
    "TEST_REPORT.md:Résultats des tests automatisés"
    "TOOLKIT_SUMMARY.md:Résumé des outils et scripts disponibles"
)

# Affichage avec numérotation
counter=1
for doc in "${docs[@]}"; do
    filename=$(echo "$doc" | cut -d':' -f1)
    description=$(echo "$doc" | cut -d':' -f2)
    echo "  $counter. $filename"
    echo "     $description"
    echo ""
    ((counter++))
done

echo "🎯 Actions disponibles :"
echo "  📖 Entrez le numéro pour lire un document"
echo "  📁 Tapez 'ls' pour lister les fichiers"
echo "  🔍 Tapez 'find <terme>' pour rechercher dans la doc"
echo "  ❌ Tapez 'exit' pour quitter"
echo ""

while true; do
    read -p "👉 Votre choix : " choice
    
    case $choice in
        [1-9]|10)
            if [ "$choice" -le "${#docs[@]}" ]; then
                filename=$(echo "${docs[$((choice-1))]}" | cut -d':' -f1)
                echo ""
                echo "📖 Ouverture de docs/$filename..."
                echo "=================================="
                
                if command -v less >/dev/null 2>&1; then
                    less "docs/$filename"
                elif command -v more >/dev/null 2>&1; then
                    more "docs/$filename"
                else
                    cat "docs/$filename"
                fi
                
                echo ""
                echo "📚 Retour au menu de navigation..."
                echo ""
            else
                echo "❌ Numéro invalide. Choisissez entre 1 et ${#docs[@]}"
            fi
            ;;
        
        "ls"|"list")
            echo ""
            echo "📁 Contenu du dossier docs/ :"
            ls -lah docs/
            echo ""
            ;;
        
        find*)
            search_term=$(echo "$choice" | cut -d' ' -f2-)
            if [ -n "$search_term" ]; then
                echo ""
                echo "🔍 Recherche de '$search_term' dans la documentation..."
                echo "=================================================="
                grep -r -i -n --color=always "$search_term" docs/ || echo "❌ Aucun résultat trouvé"
                echo ""
            else
                echo "❌ Spécifiez un terme de recherche : find <terme>"
            fi
            ;;
        
        "exit"|"quit"|"q")
            echo ""
            echo "✅ Fermeture du navigateur de documentation"
            echo "📚 Merci d'avoir consulté la documentation VortexFlow !"
            exit 0
            ;;
        
        "help"|"h"|"?")
            echo ""
            echo "🎯 Aide - Commandes disponibles :"
            echo "  [1-10]  : Lire un document spécifique"
            echo "  ls      : Lister les fichiers de documentation"
            echo "  find X  : Rechercher 'X' dans tous les documents"
            echo "  exit    : Quitter le navigateur"
            echo "  help    : Afficher cette aide"
            echo ""
            ;;
        
        "")
            # Ignore empty input
            ;;
        
        *)
            echo "❌ Commande inconnue. Tapez 'help' pour voir les options disponibles."
            ;;
    esac
done
