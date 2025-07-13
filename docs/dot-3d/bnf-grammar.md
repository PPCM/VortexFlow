# Grammaire BNF/EBNF - Extension DOT 3D

## Grammaire Étendue en EBNF

```ebnf
(* Extension de la grammaire DOT standard pour support 3D avec particules *)

(* === STRUCTURE PRINCIPALE === *)
graph ::= ['strict'] ('graph' | 'digraph') [id] '{' stmt_list '}'

stmt_list ::= [stmt [';' | '\n'] stmt_list]

stmt ::= node_stmt 
       | edge_stmt 
       | attr_stmt 
       | id '=' id
       | subgraph
       | global_3d_config

(* === CONFIGURATION GLOBALE 3D === *)
global_3d_config ::= 'defaultNodeSize' '=' number ';'
                   | 'particlesEnabled' '=' boolean ';'
                   | 'autoResize' '=' boolean ';'
                   | 'bloomEffect' '=' boolean ';'
                   | 'autoColors' '=' boolean ';'

(* === NŒUDS ÉTENDUS === *)
node_stmt ::= node_id [attr_list]
node_id ::= id [port]

attr_list ::= '[' [a_list] ']'
a_list ::= attribute (',' attribute)*

attribute ::= standard_attribute | node_3d_attribute | edge_3d_attribute

(* Attributs nœuds standard DOT *)
standard_attribute ::= 'shape' '=' id
                     | 'label' '=' string
                     | 'color' '=' color_value
                     | 'style' '=' id
                     | 'width' '=' number
                     | 'height' '=' number

(* === ATTRIBUTS 3D NŒUDS === *)
node_3d_attribute ::= visual_3d_attribute | simulation_attribute

visual_3d_attribute ::= 'geometry' '=' geometry_type
                      | 'dimensions' '=' dimensions_object
                      | 'image' '=' url_string

simulation_attribute ::= 'particleGeneration' '=' number
                       | 'maxParticleProcessing' '=' number

(* === TYPES GÉOMÉTRIQUES === *)
geometry_type ::= '"Sphere"' | '"Box"' | '"Cylinder"' | '"Cone"' | '"Torus"'

dimensions_object ::= '"{' dimension_list '}"'
dimension_list ::= dimension (',' dimension)*

dimension ::= 'radius' ':' number
            | 'width' ':' number
            | 'height' ':' number  
            | 'depth' ':' number
            | 'tube' ':' number
            | 'tubularSegments' ':' integer
            | 'radialSegments' ':' integer

(* === LIENS ÉTENDUS === *)
edge_stmt ::= (node_id | subgraph) edgeRHS [attr_list]
edgeRHS ::= edgeop (node_id | subgraph) [edgeRHS]
edgeop ::= '->' | '--'

(* === ATTRIBUTS 3D LIENS === *)
edge_3d_attribute ::= 'maxParticleFlow' '=' number
                    | 'particleSpeed' '=' number
                    | 'style' '=' link_style

link_style ::= '"solid"' | '"dashed"' | '"dotted"'

(* === TYPES DE BASE === *)
number ::= integer | float
integer ::= digit+
float ::= digit+ '.' digit+
digit ::= '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

boolean ::= 'true' | 'false'

color_value ::= hex_color | rgb_color | named_color
hex_color ::= '"#' [0-9a-fA-F]{6} '"'
rgb_color ::= '"rgb(' number ',' number ',' number ')"'
named_color ::= '"' color_name '"'
color_name ::= 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple' | 'pink' | 'cyan' | 'magenta' | 'black' | 'white' | 'gray'

url_string ::= '"' 'http' 's'? '://' [^"]+ '"'

string ::= '"' [^"]* '"'
id ::= identifier | string | number
identifier ::= [a-zA-Z_] [a-zA-Z0-9_]*

(* === SOUS-GRAPHIQUES === *)
subgraph ::= ['subgraph' [id]] '{' stmt_list '}'

(* === ATTRIBUTS GÉNÉRIQUES === *)
attr_stmt ::= ('graph' | 'node' | 'edge') attr_list
```

## Validation des Contraintes

### Contraintes Sémantiques

```ebnf
(* Contraintes à valider après parsing *)
constraint ::= geometric_constraint 
             | simulation_constraint 
             | performance_constraint

geometric_constraint ::= sphere_constraint 
                       | box_constraint 
                       | cylinder_constraint 
                       | cone_constraint 
                       | torus_constraint

sphere_constraint ::= 
    WHEN geometry="Sphere" 
    THEN radius > 0

box_constraint ::= 
    WHEN geometry="Box" 
    THEN width > 0 AND height > 0 AND depth > 0

cylinder_constraint ::= 
    WHEN geometry="Cylinder" 
    THEN radius > 0 AND height > 0

cone_constraint ::= 
    WHEN geometry="Cone" 
    THEN radius > 0 AND height > 0

torus_constraint ::= 
    WHEN geometry="Torus" 
    THEN tube > 0 AND tubularSegments >= 3 AND radialSegments >= 3

simulation_constraint ::= 
    particleGeneration >= 0 AND
    maxParticleProcessing > 0 AND
    maxParticleFlow > 0 AND
    particleSpeed > 0 AND
    defaultNodeSize > 0
```

## Exemples de Productions

### Production Complète d'un Nœud 3D

```
node_stmt:
  node_id: "ServerA"
  attr_list: [
    visual_3d_attribute: geometry="Box"
    visual_3d_attribute: dimensions="{width: 2, height: 1, depth: 1}"
    simulation_attribute: particleGeneration=60
    simulation_attribute: maxParticleProcessing=100
    standard_attribute: color="#4a90e2"
    standard_attribute: label="Serveur Principal"
  ]
```

### Production d'un Lien 3D

```
edge_stmt:
  node_id: "ServerA"
  edgeop: "->"  
  node_id: "ServerB"
  attr_list: [
    edge_3d_attribute: maxParticleFlow=45
    edge_3d_attribute: particleSpeed=1.5
    edge_3d_attribute: style="solid"
    standard_attribute: color="#ff8800"
    standard_attribute: label="Flux Principal"
  ]
```

### Production Configuration Globale

```
global_3d_config:
  defaultNodeSize=1.5
  particlesEnabled=true
  autoResize=true
  bloomEffect=true
  autoColors=false
```

## Règles de Précédence

### Ordre d'Évaluation des Attributs

1. **Configuration globale** → paramètres par défaut
2. **Attributs nœuds/liens** → surcharge locale
3. **Validation contraintes** → vérification cohérence
4. **Application effets** → rendu 3D final

### Gestion des Conflits

```ebnf
conflict_resolution ::= 
    WHEN duplicate_attribute
    THEN use_last_defined
    
    WHEN global_vs_local
    THEN prefer_local
    
    WHEN invalid_combination  
    THEN emit_error_with_suggestion
```

## Extensions Futures

### Syntaxe Modulaire pour Nouvelles Géométries

```ebnf
(* Structure extensible pour futures géométries *)
custom_geometry ::= 'geometry' '=' '"' custom_geometry_name '"'
custom_geometry_name ::= plugin_prefix '::' geometry_name
plugin_prefix ::= [a-zA-Z_][a-zA-Z0-9_]*
geometry_name ::= [a-zA-Z_][a-zA-Z0-9_]*

(* Exemple: geometry="physics::FluidMesh" *)
```

### Support Import Modèles 3D

```ebnf
(* Extension pour modèles externes *)
external_model ::= 'model' '=' model_url
model_url ::= '"' ('file://' | 'http://' | 'https://') [^"]+ ('.' model_format) '"'
model_format ::= 'obj' | 'gltf' | 'glb' | 'fbx'
```

Cette grammaire EBNF définit formellement toutes les extensions DOT 3D tout en maintenant la compatibilité avec la syntaxe DOT standard.
