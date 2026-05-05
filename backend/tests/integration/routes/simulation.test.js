// Integration tests for /api/simulation.

const mockSessionFindAndCountAll = jest.fn();
const mockSessionFindOne = jest.fn();
const mockSessionCreate = jest.fn();
const mockGraphFindByPk = jest.fn();

jest.mock('../../../src/models', () => ({
  SimulationSession: {
    findAndCountAll: (...a) => mockSessionFindAndCountAll(...a),
    findOne: (...a) => mockSessionFindOne(...a),
    create: (...a) => mockSessionCreate(...a),
  },
  Graph: { findByPk: (...a) => mockGraphFindByPk(...a) },
  User: {},
  GraphVersion: {},
  GraphShare: {},
}));

jest.mock('../../../src/middleware/auth', () => ({
  validateSession: (req, res, next) => next(),
  requireEditor: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requireGraphAccess: () => (req, res, next) => next(),
  authRateLimit: (req, res, next) => next(),
  logActivity: () => (req, res, next) => next(),
}));

const request = require('supertest');
const simRoutes = require('../../../src/routes/simulation');
const { buildTestApp } = require('../helpers/buildTestApp');

const TEST_USER = { id: 'user-1', role: 'editor', email: 'a@b.com' };

const buildApp = (user = TEST_USER) =>
  buildTestApp(simRoutes, '/api/simulation', { user });

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

const makeSession = (overrides = {}) => ({
  id: 'sess-1',
  user_id: TEST_USER.id,
  graph_id: VALID_UUID,
  session_name: 'Run 1',
  status: 'running',
  duration: null,
  start_time: new Date(Date.now() - 5000).toISOString(),
  end_time: null,
  config: { speed: 1, particleCount: 100 },
  results: null,
  metrics: null,
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  graph: {
    id: VALID_UUID,
    title: 'G',
    description: 'd',
    category: 'cat',
    dot_code: 'digraph G { A -> B }',
  },
  update: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeGraph = (overrides = {}) => ({
  id: VALID_UUID,
  user_id: TEST_USER.id,
  title: 'G',
  canBeAccessedBy: jest.fn().mockReturnValue(true),
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  mockSessionFindAndCountAll.mockReset();
  mockSessionFindOne.mockReset();
  mockSessionCreate.mockReset();
  mockGraphFindByPk.mockReset();
});

// ----------------------------------------------------------------------------
// GET /api/simulation/sessions
// ----------------------------------------------------------------------------
describe('GET /api/simulation/sessions', () => {
  test('200 returns paginated sessions', async () => {
    mockSessionFindAndCountAll.mockResolvedValue({
      count: 1,
      rows: [makeSession()],
    });
    const res = await request(buildApp()).get('/api/simulation/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0]).toEqual(expect.objectContaining({
      id: 'sess-1',
      status: 'running',
      graph: expect.objectContaining({ id: VALID_UUID }),
    }));
    expect(res.body.pagination.total).toBe(1);
  });

  test('400 on invalid status filter', async () => {
    const res = await request(buildApp()).get('/api/simulation/sessions?status=weird');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 on non-UUID graphId filter', async () => {
    const res = await request(buildApp()).get('/api/simulation/sessions?graphId=not-a-uuid');
    expect(res.status).toBe(400);
  });

  test('passes status and graphId filters into the where clause', async () => {
    mockSessionFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await request(buildApp())
      .get(`/api/simulation/sessions?status=running&graphId=${VALID_UUID}`);
    const where = mockSessionFindAndCountAll.mock.calls[0][0].where;
    expect(where).toEqual(expect.objectContaining({
      user_id: TEST_USER.id,
      status: 'running',
      graph_id: VALID_UUID,
    }));
  });
});

// ----------------------------------------------------------------------------
// GET /api/simulation/sessions/:id
// ----------------------------------------------------------------------------
describe('GET /api/simulation/sessions/:id', () => {
  test('404 when not found', async () => {
    mockSessionFindOne.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/simulation/sessions/x');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SESSION_NOT_FOUND');
  });

  test('200 returns session with embedded graph dot code', async () => {
    mockSessionFindOne.mockResolvedValue(makeSession());
    const res = await request(buildApp()).get('/api/simulation/sessions/sess-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sess-1');
    expect(res.body.graph.dotCode).toBe('digraph G { A -> B }');
  });
});

// ----------------------------------------------------------------------------
// POST /api/simulation/start
// ----------------------------------------------------------------------------
describe('POST /api/simulation/start', () => {
  test('400 on non-UUID graphId', async () => {
    const res = await request(buildApp())
      .post('/api/simulation/start')
      .send({ graphId: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 when config.speed is out of range', async () => {
    const res = await request(buildApp())
      .post('/api/simulation/start')
      .send({ graphId: VALID_UUID, config: { speed: 999 } });
    expect(res.status).toBe(400);
  });

  test('404 when graph not found', async () => {
    mockGraphFindByPk.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/simulation/start')
      .send({ graphId: VALID_UUID });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('GRAPH_NOT_FOUND');
  });

  test('403 when user has no access to the graph', async () => {
    mockGraphFindByPk.mockResolvedValue(
      makeGraph({ canBeAccessedBy: jest.fn().mockReturnValue(false) }),
    );
    const res = await request(buildApp())
      .post('/api/simulation/start')
      .send({ graphId: VALID_UUID });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCESS_DENIED');
  });

  test('409 when a simulation is already running for this graph', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockSessionFindOne.mockResolvedValue(makeSession()); // already running
    const res = await request(buildApp())
      .post('/api/simulation/start')
      .send({ graphId: VALID_UUID });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SIMULATION_ALREADY_RUNNING');
  });

  test('201 creates a session with merged default config', async () => {
    const graph = makeGraph();
    mockGraphFindByPk.mockResolvedValue(graph);
    mockSessionFindOne.mockResolvedValue(null);
    mockSessionCreate.mockResolvedValue(makeSession({ status: 'running' }));

    const res = await request(buildApp())
      .post('/api/simulation/start')
      .send({
        graphId: VALID_UUID,
        sessionName: 'Test run',
        config: { speed: 2, particleCount: 200 },
      });

    expect(res.status).toBe(201);
    expect(res.body.session.id).toBe('sess-1');

    const created = mockSessionCreate.mock.calls[0][0];
    expect(created).toEqual(expect.objectContaining({
      user_id: TEST_USER.id,
      graph_id: VALID_UUID,
      session_name: 'Test run',
      // status enum is ('running','paused','completed','failed') — no 'pending'.
      status: 'running',
    }));
    // User overrides win, defaults still merged. Config is persisted under
    // simulation_config (the `config` attribute is not a model field).
    expect(created.simulation_config.speed).toBe(2);
    expect(created.simulation_config.particleCount).toBe(200);
    expect(created.simulation_config.duration).toBe(60); // default kept
    expect(created.simulation_config.physics).toBeDefined();

    expect(graph.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_simulation: expect.any(Date) }),
    );
  });
});

// ----------------------------------------------------------------------------
// POST /api/simulation/:id/stop  /  /pause  /  /resume
// ----------------------------------------------------------------------------
describe('POST /api/simulation/:id/stop', () => {
  test('404 when no running session matches', async () => {
    mockSessionFindOne.mockResolvedValue(null);
    const res = await request(buildApp()).post('/api/simulation/sess-1/stop');
    expect(res.status).toBe(404);
  });

  test('200 cancels and writes duration', async () => {
    const s = makeSession({ start_time: new Date(Date.now() - 10000).toISOString() });
    mockSessionFindOne.mockResolvedValue(s);

    const res = await request(buildApp()).post('/api/simulation/sess-1/stop');
    expect(res.status).toBe(200);
    expect(s.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'cancelled',
      end_time: expect.any(Date),
      duration: expect.any(Number),
    }));
    const callArgs = s.update.mock.calls[0][0];
    expect(callArgs.duration).toBeGreaterThanOrEqual(9);
  });
});

describe('POST /api/simulation/:id/pause', () => {
  test('404 when no running session', async () => {
    mockSessionFindOne.mockResolvedValue(null);
    const res = await request(buildApp()).post('/api/simulation/sess-1/pause');
    expect(res.status).toBe(404);
  });

  test('200 marks the session paused in config', async () => {
    const s = makeSession();
    mockSessionFindOne.mockResolvedValue(s);
    const res = await request(buildApp()).post('/api/simulation/sess-1/pause');
    expect(res.status).toBe(200);
    const cfg = s.update.mock.calls[0][0].config;
    expect(cfg.isPaused).toBe(true);
    expect(cfg.pausedAt).toBeDefined();
  });
});

describe('POST /api/simulation/:id/resume', () => {
  test('404 when no running session', async () => {
    mockSessionFindOne.mockResolvedValue(null);
    const res = await request(buildApp()).post('/api/simulation/sess-1/resume');
    expect(res.status).toBe(404);
  });

  test('400 when session is not currently paused', async () => {
    mockSessionFindOne.mockResolvedValue(makeSession());
    const res = await request(buildApp()).post('/api/simulation/sess-1/resume');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_PAUSED');
  });

  test('200 strips pause flags from config', async () => {
    const s = makeSession({
      config: { speed: 1, isPaused: true, pausedAt: new Date().toISOString() },
    });
    mockSessionFindOne.mockResolvedValue(s);
    const res = await request(buildApp()).post('/api/simulation/sess-1/resume');
    expect(res.status).toBe(200);
    const cfg = s.update.mock.calls[0][0].config;
    expect(cfg.isPaused).toBeUndefined();
    expect(cfg.pausedAt).toBeUndefined();
    expect(cfg.speed).toBe(1);
  });
});

// ----------------------------------------------------------------------------
// PUT /api/simulation/:id/config
// ----------------------------------------------------------------------------
describe('PUT /api/simulation/:id/config', () => {
  test('400 when config missing', async () => {
    const res = await request(buildApp())
      .put('/api/simulation/sess-1/config')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('404 when no running session matches', async () => {
    mockSessionFindOne.mockResolvedValue(null);
    const res = await request(buildApp())
      .put('/api/simulation/sess-1/config')
      .send({ config: { speed: 2 } });
    expect(res.status).toBe(404);
  });

  test('200 merges new config into existing one', async () => {
    const s = makeSession({ config: { speed: 1, particleCount: 50 } });
    mockSessionFindOne.mockResolvedValue(s);

    const res = await request(buildApp())
      .put('/api/simulation/sess-1/config')
      .send({ config: { speed: 3 } });

    expect(res.status).toBe(200);
    expect(res.body.config).toEqual({ speed: 3, particleCount: 50 });
    expect(s.update).toHaveBeenCalledWith({
      config: { speed: 3, particleCount: 50 },
    });
  });
});

// ----------------------------------------------------------------------------
// DELETE /api/simulation/sessions/:id
// ----------------------------------------------------------------------------
describe('DELETE /api/simulation/sessions/:id', () => {
  test('404 when not found', async () => {
    mockSessionFindOne.mockResolvedValue(null);
    const res = await request(buildApp()).delete('/api/simulation/sessions/x');
    expect(res.status).toBe(404);
  });

  test('400 when session is still running', async () => {
    mockSessionFindOne.mockResolvedValue(makeSession({ status: 'running' }));
    const res = await request(buildApp()).delete('/api/simulation/sessions/sess-1');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_DELETE_RUNNING');
  });

  test('200 destroys a non-running session', async () => {
    const s = makeSession({ status: 'completed' });
    mockSessionFindOne.mockResolvedValue(s);
    const res = await request(buildApp()).delete('/api/simulation/sessions/sess-1');
    expect(res.status).toBe(200);
    expect(s.destroy).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// GET /api/simulation/templates
// ----------------------------------------------------------------------------
describe('GET /api/simulation/templates', () => {
  test('returns the three preset templates', async () => {
    const res = await request(buildApp()).get('/api/simulation/templates');
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(3);
    const ids = res.body.templates.map((t) => t.id);
    expect(ids).toEqual(['network-flow', 'data-pipeline', 'distributed-system']);
    res.body.templates.forEach((t) => {
      expect(t).toEqual(expect.objectContaining({
        name: expect.any(String),
        description: expect.any(String),
        config: expect.any(Object),
        category: expect.any(String),
      }));
    });
  });
});

// ----------------------------------------------------------------------------
// POST /api/simulation/validate-config
// ----------------------------------------------------------------------------
describe('POST /api/simulation/validate-config', () => {
  test('400 when body misses config', async () => {
    const res = await request(buildApp())
      .post('/api/simulation/validate-config')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('valid config returns valid=true and low complexity', async () => {
    const res = await request(buildApp())
      .post('/api/simulation/validate-config')
      .send({ config: { speed: 1, particleCount: 100, duration: 60 } });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.errors).toEqual([]);
    expect(res.body.estimatedComplexity).toBe('low');
    expect(res.body.estimatedDuration).toBe(60);
  });

  test('emits warnings for high particle count and high speed', async () => {
    const res = await request(buildApp())
      .post('/api/simulation/validate-config')
      .send({ config: { speed: 6, particleCount: 1500 } });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.warnings.length).toBeGreaterThanOrEqual(2);
    expect(res.body.estimatedComplexity).toBe('high');
  });

  test('reports range errors for over-the-limit values', async () => {
    // The express-validator chain only runs on the body shape; the body of the
    // handler does its own range checks too, which is what we exercise here
    // by passing values that are within validator bounds (because there's no
    // numeric check on top-level config) but caught by the inner validator
    // logic.
    const res = await request(buildApp())
      .post('/api/simulation/validate-config')
      .send({ config: { speed: 50, particleCount: 50000, duration: 99999 } });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/Speed/),
      expect.stringMatching(/Particle count/),
      expect.stringMatching(/Duration/),
    ]));
  });
});
