const logger = require('./logger');

/**
 * DOT Language Validator and Parser
 * Validates and parses Graphviz DOT syntax with VortexFlow extensions
 */
class DotValidator {
  constructor() {
    // Extended DOT syntax keywords for VortexFlow
    this.keywords = new Set([
      'graph', 'digraph', 'subgraph', 'node', 'edge',
      'strict', 'label', 'color', 'style', 'shape',
      'fontsize', 'fontname', 'fontcolor', 'fillcolor',
      'width', 'height', 'penwidth', 'arrowhead', 'arrowtail',
      // VortexFlow legacy extensions
      'flow_rate', 'capacity', 'latency', 'bandwidth',
      'packet_size', 'processing_time', 'queue_size',
      'failure_rate', 'recovery_time', 'priority',
      // VortexFlow 3D extensions
      'geometry', 'dimensions', 'particleGeneration', 'maxParticleProcessing',
      'particleSpeed', 'maxParticleFlow', 'image', 'autoResize',
      'bloomEffect', 'particlesEnabled', 'autoColors', 'defaultNodeSize'
    ]);

    this.nodeShapes = new Set([
      // Standard DOT shapes
      'box', 'circle', 'ellipse', 'point', 'egg', 'triangle',
      'diamond', 'trapezium', 'parallelogram', 'house',
      'pentagon', 'hexagon', 'septagon', 'octagon',
      'plaintext', 'record', 'Mrecord',
      // VortexFlow 3D geometries
      'Sphere', 'Box', 'Cylinder', 'Cone', 'Torus'
    ]);

    // VortexFlow 3D geometries validation
    this.geometries3D = new Set([
      'Sphere', 'Box', 'Cylinder', 'Cone', 'Torus'
    ]);

    // Dimension parameters for each geometry
    this.geometryDimensions = {
      'Sphere': ['radius'],
      'Box': ['width', 'height', 'depth'],
      'Cylinder': ['radius', 'height'],
      'Cone': ['radius', 'height'],
      'Torus': ['radius', 'tube']
    };

    this.edgeStyles = new Set([
      'solid', 'dashed', 'dotted', 'bold', 'invis'
    ]);

    this.arrowTypes = new Set([
      'normal', 'inv', 'dot', 'invdot', 'odot', 'invodot',
      'none', 'tee', 'empty', 'invempty', 'diamond',
      'odiamond', 'ediamond', 'crow', 'box', 'obox',
      'open', 'halfopen', 'vee'
    ]);
  }

  /**
   * Validate DOT code syntax and semantics
   * @param {string} dotCode - The DOT code to validate
   * @returns {Object} Validation result with errors and warnings
   */
  async validate(dotCode) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {
        type: null,
        nodeCount: 0,
        edgeCount: 0,
        subgraphCount: 0,
        hasVortexFlowExtensions: false
      }
    };

    if (!dotCode || typeof dotCode !== 'string') {
      result.valid = false;
      result.errors.push('Invalid DOT code: must be a non-empty string');
      return result;
    }

    try {
      // Clean and prepare code
      const cleanCode = this.cleanDotCode(dotCode);
      
      // Parse structure
      const parseResult = this.parseDotStructure(cleanCode);
      result.metadata = { ...result.metadata, ...parseResult.metadata };
      
      if (!parseResult.valid) {
        result.valid = false;
        result.errors.push(...parseResult.errors);
        return result;
      }

      // Validate syntax
      const syntaxResult = this.validateSyntax(cleanCode);
      if (!syntaxResult.valid) {
        result.valid = false;
        result.errors.push(...syntaxResult.errors);
      }
      result.warnings.push(...syntaxResult.warnings);

      // Validate semantics
      const semanticResult = this.validateSemantics(parseResult.ast);
      if (!semanticResult.valid) {
        result.valid = false;
        result.errors.push(...semanticResult.errors);
      }
      result.warnings.push(...semanticResult.warnings);

      // Check VortexFlow extensions
      const extensionResult = this.validateVortexFlowExtensions(cleanCode);
      result.metadata.hasVortexFlowExtensions = extensionResult.hasExtensions;
      result.warnings.push(...extensionResult.warnings);

      // Performance warnings
      this.addPerformanceWarnings(result);

    } catch (error) {
      result.valid = false;
      result.errors.push(`Parse error: ${error.message}`);
      logger.error('DOT validation error', { error: error.message, dotCode: dotCode.substring(0, 200) });
    }

    return result;
  }

  /**
   * Clean DOT code by removing comments and normalizing whitespace
   */
  cleanDotCode(dotCode) {
    return dotCode
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove C-style comments
      .replace(/#.*$/gm, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse the basic structure of DOT code
   */
  parseDotStructure(dotCode) {
    const result = {
      valid: true,
      errors: [],
      metadata: {
        type: null,
        nodeCount: 0,
        edgeCount: 0,
        subgraphCount: 0
      },
      ast: {
        nodes: [],
        edges: [],
        subgraphs: [],
        attributes: {}
      }
    };

    // Clean comments FIRST before checking graph declaration
    const cleanedForDeclaration = dotCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/\/\/.*$/gm, '') // Remove // comments
      .trim();

    // Check for graph declaration on cleaned content
    const graphMatch = cleanedForDeclaration.match(/^\s*(strict\s+)?(di)?graph\s+(\w+)?\s*\{/i);
    if (!graphMatch) {
      result.valid = false;
      result.errors.push('Missing graph declaration. Must start with "graph" or "digraph"');
      console.log('[BACKEND] DOT content received:', dotCode.substring(0, 200) + '...');
      console.log('[BACKEND] Cleaned content for check:', cleanedForDeclaration.substring(0, 200) + '...');
      return result;
    }

    result.metadata.type = graphMatch[2] ? 'digraph' : 'graph';

    // Check for matching braces
    const openBraces = (dotCode.match(/\{/g) || []).length;
    const closeBraces = (dotCode.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      result.valid = false;
      result.errors.push('Mismatched braces in graph structure');
      return result;
    }

    // ===== ROBUST DOT PARSER V2 =====
    // Liste étendue des mots-clés DOT à exclure
    const dotKeywords = new Set([
      'digraph', 'graph', 'subgraph', 'node', 'edge', 'strict',
      'cluster', 'rank', 'rankdir', 'label', 'style', 'color',
      'shape', 'size', 'width', 'height', 'fontname', 'fontsize',
      'bgcolor', 'margin', 'pad', 'nodesep', 'ranksep', 'splines',
      'overlap', 'concentrate', 'compound', 'lhead', 'ltail',
      'exemple', 'example' // Mots d'exemple courants
    ]);

    // Nettoyer le contenu DOT
    const cleanContent = dotCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Supprimer commentaires /* */
      .replace(/\/\/.*$/gm, '') // Supprimer commentaires //
      .replace(/^\s*(strict\s+)?(di)?graph\s+\w*\s*\{/i, '') // Supprimer déclaration graph
      .replace(/\}\s*$/g, '') // Supprimer accolade fermante
      .replace(/;/g, '') // Supprimer points-virgules
      .replace(/\s+/g, ' ') // Normaliser espaces
      .trim();

    console.log('[BACKEND] Contenu DOT nettoyé:', cleanContent);

    // Map pour éviter les doublons de nœuds
    const nodeMap = new Map();
    const connectedNodeIds = new Set();

    // ÉTAPE 1: Parser les arêtes UNIQUEMENT pour identifier les nœuds connectés
    const edgePattern = result.metadata.type === 'digraph' 
      ? /([A-Za-z]\w*)\s*->\s*([A-Za-z]\w*)(?:\s*\[([^\]]*)\])?/g
      : /([A-Za-z]\w*)\s*--\s*([A-Za-z]\w*)(?:\s*\[([^\]]*)\])?/g;
    
    let edgeMatch;
    edgePattern.lastIndex = 0; // Reset regex
    
    while ((edgeMatch = edgePattern.exec(cleanContent)) !== null) {
      const fromId = edgeMatch[1];
      const toId = edgeMatch[2];
      
      // Filtrer les mots-clés DOT
      if (dotKeywords.has(fromId.toLowerCase()) || dotKeywords.has(toId.toLowerCase())) {
        continue;
      }
      
      // Marquer comme connectés
      connectedNodeIds.add(fromId);
      connectedNodeIds.add(toId);
      
      // Créer les nœuds s'ils n'existent pas
      if (!nodeMap.has(fromId)) {
        nodeMap.set(fromId, {
          id: fromId,
          attributes: {}
        });
      }
      if (!nodeMap.has(toId)) {
        nodeMap.set(toId, {
          id: toId,
          attributes: {}
        });
      }
      
      // Ajouter l'arête
      result.ast.edges.push({
        from: fromId,
        to: toId,
        attributes: this.parseAttributes(edgeMatch[3] || '')
      });
      result.metadata.edgeCount++;
    }

    // ÉTAPE 2: Parser les attributs des nœuds et enrichir les nœuds existants
    // Il faut éviter de confondre les attributs des nœuds avec ceux des liens
    // Utiliser une approche qui ne dépend pas des sauts de ligne
    
    console.log('[BACKEND DEBUG] Contenu nettoyé \u00e0 parser:', cleanContent);
    
    // Approche: parser toutes les déclarations de nœuds, puis filtrer celles qui ne font pas partie d'arêtes
    const edgeOperators = result.metadata.type === 'digraph' ? ['->', '<-'] : ['--'];
    
    // D'abord, identifier toutes les positions des arêtes pour les exclure
    // Utiliser la même regex que pour parser les arêtes, mais pour capturer les positions
    const nodeEdgePattern = result.metadata.type === 'digraph' 
      ? /([A-Za-z]\w*)\s*->\s*([A-Za-z]\w*)\s*(?:\[([^\]]*)\])?/g
      : /([A-Za-z]\w*)\s*--\s*([A-Za-z]\w*)\s*(?:\[([^\]]*)\])?/g;
    
    const edgeRanges = [];
    let nodeEdgeMatch;
    nodeEdgePattern.lastIndex = 0;
    
    while ((nodeEdgeMatch = nodeEdgePattern.exec(cleanContent)) !== null) {
      const range = {
        start: nodeEdgeMatch.index,
        end: nodeEdgeMatch.index + nodeEdgeMatch[0].length
      };
      console.log(`[BACKEND DEBUG] Plage arête détectée: "${nodeEdgeMatch[0]}" positions ${range.start}-${range.end}`);
      edgeRanges.push(range);
    }
    
    // Maintenant parser les nœuds avec attributs en excluant ceux dans les arêtes
    const nodeWithAttrsRegex = /([A-Za-z]\w*)\s*\[([^\]]*)\]/g;
    let nodeAttrMatch;
    
    while ((nodeAttrMatch = nodeWithAttrsRegex.exec(cleanContent)) !== null) {
      const nodeId = nodeAttrMatch[1];
      const attrsString = nodeAttrMatch[2];
      const matchStart = nodeAttrMatch.index;
      const matchEnd = nodeAttrMatch.index + nodeAttrMatch[0].length;
      
      // Vérifier si cette déclaration fait partie d'une arête
      const isPartOfEdge = edgeRanges.some(range => 
        matchStart >= range.start && matchEnd <= range.end
      );
      
      // Si ce n'est pas partie d'une arête, traiter comme attributs de nœud
      if (!isPartOfEdge) {
        // Filtrer les mots-clés DOT
        if (dotKeywords.has(nodeId.toLowerCase())) {
          continue;
        }
        
        console.log(`[BACKEND DEBUG] Traitement attributs nœud ${nodeId}: "${attrsString}"`);
        
        // Mettre à jour ou créer le nœud
        if (nodeMap.has(nodeId)) {
          // Enrichir nœud existant
          const existingNode = nodeMap.get(nodeId);
          existingNode.attributes = { ...existingNode.attributes, ...this.parseAttributes(attrsString) };
        } else if (connectedNodeIds.has(nodeId)) {
          // Créer nœud seulement s'il est connecté
          nodeMap.set(nodeId, {
            id: nodeId,
            attributes: this.parseAttributes(attrsString)
          });
        }
      } else {
        console.log(`[BACKEND DEBUG] Ignoré car partie d'arête: ${nodeId} [${attrsString}]`);
      }
    }

    // Convertir la Map en array pour result.ast.nodes
    result.ast.nodes = Array.from(nodeMap.values());
    result.metadata.nodeCount = result.ast.nodes.length;

    console.log('[BACKEND] Nœuds traités:', Array.from(nodeMap.keys()));
    console.log('[BACKEND] Liens créés:', result.metadata.edgeCount);
    console.log('[BACKEND DEBUG] Détail des nœuds:');
    result.ast.nodes.forEach(node => {
      console.log(`  - Nœud ${node.id}: label="${node.attributes.label}", attributes:`, node.attributes);
    });
    console.log('[BACKEND DEBUG] Détail des liens:');
    result.ast.edges.forEach(edge => {
      console.log(`  - Lien ${edge.from}->${edge.to}: label="${edge.attributes.label}", attributes:`, edge.attributes);
    });

    // Parse subgraphs
    const subgraphPattern = /subgraph\s+(\w+)?\s*\{([^}]*)\}/g;
    let subgraphMatch;
    while ((subgraphMatch = subgraphPattern.exec(dotCode)) !== null) {
      result.ast.subgraphs.push({
        id: subgraphMatch[1],
        content: subgraphMatch[2]
      });
      result.metadata.subgraphCount++;
    }

    // ÉTAPE 4: Extraire les attributs globaux de type "graph [...]"
    const globalGraphPattern = /graph\s*\[([^\]]+)\]/gi;
    let globalMatch;
    while ((globalMatch = globalGraphPattern.exec(dotCode)) !== null) {
      const globalAttrs = this.parseAttributes(globalMatch[1]);
      // Fusionner avec les attributs existants
      result.ast.attributes = { ...result.ast.attributes, ...globalAttrs };
      console.log('[BACKEND] Attributs globaux trouvés:', globalAttrs);
    }

    return result;
  }

  /**
   * Parse attribute string into key-value pairs
   */
  parseAttributes(attributeString) {
    const attributes = {};
    if (!attributeString) return attributes;

    const attrPattern = /(\w+)\s*=\s*("([^"]*)"|(\w+))/g;
    let match;
    while ((match = attrPattern.exec(attributeString)) !== null) {
      const key = match[1];
      const value = match[3] || match[4];
      attributes[key] = value;
    }
    return attributes;
  }

  /**
   * Validate DOT syntax rules
   */
  validateSyntax(dotCode) {
    const result = { valid: true, errors: [], warnings: [] };

    // Clean code for analysis
    let cleanCode = dotCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/\/\/.*$/gm, ''); // Remove // comments

    // Check for semicolons on global settings (single line assignments)
    const globalSettingPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[^;\n]+$/gm;
    let match = globalSettingPattern.exec(cleanCode);
    while (match !== null) {
      const line = match[0].trim();
      if (!line.endsWith(';') && !line.includes('[') && !line.includes('{')) {
        result.warnings.push(`Missing semicolon at end of global setting: "${line}"`);
      }
      match = globalSettingPattern.exec(cleanCode);
    }

    // Check node declarations (can be multi-line) - match complete nodes with brackets
    const nodePattern = /\w+\s*\[([\s\S]*?)\];?/g;
    match = nodePattern.exec(cleanCode);
    while (match !== null) {
      const fullMatch = match[0].trim();
      if (!fullMatch.endsWith('];')) {
        // Only warn if it's clearly missing semicolon, not a formatting issue
        if (fullMatch.endsWith(']')) {
          result.warnings.push(`Node declaration should end with ]; : "${fullMatch.substring(0, 50)}..."`);
        }
      }
      match = nodePattern.exec(cleanCode);
    }

    // Check edge declarations - match complete edge statements
    const edgePattern = /\w+\s*->\s*\w+[^;]*?(?=;|\n|$)/g;
    match = edgePattern.exec(cleanCode);
    while (match !== null) {
      const edgeMatch = match[0].trim();
      // Look ahead to see if semicolon follows
      const nextChar = cleanCode.charAt(match.index + match[0].length);
      if (nextChar !== ';' && !edgeMatch.includes('[')) {
        result.warnings.push(`Edge declaration should end with ; : "${edgeMatch}"`);
      }
      match = edgePattern.exec(cleanCode);
    }

    // Check for invalid characters in identifiers
    const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    match = identifierPattern.exec(dotCode);
    while (match !== null) {
      const identifier = match[1];
      if (identifier.length > 50) {
        result.warnings.push(`Identifier "${identifier}" is very long (${identifier.length} chars)`);
      }
      match = identifierPattern.exec(dotCode);
    }

    // Check for proper quoting of labels with spaces
    const labelPattern = /label\s*=\s*([^",\]]+[^"\],]*)/g;
    while ((match = labelPattern.exec(dotCode)) !== null) {
      const label = match[1].trim();
      if (label.includes(' ') && !label.startsWith('"')) {
        result.warnings.push(`Label with spaces should be quoted: "${label}"`);
      }
    }

    return result;
  }

  /**
   * Validate semantic rules and graph consistency
   */
  validateSemantics(ast) {
    const result = { valid: true, errors: [], warnings: [] };

    // Check for undefined nodes in edges
    const nodeIds = new Set(ast.nodes.map(n => n.id));
    for (const edge of ast.edges) {
      if (!nodeIds.has(edge.from)) {
        result.warnings.push(`Edge references undefined node: "${edge.from}"`);
      }
      if (!nodeIds.has(edge.to)) {
        result.warnings.push(`Edge references undefined node: "${edge.to}"`);
      }
    }

    // Note: Duplicate node definitions are now prevented by the robust parser V2

    // Validate node attributes
    for (const node of ast.nodes) {
      const attrResult = this.validateNodeAttributes(node.attributes);
      if (!attrResult.valid) {
        result.warnings.push(...attrResult.warnings);
      }
    }

    // Validate edge attributes
    for (const edge of ast.edges) {
      const attrResult = this.validateEdgeAttributes(edge.attributes);
      if (!attrResult.valid) {
        result.warnings.push(...attrResult.warnings);
      }
    }

    // Note: Isolated nodes are now filtered out by the robust parser V2

    return result;
  }

  /**
   * Validate node attributes
   */
  validateNodeAttributes(attributes) {
    const result = { valid: true, warnings: [] };

    if (attributes.shape && !this.nodeShapes.has(attributes.shape)) {
      result.warnings.push(`Unknown node shape: "${attributes.shape}"`);
    }

    if (attributes.style && !this.edgeStyles.has(attributes.style)) {
      result.warnings.push(`Unknown node style: "${attributes.style}"`);
    }

    if (attributes.fontsize) {
      const fontSize = parseFloat(attributes.fontsize);
      if (isNaN(fontSize) || fontSize <= 0) {
        result.warnings.push(`Invalid font size: "${attributes.fontsize}"`);
      } else if (fontSize > 72) {
        result.warnings.push(`Very large font size: ${fontSize}`);
      }
    }

    return result;
  }

  /**
   * Validate edge attributes
   */
  validateEdgeAttributes(attributes) {
    const result = { valid: true, warnings: [] };

    if (attributes.style && !this.edgeStyles.has(attributes.style)) {
      result.warnings.push(`Unknown edge style: "${attributes.style}"`);
    }

    if (attributes.arrowhead && !this.arrowTypes.has(attributes.arrowhead)) {
      result.warnings.push(`Unknown arrowhead type: "${attributes.arrowhead}"`);
    }

    if (attributes.arrowtail && !this.arrowTypes.has(attributes.arrowtail)) {
      result.warnings.push(`Unknown arrowtail type: "${attributes.arrowtail}"`);
    }

    if (attributes.penwidth) {
      const penWidth = parseFloat(attributes.penwidth);
      if (isNaN(penWidth) || penWidth <= 0) {
        result.warnings.push(`Invalid pen width: "${attributes.penwidth}"`);
      }
    }

    return result;
  }

  /**
   * Validate VortexFlow specific extensions
   */
  validateVortexFlowExtensions(dotCode) {
    const result = { hasExtensions: false, warnings: [] };

    // Legacy VortexFlow attributes
    const vortexFlowAttrs = [
      'flow_rate', 'capacity', 'latency', 'bandwidth',
      'packet_size', 'processing_time', 'queue_size',
      'failure_rate', 'recovery_time', 'priority'
    ];

    // VortexFlow 3D attributes
    const vortexFlow3DAttrs = [
      'geometry', 'dimensions', 'particleGeneration', 'maxParticleProcessing',
      'particleSpeed', 'maxParticleFlow', 'image', 'autoResize',
      'bloomEffect', 'particlesEnabled', 'autoColors', 'defaultNodeSize'
    ];

    // Check legacy attributes
    for (const attr of vortexFlowAttrs) {
      if (dotCode.includes(attr)) {
        result.hasExtensions = true;
        
        // Validate numeric attributes
        const pattern = new RegExp(`${attr}\\s*=\\s*"?([^",\\]]+)"?`, 'g');
        let match;
        while ((match = pattern.exec(dotCode)) !== null) {
          const value = match[1].trim();
          
          if (['flow_rate', 'capacity', 'bandwidth', 'packet_size', 
               'processing_time', 'queue_size', 'recovery_time'].includes(attr)) {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
              result.warnings.push(`Invalid ${attr} value: "${value}" (must be positive number)`);
            }
          }
          
          if (attr === 'failure_rate') {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0 || numValue > 1) {
              result.warnings.push(`Invalid failure_rate: "${value}" (must be between 0 and 1)`);
            }
          }
          
          if (attr === 'priority') {
            const numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 1 || numValue > 10) {
              result.warnings.push(`Invalid priority: "${value}" (must be integer 1-10)`);
            }
          }
        }
      }
    }

    // Check 3D attributes
    for (const attr of vortexFlow3DAttrs) {
      if (dotCode.includes(attr)) {
        result.hasExtensions = true;
        
        // Validate 3D attributes
        const validate3DResult = this.validate3DAttributes(dotCode, attr);
        result.warnings.push(...validate3DResult.warnings);
      }
    }

    return result;
  }

  /**
   * Validate 3D specific attributes
   */
  validate3DAttributes(dotCode, attribute) {
    const result = { warnings: [] };
    
    // Pattern matches: attribute = "value", attribute = {complex: value}, or attribute = bare-token.
    // Note: backslashes must be doubled so `\s` reaches the RegExp constructor intact.
    const pattern = new RegExp(
      `${attribute}\\s*=\\s*(?:"([^"]*)"|(\\{[^}]*\\})|([^,\\];\\s]+))`,
      'g'
    );
    let match;

    while ((match = pattern.exec(dotCode)) !== null) {
      // Extract value from quoted (group 1), braced object (group 2), or unquoted (group 3)
      const value = (match[1] || match[2] || match[3]).trim();

      switch (attribute) {
        case 'geometry':
          if (!this.geometries3D.has(value)) {
            result.warnings.push(`Unknown 3D geometry: "${value}". Valid geometries: ${Array.from(this.geometries3D).join(', ')}`);
          }
          break;

        case 'dimensions':
          try {
            // Support both JSON-strict and JavaScript object literal syntax
            let dimensions;
            
            // If it looks like JSON (quoted keys), parse as JSON
            if (value.includes('"')) {
              dimensions = JSON.parse(value);
            } else {
              // Convert JavaScript object literal to JSON and parse
              // Handle unquoted keys: {width: 1.0} -> {"width": 1.0}
              const jsonString = value.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
              dimensions = JSON.parse(jsonString);
            }
            
            if (typeof dimensions !== 'object' || dimensions === null) {
              result.warnings.push(`Invalid dimensions format: "${value}" (must be object)`);
            } else {
              // Validate dimension values are positive numbers
              for (const [key, val] of Object.entries(dimensions)) {
                const numVal = parseFloat(val);
                if (isNaN(numVal) || numVal <= 0) {
                  result.warnings.push(`Invalid dimension ${key}: "${val}" (must be positive number)`);
                }
              }
            }
          } catch (e) {
            result.warnings.push(`Invalid dimensions format: "${value}" - ${e.message}`);
          }
          break;

        case 'particleGeneration':
        case 'maxParticleProcessing':
        case 'particleSpeed':
        case 'maxParticleFlow':
        case 'defaultNodeSize':
          const numValue = parseFloat(value);
          if (isNaN(numValue) || numValue < 0) {
            result.warnings.push(`Invalid ${attribute}: "${value}" (must be non-negative number)`);
          }
          if (attribute === 'particleSpeed' && numValue > 100) {
            result.warnings.push(`Very high particle speed: ${numValue} (may impact performance)`);
          }
          break;

        case 'autoResize':
        case 'bloomEffect':
        case 'particlesEnabled':
        case 'autoColors':
          if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
            result.warnings.push(`Invalid boolean value for ${attribute}: "${value}" (use true/false or 1/0)`);
          }
          break;

        case 'image':
          // Basic URL/path validation
          if (value && !value.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) && !value.startsWith('http')) {
            result.warnings.push(`Image path "${value}" may not be a valid image file`);
          }
          break;
      }
    }

    return result;
  }

  /**
   * Validate geometry and dimensions consistency
   */
  validateGeometryDimensions(geometry, dimensions) {
    const result = { warnings: [] };
    
    if (!this.geometries3D.has(geometry)) {
      return result;
    }

    const requiredDimensions = this.geometryDimensions[geometry];
    if (!requiredDimensions) {
      return result;
    }

    try {
      const dims = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
      
      // Check for missing required dimensions
      for (const reqDim of requiredDimensions) {
        if (!(reqDim in dims)) {
          result.warnings.push(`Geometry "${geometry}" missing required dimension: "${reqDim}"`);
        }
      }

      // Check for unexpected dimensions
      for (const dimKey of Object.keys(dims)) {
        if (!requiredDimensions.includes(dimKey)) {
          result.warnings.push(`Geometry "${geometry}" has unexpected dimension: "${dimKey}". Expected: ${requiredDimensions.join(', ')}`);
        }
      }

    } catch (e) {
      result.warnings.push(`Cannot validate dimensions for geometry "${geometry}": invalid JSON`);
    }

    return result;
  }

  /**
   * Add performance-related warnings
   */
  addPerformanceWarnings(result) {
    if (result.metadata.nodeCount > 1000) {
      result.warnings.push(`Large graph (${result.metadata.nodeCount} nodes) may impact performance`);
    }
    
    if (result.metadata.edgeCount > 2000) {
      result.warnings.push(`Many edges (${result.metadata.edgeCount}) may slow down rendering`);
    }
    
    if (result.metadata.subgraphCount > 50) {
      result.warnings.push(`Many subgraphs (${result.metadata.subgraphCount}) may affect layout`);
    }
  }

  /**
   * Generate example DOT code with VortexFlow extensions
   */
  generateExample(type = 'network') {
    switch (type) {
      case 'network':
        return `digraph NetworkFlow {
  rankdir=LR;
  
  // Nodes with VortexFlow attributes
  Router1 [label="Main Router", shape=box, processing_time=5];
  Router2 [label="Edge Router", shape=box, processing_time=3];
  Server1 [label="Web Server", shape=ellipse, processing_time=10];
  Server2 [label="DB Server", shape=ellipse, processing_time=15];
  
  // Edges with flow properties
  Router1 -> Router2 [label="100Mbps", capacity=100, latency=2];
  Router2 -> Server1 [label="50Mbps", capacity=50, latency=1];
  Router2 -> Server2 [label="25Mbps", capacity=25, latency=3];
  Server1 -> Server2 [label="DB Query", bandwidth=10, priority=5];
}`;

      case 'pipeline':
        return `digraph DataPipeline {
  // Data processing pipeline
  Source [label="Data Source", shape=box, flow_rate=1000];
  Filter [label="Filter", shape=diamond, processing_time=2];
  Transform [label="Transform", shape=box, processing_time=5];
  Sink [label="Data Sink", shape=ellipse, queue_size=500];
  
  Source -> Filter [packet_size=1024, priority=8];
  Filter -> Transform [packet_size=512, priority=7];
  Transform -> Sink [packet_size=256, priority=6];
}`;

      default:
        return `digraph SimpleExample {
  A [label="Node A"];
  B [label="Node B"];
  A -> B;
}`;
    }
  }
}

module.exports = new DotValidator();
