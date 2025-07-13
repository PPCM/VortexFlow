# Spécification Technique - Grammaire DOT 3D Étendue

## Vue d'ensemble

Cette spécification définit l'extension de la grammaire DOT standard pour supporter la génération de graphiques 3D avec simulation de particules en temps réel, utilisant la bibliothèque 3d-force-graph.

## Compatibilité

✅ **Compatibilité descendante complète** avec la syntaxe DOT standard  
✅ **Extensions non-intrusives** via nouveaux attributs optionnels  
✅ **Validation progressive** pour maintenir la robustesse  

---

## 1. Attributs Étendus pour les Nœuds

### 1.1 Attributs Visuels

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `label` | string | ID du nœud | Texte affiché sur le nœud |
| `color` | color | auto | Couleur au format hex (#ff0000), rgb(255,0,0) ou nom (red) |
| `image` | url | null | URL d'une image à appliquer comme texture |
| `geometry` | enum | "Sphere" | Type de géométrie 3D |
| `dimensions` | object | géométrie-dépendant | Paramètres dimensionnels |

#### Géométries 3D Supportées

**Sphere** (défaut)
```dot
A [geometry="Sphere", dimensions="{radius: 1.0}"];
```

**Box**
```dot
B [geometry="Box", dimensions="{width: 2.0, height: 1.5, depth: 1.0}"];
```

**Cylinder**
```dot
C [geometry="Cylinder", dimensions="{radius: 0.8, height: 2.0}"];
```

**Cone**
```dot
D [geometry="Cone", dimensions="{radius: 1.0, height: 2.5}"];
```

**Torus**
```dot
E [geometry="Torus", dimensions="{tube: 0.3, tubularSegments: 8, radialSegments: 6}"];
```

### 1.2 Attributs de Simulation

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `particleGeneration` | number | 0 | Particules générées par minute |
| `maxParticleProcessing` | number | 60 | Particules maximum traitées par minute |

### 1.3 Exemple Complet Nœud

```dot
ServerNode [
    label="Serveur Principal",
    color="#4a90e2",
    geometry="Box",
    dimensions="{width: 2, height: 1, depth: 1}",
    particleGeneration=120,
    maxParticleProcessing=100
];
```

---

## 2. Système de Redimensionnement Automatique

### 2.1 Formule de Calcul

```javascript
taille_finale = defaultNodeSize * (1 + 0.1 * sqrt(nombre_connexions_entrantes))
```

### 2.2 Configuration Globale

```dot
digraph SystemGraph {
    // Taille de base pour tous les nœuds
    defaultNodeSize = 1.5;
    
    // Activation du redimensionnement automatique
    autoResize = true;
}
```

---

## 3. Système de Particules et Accumulation

### 3.1 Calcul d'Accumulation

```javascript
// À chaque cycle de simulation
accumulation += (particules_generees + particules_reçues) - particules_traitees

// Effet bloom proportionnel
bloom_intensity = min(1.0, accumulation / 100)
```

### 3.2 États des Particules

- **Générées** : Créées par le nœud selon `particleGeneration`
- **Reçues** : Transmises par les nœuds connectés
- **Traitées** : Limitées par `maxParticleProcessing`
- **Accumulées** : Différence entre entrées et sorties

---

## 4. Attributs Étendus pour les Liens

### 4.1 Spécification des Attributs

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `label` | string | "" | Texte affiché sur le lien |
| `color` | color | auto | Couleur du lien |
| `maxParticleFlow` | number | 30 | Particules maximum transmises par minute |
| `particleSpeed` | number | 1.0 | Vitesse de propagation (multiplier) |
| `style` | enum | "solid" | Style visuel du lien |

### 4.2 Styles de Liens

- `"solid"` : Ligne continue (défaut)
- `"dashed"` : Ligne pointillée
- `"dotted"` : Ligne en points

### 4.3 Exemple Complet Lien

```dot
A -> B [
    label="Flux Principal",
    color="#ff8800",
    maxParticleFlow=60,
    particleSpeed=1.5,
    style="solid"
];
```

---

## 5. Configuration Globale du Graphique

### 5.1 Paramètres Disponibles

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `defaultNodeSize` | number | 1.0 | Taille de base des nœuds |
| `particlesEnabled` | boolean | true | Activation système particules |
| `autoResize` | boolean | false | Redimensionnement automatique |
| `bloomEffect` | boolean | true | Effet bloom sur accumulation |
| `autoColors` | boolean | true | Attribution automatique couleurs |

### 5.2 Exemple Configuration

```dot
digraph ParticleSystem {
    // Configuration globale
    defaultNodeSize = 1.2;
    particlesEnabled = true;
    autoResize = true;
    bloomEffect = true;
    autoColors = false; // Couleurs manuelles uniquement
    
    // Reste du graphique...
}
```

---

## 6. Intégration Panneau de Contrôle 3D

### 6.1 Contrôles Temps Réel

Le panneau de contrôle 3D doit permettre la modification dynamique de :

- ✅ Activation/désactivation système particules
- ✅ Activation/désactivation redimensionnement automatique  
- ✅ Activation/désactivation effet bloom
- ✅ Activation/désactivation couleurs automatiques
- ✅ Ajustement `defaultNodeSize` global
- ✅ Vitesse de simulation globale

### 6.2 Statistiques Temps Réel

Affichage en direct de :
- Nombre total de particules actives
- Taux de génération global (particules/minute)
- Taux de traitement global (particules/minute)
- Nœuds avec accumulation critique (>80)

---

## 7. Validation et Contraintes

### 7.1 Contraintes Logiques

- `particleGeneration >= 0`
- `maxParticleProcessing > 0`
- `maxParticleFlow > 0`
- `particleSpeed > 0`
- `defaultNodeSize > 0`

### 7.2 Validation Géométries

Chaque géométrie doit avoir ses dimensions appropriées :
- **Sphere** : `radius > 0`
- **Box** : `width, height, depth > 0`
- **Cylinder** : `radius, height > 0`
- **Cone** : `radius, height > 0`
- **Torus** : `tube > 0, tubularSegments >= 3, radialSegments >= 3`

### 7.3 Messages d'Erreur

Messages explicites pour faciliter le debugging :

```
❌ Erreur ligne 15: particleGeneration ne peut pas être négatif
❌ Erreur ligne 23: geometry "InvalidShape" non supportée
❌ Erreur ligne 31: dimensions manquantes pour geometry="Box"
✅ Graphique validé avec succès - 12 nœuds, 18 liens
```

---

## 8. Optimisations Performance

### 8.1 Gestion Mémoire

- Pool de particules réutilisables
- Culling des particules hors champ de vision
- Limitation dynamique selon performance

### 8.2 Rendu Optimisé

- Instanced rendering pour géométries identiques
- LOD (Level of Detail) selon distance caméra
- Batching des particules par matériau

---

## 9. Extensibilité Future

### 9.1 Nouvelles Géométries

Architecture permettant l'ajout de :
- Géométries personnalisées via plugins
- Géométries procedurales (fractales, etc.)
- Import de modèles 3D (.obj, .gltf)

### 9.2 Nouveaux Attributs

Extension prévue pour :
- Animations automatiques (rotation, pulsation)
- Physique avancée (collision, gravité)
- Effets visuels (particules custom, shaders)

---

## Conclusion

Cette spécification définit un système complet et extensible pour la visualisation 3D de graphiques DOT avec simulation de particules en temps réel, tout en maintenant la compatibilité avec la syntaxe DOT standard.
