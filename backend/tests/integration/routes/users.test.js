// Integration tests for /api/users (admin-facing user management).

const mockUserFindByPk = jest.fn();
const mockUserFindAndCountAll = jest.fn();
const mockGraphCount = jest.fn();

jest.mock('../../../src/models', () => ({
  User: {
    findByPk: (...a) => mockUserFindByPk(...a),
    findAndCountAll: (...a) => mockUserFindAndCountAll(...a),
  },
  Graph: { count: (...a) => mockGraphCount(...a) },
  SimulationSession: {},
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
const userRoutes = require('../../../src/routes/users');
const { buildTestApp } = require('../helpers/buildTestApp');

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@b.com' };

const makeUser = (overrides = {}) => ({
  id: 'user-2',
  email: 'b@b.com',
  role: 'editor',
  is_active: true,
  first_name: 'Bob',
  last_name: 'Builder',
  preferences: {},
  avatar_url: null,
  last_login: null,
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-01-01').toISOString(),
  updated_at: new Date('2026-01-01').toISOString(),
  getFullName: () => 'Bob Builder',
  update: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  mockUserFindByPk.mockReset();
  mockUserFindAndCountAll.mockReset();
  mockGraphCount.mockReset();
});

const buildApp = (user = ADMIN) =>
  buildTestApp(userRoutes, '/api/users', { user });

// ----------------------------------------------------------------------------
// GET /api/users/profile
// ----------------------------------------------------------------------------
describe('GET /api/users/profile', () => {
  test('200 returns the current user payload (no password_hash)', async () => {
    mockUserFindByPk.mockResolvedValue(makeUser());
    const res = await request(buildApp()).get('/api/users/profile');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(expect.objectContaining({
      id: 'user-2',
      email: 'b@b.com',
      fullName: 'Bob Builder',
    }));
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    // The route must request exclusion of the hash from Sequelize.
    expect(mockUserFindByPk).toHaveBeenCalledWith(ADMIN.id, expect.objectContaining({
      attributes: { exclude: ['password_hash'] },
    }));
  });

  test('404 when current user not found in DB', async () => {
    mockUserFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/users/profile');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });
});

// ----------------------------------------------------------------------------
// GET /api/users (list)
// ----------------------------------------------------------------------------
describe('GET /api/users', () => {
  test('200 returns paginated users', async () => {
    mockUserFindAndCountAll.mockResolvedValue({
      count: 1,
      rows: [makeUser()],
    });

    const res = await request(buildApp()).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.pagination).toEqual(expect.objectContaining({
      page: 1,
      limit: 20,
      total: 1,
    }));
  });

  test('400 on invalid role filter', async () => {
    const res = await request(buildApp()).get('/api/users?role=evil');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ----------------------------------------------------------------------------
// PUT /api/users/:id/role
// ----------------------------------------------------------------------------
describe('PUT /api/users/:id/role', () => {
  test('400 when admin tries to change their own role', async () => {
    const res = await request(buildApp())
      .put(`/api/users/${ADMIN.id}/role`)
      .send({ role: 'viewer' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_MODIFY_OWN_ROLE');
  });

  test('400 on invalid role', async () => {
    const res = await request(buildApp())
      .put('/api/users/user-2/role')
      .send({ role: 'godmode' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('404 when target user does not exist', async () => {
    mockUserFindByPk.mockResolvedValue(null);
    const res = await request(buildApp())
      .put('/api/users/user-2/role')
      .send({ role: 'admin' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  test('200 updates the role', async () => {
    const target = makeUser();
    mockUserFindByPk.mockResolvedValue(target);

    const res = await request(buildApp())
      .put('/api/users/user-2/role')
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(target.update).toHaveBeenCalledWith({ role: 'admin' });
  });
});

// ----------------------------------------------------------------------------
// PUT /api/users/:id/status
// ----------------------------------------------------------------------------
describe('PUT /api/users/:id/status', () => {
  test('400 when admin tries to change their own status', async () => {
    const res = await request(buildApp())
      .put(`/api/users/${ADMIN.id}/status`)
      .send({ isActive: false });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_MODIFY_OWN_STATUS');
  });

  test('200 disables a user', async () => {
    const target = makeUser();
    mockUserFindByPk.mockResolvedValue(target);

    const res = await request(buildApp())
      .put('/api/users/user-2/status')
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(target.update).toHaveBeenCalledWith({ is_active: false });
  });
});

// ----------------------------------------------------------------------------
// DELETE /api/users/:id
// ----------------------------------------------------------------------------
describe('DELETE /api/users/:id', () => {
  test('400 when admin tries to delete themselves', async () => {
    const res = await request(buildApp()).delete(`/api/users/${ADMIN.id}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_DELETE_OWN_ACCOUNT');
  });

  test('404 when user does not exist', async () => {
    mockUserFindByPk.mockResolvedValue(null);
    const res = await request(buildApp()).delete('/api/users/missing');
    expect(res.status).toBe(404);
  });

  test('400 when user owns graphs', async () => {
    mockUserFindByPk.mockResolvedValue(makeUser());
    mockGraphCount.mockResolvedValue(3);

    const res = await request(buildApp()).delete('/api/users/user-2');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USER_HAS_GRAPHS');
  });

  test('200 soft-deletes a user with no graphs', async () => {
    const target = makeUser();
    mockUserFindByPk.mockResolvedValue(target);
    mockGraphCount.mockResolvedValue(0);

    const res = await request(buildApp()).delete('/api/users/user-2');
    expect(res.status).toBe(200);
    expect(target.destroy).toHaveBeenCalled();
  });
});
