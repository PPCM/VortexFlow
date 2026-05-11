const setupModule = require('../../../src/utils/setup');

// Stub the User model so setupAdminUser doesn't hit the database.
// We're only testing the prod-guard branch — nothing past it.
jest.mock('../../../src/models', () => ({
  User: {
    findByEmail: jest.fn().mockResolvedValue({
      id: 'existing-admin-id',
      email: 'admin@example.com',
      role: 'admin',
    }),
    create: jest.fn(),
  },
  Graph: {
    findByUser: jest.fn(),
    create: jest.fn(),
  },
}));

describe('setupAdminUser — AUTH-PROD-GUARD', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  test('refuses to seed in production when ADMIN_PASSWORD is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await expect(setupModule.setupAdminUser()).rejects.toThrow(/ADMIN_PASSWORD is unset/);
  });

  test('refuses to seed in production when ADMIN_PASSWORD is the documented default', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'change-me-in-production-please';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await expect(setupModule.setupAdminUser()).rejects.toThrow(/publicly-documented default/);
  });

  test('refuses to seed in production when ADMIN_PASSWORD is the legacy default', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'VortexFlow2024!';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await expect(setupModule.setupAdminUser()).rejects.toThrow(/publicly-documented default/);
  });

  test('accepts a non-default password in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'a-real-strong-secret-here-please-change-this-too';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    // findByEmail mock returns an existing admin, so setupAdminUser
    // returns early without creating anything.
    await expect(setupModule.setupAdminUser()).resolves.toBeDefined();
  });

  test('accepts the default password in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_PASSWORD = 'change-me-in-production-please';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await expect(setupModule.setupAdminUser()).resolves.toBeDefined();
  });

  test('accepts an unset ADMIN_PASSWORD in development (fallback applies)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await expect(setupModule.setupAdminUser()).resolves.toBeDefined();
  });
});
