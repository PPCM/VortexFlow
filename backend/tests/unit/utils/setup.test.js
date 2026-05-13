const setupModule = require('../../../src/utils/setup');

// Stub the User / Graph models so the setup helpers don't hit the database.
jest.mock('../../../src/models', () => ({
  User: {
    findByEmail: jest.fn().mockResolvedValue({
      id: 'existing-admin-id',
      email: 'admin@example.com',
      role: 'admin',
    }),
    create: jest.fn().mockResolvedValue({
      id: 'new-admin-id',
      email: 'admin@example.com',
      role: 'admin',
    }),
  },
  Graph: {
    findByUser: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'new-graph-id' }),
  },
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
  },
}));

const { User, Graph, sequelize } = require('../../../src/models');

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

describe('setupAdminUser — happy paths', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('returns the existing admin when one already exists', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    const result = await setupModule.setupAdminUser();

    expect(User.findByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(User.create).not.toHaveBeenCalled();
    expect(result.id).toBe('existing-admin-id');
  });

  test('creates a new admin when none exists', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    User.findByEmail.mockResolvedValueOnce(null);

    const result = await setupModule.setupAdminUser();

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        role: 'admin',
        first_name: 'System',
        last_name: 'Administrator',
        is_active: true,
      })
    );
    expect(result.id).toBe('new-admin-id');
  });
});

describe('createSampleData', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('skips sample data creation in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await setupModule.createSampleData();

    expect(Graph.create).not.toHaveBeenCalled();
  });

  test('skips when admin user is not found', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    User.findByEmail.mockResolvedValueOnce(null);

    await setupModule.createSampleData();

    expect(Graph.create).not.toHaveBeenCalled();
  });

  test('skips when sample graphs already exist for the admin', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    Graph.findByUser.mockResolvedValueOnce([{ id: 'existing' }]);

    await setupModule.createSampleData();

    expect(Graph.create).not.toHaveBeenCalled();
  });

  test('creates sample graphs when none exist (dev only)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await setupModule.createSampleData();

    expect(Graph.create).toHaveBeenCalled();
    // The helper now seeds a single "VortexFlow Showcase" demo graph.
    expect(Graph.create.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test('swallows errors instead of throwing (sample data is optional)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    Graph.findByUser.mockRejectedValueOnce(new Error('boom'));

    // Should not throw — sample-data failures are logged and ignored.
    await expect(setupModule.createSampleData()).resolves.toBeUndefined();
  });
});

describe('healthCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reports database OK and admin exists when both succeed', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';

    const status = await setupModule.healthCheck();

    expect(status.database).toBe(true);
    expect(status.adminUser).toBe(true);
    expect(status.timestamp).toBeDefined();
  });

  test('reports database false when sequelize.authenticate throws', async () => {
    sequelize.authenticate.mockRejectedValueOnce(new Error('DB down'));

    const status = await setupModule.healthCheck();

    expect(status.database).toBe(false);
  });
});

describe('initializeDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('runs setupAdminUser and (in dev) createSampleData', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await setupModule.initializeDatabase();

    expect(User.findByEmail).toHaveBeenCalled();
  });

  test('skips createSampleData outside development', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_EMAIL = 'admin@example.com';

    await setupModule.initializeDatabase();

    // createSampleData only runs in NODE_ENV === 'development'
    expect(Graph.create).not.toHaveBeenCalled();
  });
});
