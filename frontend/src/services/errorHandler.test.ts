import {
  VortexFlowError,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ServerError,
  ErrorHandler,
  errorHandler,
} from './errorHandler';
import type { AxiosError } from 'axios';

// ErrorHandler logs via console in dev mode; suppress to keep test output clean.
beforeAll(() => {
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

const makeAxiosError = (overrides: Partial<AxiosError> = {}): AxiosError => ({
  isAxiosError: true,
  toJSON: () => ({}),
  name: 'AxiosError',
  message: 'axios',
  config: { url: '/x', method: 'get' } as any,
  ...overrides,
} as AxiosError);

describe('VortexFlowError class hierarchy', () => {
  test('VortexFlowError captures code, statusCode, details, timestamp', () => {
    const e = new VortexFlowError('msg', 'CODE', 418, { x: 1 });
    expect(e.message).toBe('msg');
    expect(e.code).toBe('CODE');
    expect(e.statusCode).toBe(418);
    expect(e.details).toEqual({ x: 1 });
    expect(e.timestamp).toBeInstanceOf(Date);
    expect(e instanceof Error).toBe(true);
    expect(e.name).toBe('VortexFlowError');
  });

  test('NetworkError defaults', () => {
    const e = new NetworkError();
    expect(e.code).toBe('NETWORK_ERROR');
    expect(e.statusCode).toBeUndefined();
    expect(e.name).toBe('NetworkError');
  });

  test('AuthenticationError → 401 / AUTH_ERROR', () => {
    const e = new AuthenticationError();
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe('AUTH_ERROR');
  });

  test('AuthorizationError → 403 / AUTHORIZATION_ERROR', () => {
    const e = new AuthorizationError();
    expect(e.statusCode).toBe(403);
    expect(e.code).toBe('AUTHORIZATION_ERROR');
  });

  test('ValidationError → 400 / VALIDATION_ERROR with details', () => {
    const e = new ValidationError('bad input', { field: 'email' });
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.details).toEqual({ field: 'email' });
  });

  test('ServerError defaults to 500 / SERVER_ERROR', () => {
    const e = new ServerError();
    expect(e.statusCode).toBe(500);
    expect(e.code).toBe('SERVER_ERROR');
  });

  test('ServerError accepts custom status code', () => {
    expect(new ServerError('m', 503).statusCode).toBe(503);
  });
});

describe('ErrorHandler.getInstance() singleton', () => {
  test('returns the same instance', () => {
    expect(ErrorHandler.getInstance()).toBe(ErrorHandler.getInstance());
  });

  test('exported errorHandler is the singleton', () => {
    expect(errorHandler).toBe(ErrorHandler.getInstance());
  });
});

describe('handleAxiosError → VortexFlow error mapping', () => {
  test('400 → ValidationError', () => {
    const err = makeAxiosError({
      response: { status: 400, data: { message: 'bad', errors: [1, 2] }, statusText: '', headers: {}, config: {} as any },
    });
    const v = errorHandler.handleAxiosError(err);
    expect(v).toBeInstanceOf(ValidationError);
    expect(v.message).toBe('bad');
    expect(v.details).toEqual([1, 2]);
  });

  test('401 → AuthenticationError', () => {
    const err = makeAxiosError({
      response: { status: 401, data: {}, statusText: '', headers: {}, config: {} as any },
    });
    expect(errorHandler.handleAxiosError(err)).toBeInstanceOf(AuthenticationError);
  });

  test('403 → AuthorizationError', () => {
    const err = makeAxiosError({
      response: { status: 403, data: {}, statusText: '', headers: {}, config: {} as any },
    });
    expect(errorHandler.handleAxiosError(err)).toBeInstanceOf(AuthorizationError);
  });

  test('404 → NOT_FOUND VortexFlowError', () => {
    const err = makeAxiosError({
      response: { status: 404, data: { message: 'gone' }, statusText: '', headers: {}, config: {} as any },
    });
    const v = errorHandler.handleAxiosError(err);
    expect(v.code).toBe('NOT_FOUND');
    expect(v.statusCode).toBe(404);
    expect(v.message).toBe('gone');
  });

  test('422 → ValidationError', () => {
    const err = makeAxiosError({
      response: { status: 422, data: {}, statusText: '', headers: {}, config: {} as any },
    });
    expect(errorHandler.handleAxiosError(err)).toBeInstanceOf(ValidationError);
  });

  test('429 → RATE_LIMIT', () => {
    const err = makeAxiosError({
      response: { status: 429, data: {}, statusText: '', headers: {}, config: {} as any },
    });
    const v = errorHandler.handleAxiosError(err);
    expect(v.code).toBe('RATE_LIMIT');
    expect(v.statusCode).toBe(429);
  });

  test.each([500, 502, 503, 504])('%i → ServerError', (status) => {
    const err = makeAxiosError({
      response: { status, data: {}, statusText: '', headers: {}, config: {} as any },
    });
    const v = errorHandler.handleAxiosError(err);
    expect(v).toBeInstanceOf(ServerError);
    expect(v.statusCode).toBe(status);
  });

  test('unmapped status → generic HTTP_ERROR', () => {
    const err = makeAxiosError({
      response: { status: 418, data: {}, statusText: '', headers: {}, config: {} as any },
    });
    const v = errorHandler.handleAxiosError(err);
    expect(v.code).toBe('HTTP_ERROR');
    expect(v.statusCode).toBe(418);
  });

  test('no response, only request → NetworkError', () => {
    const err = makeAxiosError({ request: {} });
    expect(errorHandler.handleAxiosError(err)).toBeInstanceOf(NetworkError);
  });

  test('no response and no request → REQUEST_CONFIG_ERROR', () => {
    const err = makeAxiosError({ message: 'config bad' });
    const v = errorHandler.handleAxiosError(err);
    expect(v.code).toBe('REQUEST_CONFIG_ERROR');
  });

  test('merges endpoint and method into context', () => {
    const err = makeAxiosError({
      config: { url: '/api/x', method: 'POST' } as any,
      response: { status: 500, data: {}, statusText: '', headers: {}, config: {} as any },
    });
    const v = errorHandler.handleAxiosError(err);
    expect(v.context).toEqual(expect.objectContaining({
      endpoint: '/api/x',
      method: 'POST',
    }));
  });
});

describe('handleError (generic)', () => {
  test('returns a VortexFlowError unchanged', () => {
    const original = new ValidationError('keep me');
    expect(errorHandler.handleError(original)).toBe(original);
  });

  test('wraps native Error in GENERIC_ERROR', () => {
    const v = errorHandler.handleError(new TypeError('boom'));
    expect(v.code).toBe('GENERIC_ERROR');
    expect(v.message).toBe('boom');
  });

  test('wraps unknown values in UNKNOWN_ERROR', () => {
    const v = errorHandler.handleError({ weird: true });
    expect(v.code).toBe('UNKNOWN_ERROR');
  });
});

describe('classification helpers', () => {
  test('isRetryableError flags network/server/rate-limit codes', () => {
    expect(errorHandler.isRetryableError(new NetworkError())).toBe(true);
    expect(errorHandler.isRetryableError(new ServerError())).toBe(true);
    expect(errorHandler.isRetryableError(
      new VortexFlowError('m', 'RATE_LIMIT', 429),
    )).toBe(true);
  });

  test('isRetryableError treats any 5xx as retryable', () => {
    expect(errorHandler.isRetryableError(
      new VortexFlowError('m', 'WHATEVER', 502),
    )).toBe(true);
  });

  test('isRetryableError rejects validation errors', () => {
    expect(errorHandler.isRetryableError(new ValidationError('m'))).toBe(false);
  });

  test('shouldRedirectToLogin recognises auth errors and 401', () => {
    expect(errorHandler.shouldRedirectToLogin(new AuthenticationError())).toBe(true);
    expect(errorHandler.shouldRedirectToLogin(
      new VortexFlowError('m', 'OTHER', 401),
    )).toBe(true);
    expect(errorHandler.shouldRedirectToLogin(new ValidationError('m'))).toBe(false);
  });

  test('getUserFriendlyMessage maps known codes', () => {
    expect(errorHandler.getUserFriendlyMessage(new NetworkError()))
      .toMatch(/connexion/i);
    expect(errorHandler.getUserFriendlyMessage(new AuthenticationError()))
      .toMatch(/session/i);
  });

  test('getUserFriendlyMessage falls back to error.message for unknown codes', () => {
    const v = new VortexFlowError('original message', 'WEIRD', 999);
    expect(errorHandler.getUserFriendlyMessage(v)).toBe('original message');
  });
});

describe('error listeners', () => {
  test('listeners are invoked on error and unsubscribe works', () => {
    const seen: string[] = [];
    const off = errorHandler.addErrorListener((e) => seen.push(e.code));

    errorHandler.handleError(new Error('x'));
    expect(seen).toContain('GENERIC_ERROR');

    off();
    seen.length = 0;
    errorHandler.handleError(new Error('y'));
    expect(seen).toEqual([]);
  });

  test('a throwing listener does not break notification of others', () => {
    const seen: string[] = [];
    const off1 = errorHandler.addErrorListener(() => { throw new Error('listener boom'); });
    const off2 = errorHandler.addErrorListener((e) => seen.push(e.code));

    errorHandler.handleError(new Error('z'));
    expect(seen).toContain('GENERIC_ERROR');

    off1();
    off2();
  });
});
