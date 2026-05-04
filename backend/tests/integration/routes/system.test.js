// Integration tests for /api/system.

const mockUserFindOne = jest.fn();
const mockTestEmailConfig = jest.fn();
const mockSendWelcomeEmail = jest.fn();

jest.mock('../../../src/models', () => ({
  User: { findOne: (...a) => mockUserFindOne(...a), count: jest.fn().mockResolvedValue(0) },
  Graph: { count: jest.fn().mockResolvedValue(0) },
  SimulationSession: { count: jest.fn().mockResolvedValue(0) },
  GraphVersion: {},
  GraphShare: {},
}));

jest.mock('../../../src/services/emailService', () => ({
  testConfiguration: (...a) => mockTestEmailConfig(...a),
  sendWelcomeEmail: (...a) => mockSendWelcomeEmail(...a),
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
const systemRoutes = require('../../../src/routes/system');
const { buildTestApp } = require('../helpers/buildTestApp');

const TEST_ADMIN = { id: 'a1', role: 'admin', email: 'admin@b.com' };

beforeEach(() => {
  mockUserFindOne.mockReset();
  mockTestEmailConfig.mockReset();
  mockSendWelcomeEmail.mockReset();
});

describe('GET /api/system/health', () => {
  test('200 healthy when DB and email work', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'x' });
    mockTestEmailConfig.mockResolvedValue({ success: true, message: 'ok' });

    const app = buildTestApp(systemRoutes, '/api/system');
    const res = await request(app).get('/api/system/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database.status).toBe('healthy');
    expect(res.body.services.email.status).toBe('healthy');
    expect(res.body.system.memory).toEqual(expect.objectContaining({
      used: expect.any(Number),
      total: expect.any(Number),
    }));
  });

  test('503 degraded when DB probe fails', async () => {
    mockUserFindOne.mockRejectedValue(new Error('db down'));
    mockTestEmailConfig.mockResolvedValue({ success: false, message: 'no smtp' });

    const app = buildTestApp(systemRoutes, '/api/system');
    const res = await request(app).get('/api/system/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database.status).toBe('unhealthy');
    expect(res.body.services.email.status).toBe('unavailable');
  });
});

describe('GET /api/system/info', () => {
  test('returns server/database/redis/email/features payload', async () => {
    const app = buildTestApp(systemRoutes, '/api/system', { user: TEST_ADMIN });
    const res = await request(app).get('/api/system/info');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      server: expect.objectContaining({
        nodeVersion: expect.any(String),
        platform: expect.any(String),
        environment: expect.any(String),
      }),
      database: expect.objectContaining({ type: 'PostgreSQL' }),
      features: expect.objectContaining({
        authentication: true,
        websockets: true,
      }),
      limits: expect.any(Object),
    }));
  });
});

describe('POST /api/system/test-email', () => {
  test('200 when email config is valid and welcome email is sent', async () => {
    mockTestEmailConfig.mockResolvedValue({ success: true, message: 'ok' });
    mockSendWelcomeEmail.mockResolvedValue(true);

    const app = buildTestApp(systemRoutes, '/api/system', { user: TEST_ADMIN });
    const res = await request(app).post('/api/system/test-email');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Email configuration is working',
      testEmailSent: true,
    });
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(TEST_ADMIN);
  });

  test('400 when email is not configured', async () => {
    mockTestEmailConfig.mockResolvedValue({ success: false, message: 'no smtp' });
    const app = buildTestApp(systemRoutes, '/api/system', { user: TEST_ADMIN });
    const res = await request(app).post('/api/system/test-email');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'no smtp' });
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });
});

describe('GET /api/system/metrics', () => {
  test('200 with timestamp/uptime/memory/cpu fields', async () => {
    const app = buildTestApp(systemRoutes, '/api/system', { user: TEST_ADMIN });
    const res = await request(app).get('/api/system/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      memory: expect.objectContaining({
        used: expect.any(Number),
        total: expect.any(Number),
      }),
    }));
  });
});
