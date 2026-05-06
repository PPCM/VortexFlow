import type { Mock } from 'vitest';
// Tests for the pure-logic DOT→3D converter helpers exposed by
// GraphRenderer3D. The renderer itself is React + 3d-force-graph + three.js
// and is not exercised here; we only test the static methods that take
// strings and return data.
//
// 3d-force-graph and three.js use Canvas/WebGL APIs that jsdom does not
// implement, so we stub them at import time.

vi.mock('3d-force-graph', () => ({ __esModule: true, default: vi.fn() }));
vi.mock('three', () => ({}));
vi.mock('three-spritetext', () => ({ __esModule: true, default: vi.fn() }));

import { DotTo3DConverter } from './GraphRenderer3D';

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const Cls = DotTo3DConverter as any;

// ----------------------------------------------------------------------------
// parseBoolean (private)
// ----------------------------------------------------------------------------
describe('parseBoolean', () => {
  test.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['false', false],
    ['FALSE', false],
    ['0', false],
  ])('parses "%s" as %s', (input, expected) => {
    expect(Cls.parseBoolean(input)).toBe(expected);
  });

  test('returns undefined for empty/missing input', () => {
    expect(Cls.parseBoolean(undefined)).toBeUndefined();
    expect(Cls.parseBoolean('')).toBeUndefined();
  });

  test('returns undefined for ambiguous values', () => {
    expect(Cls.parseBoolean('maybe')).toBeUndefined();
    expect(Cls.parseBoolean('2')).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------
// parseGeometry (private)
// ----------------------------------------------------------------------------
describe('parseGeometry', () => {
  test.each([
    ['Box', '3d-box'],
    ['Cone', '3d-cone'],
    ['Cylinder', '3d-cylinder'],
    ['Sphere', '3d-sphere'],
    ['Torus', '3d-torus'],
  ])('maps "%s" to "%s"', (input, expected) => {
    expect(Cls.parseGeometry(input)).toBe(expected);
  });

  test('lowercases the input before mapping', () => {
    expect(Cls.parseGeometry('BOX')).toBe('3d-box');
    expect(Cls.parseGeometry('sphere')).toBe('3d-sphere');
  });

  test('returns undefined for unknown geometry', () => {
    expect(Cls.parseGeometry('Pyramid')).toBeUndefined();
    expect(Cls.parseGeometry(undefined)).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------
// parseDimensions (private)
// ----------------------------------------------------------------------------
describe('parseDimensions', () => {
  test('parses strict JSON', () => {
    expect(Cls.parseDimensions('{"radius": 1.5}')).toEqual({ radius: 1.5 });
  });

  test('parses unquoted-key JS object literals', () => {
    expect(Cls.parseDimensions('{width: 2.0, height: 1.0, depth: 3.0}'))
      .toEqual({ width: 2.0, height: 1.0, depth: 3.0 });
  });

  test('returns undefined when input is missing', () => {
    expect(Cls.parseDimensions(undefined)).toBeUndefined();
  });

  test('falls back to a Box default when input mentions width+height but is malformed', () => {
    // A wholly invalid string that still mentions both keys → defensive default.
    const out = Cls.parseDimensions('{width: oops, height: ');
    expect(out).toEqual({ width: 2.0, height: 2.0, depth: 2.0 });
  });

  test('falls back to a Cylinder default when input mentions radius but is malformed', () => {
    const out = Cls.parseDimensions('{radius: bad');
    expect(out).toEqual({ radius: 1.0, height: 2.0 });
  });

  test('falls back to a Torus default when input mentions tube but is malformed', () => {
    const out = Cls.parseDimensions('{tube: bad');
    expect(out).toEqual({ tube: 0.4, tubularSegments: 12, radialSegments: 8 });
  });

  test('returns undefined for malformed input that does not match any default pattern', () => {
    expect(Cls.parseDimensions('totally garbage')).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------
// parseAttributes (private)
// ----------------------------------------------------------------------------
describe('parseAttributes', () => {
  test('returns empty object for empty input', () => {
    expect(Cls.parseAttributes('')).toEqual({});
    expect(Cls.parseAttributes(undefined)).toEqual({});
  });

  test('parses quoted values', () => {
    expect(Cls.parseAttributes('label="My Node", color="red"'))
      .toEqual({ label: 'My Node', color: 'red' });
  });

  test('parses unquoted values', () => {
    expect(Cls.parseAttributes('shape=box, size=10'))
      .toEqual({ shape: 'box', size: '10' });
  });

  test('mixed quoted and unquoted values', () => {
    expect(Cls.parseAttributes('label="Hello", size=10, color="blue"'))
      .toEqual({ label: 'Hello', size: '10', color: 'blue' });
  });
});

// ----------------------------------------------------------------------------
// parseDotToGraphDataFrontend
// ----------------------------------------------------------------------------
describe('parseDotToGraphDataFrontend', () => {
  test('extracts simple A->B edges and creates corresponding nodes', () => {
    const r = DotTo3DConverter.parseDotToGraphDataFrontend(
      'digraph G { A -> B; B -> C }',
    );
    expect(r.nodes.map((n) => n.id).sort()).toEqual(['A', 'B', 'C']);
    expect(r.links).toHaveLength(2);
    expect(r.links[0]).toEqual(expect.objectContaining({ source: 'A', target: 'B' }));
  });

  test('skips DOT keywords used as node ids (e.g. "node", "graph")', () => {
    const r = DotTo3DConverter.parseDotToGraphDataFrontend(
      'digraph G { node -> A; A -> B }',
    );
    // "node" is a keyword, so the node->A edge is dropped.
    expect(r.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
  });

  test('attaches edge attributes (color, label, weight)', () => {
    const r = DotTo3DConverter.parseDotToGraphDataFrontend(
      'digraph G { A -> B [color="red", label="link", weight=3] }',
    );
    expect(r.links[0]).toEqual(expect.objectContaining({
      source: 'A',
      target: 'B',
      color: 'red',
      name: 'link',
      value: 3,
    }));
  });

  test('attaches 3D node attributes (geometry, particleGeneration)', () => {
    const r = DotTo3DConverter.parseDotToGraphDataFrontend(
      `digraph G {
         A [geometry="Box", particleGeneration=10]
         A -> B
       }`,
    );
    const a = r.nodes.find((n) => n.id === 'A')!;
    expect(a.geometry).toBe('3d-box');
    expect(a.particleGeneration).toBe(10);
  });

  test('parses global graph[...] settings', () => {
    const r = DotTo3DConverter.parseDotToGraphDataFrontend(
      'digraph G { graph [defaultNodeSize=12, autoColors=false]; A -> B }',
    );
    expect(r.globalSettings?.defaultNodeSize).toBe(12);
    expect(r.globalSettings?.autoColors).toBe(false);
  });

  test('returns sane defaults for an empty graph body', () => {
    const r = DotTo3DConverter.parseDotToGraphDataFrontend('digraph G { }');
    expect(r.nodes).toEqual([]);
    expect(r.links).toEqual([]);
    expect(r.globalSettings).toEqual(expect.objectContaining({
      defaultNodeSize: 6,
      autoColors: true,
      autoResize: true,
      particlesEnabled: true,
      bloomEffect: true,
    }));
  });
});

// ----------------------------------------------------------------------------
// convertBackendDataToGraph
// ----------------------------------------------------------------------------
describe('convertBackendDataToGraph', () => {
  test('maps backend payload to ForceGraph nodes and links', () => {
    const r = DotTo3DConverter.convertBackendDataToGraph({
      nodes: [
        { id: 'A', label: 'Alpha', size: '10', color: '#ff0000', geometry: 'Sphere' },
        { id: 'B', label: 'Beta' },
      ],
      links: [
        { source: 'A', target: 'B', label: 'link', color: '#00ff00', style: 'dashed' },
      ],
    });
    expect(r.nodes).toHaveLength(2);
    expect(r.nodes[0]).toEqual(expect.objectContaining({
      id: 'A', name: 'Alpha', val: 10, color: '#ff0000', geometry: '3d-sphere',
    }));
    // Defaults applied where backend omits values.
    expect(r.nodes[1]).toEqual(expect.objectContaining({
      id: 'B', name: 'Beta', color: '#1976D2',
    }));
    expect(r.links[0]).toEqual(expect.objectContaining({
      source: 'A', target: 'B', name: 'link', color: '#00ff00', style: 'dashed',
    }));
  });

  test('respects explicit globalSettings overrides', () => {
    const r = DotTo3DConverter.convertBackendDataToGraph({
      nodes: [],
      links: [],
      globalSettings: {
        defaultNodeSize: 20,
        autoColors: false,
        bloomEffect: false,
      },
    });
    expect(r.globalSettings).toEqual(expect.objectContaining({
      defaultNodeSize: 20,
      autoColors: false,
      bloomEffect: false,
      // Unset flags default to true.
      autoResize: true,
      particlesEnabled: true,
    }));
  });

  test('handles missing nodes/links arrays gracefully', () => {
    const r = DotTo3DConverter.convertBackendDataToGraph({});
    expect(r.nodes).toEqual([]);
    expect(r.links).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// parseDotToGraphData (uses fetch; falls back on error)
// ----------------------------------------------------------------------------
describe('parseDotToGraphData (network-aware)', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });
  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  test('uses backend payload when fetch succeeds', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        nodes: [{ id: 'X' }],
        links: [],
      }),
    });
    const r = await DotTo3DConverter.parseDotToGraphData('digraph G { X }');
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].id).toBe('X');
  });

  test('falls back to frontend parsing when fetch returns non-ok', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    });
    const r = await DotTo3DConverter.parseDotToGraphData('digraph G { A -> B }');
    expect(r.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
  });

  test('falls back to frontend parsing when fetch throws', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new Error('offline'));
    const r = await DotTo3DConverter.parseDotToGraphData('digraph G { A -> B }');
    expect(r.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
  });
});
