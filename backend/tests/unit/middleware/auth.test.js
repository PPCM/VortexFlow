// Mock the models module before requiring the middleware so that
// validateSession's `User.findByPk` lookup is fully controllable.
const mockFindByPk = jest.fn();

jest.mock('../../../src/models', () => ({
  User: { findByPk: (...args) => mockFindByPk(...args) },
  Graph: { findByPk: jest.fn() },
  GraphShare: {},
}));

const {
  validateSession,
  requireRole,
  requireAdmin,
  requireEditor,
  optionalAuth,
} = require('../../../src/middleware/auth');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  mockFindByPk.mockReset();
});

describe('validateSession', () => {
  test('returns 401 when no session', async () => {
    const res = makeRes();
    const next = jest.fn();
    await validateSession({ session: null }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when session has no userId', async () => {
    const res = makeRes();
    await validateSession({ session: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 and destroys session for unknown user', async () => {
    mockFindByPk.mockResolvedValue(null);
    const destroy = jest.fn();
    const res = makeRes();
    const req = { session: { userId: 'u1', destroy } };
    await validateSession(req, res, jest.fn());
    expect(destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_INACTIVE' }));
  });

  test('returns 401 for inactive user', async () => {
    mockFindByPk.mockResolvedValue({ id: 'u1', is_active: false });
    const res = makeRes();
    const req = { session: { userId: 'u1', destroy: jest.fn() } };
    await validateSession(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('attaches req.user and calls next for active user', async () => {
    const user = { id: 'u1', is_active: true, role: 'editor' };
    mockFindByPk.mockResolvedValue(user);
    const res = makeRes();
    const req = { session: { userId: 'u1' } };
    const next = jest.fn();
    await validateSession(req, res, next);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 500 when DB lookup throws', async () => {
    mockFindByPk.mockRejectedValue(new Error('db boom'));
    const res = makeRes();
    const req = { session: { userId: 'u1' } };
    await validateSession(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });
});

describe('requireRole', () => {
  test('returns 401 when no req.user', () => {
    const res = makeRes();
    requireRole(['admin'])({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 403 when user has wrong role', () => {
    const res = makeRes();
    const next = jest.fn();
    requireRole(['admin'])({ user: { role: 'viewer' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INSUFFICIENT_PERMISSIONS',
      required: ['admin'],
      current: 'viewer',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('passes when role matches', () => {
    const res = makeRes();
    const next = jest.fn();
    requireRole(['admin', 'editor'])({ user: { role: 'editor' } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('accepts a string instead of an array', () => {
    const res = makeRes();
    const next = jest.fn();
    requireRole('admin')({ user: { role: 'admin' } }, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin / requireEditor shortcuts', () => {
  test('requireAdmin lets admins through', () => {
    const next = jest.fn();
    requireAdmin({ user: { role: 'admin' } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('requireAdmin rejects editors', () => {
    const res = makeRes();
    requireAdmin({ user: { role: 'editor' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('requireEditor accepts both editor and admin', () => {
    const a = jest.fn();
    const b = jest.fn();
    requireEditor({ user: { role: 'editor' } }, makeRes(), a);
    requireEditor({ user: { role: 'admin' } }, makeRes(), b);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  test('requireEditor rejects viewers', () => {
    const res = makeRes();
    requireEditor({ user: { role: 'viewer' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('optionalAuth', () => {
  test('attaches user when session is valid', async () => {
    const user = { id: 'u', is_active: true };
    mockFindByPk.mockResolvedValue(user);
    const req = { session: { userId: 'u' } };
    const next = jest.fn();
    await optionalAuth(req, makeRes(), next);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalled();
  });

  test('skips silently when no session', async () => {
    const req = { session: null };
    const next = jest.fn();
    await optionalAuth(req, makeRes(), next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test('does not attach user if inactive', async () => {
    mockFindByPk.mockResolvedValue({ id: 'u', is_active: false });
    const req = { session: { userId: 'u' } };
    const next = jest.fn();
    await optionalAuth(req, makeRes(), next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test('continues even if DB throws', async () => {
    mockFindByPk.mockRejectedValue(new Error('db'));
    const req = { session: { userId: 'u' } };
    const next = jest.fn();
    await optionalAuth(req, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
