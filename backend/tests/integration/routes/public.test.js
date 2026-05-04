// Integration tests for /api/public routes.
// User.findOne is mocked so the health probe never touches Postgres.

const mockFindOne = jest.fn();

jest.mock('../../../src/models', () => ({
  User: { findOne: (...args) => mockFindOne(...args) },
  Graph: {},
  GraphVersion: {},
  GraphShare: {},
  SimulationSession: {},
}));

const request = require('supertest');
const publicRoutes = require('../../../src/routes/public');
const { buildTestApp } = require('../helpers/buildTestApp');

const app = buildTestApp(publicRoutes, '/api/public');

beforeEach(() => {
  mockFindOne.mockReset();
});

describe('GET /api/public/health', () => {
  test('returns healthy when DB probe succeeds', async () => {
    mockFindOne.mockResolvedValue({ id: 'x' });
    const res = await request(app).get('/api/public/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database.status).toBe('healthy');
    expect(res.body.system).toEqual(expect.objectContaining({
      memory: expect.any(Object),
      cpu: expect.any(Object),
    }));
  });

  test('returns degraded when DB probe fails', async () => {
    mockFindOne.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/api/public/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database.status).toBe('unhealthy');
    expect(res.body.services.database.error).toBe('db down');
  });
});

describe('GET /api/public/dot-examples', () => {
  test('returns the network example by default', async () => {
    const res = await request(app).get('/api/public/dot-examples');
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
  });

  test('respects ?type=pipeline', async () => {
    const res = await request(app).get('/api/public/dot-examples?type=pipeline');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/public/validate-dot', () => {
  test('rejects missing body', async () => {
    const res = await request(app).post('/api/public/validate-dot').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DOT_CODE_REQUIRED');
  });

  test('returns valid=true for a well-formed digraph (legacy `code` field)', async () => {
    const res = await request(app)
      .post('/api/public/validate-dot')
      .send({ code: 'digraph G { A -> B }' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isValid).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(Array.isArray(res.body.data.errors)).toBe(true);
    expect(Array.isArray(res.body.data.warnings)).toBe(true);
  });

  test('accepts the new `dotCode` field name', async () => {
    const res = await request(app)
      .post('/api/public/validate-dot')
      .send({ dotCode: 'digraph G { A -> B }' });
    expect(res.status).toBe(200);
    expect(res.body.data.isValid).toBe(true);
  });

  test('returns valid=false for code without graph declaration', async () => {
    const res = await request(app)
      .post('/api/public/validate-dot')
      .send({ dotCode: 'A -> B' });
    expect(res.status).toBe(200);
    expect(res.body.data.isValid).toBe(false);
    expect(res.body.data.errors.length).toBeGreaterThan(0);
  });

  test('reports VortexFlow extensions in metadata', async () => {
    const res = await request(app)
      .post('/api/public/validate-dot')
      .send({ dotCode: 'digraph G { A -> B [bandwidth=10] }' });
    expect(res.status).toBe(200);
    expect(res.body.data.metadata.hasVortexFlowExtensions).toBe(true);
  });
});

describe('POST /api/public/parse-dot', () => {
  test('rejects missing body', async () => {
    const res = await request(app).post('/api/public/parse-dot').send({});
    expect(res.status).toBe(400);
  });

  test('rejects very large payloads', async () => {
    const huge = 'a'.repeat(1_000_001);
    const res = await request(app)
      .post('/api/public/parse-dot')
      .send({ dotContent: huge });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  test('returns nodes and edges for a valid digraph', async () => {
    const res = await request(app)
      .post('/api/public/parse-dot')
      .send({ dotContent: 'digraph G { A [label="A1"]; A -> B }' });
    expect(res.status).toBe(200);
    expect(res.body.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'A' }),
      expect.objectContaining({ id: 'B' }),
    ]));
    expect(res.body.links).toEqual([
      expect.objectContaining({ source: 'A', target: 'B' }),
    ]);
  });

  test('400 when DOT cannot be parsed', async () => {
    const res = await request(app)
      .post('/api/public/parse-dot')
      .send({ dotContent: 'not a graph' });
    expect(res.status).toBe(400);
  });
});
