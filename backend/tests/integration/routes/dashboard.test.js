// Integration tests for /api/dashboard.

const mockGraphCount = jest.fn();
const mockGraphFindAll = jest.fn();
const mockSimulationCount = jest.fn();
const mockUserCount = jest.fn();

jest.mock('../../../src/models', () => ({
  Graph: { count: (...a) => mockGraphCount(...a), findAll: (...a) => mockGraphFindAll(...a) },
  SimulationSession: { count: (...a) => mockSimulationCount(...a) },
  User: { count: (...a) => mockUserCount(...a) },
  GraphVersion: {},
  GraphShare: {},
}));

jest.mock('../../../src/middleware/auth', () => ({
  validateSession: (req, res, next) => next(),
  logActivity: () => (req, res, next) => next(),
  requireEditor: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  authRateLimit: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requireGraphAccess: () => (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
}));

const request = require('supertest');
const dashboardRoutes = require('../../../src/routes/dashboard');
const { buildTestApp } = require('../helpers/buildTestApp');

const TEST_USER = { id: 'user-1', role: 'editor', email: 'a@b.com', username: 'alice' };
const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@b.com', username: 'admin' };

beforeEach(() => {
  mockGraphCount.mockReset();
  mockGraphFindAll.mockReset();
  mockSimulationCount.mockReset();
  mockUserCount.mockReset();
});

describe('GET /api/dashboard/stats', () => {
  test('returns user stats with totalUsers=1 for non-admin', async () => {
    // Per-call mock values (Promise.allSettled order in route).
    mockGraphCount
      .mockResolvedValueOnce(7) // totalGraphs
      .mockResolvedValueOnce(2); // recentActivity (3rd call below for User if admin)
    mockSimulationCount.mockResolvedValue(3);

    const app = buildTestApp(dashboardRoutes, '/api/dashboard', { user: TEST_USER });
    const res = await request(app).get('/api/dashboard/stats');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalGraphs: 7,
      activeSimulations: 3,
      totalUsers: 1, // non-admin sees 1
      recentActivity: 2,
    });
    expect(mockUserCount).not.toHaveBeenCalled();
  });

  test('admin gets the real total user count', async () => {
    mockGraphCount.mockResolvedValueOnce(10).mockResolvedValueOnce(4);
    mockSimulationCount.mockResolvedValue(1);
    mockUserCount.mockResolvedValue(42);

    const app = buildTestApp(dashboardRoutes, '/api/dashboard', { user: ADMIN });
    const res = await request(app).get('/api/dashboard/stats');

    expect(res.body.data.totalUsers).toBe(42);
    expect(mockUserCount).toHaveBeenCalled();
  });

  test('falls back to defaults when individual counts reject', async () => {
    mockGraphCount.mockRejectedValue(new Error('db'));
    mockSimulationCount.mockRejectedValue(new Error('db'));

    const app = buildTestApp(dashboardRoutes, '/api/dashboard', { user: TEST_USER });
    const res = await request(app).get('/api/dashboard/stats');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalGraphs: 0,
      activeSimulations: 0,
      totalUsers: 1,
      recentActivity: 0,
    });
  });
});

describe('GET /api/dashboard/recent-graphs', () => {
  test('returns user graphs ordered by updatedAt', async () => {
    mockGraphFindAll.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);
    const app = buildTestApp(dashboardRoutes, '/api/dashboard', { user: TEST_USER });
    const res = await request(app).get('/api/dashboard/recent-graphs');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const args = mockGraphFindAll.mock.calls[0][0];
    expect(args.where).toEqual({ user_id: TEST_USER.id });
    expect(args.order).toEqual([['updatedAt', 'DESC']]);
    expect(args.limit).toBe(5); // default
  });

  test('respects ?limit query', async () => {
    mockGraphFindAll.mockResolvedValue([]);
    const app = buildTestApp(dashboardRoutes, '/api/dashboard', { user: TEST_USER });
    await request(app).get('/api/dashboard/recent-graphs?limit=20');
    expect(mockGraphFindAll.mock.calls[0][0].limit).toBe(20);
  });
});

describe('GET /api/dashboard/activity-feed', () => {
  test('returns simulated activity items', async () => {
    const app = buildTestApp(dashboardRoutes, '/api/dashboard', { user: TEST_USER });
    const res = await request(app).get('/api/dashboard/activity-feed');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      type: expect.any(String),
      message: expect.any(String),
    }));
  });

  test('caps the response at the requested limit', async () => {
    const app = buildTestApp(dashboardRoutes, '/api/dashboard', { user: TEST_USER });
    const res = await request(app).get('/api/dashboard/activity-feed?limit=1');
    expect(res.body.data).toHaveLength(1);
  });
});
