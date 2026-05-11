const { validate } = require('../../../src/config/env');

describe('config/env.validate', () => {
  test('accepts a minimal dev env (everything falls back to defaults)', () => {
    const env = { NODE_ENV: 'development' };
    const result = validate(env);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(5000);
    expect(result.HOST).toBe('0.0.0.0');
    expect(result.SESSION_SECRET).toBe('dev-only-insecure-secret');
    expect(result.FRONTEND_URL).toBe('http://localhost:3000');
  });

  test('requires a real SESSION_SECRET in production', () => {
    const env = {
      NODE_ENV: 'production',
      ADMIN_PASSWORD: 'a-real-strong-secret-here',
    };

    expect(() => validate(env)).toThrow(/SESSION_SECRET/);
  });

  test('rejects a SESSION_SECRET that is too short in production', () => {
    const env = {
      NODE_ENV: 'production',
      SESSION_SECRET: 'too-short',
      ADMIN_PASSWORD: 'a-real-strong-secret-here',
    };

    expect(() => validate(env)).toThrow(/SESSION_SECRET/);
  });

  test('accepts a long SESSION_SECRET in production', () => {
    const env = {
      NODE_ENV: 'production',
      SESSION_SECRET: 'a-suitably-long-and-random-session-secret-here',
      ADMIN_PASSWORD: 'a-real-strong-secret-here',
    };

    expect(() => validate(env)).not.toThrow();
  });

  test('rejects a malformed PORT', () => {
    const env = { NODE_ENV: 'development', PORT: 'not-a-number' };

    expect(() => validate(env)).toThrow(/PORT/);
  });

  test('rejects a malformed REDIS_URL', () => {
    const env = { NODE_ENV: 'development', REDIS_URL: 'not-a-url' };

    expect(() => validate(env)).toThrow(/REDIS_URL/);
  });

  test('rejects a malformed ADMIN_EMAIL', () => {
    const env = { NODE_ENV: 'development', ADMIN_EMAIL: 'not-an-email' };

    expect(() => validate(env)).toThrow(/ADMIN_EMAIL/);
  });

  test('accepts unknown env vars (CI runners, deploy platforms…)', () => {
    const env = {
      NODE_ENV: 'development',
      SOME_RANDOM_CI_VAR: 'whatever',
    };

    expect(() => validate(env)).not.toThrow();
  });

  test('applies defaults back to process.env when keys are missing', () => {
    const env = { NODE_ENV: 'development' };
    delete env.PORT;

    validate(env);

    expect(env.PORT).toBe('5000');
    expect(env.SESSION_NAME).toBe('vortexflow-session');
  });
});
