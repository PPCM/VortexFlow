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
      // VortexFlow extensions
      'flow_rate', 'capacity', 'latency', 'bandwidth',
      'packet_size', 'processing_time', 'queue_size',
      'failure_rate', 'recovery_time', 'priority'
    ]);

    this.nodeShapes = new Set([
      'box', 'circle', 'ellipse', 'point', 'egg', 'triangle',
      'diamond', 'trapezium', 'parallelogram', 'house',
      'pentagon', 'hexagon', 'septagon', 'octagon',
      'plaintext', 'record', 'Mrecord'
    ]);

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

    // Check for graph declaration
    const graphMatch = dotCode.match(/^\s*(strict\s+)?(di)?graph\s+(\w+)?\s*\{/i);
    if (!graphMatch) {
      result.valid = false;
      result.errors.push('Missing graph declaration. Must start with "graph" or "digraph"');
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

    // Parse nodes
    const nodePattern = /(\w+)\s*(\[([^\]]*)\])?/g;
    let nodeMatch;
    while ((nodeMatch = nodePattern.exec(dotCode)) !== null) {
      if (!nodeMatch[0].includes('->') && !nodeMatch[0].includes('--')) {
        result.ast.nodes.push({
          id: nodeMatch[1],
          attributes: this.parseAttributes(nodeMatch[3] || '')
        });
        result.metadata.nodeCount++;
      }
    }

    // Parse edges
    const edgePattern = result.metadata.type === 'digraph' 
      ? /(\w+)\s*->\s*(\w+)(\s*\[([^\]]*)\])?/g
      : /(\w+)\s*--\s*(\w+)(\s*\[([^\]]*)\])?/g;
    
    let edgeMatch;
    while ((edgeMatch = edgePattern.exec(dotCode)) !== null) {
      result.ast.edges.push({
        from: edgeMatch[1],
        to: edgeMatch[2],
        attributes: this.parseAttributes(edgeMatch[4] || '')
      });
      result.metadata.edgeCount++;
    }

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

    // Check for semicolons (recommended but not required)
    const statements = dotCode.split(/[{}]/).filter(s => s.trim());
    for (const statement of statements) {
      const lines = statement.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim() && !line.trim().endsWith(';') && 
            !line.includes('graph') && !line.includes('{') && !line.includes('}')) {
          result.warnings.push(`Missing semicolon at end of statement: "${line.trim()}"`);
        }
      }
    }

    // Check for invalid characters in identifiers
    const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    let match;
    while ((match = identifierPattern.exec(dotCode)) !== null) {
      const identifier = match[1];
      if (identifier.length > 50) {
        result.warnings.push(`Identifier "${identifier}" is very long (${identifier.length} chars)`);
      }
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

    // Check for duplicate node definitions
    const seenNodes = new Set();
    for (const node of ast.nodes) {
      if (seenNodes.has(node.id)) {
        result.warnings.push(`Duplicate node definition: "${node.id}"`);
      }
      seenNodes.add(node.id);
    }

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

    // Check for isolated nodes
    const connectedNodes = new Set();
    for (const edge of ast.edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }
    for (const node of ast.nodes) {
      if (!connectedNodes.has(node.id)) {
        result.warnings.push(`Isolated node (no connections): "${node.id}"`);
      }
    }

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

    const vortexFlowAttrs = [
      'flow_rate', 'capacity', 'latency', 'bandwidth',
      'packet_size', 'processing_time', 'queue_size',
      'failure_rate', 'recovery_time', 'priority'
    ];

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
