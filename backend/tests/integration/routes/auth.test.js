// Integration tests for /api/auth.
//
// Mocks (must be set up before requiring the router):
//   - express-rate-limit: pass-through (auth endpoints have a 5/15min limit
//     that would trip during a test run).
//   - src/models: User with findByEmail / findByPk / create.
//
// We use buildTestApp's session shim to drive `req.session` rather than running
// real express-session/Redis.

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const mockFindByEmail = jest.fn();
const mockFindByPk = jest.fn();
const mockCreate = jest.fn();

jest.mock('../../../src/models', () => ({
  User: {
    findByEmail: (...args) => mockFindByEmail(...args),
    findByPk: (...args) => mockFindByPk(...args),
    create: (...args) => mockCreate(...args),
  },
  Graph: {},
  GraphVersion: {},
  GraphShare: {},
  SimulationSession: {},
}));

const request = require('supertest');
const authRoutes = require('../../../src/routes/auth');
const { buildTestApp } = require('../helpers/buildTestApp');

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'a@b.com',
  role: 'editor',
  is_active: true,
  first_name: 'Alice',
  last_name: 'Smith',
  preferences: { theme: 'dark' },
  last_login: null,
  created_at: new Date('2026-01-01').toISOString(),
  updated_at: new Date('2026-01-01').toISOString(),
  password_hash: 'h',
  validatePassword: jest.fn().mockResolvedValue(true),
  updateLastLogin: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  getFullName: jest.fn(() => 'Alice Smith'),
  ...overrides,
});

beforeEach(() => {
  mockFindByEmail.mockReset();
  mockFindByPk.mockReset();
  mockCreate.mockReset();
});

// ----------------------------------------------------------------------------
// POST /api/auth/register
// ----------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  const app = buildTestApp(authRoutes, '/api/auth');

  test('400 on missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Password1!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 on weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('409 when email already exists', async () => {
    mockFindByEmail.mockResolvedValue(makeUser());
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'Password1!' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_EXISTS');
  });

  test('201 creates the user and returns the safe payload', async () => {
    mockFindByEmail.mockResolvedValue(null);
    mockCreate.mockResolvedValue(makeUser({ role: 'editor' }));

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'a@b.com',
        password: 'Password1!',
        firstName: 'Alice',
        lastName: 'Smith',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual(expect.objectContaining({
      id: 'user-1',
      email: 'a@b.com',
      role: 'editor',
      firstName: 'Alice',
      lastName: 'Smith',
      fullName: 'Alice Smith',
    }));
    // Password hash must never leak into the response.
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      email: 'a@b.com',
      role: 'editor',
      first_name: 'Alice',
      last_name: 'Smith',
    }));
  });
});

// ----------------------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  const app = buildTestApp(authRoutes, '/api/auth');

  test('400 on validation failure', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('401 when user not found', async () => {
    mockFindByEmail.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'Password1!' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('401 when user is inactive', async () => {
    mockFindByEmail.mockResolvedValue(makeUser({ is_active: false }));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'Password1!' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('401 when password is invalid', async () => {
    const u = makeUser({ validatePassword: jest.fn().mockResolvedValue(false) });
    mockFindByEmail.mockResolvedValue(u);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(u.validatePassword).toHaveBeenCalledWith('wrong');
    expect(u.updateLastLogin).not.toHaveBeenCalled();
  });

  test('200 on successful login and updates last_login', async () => {
    const u = makeUser();
    mockFindByEmail.mockResolvedValue(u);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-1');
    expect(u.updateLastLogin).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// POST /api/auth/logout
// ----------------------------------------------------------------------------
describe('POST /api/auth/logout', () => {
  test('401 without a session', async () => {
    const app = buildTestApp(authRoutes, '/api/auth', { session: null });
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  test('200 destroys session for authenticated user', async () => {
    mockFindByPk.mockResolvedValue(makeUser());
    const app = buildTestApp(authRoutes, '/api/auth', {
      session: { userId: 'user-1', userEmail: 'a@b.com' },
    });
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logout successful');
  });
});

// ----------------------------------------------------------------------------
// GET /api/auth/session
// ----------------------------------------------------------------------------
describe('GET /api/auth/session', () => {
  test('401 without session', async () => {
    const app = buildTestApp(authRoutes, '/api/auth', { session: null });
    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(401);
  });

  test('200 with the current user payload when authenticated', async () => {
    mockFindByPk.mockResolvedValue(makeUser());
    const app = buildTestApp(authRoutes, '/api/auth', {
      session: { userId: 'user-1' },
    });
    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user.id).toBe('user-1');
    expect(res.body.user.fullName).toBe('Alice Smith');
  });
});

// ----------------------------------------------------------------------------
// PUT /api/auth/profile
// ----------------------------------------------------------------------------
describe('PUT /api/auth/profile', () => {
  test('401 without session', async () => {
    const app = buildTestApp(authRoutes, '/api/auth', { session: null });
    const res = await request(app).put('/api/auth/profile').send({});
    expect(res.status).toBe(401);
  });

  test('200 updates first/last name and merges preferences', async () => {
    const u = makeUser();
    mockFindByPk.mockResolvedValue(u);
    const app = buildTestApp(authRoutes, '/api/auth', {
      session: { userId: 'user-1' },
    });
    const res = await request(app)
      .put('/api/auth/profile')
      .send({ firstName: 'Bob', preferences: { lang: 'fr' } });
    expect(res.status).toBe(200);
    expect(u.update).toHaveBeenCalledWith({
      first_name: 'Bob',
      preferences: { theme: 'dark', lang: 'fr' },
    });
  });

  test('400 on validation failure', async () => {
    mockFindByPk.mockResolvedValue(makeUser());
    const app = buildTestApp(authRoutes, '/api/auth', {
      session: { userId: 'user-1' },
    });
    const res = await request(app)
      .put('/api/auth/profile')
      .send({ firstName: '' }); // empty after trim → fails min(1)
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ----------------------------------------------------------------------------
// PUT /api/auth/change-password
// ----------------------------------------------------------------------------
describe('PUT /api/auth/change-password', () => {
  test('401 without session', async () => {
    const app = buildTestApp(authRoutes, '/api/auth', { session: null });
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'x', newPassword: 'Password1!' });
    expect(res.status).toBe(401);
  });

  test('401 when current password is wrong', async () => {
    const u = makeUser({ validatePassword: jest.fn().mockResolvedValue(false) });
    mockFindByPk.mockResolvedValue(u);
    const app = buildTestApp(authRoutes, '/api/auth', {
      session: { userId: 'user-1' },
    });
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'bad', newPassword: 'NewPassword1!' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(u.update).not.toHaveBeenCalled();
  });

  test('400 when new password is too weak', async () => {
    mockFindByPk.mockResolvedValue(makeUser());
    const app = buildTestApp(authRoutes, '/api/auth', {
      session: { userId: 'user-1' },
    });
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('200 updates the password hash via model hook', async () => {
    const u = makeUser();
    mockFindByPk.mockResolvedValue(u);
    const app = buildTestApp(authRoutes, '/api/auth', {
      session: { userId: 'user-1' },
    });
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'NewPassword1!' });
    expect(res.status).toBe(200);
    expect(u.update).toHaveBeenCalledWith({ password_hash: 'NewPassword1!' });
  });
});
