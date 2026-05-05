// Unit tests for EmailService.
//
// nodemailer is mocked entirely. Each test rebuilds a fresh EmailService
// instance because the real module exports a pre-instantiated singleton.

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify,
}));

jest.mock('nodemailer', () => ({
  createTransport: (...a) => mockCreateTransport(...a),
}));

// Import the class via jest.requireActual on the singleton module is awkward;
// the module exports a singleton, so we reset the require cache between tests
// to get a fresh instance reflecting current env vars.
const loadFreshService = () => {
  jest.resetModules();
  // Re-mock nodemailer for the new module instance.
  jest.doMock('nodemailer', () => ({
    createTransport: (...a) => mockCreateTransport(...a),
  }));
  // eslint-disable-next-line global-require
  return require('../../../src/services/emailService');
};

let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  mockSendMail.mockReset();
  mockVerify.mockReset();
  mockCreateTransport.mockClear();
});

afterEach(() => {
  process.env = originalEnv;
});

describe('setupTransporter', () => {
  test('does not configure when SMTP env vars are missing', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const service = loadFreshService();
    expect(service.isConfigured).toBe(false);
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  test('creates a transporter when SMTP_HOST/USER/PASS are all set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'me@example.com';
    process.env.SMTP_PASS = 'secret';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    mockVerify.mockImplementation((cb) => cb && cb(null, true));

    const service = loadFreshService();
    expect(service.isConfigured).toBe(true);
    expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'me@example.com', pass: 'secret' },
    }));
  });

  test('flips isConfigured back to false when verify reports an error', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    mockVerify.mockImplementation((cb) => cb(new Error('bad creds')));

    const service = loadFreshService();
    // mockVerify ran synchronously, so isConfigured should already be false.
    expect(service.isConfigured).toBe(false);
  });
});

describe('email send methods (configured)', () => {
  let service;

  beforeEach(() => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'me@example.com';
    process.env.SMTP_PASS = 'secret';
    process.env.FRONTEND_URL = 'https://app.example.com';
    mockVerify.mockImplementation((cb) => cb && cb(null, true));
    service = loadFreshService();
  });

  test('sendWelcomeEmail returns true and calls sendMail with the right shape', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' });
    const ok = await service.sendWelcomeEmail({
      id: 'u1', email: 'alice@x.com', first_name: 'Alice', role: 'editor',
    });
    expect(ok).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@x.com',
      subject: 'Welcome to VortexFlow!',
      html: expect.stringContaining('Hello Alice'),
    }));
  });

  test('sendWelcomeEmail returns false when transport throws', async () => {
    mockSendMail.mockRejectedValue(new Error('network'));
    const ok = await service.sendWelcomeEmail({
      id: 'u1', email: 'alice@x.com', first_name: 'Alice',
    });
    expect(ok).toBe(false);
  });

  test('sendPasswordResetEmail builds the reset URL with the token', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-2' });
    await service.sendPasswordResetEmail(
      { id: 'u1', email: 'a@x.com', first_name: 'A' },
      'token-abc',
    );
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('token=token-abc');
    expect(call.html).toContain('https://app.example.com/reset-password');
  });

  test('sendGraphShareNotification embeds the graph URL and permission level text', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-3' });
    await service.sendGraphShareNotification(
      { id: 'u2', email: 'b@x.com', first_name: 'Bob' },
      { id: 'u1', email: 'a@x.com', first_name: 'Alice' },
      { id: 'g1', title: 'My Graph', description: 'd', category: 'demo' },
      'edit',
    );
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('My Graph');
    expect(call.html).toContain('https://app.example.com/graphs/g1');
    expect(call.html).toContain('Permission Level:</strong> edit');
  });

  test('sendSimulationCompletionEmail embeds session id in URL', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-4' });
    await service.sendSimulationCompletionEmail(
      { id: 'u1', email: 'a@x.com', first_name: 'A' },
      { id: 'sess-1', session_name: 'Run 1' },
      { duration: 12, totalSteps: 50, finalParticleCount: 100 },
    );
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('https://app.example.com/simulations/sess-1');
    expect(call.html).toContain('Run 1');
  });
});

describe('email send methods (not configured)', () => {
  let service;

  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    service = loadFreshService();
  });

  test.each([
    'sendWelcomeEmail',
    'sendPasswordResetEmail',
    'sendGraphShareNotification',
    'sendSimulationCompletionEmail',
  ])('%s returns false (no SMTP configured)', async (method) => {
    const result = await service[method]({}, {}, {}, 'view');
    expect(result).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

describe('testConfiguration', () => {
  test('returns success=false when not configured', async () => {
    delete process.env.SMTP_HOST;
    const service = loadFreshService();
    const r = await service.testConfiguration();
    expect(r).toEqual({ success: false, message: 'Email service not configured' });
  });

  test('returns success=true when verify resolves', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    mockVerify.mockImplementation((cb) => cb && cb(null, true));
    const service = loadFreshService();
    // Now testConfiguration awaits verify() with no callback (Promise form):
    mockVerify.mockResolvedValue(true);
    const r = await service.testConfiguration();
    expect(r).toEqual({ success: true, message: 'Email configuration is working' });
  });

  test('returns success=false when verify rejects', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    // First, the constructor's verify(callback) call must not error.
    mockVerify.mockImplementationOnce((cb) => cb && cb(null, true));
    const service = loadFreshService();
    // Then, the testConfiguration() call uses the no-arg promise form.
    mockVerify.mockRejectedValueOnce(new Error('refused'));
    const r = await service.testConfiguration();
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/refused/);
  });
});

describe('template generators (pure)', () => {
  let service;
  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    service = loadFreshService();
  });

  test('welcome template includes user role and dashboard link', () => {
    const html = service.generateWelcomeTemplate({
      first_name: 'Alice', role: 'admin',
    });
    expect(html).toContain('Hello Alice');
    expect(html).toContain('admin');
    expect(html).toContain('https://app.example.com/dashboard');
  });

  test('welcome template falls back to "there" without first_name', () => {
    const html = service.generateWelcomeTemplate({ role: 'editor' });
    expect(html).toContain('Hello there');
  });

  test('password reset template embeds reset URL', () => {
    const html = service.generatePasswordResetTemplate(
      { first_name: 'Bob' }, 'https://x/reset?t=abc',
    );
    expect(html).toContain('https://x/reset?t=abc');
  });

  test('graph share template formats permission level into "edit" or "view"', () => {
    const html = service.generateGraphShareTemplate(
      { first_name: 'Bob' },
      { first_name: 'Alice' },
      { title: 'G', description: 'd', category: 'cat' },
      'view',
      'https://app/graphs/1',
    );
    expect(html).toContain('view');
    expect(html).toContain('https://app/graphs/1');
  });

  test('simulation complete template renders results stats', () => {
    const html = service.generateSimulationCompleteTemplate(
      { first_name: 'A' },
      { session_name: 'Run' },
      { duration: 30.7, totalSteps: 100, finalParticleCount: 42 },
      'https://app/sim/1',
    );
    expect(html).toContain('31s'); // Math.round(30.7)
    expect(html).toContain('100');
    expect(html).toContain('42');
  });
});
