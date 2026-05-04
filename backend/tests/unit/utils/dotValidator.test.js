const validator = require('../../../src/utils/dotValidator');

describe('dotValidator', () => {
  // ----- Top-level validate() entrypoint -----
  describe('validate() input handling', () => {
    test('rejects null', async () => {
      const r = await validator.validate(null);
      expect(r.valid).toBe(false);
      expect(r.errors).toContain('Invalid DOT code: must be a non-empty string');
    });

    test('rejects empty string', async () => {
      const r = await validator.validate('');
      expect(r.valid).toBe(false);
    });

    test('rejects non-string input', async () => {
      const r = await validator.validate(42);
      expect(r.valid).toBe(false);
    });

    test('rejects code without a graph declaration', async () => {
      const r = await validator.validate('A -> B');
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => /Missing graph declaration/.test(e))).toBe(true);
    });
  });

  // ----- Graph type detection -----
  describe('graph type detection', () => {
    test('detects digraph', async () => {
      const r = await validator.validate('digraph G { A -> B }');
      expect(r.valid).toBe(true);
      expect(r.metadata.type).toBe('digraph');
    });

    test('detects undirected graph', async () => {
      const r = await validator.validate('graph G { A -- B }');
      expect(r.valid).toBe(true);
      expect(r.metadata.type).toBe('graph');
    });

    test('accepts strict prefix', async () => {
      const r = await validator.validate('strict digraph G { A -> B }');
      expect(r.valid).toBe(true);
      expect(r.metadata.type).toBe('digraph');
    });
  });

  // ----- Brace balance -----
  describe('brace balance', () => {
    test('flags mismatched braces', async () => {
      const r = await validator.validate('digraph G { A -> B { ');
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => /Mismatched braces/.test(e))).toBe(true);
    });
  });

  // ----- Node and edge counting -----
  describe('node and edge counting', () => {
    test('counts nodes connected through edges', async () => {
      const r = await validator.validate('digraph G { A -> B; B -> C }');
      expect(r.metadata.edgeCount).toBe(2);
      expect(r.metadata.nodeCount).toBe(3);
    });

    test('ignores isolated nodes (parser V2 behaviour)', async () => {
      // Per parser: only nodes appearing in edges are counted. This locks in the
      // documented V2 behaviour so future parser changes that alter it are caught.
      const r = await validator.validate('digraph G { Lonely [label="x"]; A -> B }');
      expect(r.metadata.nodeCount).toBe(2);
    });

    test('counts subgraphs', async () => {
      const dot = `digraph G {
        subgraph cluster_a { X -> Y }
        A -> B
      }`;
      const r = await validator.validate(dot);
      expect(r.metadata.subgraphCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ----- Comment stripping -----
  describe('cleanDotCode', () => {
    test('strips // single-line comments', () => {
      expect(validator.cleanDotCode('A -> B // comment')).toBe('A -> B');
    });

    test('strips /* multi-line */ comments', () => {
      expect(validator.cleanDotCode('A /* mid */ -> B')).toBe('A -> B');
    });

    test('strips # comments', () => {
      expect(validator.cleanDotCode('A -> B # remark')).toBe('A -> B');
    });

    test('normalises whitespace', () => {
      expect(validator.cleanDotCode('A   ->\n\tB')).toBe('A -> B');
    });
  });

  // ----- Attribute parsing -----
  describe('parseAttributes', () => {
    test('returns empty object for empty input', () => {
      expect(validator.parseAttributes('')).toEqual({});
      expect(validator.parseAttributes(undefined)).toEqual({});
    });

    test('parses quoted values', () => {
      expect(validator.parseAttributes('label="My Node", color=red'))
        .toEqual({ label: 'My Node', color: 'red' });
    });

    test('parses unquoted identifier values', () => {
      expect(validator.parseAttributes('shape=box')).toEqual({ shape: 'box' });
    });
  });

  // ----- Node attribute validation -----
  describe('validateNodeAttributes', () => {
    test('warns on unknown shape', () => {
      const r = validator.validateNodeAttributes({ shape: 'wibble' });
      expect(r.warnings.some((w) => /Unknown node shape/.test(w))).toBe(true);
    });

    test('accepts known shape', () => {
      const r = validator.validateNodeAttributes({ shape: 'box' });
      expect(r.warnings).toHaveLength(0);
    });

    test('accepts 3D geometry as shape', () => {
      const r = validator.validateNodeAttributes({ shape: 'Sphere' });
      expect(r.warnings).toHaveLength(0);
    });

    test('warns on negative font size', () => {
      const r = validator.validateNodeAttributes({ fontsize: '-3' });
      expect(r.warnings.some((w) => /Invalid font size/.test(w))).toBe(true);
    });

    test('warns on huge font size', () => {
      const r = validator.validateNodeAttributes({ fontsize: '200' });
      expect(r.warnings.some((w) => /Very large font size/.test(w))).toBe(true);
    });
  });

  // ----- Edge attribute validation -----
  describe('validateEdgeAttributes', () => {
    test('warns on unknown style', () => {
      const r = validator.validateEdgeAttributes({ style: 'squiggly' });
      expect(r.warnings.some((w) => /Unknown edge style/.test(w))).toBe(true);
    });

    test('warns on unknown arrowhead', () => {
      const r = validator.validateEdgeAttributes({ arrowhead: 'unicorn' });
      expect(r.warnings.some((w) => /Unknown arrowhead type/.test(w))).toBe(true);
    });

    test('warns on invalid penwidth', () => {
      const r = validator.validateEdgeAttributes({ penwidth: '-1' });
      expect(r.warnings.some((w) => /Invalid pen width/.test(w))).toBe(true);
    });
  });

  // ----- VortexFlow extension detection -----
  describe('validateVortexFlowExtensions', () => {
    test('flags presence of legacy extensions', () => {
      const r = validator.validateVortexFlowExtensions(
        'digraph G { A -> B [bandwidth=10, latency=2] }',
      );
      expect(r.hasExtensions).toBe(true);
    });

    test('flags presence of 3D extensions', () => {
      const r = validator.validateVortexFlowExtensions(
        'digraph G { A [geometry="Sphere"] }',
      );
      expect(r.hasExtensions).toBe(true);
    });

    test('warns on negative bandwidth', () => {
      const r = validator.validateVortexFlowExtensions(
        'digraph G { A -> B [bandwidth=-5] }',
      );
      expect(r.warnings.some((w) => /Invalid bandwidth/.test(w))).toBe(true);
    });

    test('warns on out-of-range failure_rate', () => {
      const r = validator.validateVortexFlowExtensions(
        'digraph G { A -> B [failure_rate=2.0] }',
      );
      expect(r.warnings.some((w) => /Invalid failure_rate/.test(w))).toBe(true);
    });

    test('warns on out-of-range priority', () => {
      const r = validator.validateVortexFlowExtensions(
        'digraph G { A -> B [priority=42] }',
      );
      expect(r.warnings.some((w) => /Invalid priority/.test(w))).toBe(true);
    });
  });

  // ----- 3D attribute validation -----
  describe('validate3DAttributes', () => {
    test('warns on unknown geometry', () => {
      const r = validator.validate3DAttributes(
        'A [geometry="Pyramid"]',
        'geometry',
      );
      expect(r.warnings.some((w) => /Unknown 3D geometry/.test(w))).toBe(true);
    });

    test('accepts valid geometry', () => {
      const r = validator.validate3DAttributes(
        'A [geometry="Sphere"]',
        'geometry',
      );
      expect(r.warnings).toHaveLength(0);
    });

    test('warns on negative particleGeneration', () => {
      const r = validator.validate3DAttributes(
        'A [particleGeneration=-1]',
        'particleGeneration',
      );
      expect(r.warnings.some((w) => /Invalid particleGeneration/.test(w))).toBe(true);
    });

    test('warns on very high particleSpeed', () => {
      const r = validator.validate3DAttributes(
        'A [particleSpeed=500]',
        'particleSpeed',
      );
      expect(r.warnings.some((w) => /Very high particle speed/.test(w))).toBe(true);
    });

    test('accepts boolean true/false for autoResize', () => {
      const r = validator.validate3DAttributes(
        'graph [autoResize=true]',
        'autoResize',
      );
      expect(r.warnings).toHaveLength(0);
    });

    test('warns on non-boolean for bloomEffect', () => {
      const r = validator.validate3DAttributes(
        'graph [bloomEffect=maybe]',
        'bloomEffect',
      );
      expect(r.warnings.some((w) => /Invalid boolean value/.test(w))).toBe(true);
    });

    test('warns on dubious image path', () => {
      const r = validator.validate3DAttributes(
        'A [image="not-an-image.txt"]',
        'image',
      );
      expect(r.warnings.some((w) => /may not be a valid image file/.test(w))).toBe(true);
    });

    test('accepts http URL for image', () => {
      const r = validator.validate3DAttributes(
        'A [image="http://example.com/x.png"]',
        'image',
      );
      expect(r.warnings).toHaveLength(0);
    });
  });

  // ----- Geometry/dimensions consistency -----
  describe('validateGeometryDimensions', () => {
    test('warns on missing required dimension', () => {
      const r = validator.validateGeometryDimensions('Box', '{"width":1,"height":1}');
      // Box requires width, height, depth
      expect(r.warnings.some((w) => /missing required dimension.*depth/.test(w))).toBe(true);
    });

    test('warns on unexpected dimension', () => {
      const r = validator.validateGeometryDimensions(
        'Sphere',
        '{"radius":1,"width":2}',
      );
      expect(r.warnings.some((w) => /unexpected dimension.*width/.test(w))).toBe(true);
    });

    test('accepts complete sphere dimensions', () => {
      const r = validator.validateGeometryDimensions('Sphere', '{"radius":1}');
      expect(r.warnings).toHaveLength(0);
    });

    test('accepts dimensions object passed directly', () => {
      const r = validator.validateGeometryDimensions(
        'Cylinder',
        { radius: 1, height: 2 },
      );
      expect(r.warnings).toHaveLength(0);
    });

    test('returns no warnings for unknown geometry (delegated elsewhere)', () => {
      const r = validator.validateGeometryDimensions('Pyramid', '{}');
      expect(r.warnings).toHaveLength(0);
    });
  });

  // ----- Performance warnings -----
  describe('addPerformanceWarnings', () => {
    test('warns on large node count', () => {
      const result = { warnings: [], metadata: { nodeCount: 1500, edgeCount: 0, subgraphCount: 0 } };
      validator.addPerformanceWarnings(result);
      expect(result.warnings.some((w) => /Large graph/.test(w))).toBe(true);
    });

    test('warns on many edges', () => {
      const result = { warnings: [], metadata: { nodeCount: 0, edgeCount: 5000, subgraphCount: 0 } };
      validator.addPerformanceWarnings(result);
      expect(result.warnings.some((w) => /Many edges/.test(w))).toBe(true);
    });

    test('warns on many subgraphs', () => {
      const result = { warnings: [], metadata: { nodeCount: 0, edgeCount: 0, subgraphCount: 100 } };
      validator.addPerformanceWarnings(result);
      expect(result.warnings.some((w) => /Many subgraphs/.test(w))).toBe(true);
    });

    test('no warnings for small graphs', () => {
      const result = { warnings: [], metadata: { nodeCount: 10, edgeCount: 10, subgraphCount: 1 } };
      validator.addPerformanceWarnings(result);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ----- Example generation -----
  describe('generateExample', () => {
    test('generates network example by default', () => {
      const dot = validator.generateExample();
      expect(dot).toMatch(/digraph/);
    });

    test('network example is itself valid', async () => {
      const dot = validator.generateExample('network');
      const r = await validator.validate(dot);
      expect(r.valid).toBe(true);
    });

    test('pipeline example is itself valid', async () => {
      const dot = validator.generateExample('pipeline');
      const r = await validator.validate(dot);
      expect(r.valid).toBe(true);
    });

    test('falls back to simple example for unknown type', () => {
      const dot = validator.generateExample('nope');
      expect(dot).toMatch(/SimpleExample/);
    });
  });

  // ----- End-to-end integration of validate() -----
  describe('validate() end-to-end', () => {
    test('valid digraph with VortexFlow extensions yields hasVortexFlowExtensions=true', async () => {
      const dot = `digraph Net {
        A [label="A", geometry="Sphere"]
        B [label="B"]
        A -> B [bandwidth=10, latency=2]
      }`;
      const r = await validator.validate(dot);
      expect(r.valid).toBe(true);
      expect(r.metadata.hasVortexFlowExtensions).toBe(true);
    });

    test('valid digraph without extensions yields hasVortexFlowExtensions=false', async () => {
      const dot = 'digraph G { A -> B; B -> C }';
      const r = await validator.validate(dot);
      expect(r.valid).toBe(true);
      expect(r.metadata.hasVortexFlowExtensions).toBe(false);
    });
  });
});
