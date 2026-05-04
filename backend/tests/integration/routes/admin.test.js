// Integration tests for /api/admin.

const mockUserCount = jest.fn();
const mockUserFindAll = jest.fn();
const mockUserFindAndCountAll = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserFindByEmail = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn(); // bulk update
const mockUserDestroy = jest.fn(); // bulk destroy

const mockGraphCount = jest.fn();
const mockGraphFindAll = jest.fn();
const mockGraphFindAndCountAll = jest.fn();
const mockGraphFindByPk = jest.fn();

const mockSessionCount = jest.fn();
const mockSessionFindAll = jest.fn();
const mockSessionFindAndCountAll = jest.fn();
const mockSessionFindByPk = jest.fn();

jest.mock('../../../src/models', () => ({
  User: {
    count: (...a) => mockUserCount(...a),
    findAll: (...a) => mockUserFindAll(...a),
    findAndCountAll: (...a) => mockUserFindAndCountAll(...a),
    findByPk: (...a) => mockUserFindByPk(...a),
    findByEmail: (...a) => mockUserFindByEmail(...a),
    create: (...a) => mockUserCreate(...a),
    update: (...a) => mockUserUpdate(...a),
    destroy: (...a) => mockUserDestroy(...a),
  },
  Graph: {
    count: (...a) => mockGraphCount(...a),
    findAll: (...a) => mockGraphFindAll(...a),
    findAndCountAll: (...a) => mockGraphFindAndCountAll(...a),
    findByPk: (...a) => mockGraphFindByPk(...a),
  },
  SimulationSession: {
    count: (...a) => mockSessionCount(...a),
    findAll: (...a) => mockSessionFindAll(...a),
    findAndCountAll: (...a) => mockSessionFindAndCountAll(...a),
    findByPk: (...a) => mockSessionFindByPk(...a),
  },
  GraphVersion: {},
  GraphShare: {},
}));

jest.mock('../../../src/middleware/auth', () => ({
  validateSession: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  requireEditor: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requireGraphAccess: () => (req, res, next) => next(),
  authRateLimit: (req, res, next) => next(),
  logActivity: () => (req, res, next) => next(),
}));

const request = require('supertest');
const adminRoutes = require('../../../src/routes/admin');
const { buildTestApp } = require('../helpers/buildTestApp');

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@b.com' };

const buildApp = (user = ADMIN) =>
  buildTestApp(adminRoutes, '/api/admin', { user });

const makeUser = (overrides = {}) => ({
  id: 'user-2',
  email: 'b@b.com',
  role: 'editor',
  is_active: true,
  first_name: 'Bob',
  last_name: 'Builder',
  last_login: null,
  toJSON: function toJSON() {
    return { ...this };
  },
  update: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeGraph = (overrides = {}) => ({
  id: 'graph-1',
  user_id: 'user-2',
  name: 'G',
  description: 'd',
  is_public: true,
  toJSON: function toJSON() {
    return { ...this };
  },
  destroy: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  [
    mockUserCount, mockUserFindAll, mockUserFindAndCountAll, mockUserFindByPk,
    mockUserFindByEmail, mockUserCreate, mockUserUpdate, mockUserDestroy,
    mockGraphCount, mockGraphFindAll, mockGraphFindAndCountAll, mockGraphFindByPk,
    mockSessionCount, mockSessionFindAll, mockSessionFindAndCountAll, mockSessionFindByPk,
  ].forEach((m) => m.mockReset());
});

// ----------------------------------------------------------------------------
// GET /api/admin/stats
// ----------------------------------------------------------------------------
describe('GET /api/admin/stats', () => {
  test('200 aggregates counts and breakdowns', async () => {
    // Promise.all order: totalUsers, totalGraphs, totalSimulations,
    // activeSimulations, recentUsers, todayActivity (last is Promise.resolve(0)).
    mockUserCount.mockResolvedValueOnce(50).mockResolvedValueOnce(7);
    mockGraphCount.mockResolvedValueOnce(120);
    mockSessionCount.mockResolvedValueOnce(300).mockResolvedValueOnce(4);

    mockUserFindAll.mockResolvedValueOnce([
      { role: 'admin', count: '2' },
      { role: 'editor', count: '20' },
      { role: 'viewer', count: '28' },
    ]);
    mockGraphFindAll.mockResolvedValueOnce([
      { is_public: true, count: '40' },
      { is_public: false, count: '80' },
    ]);
    mockSessionFindAll.mockResolvedValueOnce([
      { status: 'running', count: '4' },
      { status: 'completed', count: '296' },
    ]);

    const res = await request(buildApp()).get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.overview).toEqual({
      totalUsers: 50,
      totalGraphs: 120,
      totalSimulations: 300,
      activeSimulations: 4,
      recentUsers: 7,
      todayActivity: 0,
    });
    expect(res.body.data.breakdown.usersByRole).toEqual({
      admin: 2, editor: 20, viewer: 28,
    });
    expect(res.body.data.breakdown.graphsByStatus.public).toBe('40');
    expect(res.body.data.breakdown.graphsByStatus.private).toBe('80');
    expect(res.body.data.breakdown.simulationsByStatus).toEqual({
      running: 4, completed: 296,
    });
  });

  test('500 surfaces DB errors', async () => {
    mockUserCount.mockRejectedValue(new Error('db'));
    const res = await request(buildApp()).get('/api/admin/stats');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// GET /api/admin/users
// ----------------------------------------------------------------------------
describe('GET /api/admin/users', () => {
  test('200 returns enriched users with stats', async () => {
    const u = makeUser();
    mockUserFindAndCountAll.mockResolvedValue({ count: 1, rows: [u] });
    mockGraphCount.mockResolvedValue(3);
    mockSessionCount.mockResolvedValue(7);

    const res = await request(buildApp()).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].stats).toEqual({
      totalGraphs: 3,
      totalSimulations: 7,
      lastActivity: null,
    });
    expect(res.body.data.pagination.total).toBe(1);
  });

  test('passes search/role/status filters into the where clause', async () => {
    mockUserFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await request(buildApp()).get('/api/admin/users?role=admin&status=active');
    const where = mockUserFindAndCountAll.mock.calls[0][0].where;
    expect(where.role).toBe('admin');
    expect(where.is_active).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// POST /api/admin/users
// ----------------------------------------------------------------------------
describe('POST /api/admin/users', () => {
  test('400 when required fields are missing', async () => {
    const res = await request(buildApp())
      .post('/api/admin/users')
      .send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 on duplicate email', async () => {
    mockUserFindByEmail.mockResolvedValue(makeUser());
    const res = await request(buildApp())
      .post('/api/admin/users')
      .send({ email: 'b@b.com', password: 'x', first_name: 'B', last_name: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test('400 on invalid role', async () => {
    mockUserFindByEmail.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/admin/users')
      .send({
        email: 'c@b.com', password: 'x', first_name: 'C', last_name: 'C',
        role: 'godmode',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid role/i);
  });

  test('201 creates a user with default role=viewer', async () => {
    mockUserFindByEmail.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(makeUser({ role: 'viewer' }));
    const res = await request(buildApp())
      .post('/api/admin/users')
      .send({
        email: 'c@b.com', password: 'pw', first_name: 'C', last_name: 'D',
      });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash/);
    expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      email: 'c@b.com', role: 'viewer', is_active: true,
    }));
  });
});

// ----------------------------------------------------------------------------
// PUT /api/admin/users/:id
// ----------------------------------------------------------------------------
describe('PUT /api/admin/users/:id', () => {
  test('404 when user not found', async () => {
    mockUserFindByPk.mockResolvedValue(null);
    const res = await request(buildApp())
      .put('/api/admin/users/missing')
      .send({ role: 'admin' });
    expect(res.status).toBe(404);
  });

  test('400 when admin tries to change their own role', async () => {
    mockUserFindByPk.mockResolvedValue(
      makeUser({ id: ADMIN.id, role: 'admin' }),
    );
    const res = await request(buildApp())
      .put(`/api/admin/users/${ADMIN.id}`)
      .send({ role: 'viewer' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/own admin/i);
  });

  test('400 when new email is already taken', async () => {
    mockUserFindByPk.mockResolvedValue(makeUser({ email: 'old@b.com' }));
    mockUserFindByEmail.mockResolvedValue(makeUser({ id: 'someone-else' }));

    const res = await request(buildApp())
      .put('/api/admin/users/user-2')
      .send({ email: 'taken@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test('200 updates fields keeping unchanged ones', async () => {
    const u = makeUser();
    mockUserFindByPk.mockResolvedValue(u);
    const res = await request(buildApp())
      .put('/api/admin/users/user-2')
      .send({ role: 'admin', first_name: 'Robert' });
    expect(res.status).toBe(200);
    expect(u.update).toHaveBeenCalledWith(expect.objectContaining({
      role: 'admin',
      first_name: 'Robert',
    }));
  });
});

// ----------------------------------------------------------------------------
// DELETE /api/admin/users/:id  (soft)
// ----------------------------------------------------------------------------
describe('DELETE /api/admin/users/:id (soft)', () => {
  test('404 when user not found', async () => {
    mockUserFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).delete('/api/admin/users/missing');
    expect(res.status).toBe(404);
  });

  test('400 when admin tries to delete themselves', async () => {
    mockUserFindByPk.mockResolvedValue(makeUser({ id: ADMIN.id }));
    const res = await request(buildApp()).delete(`/api/admin/users/${ADMIN.id}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/own account/i);
  });

  test('200 soft-deletes by setting is_active=false', async () => {
    const u = makeUser();
    mockUserFindByPk.mockResolvedValue(u);
    const res = await request(buildApp()).delete('/api/admin/users/user-2');
    expect(res.status).toBe(200);
    expect(u.update).toHaveBeenCalledWith({ is_active: false });
  });
});

// ----------------------------------------------------------------------------
// DELETE /api/admin/users/:id/permanent
// ----------------------------------------------------------------------------
describe('DELETE /api/admin/users/:id/permanent', () => {
  test('400 when deleting self', async () => {
    mockUserFindByPk.mockResolvedValue(makeUser({ id: ADMIN.id }));
    const res = await request(buildApp())
      .delete(`/api/admin/users/${ADMIN.id}/permanent`);
    expect(res.status).toBe(400);
  });

  test('400 when target is the last active admin', async () => {
    mockUserFindByPk.mockResolvedValue(makeUser({ role: 'admin' }));
    mockUserCount.mockResolvedValue(1); // only one active admin → the target
    const res = await request(buildApp())
      .delete('/api/admin/users/user-2/permanent');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last active admin/i);
  });

  test('200 hard-deletes when there are other admins', async () => {
    const u = makeUser({ role: 'admin' });
    mockUserFindByPk.mockResolvedValue(u);
    mockUserCount.mockResolvedValue(3);
    const res = await request(buildApp())
      .delete('/api/admin/users/user-2/permanent');
    expect(res.status).toBe(200);
    expect(u.destroy).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// POST /api/admin/users/:id/reset-password
// ----------------------------------------------------------------------------
describe('POST /api/admin/users/:id/reset-password', () => {
  test('400 when new_password missing', async () => {
    const res = await request(buildApp())
      .post('/api/admin/users/user-2/reset-password')
      .send({});
    expect(res.status).toBe(400);
  });

  test('404 when user not found', async () => {
    mockUserFindByPk.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/admin/users/missing/reset-password')
      .send({ new_password: 'NewPass1!' });
    expect(res.status).toBe(404);
  });

  test('200 updates password_hash via the model hook', async () => {
    const u = makeUser();
    mockUserFindByPk.mockResolvedValue(u);
    const res = await request(buildApp())
      .post('/api/admin/users/user-2/reset-password')
      .send({ new_password: 'NewPass1!' });
    expect(res.status).toBe(200);
    expect(u.update).toHaveBeenCalledWith({ password_hash: 'NewPass1!' });
  });
});

// ----------------------------------------------------------------------------
// POST /api/admin/users/bulk-action
// ----------------------------------------------------------------------------
describe('POST /api/admin/users/bulk-action', () => {
  test('400 on missing/invalid payload', async () => {
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-action')
      .send({ action: 'activate' });
    expect(res.status).toBe(400);
  });

  test('400 if the admin themselves is in the user_ids list', async () => {
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-action')
      .send({ action: 'deactivate', user_ids: [ADMIN.id, 'user-2'] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/own account/i);
  });

  test('activate: bulk update is_active=true', async () => {
    mockUserUpdate.mockResolvedValue([3]);
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-action')
      .send({ action: 'activate', user_ids: ['a', 'b', 'c'] });
    expect(res.status).toBe(200);
    expect(res.body.data.affected_count).toBe(3);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      { is_active: true },
      { where: { id: ['a', 'b', 'c'] } },
    );
  });

  test('deactivate: bulk update is_active=false', async () => {
    mockUserUpdate.mockResolvedValue([2]);
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-action')
      .send({ action: 'deactivate', user_ids: ['a', 'b'] });
    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      { is_active: false },
      expect.any(Object),
    );
  });

  test('permanent_delete: blocked when it would leave no active admin', async () => {
    // adminCount = active admins NOT in user_ids; adminToDeleteCount = admins IN user_ids.
    mockUserCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-action')
      .send({ action: 'permanent_delete', user_ids: ['some-admin'] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/all active admin/i);
    expect(mockUserDestroy).not.toHaveBeenCalled();
  });

  test('permanent_delete: succeeds when at least one admin remains', async () => {
    mockUserCount
      .mockResolvedValueOnce(2) // remaining admins
      .mockResolvedValueOnce(0); // admins to delete
    mockUserDestroy.mockResolvedValue(2);
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-action')
      .send({ action: 'permanent_delete', user_ids: ['x', 'y'] });
    expect(res.status).toBe(200);
    expect(mockUserDestroy).toHaveBeenCalled();
  });

  test('400 on unknown action', async () => {
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-action')
      .send({ action: 'launch-rockets', user_ids: ['a'] });
    expect(res.status).toBe(400);
  });
});

// ----------------------------------------------------------------------------
// GET /api/admin/graphs  +  DELETE /api/admin/graphs/:id
// ----------------------------------------------------------------------------
describe('GET /api/admin/graphs', () => {
  test('200 returns paginated graphs with simulation counts', async () => {
    mockGraphFindAndCountAll.mockResolvedValue({
      count: 1,
      rows: [makeGraph()],
    });
    mockSessionCount.mockResolvedValue(5);

    const res = await request(buildApp()).get('/api/admin/graphs');
    expect(res.status).toBe(200);
    expect(res.body.data.graphs[0].stats.totalSimulations).toBe(5);
  });

  test('passes isPublic=true filter into where clause', async () => {
    mockGraphFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await request(buildApp()).get('/api/admin/graphs?isPublic=true');
    expect(mockGraphFindAndCountAll.mock.calls[0][0].where.is_public).toBe(true);
  });
});

describe('DELETE /api/admin/graphs/:id', () => {
  test('404 when graph not found', async () => {
    mockGraphFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).delete('/api/admin/graphs/missing');
    expect(res.status).toBe(404);
  });

  test('400 when there is at least one running simulation on it', async () => {
    mockGraphFindByPk.mockResolvedValue(makeGraph());
    mockSessionCount.mockResolvedValue(1);
    const res = await request(buildApp()).delete('/api/admin/graphs/graph-1');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/active simulations/i);
  });

  test('200 destroys when no active simulations', async () => {
    const g = makeGraph();
    mockGraphFindByPk.mockResolvedValue(g);
    mockSessionCount.mockResolvedValue(0);
    const res = await request(buildApp()).delete('/api/admin/graphs/graph-1');
    expect(res.status).toBe(200);
    expect(g.destroy).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// GET /api/admin/simulations  +  POST /api/admin/simulations/:id/stop
// ----------------------------------------------------------------------------
describe('GET /api/admin/simulations', () => {
  test('200 returns paginated simulations', async () => {
    mockSessionFindAndCountAll.mockResolvedValue({
      count: 1, rows: [{ id: 's1' }],
    });
    const res = await request(buildApp()).get('/api/admin/simulations');
    expect(res.status).toBe(200);
    expect(res.body.data.simulations).toHaveLength(1);
  });

  test('passes status filter through', async () => {
    mockSessionFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await request(buildApp()).get('/api/admin/simulations?status=completed');
    expect(mockSessionFindAndCountAll.mock.calls[0][0].where.status).toBe('completed');
  });
});

describe('POST /api/admin/simulations/:id/stop', () => {
  test('404 when not found', async () => {
    mockSessionFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).post('/api/admin/simulations/x/stop');
    expect(res.status).toBe(404);
  });

  test('400 when simulation is not running', async () => {
    mockSessionFindByPk.mockResolvedValue({ status: 'completed', update: jest.fn() });
    const res = await request(buildApp()).post('/api/admin/simulations/s1/stop');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not running/i);
  });

  test('200 marks running simulation as completed', async () => {
    const sim = { status: 'running', update: jest.fn().mockResolvedValue(undefined) };
    mockSessionFindByPk.mockResolvedValue(sim);
    const res = await request(buildApp()).post('/api/admin/simulations/s1/stop');
    expect(res.status).toBe(200);
    expect(sim.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      end_time: expect.any(Date),
    }));
  });
});

// ----------------------------------------------------------------------------
// GET /api/admin/activity  +  GET /api/admin/system  +  POST /api/admin/backup
// ----------------------------------------------------------------------------
describe('GET /api/admin/activity', () => {
  test('200 returns an empty list (ActivityLog not implemented yet)', async () => {
    const res = await request(buildApp()).get('/api/admin/activity');
    expect(res.status).toBe(200);
    expect(res.body.data.activities).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
  });
});

describe('GET /api/admin/system', () => {
  test('200 returns runtime info', async () => {
    const res = await request(buildApp()).get('/api/admin/system');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      nodeVersion: expect.any(String),
      uptime: expect.any(Number),
      platform: expect.any(String),
      memory: expect.any(Object),
    }));
  });
});

describe('POST /api/admin/backup', () => {
  test('reports backup is not implemented yet', async () => {
    const res = await request(buildApp()).post('/api/admin/backup');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not yet implemented/i);
  });
});
