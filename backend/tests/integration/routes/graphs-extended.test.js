// Integration tests for /api/graphs extended endpoints:
//   PUT /:id, GET /:id/versions, POST /:id/versions/:versionId/restore,
//   POST /:id/share, DELETE /:id/shares/:shareId, POST /:id/duplicate.
//
// CRUD core (GET, POST, DELETE) is covered by graphs.test.js.

const mockGraphFindByPk = jest.fn();
const mockGraphCreate = jest.fn();
const mockGraphVersionFindByGraph = jest.fn();
const mockGraphVersionFindOne = jest.fn();
const mockGraphVersionCreateFromGraph = jest.fn();
const mockGraphShareFindOne = jest.fn();
const mockGraphShareCreateShare = jest.fn();
const mockUserFindByEmail = jest.fn();

jest.mock('../../../src/models', () => ({
  Graph: {
    findByPk: (...a) => mockGraphFindByPk(...a),
    create: (...a) => mockGraphCreate(...a),
  },
  GraphVersion: {
    findByGraph: (...a) => mockGraphVersionFindByGraph(...a),
    findOne: (...a) => mockGraphVersionFindOne(...a),
    createFromGraph: (...a) => mockGraphVersionCreateFromGraph(...a),
  },
  GraphShare: {
    findOne: (...a) => mockGraphShareFindOne(...a),
    createShare: (...a) => mockGraphShareCreateShare(...a),
  },
  User: { findByEmail: (...a) => mockUserFindByEmail(...a) },
  SimulationSession: {},
}));

jest.mock('../../../src/middleware/auth', () => ({
  validateSession: (req, res, next) => next(),
  requireEditor: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requireGraphAccess: () => async (req, res, next) => {
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
  title: 'Original',
  description: 'desc',
  category: 'cat',
  tags: ['a', 'b'],
  is_public: false,
  version: 3,
  dot_code: 'digraph G { A -> B }',
  simulation_config: { speed: 1 },
  visual_settings: { theme: 'dark' },
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-02-01').toISOString(),
  user: {
    id: TEST_USER.id,
    email: TEST_USER.email,
    first_name: 'A',
    last_name: 'B',
    getFullName: () => 'A B',
  },
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  [
    mockGraphFindByPk, mockGraphCreate,
    mockGraphVersionFindByGraph, mockGraphVersionFindOne, mockGraphVersionCreateFromGraph,
    mockGraphShareFindOne, mockGraphShareCreateShare,
    mockUserFindByEmail,
  ].forEach((m) => m.mockReset());
  mockGraphVersionCreateFromGraph.mockResolvedValue(undefined);
});

// ----------------------------------------------------------------------------
// PUT /api/graphs/:id
// ----------------------------------------------------------------------------
describe('PUT /api/graphs/:id', () => {
  test('404 when graph not found', async () => {
    mockGraphFindByPk.mockResolvedValue(null);
    const res = await request(buildApp())
      .put('/api/graphs/missing')
      .send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  test('400 on invalid DOT code', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const res = await request(buildApp())
      .put('/api/graphs/graph-1')
      .send({ dotCode: 'this is not DOT' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DOT_VALIDATION_ERROR');
  });

  test('400 on validation error (title too long)', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const res = await request(buildApp())
      .put('/api/graphs/graph-1')
      .send({ title: 'x'.repeat(300) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('200 updates only the provided fields and bumps version on dotCode change', async () => {
    const g = makeGraph();
    mockGraphFindByPk.mockResolvedValue(g);

    const res = await request(buildApp())
      .put('/api/graphs/graph-1')
      .send({
        title: 'Renamed',
        dotCode: 'digraph G { A -> C }',
      });

    expect(res.status).toBe(200);
    const updateArgs = g.update.mock.calls[0][0];
    expect(updateArgs.title).toBe('Renamed');
    expect(updateArgs.dot_code).toBe('digraph G { A -> C }');
    expect(updateArgs.version).toBe(g.version + 1);
    expect(mockGraphVersionCreateFromGraph).toHaveBeenCalled();
  });

  test('200 metadata-only changes do not bump version or create a snapshot', async () => {
    const g = makeGraph();
    mockGraphFindByPk.mockResolvedValue(g);

    await request(buildApp())
      .put('/api/graphs/graph-1')
      .send({ title: 'Just a rename', tags: ['x'] });

    const updateArgs = g.update.mock.calls[0][0];
    expect(updateArgs.version).toBeUndefined();
    expect(mockGraphVersionCreateFromGraph).not.toHaveBeenCalled();
  });

  test('200 honors explicit createVersion=true when paired with significant changes', async () => {
    const g = makeGraph();
    mockGraphFindByPk.mockResolvedValue(g);

    await request(buildApp())
      .put('/api/graphs/graph-1')
      .send({
        dotCode: 'digraph G { A -> B }',
        createVersion: true,
        versionNotes: 'big rework',
      });

    expect(mockGraphVersionCreateFromGraph).toHaveBeenCalledWith(g, 'big rework');
  });
});

// ----------------------------------------------------------------------------
// GET /api/graphs/:id/versions
// ----------------------------------------------------------------------------
describe('GET /api/graphs/:id/versions', () => {
  test('404 when graph not found', async () => {
    mockGraphFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/graphs/missing/versions');
    expect(res.status).toBe(404);
  });

  test('200 returns the list of versions for the graph', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockGraphVersionFindByGraph.mockResolvedValue([
      {
        id: 'v1', version_number: 1, notes: 'init', is_major_version: false,
        changes_summary: null, createdAt: new Date('2026-01-01').toISOString(),
      },
      {
        id: 'v2', version_number: 2, notes: 'refactor', is_major_version: true,
        changes_summary: 'big', createdAt: new Date('2026-02-01').toISOString(),
      },
    ]);

    const res = await request(buildApp()).get('/api/graphs/graph-1/versions');
    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[1]).toEqual(expect.objectContaining({
      versionNumber: 2,
      isMajorVersion: true,
      changesSummary: 'big',
    }));
  });
});

// ----------------------------------------------------------------------------
// POST /api/graphs/:id/versions/:versionId/restore
// ----------------------------------------------------------------------------
describe('POST /api/graphs/:id/versions/:versionId/restore', () => {
  test('404 when graph not found', async () => {
    mockGraphFindByPk.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/graphs/missing/versions/v1/restore');
    expect(res.status).toBe(404);
  });

  test('404 when version does not belong to graph', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockGraphVersionFindOne.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/graphs/graph-1/versions/missing/restore');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('VERSION_NOT_FOUND');
  });

  test('200 calls version.restore() and reports the restored version number', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const restore = jest.fn().mockResolvedValue(undefined);
    mockGraphVersionFindOne.mockResolvedValue({
      id: 'v2', version_number: 2, restore,
    });

    const res = await request(buildApp())
      .post('/api/graphs/graph-1/versions/v2/restore');

    expect(res.status).toBe(200);
    expect(restore).toHaveBeenCalled();
    expect(res.body.restoredVersion).toBe(2);
  });
});

// ----------------------------------------------------------------------------
// POST /api/graphs/:id/share
// ----------------------------------------------------------------------------
describe('POST /api/graphs/:id/share', () => {
  test('400 on missing fields', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const res = await request(buildApp())
      .post('/api/graphs/graph-1/share')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 on bad email', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const res = await request(buildApp())
      .post('/api/graphs/graph-1/share')
      .send({ email: 'not-an-email', permissionLevel: 'view' });
    expect(res.status).toBe(400);
  });

  test('400 on invalid permission level', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const res = await request(buildApp())
      .post('/api/graphs/graph-1/share')
      .send({ email: 'b@b.com', permissionLevel: 'godmode' });
    expect(res.status).toBe(400);
  });

  test('404 when target user does not exist', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockUserFindByEmail.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/graphs/graph-1/share')
      .send({ email: 'unknown@b.com', permissionLevel: 'view' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  test('400 when sharing with yourself', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockUserFindByEmail.mockResolvedValue({ id: TEST_USER.id });
    const res = await request(buildApp())
      .post('/api/graphs/graph-1/share')
      .send({ email: TEST_USER.email, permissionLevel: 'view' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_SHARE_WITH_SELF');
  });

  test('409 when an active share already exists for this user', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockUserFindByEmail.mockResolvedValue({ id: 'user-2' });
    mockGraphShareFindOne.mockResolvedValue({ id: 'existing' });

    const res = await request(buildApp())
      .post('/api/graphs/graph-1/share')
      .send({ email: 'b@b.com', permissionLevel: 'edit' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_SHARED');
    expect(mockGraphShareCreateShare).not.toHaveBeenCalled();
  });

  test('201 creates the share with the requested options', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockUserFindByEmail.mockResolvedValue({ id: 'user-2' });
    mockGraphShareFindOne.mockResolvedValue(null);
    mockGraphShareCreateShare.mockResolvedValue({
      id: 'share-1',
      permission_level: 'edit',
      expires_at: null,
      notes: 'team review',
      createdAt: new Date('2026-01-01').toISOString(),
    });

    const res = await request(buildApp())
      .post('/api/graphs/graph-1/share')
      .send({
        email: 'b@b.com',
        permissionLevel: 'edit',
        notes: 'team review',
        expiresIn: 24,
      });

    expect(res.status).toBe(201);
    expect(res.body.share).toEqual(expect.objectContaining({
      id: 'share-1',
      permissionLevel: 'edit',
      notes: 'team review',
    }));
    expect(mockGraphShareCreateShare).toHaveBeenCalledWith(
      'graph-1',
      'user-2',
      'edit',
      expect.objectContaining({
        sharedByUserId: TEST_USER.id,
        expiresIn: 24,
        notes: 'team review',
      }),
    );
  });
});

// ----------------------------------------------------------------------------
// DELETE /api/graphs/:id/shares/:shareId
// ----------------------------------------------------------------------------
describe('DELETE /api/graphs/:id/shares/:shareId', () => {
  test('404 when share not found', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockGraphShareFindOne.mockResolvedValue(null);
    const res = await request(buildApp())
      .delete('/api/graphs/graph-1/shares/missing');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SHARE_NOT_FOUND');
  });

  test('200 calls share.revoke()', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const revoke = jest.fn().mockResolvedValue(undefined);
    mockGraphShareFindOne.mockResolvedValue({ id: 'share-1', revoke });

    const res = await request(buildApp())
      .delete('/api/graphs/graph-1/shares/share-1');

    expect(res.status).toBe(200);
    expect(revoke).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// POST /api/graphs/:id/duplicate
// ----------------------------------------------------------------------------
describe('POST /api/graphs/:id/duplicate', () => {
  test('400 on title too long', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    const res = await request(buildApp())
      .post('/api/graphs/graph-1/duplicate')
      .send({ title: 'x'.repeat(300) });
    expect(res.status).toBe(400);
  });

  test('201 duplicates with default "(Copy)" suffix when no title provided', async () => {
    const original = makeGraph();
    mockGraphFindByPk.mockResolvedValue(original);
    mockGraphCreate.mockResolvedValue({
      id: 'graph-2',
      title: 'Original (Copy)',
      description: original.description,
      createdAt: new Date('2026-03-01').toISOString(),
    });

    const res = await request(buildApp())
      .post('/api/graphs/graph-1/duplicate')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.graph).toEqual(expect.objectContaining({
      id: 'graph-2',
      title: 'Original (Copy)',
    }));
    // Duplicate is always private and seeds a version.
    expect(mockGraphCreate).toHaveBeenCalledWith(expect.objectContaining({
      user_id: TEST_USER.id,
      title: 'Original (Copy)',
      is_public: false,
      dot_code: original.dot_code,
    }));
    expect(mockGraphVersionCreateFromGraph).toHaveBeenCalled();
  });

  test('201 uses the provided title', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockGraphCreate.mockResolvedValue({
      id: 'graph-2',
      title: 'Custom name',
      createdAt: new Date().toISOString(),
    });

    await request(buildApp())
      .post('/api/graphs/graph-1/duplicate')
      .send({ title: 'Custom name' });

    expect(mockGraphCreate.mock.calls[0][0].title).toBe('Custom name');
  });
});
