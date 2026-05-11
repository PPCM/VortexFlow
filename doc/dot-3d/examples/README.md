# Exemples DOT 3D avec Simulation de Particules

Cette collection d'exemples démontre les capacités avancées de l'extension DOT 3D de VortexFlow pour créer des visualisations interactives avec simulation de particules en temps réel.

## 📋 Liste des Exemples

### 0. 🎯 [Rôles `nodeRole`](./generators.dot) _(DES — ADR-006)_

**Cas d'usage** : démonstration minimale des trois rôles (`generator`, `relay`, `sink`).

- **Topologie** : 2 sources convergent vers 1 routeur vers 1 puits.
- **Pas de saturation** — le routeur a la capacité de tout traiter.
- **À utiliser pour** : comprendre l'effet de `nodeRole` avant de plonger dans des cas plus riches.

### 0.bis. 🚨 [Goulot avec drop](./saturation.dot) _(DES — ADR-006)_

**Cas d'usage** : démonstration de l'accumulation, du halo de saturation et des drops visibles.

- **Topologie** : 1 source rapide → 1 goulot étroit → 1 puits.
- **Comportement** : la file du goulot se remplit, halo orange à 80 %, drops dès saturation, flash rouge à chaque drop.
- **À utiliser pour** : valider les phases 5 (visu) et 7 (test d'intégration "saturation") du chantier DES.

### 1. 🌐 [Réseau de Distribution](./network-distribution.dot)

**Cas d'usage** : Infrastructure réseau avec flux de données

- **Domaine** : Télécommunications, Cloud Computing
- **Géométries** : Box (datacenters), Cylinder (serveurs régionaux), Cone (edge), Torus (CDN), Sphere (utilisateurs)
- **Particules** : Représentent les requêtes et données transitant
- **Goulots** : Centre de données principal, Edge Tokyo saturé
- **Vitesses** : Variables selon la géographie (backbone transpacifique plus lent)

**Points d'intérêt** :

- Accumulation visible aux goulots d'étranglement
- Différentes vitesses selon la latence géographique
- Flux bidirectionnel avec analytics de retour
- CDN optimisé pour haute performance

### 2. ⚛️ [Physique des Particules](./particle-physics.dot)

**Cas d'usage** : Accélérateur de particules et détection

- **Domaine** : Recherche scientifique, Physique
- **Géométries** : Sphere (sources), Cylinder (accélérateurs), Torus (cyclotrons), Box (détecteurs)
- **Particules** : Protons, électrons et particules secondaires
- **Goulots** : Point de collision, détecteurs limités
- **Vitesses** : Accélération progressive, très haute énergie avant collision

**Points d'intérêt** :

- Génération de particules secondaires après collision
- Pertes par rayonnement dans les cyclotrons
- Détection multi-canal parallèle
- Boucles de rétroaction pour calibration

### 3. 🔄 [Pipeline de Workflow](./workflow-pipeline.dot)

**Cas d'usage** : CI/CD avec goulots d'étranglement

- **Domaine** : DevOps, Développement logiciel
- **Géométries** : Box (repos, compilation), Cone (tests), Cylinder (intégration), Torus (sécurité)
- **Particules** : Commits, builds, et artefacts
- **Goulots** : Scan de sécurité, compilation, déploiement production
- **Vitesses** : Hotfix rapides, déploiement production contrôlé

**Points d'intérêt** :

- Parallélisation des tests après compilation
- Synchronisation avant packaging Docker
- Chemin hotfix contournant certaines étapes
- Feedback d'erreurs vers développement

### 4. 📱 [Réseau Social](./social-network.dot)

**Cas d'usage** : Propagation virale de contenu

- **Domaine** : Réseaux sociaux, Marketing viral
- **Géométries** : Sphere (influenceurs, audience), Cylinder (comptes), Torus (communautés), Box (algorithmes)
- **Particules** : Posts, shares, engagements
- **Goulots** : Communauté gaming saturée, traitement algorithmique
- **Vitesses** : Contenu lifestyle plus viral que tech

**Points d'intérêt** :

- Amplification algorithmique automatique
- Croisements entre communautés thématiques
- Boucles de rétroaction d'engagement
- Système de tendances détectant la viralité

### 5. 💰 [Système Économique](./economic-system.dot)

**Cas d'usage** : Flux financiers et monétaires

- **Domaine** : Économie, Finance, Politique monétaire
- **Géométries** : Sphere (banque centrale, ménages), Cylinder (banques), Box (industries, état), Torus (marchés)
- **Particules** : Monnaie, crédits, investissements
- **Goulots** : Volatilité boursière, contraintes budgétaires, administration fiscale
- **Vitesses** : Transactions rapides vs procédures administratives lentes

**Points d'intérêt** :

- Circuit monétaire complet banque centrale → économie
- Chaîne de valeur primaire → secondaire → tertiaire
- Circuit fiscal collecte → redistribution
- Multiplicateur bancaire et création de crédit

## 🎯 Concepts Clés Démontrés

### **Géométries 3D Avancées**

- **Sphere** : Entités centrales, sources/destinataires
- **Box** : Infrastructures, centres de traitement
- **Cylinder** : Relais, serveurs, institutions
- **Cone** : Points de concentration, edge nodes
- **Torus** : Systèmes circulaires, algorithmes, marchés

### **Simulation de Particules**

- **Génération** : `particleGeneration` - Production de contenu/flux
- **Traitement** : `maxParticleProcessing` - Capacité de traitement
- **Goulots** : Accumulation quand génération > traitement
- **Vitesses** : `particleSpeed` - Urgence et priorité des flux

### **Effets Visuels**

- **Auto-resize** : Taille des nœuds selon leur importance
- **Bloom effect** : Halo lumineux sur les accumulations
- **Couleurs thématiques** : Codage par secteur/fonction
- **Styles de liens** : Solid, dashed, dotted selon type de flux

## 🚀 Utilisation dans VortexFlow

### **Chargement des Exemples**

1. Copiez le contenu d'un fichier `.dot`
2. Collez dans l'éditeur VortexFlow
3. Cliquez sur "Visualiser en 3D"
4. Activez la simulation de particules dans le panneau de contrôle

### **Contrôles Interactifs**

- **Particules** : Activez/désactivez avec le bouton toggle
- **Vitesse** : Ajustez la vitesse globale de simulation
- **Bloom** : Intensifiez l'effet lumineux sur les accumulations
- **Tailles** : Utilisez auto-resize pour voir l'importance relative

### **Personnalisation**

- **Couleurs** : Modifiez les attributs `color` pour votre thème
- **Géométries** : Changez `geometry` et `dimensions` selon vos besoins
- **Flux** : Ajustez `maxParticleFlow` et `particleSpeed` pour votre cas
- **Capacités** : Modifiez `particleGeneration` et `maxParticleProcessing`

## 🔧 Paramètres Recommandés

### **Pour Démonstrations**

```dot
defaultNodeSize = 1.2;
particlesEnabled = true;
autoResize = true;
bloomEffect = true;
```

### **Pour Analyses Détaillées**

```dot
defaultNodeSize = 0.8;
particlesEnabled = true;
autoResize = false;  // Tailles fixes
bloomEffect = false; // Moins de distraction
```

### **Pour Présentations**

```dot
defaultNodeSize = 1.5;
particlesEnabled = true;
autoResize = true;
bloomEffect = true;
autoColors = true;   // Couleurs automatiques
```

## 📊 Métriques et KPIs

Ces exemples permettent de visualiser des métriques importantes :

- **Throughput** : Débit des particules par nœud
- **Latence** : Vitesse de propagation dans le réseau
- **Goulots** : Identification visuelle des limitations
- **Accumulation** : Zones de congestion avec bloom effect
- **Efficacité** : Ratio génération/traitement par nœud

## 🎓 Cas d'Usage Étendus

### **Infrastructure IT**

- Monitoring réseau avec alertes visuelles
- Analyse de performance des microservices
- Visualisation des flux de données en temps réel

### **Analyse Métier**

- Flux de processus avec identification des goulots
- Propagation d'information dans l'organisation
- Modélisation des chaînes d'approvisionnement

### **Recherche et Éducation**

- Simulation de systèmes complexes
- Visualisation de modèles théoriques
- Démonstrations interactives pour l'enseignement

---

💡 **Conseil** : Commencez par l'exemple de réseau de distribution pour vous familiariser avec les concepts, puis explorez les autres domaines selon vos besoins spécifiques.

Ces exemples constituent une base solide pour développer vos propres visualisations 3D interactives avec VortexFlow !
