# Règles de Validation - Grammaire DOT 3D

## Vue d'ensemble

Ce document définit toutes les règles de validation pour la grammaire DOT 3D étendue, incluant les contraintes sémantiques, les vérifications de cohérence et les messages d'erreur associés.

---

## 1. Validation Syntaxique

### 1.1 Structure DOT Standard

```typescript
interface SyntaxValidation {
  // Validation structure de base
  validateGraphDeclaration(): ValidationResult;
  validateNodeDeclaration(): ValidationResult;
  validateEdgeDeclaration(): ValidationResult;
  validateAttributeList(): ValidationResult;
}
```

#### Règles de Base

- ✅ Graphique doit commencer par `digraph` ou `graph`
- ✅ Accolades `{` `}` correctement appariées
- ✅ Identifiants valides (lettres, chiffres, underscore)
- ✅ Attributs entre crochets `[` `]`
- ✅ Chaînes entre guillemets `"` `"`

### 1.2 Extensions 3D Syntaxe

```typescript
interface ExtendedSyntaxValidation {
  validateGeometryAttribute(): ValidationResult;
  validateDimensionsObject(): ValidationResult;
  validateParticleAttributes(): ValidationResult;
  validateGlobalConfig(): ValidationResult;
}
```

---

## 2. Validation Géométrique

### 2.1 Géométries Supportées

```typescript
enum GeometryType {
  SPHERE = 'Sphere',
  BOX = 'Box',
  CYLINDER = 'Cylinder',
  CONE = 'Cone',
  TORUS = 'Torus',
}

interface GeometryValidation {
  geometry: GeometryType;
  requiredDimensions: string[];
  validateDimensions(dims: object): ValidationResult;
}
```

### 2.2 Contraintes par Géométrie

#### Sphere

```typescript
const SphereValidation: GeometryValidation = {
  geometry: 'Sphere',
  requiredDimensions: ['radius'],
  validateDimensions: (dims) => {
    if (!dims.radius) return error("Sphere requires 'radius' dimension");
    if (dims.radius <= 0) return error('Sphere radius must be > 0');
    return success();
  },
};
```

#### Box

```typescript
const BoxValidation: GeometryValidation = {
  geometry: 'Box',
  requiredDimensions: ['width', 'height', 'depth'],
  validateDimensions: (dims) => {
    const required = ['width', 'height', 'depth'];
    for (const dim of required) {
      if (!dims[dim]) return error(`Box requires '${dim}' dimension`);
      if (dims[dim] <= 0) return error(`Box ${dim} must be > 0`);
    }
    return success();
  },
};
```

#### Cylinder

```typescript
const CylinderValidation: GeometryValidation = {
  geometry: 'Cylinder',
  requiredDimensions: ['radius', 'height'],
  validateDimensions: (dims) => {
    if (!dims.radius) return error("Cylinder requires 'radius' dimension");
    if (!dims.height) return error("Cylinder requires 'height' dimension");
    if (dims.radius <= 0) return error('Cylinder radius must be > 0');
    if (dims.height <= 0) return error('Cylinder height must be > 0');
    return success();
  },
};
```

#### Cone

```typescript
const ConeValidation: GeometryValidation = {
  geometry: 'Cone',
  requiredDimensions: ['radius', 'height'],
  validateDimensions: (dims) => {
    if (!dims.radius) return error("Cone requires 'radius' dimension");
    if (!dims.height) return error("Cone requires 'height' dimension");
    if (dims.radius <= 0) return error('Cone radius must be > 0');
    if (dims.height <= 0) return error('Cone height must be > 0');
    return success();
  },
};
```

#### Torus

```typescript
const TorusValidation: GeometryValidation = {
  geometry: 'Torus',
  requiredDimensions: ['tube', 'tubularSegments', 'radialSegments'],
  validateDimensions: (dims) => {
    if (!dims.tube) return error("Torus requires 'tube' dimension");
    if (!dims.tubularSegments) return error("Torus requires 'tubularSegments'");
    if (!dims.radialSegments) return error("Torus requires 'radialSegments'");

    if (dims.tube <= 0) return error('Torus tube must be > 0');
    if (dims.tubularSegments < 3) return error('Torus tubularSegments must be >= 3');
    if (dims.radialSegments < 3) return error('Torus radialSegments must be >= 3');

    return success();
  },
};
```

---

## 3. Validation Système Particules

### 3.1 Contraintes Nœuds

```typescript
interface ParticleNodeValidation {
  validateNodeRole(value: string): ValidationResult;
  validateParticleGeneration(value: number): ValidationResult;
  validateMaxParticleProcessing(value: number): ValidationResult;
  validateQueueSize(value: number): ValidationResult;
  validateProcessingTime(value: number): ValidationResult;
  validateFailureRate(value: number): ValidationResult;
  validateDropPolicy(value: string): ValidationResult;
}

const NODE_ROLES = ['generator', 'relay', 'sink'] as const;
const DROP_POLICIES = ['tail', 'head', 'reject'] as const;

const ParticleNodeRules = {
  validateNodeRole: (value: string) => {
    if (!NODE_ROLES.includes(value as any)) {
      return error(`nodeRole must be one of: ${NODE_ROLES.join(', ')}`);
    }
    return success();
  },

  validateParticleGeneration: (value: number) => {
    if (value < 0) return error('particleGeneration cannot be negative');
    if (value > 10000) return warning('High particle generation may impact performance');
    return success();
  },

  validateMaxParticleProcessing: (value: number) => {
    if (value <= 0) return error('maxParticleProcessing must be > 0');
    if (value > 5000) return warning('High processing rate may impact performance');
    return success();
  },

  validateQueueSize: (value: number) => {
    if (!Number.isInteger(value)) return error('queue_size must be an integer');
    if (value <= 0) return error('queue_size must be > 0');
    if (value > 10000) return warning('Very large queue_size may impact memory');
    return success();
  },

  validateProcessingTime: (value: number) => {
    if (value < 0) return error('processing_time cannot be negative');
    return success();
  },

  validateFailureRate: (value: number) => {
    if (value < 0 || value > 1) return error('failure_rate must be in [0, 1]');
    return success();
  },

  validateDropPolicy: (value: string) => {
    if (!DROP_POLICIES.includes(value as any)) {
      return error(`dropPolicy must be one of: ${DROP_POLICIES.join(', ')}`);
    }
    return success();
  },
};
```

### 3.1.bis Validation de cohérence inter-attributs

```typescript
// Warnings, not errors — the validator still accepts the graph
const NodeCoherenceRules = {
  // dropPolicy without queue_size is meaningless (queue is unbounded)
  validateDropPolicyRequiresQueueSize: (node: Node3D) => {
    if (node.dropPolicy !== undefined && node.queue_size === undefined) {
      return warning(
        `Node ${node.id}: dropPolicy="${node.dropPolicy}" has no effect ` +
          `without queue_size — the queue is unbounded and never drops.`
      );
    }
    return success();
  },

  // particleGeneration on a non-generator role is ignored at runtime
  validateGenerationRequiresGeneratorRole: (node: Node3D) => {
    const role = node.nodeRole ?? 'relay';
    if (node.particleGeneration && node.particleGeneration > 0 && role !== 'generator') {
      return warning(
        `Node ${node.id}: particleGeneration=${node.particleGeneration} ` +
          `is ignored because nodeRole="${role}" (only "generator" emits).`
      );
    }
    return success();
  },
};
```

### 3.2 Contraintes Liens

```typescript
interface ParticleEdgeValidation {
  validateMaxParticleFlow(value: number): ValidationResult;
  validateParticleSpeed(value: number): ValidationResult;
}

const ParticleEdgeRules = {
  validateMaxParticleFlow: (value: number) => {
    if (value <= 0) return error('maxParticleFlow must be > 0');
    if (value > 1000) return warning('High particle flow may cause congestion');
    return success();
  },

  validateParticleSpeed: (value: number) => {
    if (value <= 0) return error('particleSpeed must be > 0');
    if (value > 10) return warning('Very high particle speed may reduce visibility');
    return success();
  },
};
```

---

## 4. Validation Configuration Globale

### 4.1 Paramètres Globaux

```typescript
interface GlobalConfigValidation {
  validateDefaultNodeSize(value: number): ValidationResult;
  validateParticlesEnabled(value: boolean): ValidationResult;
  validateAutoResize(value: boolean): ValidationResult;
  validateBloomEffect(value: boolean): ValidationResult;
  validateAutoColors(value: boolean): ValidationResult;
}

const GlobalConfigRules = {
  validateDefaultNodeSize: (value: number) => {
    if (value <= 0) return error('defaultNodeSize must be > 0');
    if (value > 10) return warning('Very large node size may cause overlap');
    return success();
  },

  validateParticlesEnabled: (value: boolean) => {
    if (typeof value !== 'boolean') return error('particlesEnabled must be true or false');
    return success();
  },

  validateAutoResize: (value: boolean) => {
    if (typeof value !== 'boolean') return error('autoResize must be true or false');
    return success();
  },

  validateBloomEffect: (value: boolean) => {
    if (typeof value !== 'boolean') return error('bloomEffect must be true or false');
    return success();
  },

  validateAutoColors: (value: boolean) => {
    if (typeof value !== 'boolean') return error('autoColors must be true or false');
    return success();
  },
};
```

---

## 5. Validation Couleurs

### 5.1 Formats Supportés

```typescript
interface ColorValidation {
  validateHexColor(color: string): ValidationResult;
  validateRgbColor(color: string): ValidationResult;
  validateNamedColor(color: string): ValidationResult;
}

const ColorRules = {
  validateHexColor: (color: string) => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (!hexPattern.test(color)) {
      return error(`Invalid hex color: ${color}. Format: #RRGGBB`);
    }
    return success();
  },

  validateRgbColor: (color: string) => {
    const rgbPattern = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
    const match = color.match(rgbPattern);
    if (!match) return error(`Invalid RGB color: ${color}. Format: rgb(r,g,b)`);

    const [, r, g, b] = match;
    if (+r > 255 || +g > 255 || +b > 255) {
      return error('RGB values must be between 0 and 255');
    }
    return success();
  },

  validateNamedColor: (color: string) => {
    const namedColors = [
      'red',
      'blue',
      'green',
      'yellow',
      'orange',
      'purple',
      'pink',
      'cyan',
      'magenta',
      'black',
      'white',
      'gray',
    ];
    if (!namedColors.includes(color)) {
      return error(`Unknown color name: ${color}. Supported: ${namedColors.join(', ')}`);
    }
    return success();
  },
};
```

---

## 6. Validation de Cohérence

### 6.1 Cohérence Flux Particules

```typescript
interface FlowConsistencyValidation {
  validateNodeCapacity(node: Node3D): ValidationResult;
  validateNetworkFlow(graph: Graph3D): ValidationResult;
}

const FlowConsistencyRules = {
  validateNodeCapacity: (node: Node3D) => {
    const incomingFlow = node.incomingEdges.reduce((sum, edge) => sum + edge.maxParticleFlow, 0);
    const nodeGeneration = node.particleGeneration;
    const totalInput = incomingFlow + nodeGeneration;

    if (totalInput > node.maxParticleProcessing * 1.5) {
      return warning(
        `Node ${node.id}: Total input (${totalInput}) significantly exceeds ` +
          `processing capacity (${node.maxParticleProcessing}). ` +
          `This will cause significant accumulation.`
      );
    }

    return success();
  },

  validateNetworkFlow: (graph: Graph3D) => {
    let totalGeneration = 0;
    let totalProcessing = 0;

    for (const node of graph.nodes) {
      totalGeneration += node.particleGeneration;
      totalProcessing += node.maxParticleProcessing;
    }

    if (totalGeneration > totalProcessing * 1.2) {
      return warning(
        `Network generates ${totalGeneration} particles/min but can only process ` +
          `${totalProcessing}/min. Consider increasing processing capacity.`
      );
    }

    return success();
  },
};
```

### 6.2 Validation Performance

```typescript
interface PerformanceValidation {
  validateParticleCount(graph: Graph3D): ValidationResult;
  validateGeometryComplexity(graph: Graph3D): ValidationResult;
}

const PerformanceRules = {
  validateParticleCount: (graph: Graph3D) => {
    const totalParticles = graph.nodes.reduce((sum, node) => sum + node.particleGeneration, 0);

    if (totalParticles > 1000) {
      return warning(
        `High particle generation rate (${totalParticles}/min). ` +
          `Consider reducing for better performance.`
      );
    }

    if (totalParticles > 5000) {
      return error(
        `Extremely high particle rate (${totalParticles}/min). ` +
          `This may cause severe performance issues.`
      );
    }

    return success();
  },

  validateGeometryComplexity: (graph: Graph3D) => {
    const complexGeometries = graph.nodes.filter((node) => node.geometry === 'Torus').length;

    if (complexGeometries > 20) {
      return warning(
        `Many complex geometries (${complexGeometries} Torus). ` +
          `Consider using simpler shapes for better performance.`
      );
    }

    return success();
  },
};
```

---

## 7. Messages d'Erreur

### 7.1 Templates d'Erreurs

```typescript
enum ErrorType {
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  SEMANTIC_ERROR = 'SEMANTIC_ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

interface ValidationMessage {
  type: ErrorType;
  line?: number;
  column?: number;
  code: string;
  message: string;
  suggestion?: string;
}

const ErrorTemplates = {
  INVALID_GEOMETRY: (line: number, geometry: string) => ({
    type: ErrorType.SEMANTIC_ERROR,
    line,
    code: 'INVALID_GEOMETRY',
    message: `Geometry "${geometry}" is not supported`,
    suggestion: `Supported geometries: Sphere, Box, Cylinder, Cone, Torus`,
  }),

  MISSING_DIMENSIONS: (line: number, geometry: string, missing: string[]) => ({
    type: ErrorType.SEMANTIC_ERROR,
    line,
    code: 'MISSING_DIMENSIONS',
    message: `Geometry "${geometry}" is missing required dimensions: ${missing.join(', ')}`,
    suggestion: `Add dimensions="{${missing.map((d) => d + ': value').join(', ')}}"}`,
  }),

  NEGATIVE_VALUE: (line: number, attribute: string, value: number) => ({
    type: ErrorType.SEMANTIC_ERROR,
    line,
    code: 'NEGATIVE_VALUE',
    message: `Attribute "${attribute}" cannot be negative (got: ${value})`,
    suggestion: `Use a positive value for ${attribute}`,
  }),

  PERFORMANCE_WARNING: (line: number, attribute: string, value: number, threshold: number) => ({
    type: ErrorType.WARNING,
    line,
    code: 'PERFORMANCE_WARNING',
    message: `High ${attribute} value (${value}) may impact performance`,
    suggestion: `Consider reducing below ${threshold} for optimal performance`,
  }),
};
```

### 7.2 Formatage des Messages

```typescript
class ValidationReporter {
  static formatMessage(msg: ValidationMessage): string {
    const prefix =
      msg.type === ErrorType.SYNTAX_ERROR || msg.type === ErrorType.SEMANTIC_ERROR
        ? '❌'
        : msg.type === ErrorType.WARNING
          ? '⚠️'
          : 'ℹ️';

    let formatted = `${prefix} ${msg.type}`;
    if (msg.line) formatted += ` ligne ${msg.line}`;
    formatted += `: ${msg.message}`;

    if (msg.suggestion) {
      formatted += `\n   💡 Suggestion: ${msg.suggestion}`;
    }

    return formatted;
  }

  static summarizeValidation(messages: ValidationMessage[]): string {
    const errors = messages.filter(
      (m) => m.type === ErrorType.SEMANTIC_ERROR || m.type === ErrorType.SYNTAX_ERROR
    );
    const warnings = messages.filter((m) => m.type === ErrorType.WARNING);

    if (errors.length === 0) {
      return `✅ Validation réussie (${warnings.length} avertissement${warnings.length !== 1 ? 's' : ''})`;
    } else {
      return `❌ Validation échouée: ${errors.length} erreur${errors.length !== 1 ? 's' : ''}, ${warnings.length} avertissement${warnings.length !== 1 ? 's' : ''}`;
    }
  }
}
```

---

## 8. Validation Complète

### 8.1 Pipeline de Validation

```typescript
class DOT3DValidator {
  validate(dotContent: string): ValidationResult {
    const results: ValidationMessage[] = [];

    // 1. Validation syntaxique
    results.push(...this.validateSyntax(dotContent));
    if (results.some((r) => r.type === ErrorType.SYNTAX_ERROR)) {
      return { success: false, messages: results };
    }

    // 2. Parse en AST
    const ast = this.parse(dotContent);

    // 3. Validation sémantique
    results.push(...this.validateGeometry(ast));
    results.push(...this.validateParticles(ast));
    results.push(...this.validateColors(ast));
    results.push(...this.validateGlobalConfig(ast));

    // 4. Validation de cohérence
    results.push(...this.validateConsistency(ast));

    // 5. Validation performance
    results.push(...this.validatePerformance(ast));

    const hasErrors = results.some(
      (r) => r.type === ErrorType.SYNTAX_ERROR || r.type === ErrorType.SEMANTIC_ERROR
    );

    return {
      success: !hasErrors,
      messages: results,
      summary: ValidationReporter.summarizeValidation(results),
    };
  }
}
```

Cette spécification complète de validation garantit que tous les graphiques DOT 3D sont syntaxiquement corrects, sémantiquement cohérents et optimisés pour la performance.
