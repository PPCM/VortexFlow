// Integration tests for /api/graphs CRUD core.
//
// Strategy: mock the models AND the auth middleware module so requireXyz
// helpers are pass-through. We inject `req.user` via the test app helper.
// The Graph model itself is mocked at the call sites we exercise.

const mockGraphFindAndCountAll = jest.fn();
const mockGraphFindByPk = jest.fn();
const mockGraphCreate = jest.fn();
const mockGraphVersionCreateFromGraph = jest.fn();

// Capture instances mutably so tests can swap them per case.
let lastGraphInstance = null;

jest.mock('../../../src/models', () => ({
  Graph: {
    findAndCountAll: (...args) => mockGraphFindAndCountAll(...args),
    findByPk: (...args) => mockGraphFindByPk(...args),
    create: (...args) => mockGraphCreate(...args),
  },
  GraphVersion: {
    createFromGraph: (...args) => mockGraphVersionCreateFromGraph(...args),
    findByGraph: jest.fn().mockResolvedValue([]),
  },
  GraphShare: {
    findByGraph: jest.fn().mockResolvedValue([]),
  },
  User: {},
  SimulationSession: {},
}));

// Make the auth helpers pass-through so we can drive the routes directly.
// Each helper attaches what the production handler expects (req.graph,
// req.graphPermission, etc.) so route handlers downstream still work.
jest.mock('../../../src/middleware/auth', () => ({
  validateSession: (req, res, next) => next(),
  requireEditor: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requireGraphAccess: () => async (req, res, next) => {
    // Test-time stand-in: look the graph up via the mocked Graph.findByPk
    // (set per test) and attach it. If the mock returns null, return 404
    // like the real middleware.
    const { Graph } = require('../../../src/models');
    const g = await Graph.findByPk(req.params.id);
    if (!g) {
      return res.status(404).json({ error: 'Graph not found', code: 'GRAPH_NOT_FOUND' });
    }
    req.graph = g;
    req.graphPermission = 'admin';
    next();
  },
  authRateLimit: (req, res, next) => next(),
  logActivity: () => (req, res, next) => next(),
}));

const request = require('supertest');
const graphRoutes = require('../../../src/routes/graphs');
const { buildTestApp } = require('../helpers/buildTestApp');

const TEST_USER = { id: 'user-1', role: 'editor', email: 'a@b.com' };

const buildApp = (user = TEST_USER) =>
  buildTestApp(graphRoutes, '/api/graphs', { user });

const makeGraph = (overrides = {}) => ({
  id: 'graph-1',
  user_id: TEST_USER.id,
  title: 'My Graph',
  description: 'desc',
  category: 'network',
  tags: ['demo'],
  is_public: false,
  is_template: false,
  template_category: null,
  view_count: 3,
  version: 1,
  last_simulation: null,
  dot_code: 'digraph G { A -> B }',
  simulation_config: {},
  visual_settings: {},
  performance_metrics: {},
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-01-01').toISOString(),
  user: {
    id: TEST_USER.id,
    email: TEST_USER.email,
    first_name: 'A',
    last_name: 'B',
    getFullName: () => 'A B',
  },
  incrementViewCount: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  mockGraphFindAndCountAll.mockReset();
  mockGraphFindByPk.mockReset();
  mockGraphCreate.mockReset();
  mockGraphVersionCreateFromGraph.mockReset().mockResolvedValue(undefined);
  lastGraphInstance = null;
});

// ----------------------------------------------------------------------------
// GET /api/graphs
// ----------------------------------------------------------------------------
describe('GET /api/graphs', () => {
  test('returns paginated list with default pagination', async () => {
    const g = makeGraph();
    mockGraphFindAndCountAll.mockResolvedValue({ count: 1, rows: [g] });

    const res = await request(buildApp()).get('/api/graphs');
    expect(res.status).toBe(200);
    expect(res.body.graphs).toHaveLength(1);
    expect(res.body.graphs[0]).toEqual(expect.objectContaining({
      id: 'graph-1',
      title: 'My Graph',
      isPublic: false,
    }));
    expect(res.body.pagination).toEqual({
      page: 1, limit: 20, total: 1, pages: 1,
    });
  });

  test('400 on invalid page query', async () => {
    const res = await request(buildApp()).get('/api/graphs?page=0');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 on out-of-range limit query', async () => {
    const res = await request(buildApp()).get('/api/graphs?limit=999');
    expect(res.status).toBe(400);
  });

  test('passes pagination through to model', async () => {
    mockGraphFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await request(buildApp()).get('/api/graphs?page=3&limit=10');
    const args = mockGraphFindAndCountAll.mock.calls[0][0];
    expect(args.limit).toBe(10);
    expect(args.offset).toBe(20);
  });
});

// ----------------------------------------------------------------------------
// GET /api/graphs/:id
// ----------------------------------------------------------------------------
describe('GET /api/graphs/:id', () => {
  test('404 when graph not found', async () => {
    mockGraphFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/graphs/missing');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('GRAPH_NOT_FOUND');
  });

  test('200 returns the graph and skips view count for owner', async () => {
    const g = makeGraph();
    mockGraphFindByPk.mockResolvedValue(g);

    const res = await request(buildApp()).get('/api/graphs/graph-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('graph-1');
    expect(res.body.dotCode).toBe('digraph G { A -> B }');
    expect(g.incrementViewCount).not.toHaveBeenCalled();
  });

  test('increments view count when viewer is not the owner', async () => {
    const g = makeGraph({ user_id: 'someone-else' });
    mockGraphFindByPk.mockResolvedValue(g);

    await request(buildApp()).get('/api/graphs/graph-1');
    expect(g.incrementViewCount).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// POST /api/graphs
// ----------------------------------------------------------------------------
describe('POST /api/graphs', () => {
  test('400 on missing title', async () => {
    const res = await request(buildApp())
      .post('/api/graphs')
      .send({ dotCode: 'digraph G { A -> B }' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 on missing dotCode', async () => {
    const res = await request(buildApp())
      .post('/api/graphs')
      .send({ title: 'Hello' });
    expect(res.status).toBe(400);
  });

  test('400 when DOT validator rejects the code', async () => {
    const res = await request(buildApp())
      .post('/api/graphs')
      .send({ title: 'Bad', dotCode: 'this is not DOT' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DOT_VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  test('201 creates the graph and seeds an initial version', async () => {
    const created = makeGraph();
    mockGraphCreate.mockResolvedValue(created);

    const res = await request(buildApp())
      .post('/api/graphs')
      .send({
        title: 'Hello',
        dotCode: 'digraph G { A -> B }',
        category: 'demo',
        tags: ['x', 'y'],
        isPublic: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.graph).toEqual(expect.objectContaining({
      id: 'graph-1',
      title: 'My Graph',
    }));
    expect(mockGraphCreate).toHaveBeenCalledWith(expect.objectContaining({
      user_id: TEST_USER.id,
      title: 'Hello',
      dot_code: 'digraph G { A -> B }',
      category: 'demo',
      tags: ['x', 'y'],
      is_public: true,
    }));
    expect(mockGraphVersionCreateFromGraph).toHaveBeenCalledWith(created, 'Initial version');
  });
});

// ----------------------------------------------------------------------------
// DELETE /api/graphs/:id
// ----------------------------------------------------------------------------
describe('DELETE /api/graphs/:id', () => {
  test('404 when graph not found', async () => {
    mockGraphFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).delete('/api/graphs/missing');
    expect(res.status).toBe(404);
  });

  test('200 destroys the graph', async () => {
    const g = makeGraph();
    mockGraphFindByPk.mockResolvedValue(g);

    const res = await request(buildApp()).delete('/api/graphs/graph-1');
    expect(res.status).toBe(200);
    expect(g.destroy).toHaveBeenCalled();
    expect(res.body.message).toBe('Graph deleted successfully');
  });
});
