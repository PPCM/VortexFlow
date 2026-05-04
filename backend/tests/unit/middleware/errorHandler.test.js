const {
  errorHandler,
  notFoundHandler,
  AppError,
  createValidationError,
  createNotFoundError,
  createForbiddenError,
  createUnauthorizedError,
  createRateLimitError,
} = require('../../../src/middleware/errorHandler');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const makeReq = (overrides = {}) => ({
  url: '/x',
  method: 'GET',
  ip: '127.0.0.1',
  get: () => 'jest',
  originalUrl: '/x',
  ...overrides,
});

describe('AppError and helpers', () => {
  test('AppError captures statusCode and code', () => {
    const e = new AppError('nope', 418, 'TEAPOT');
    expect(e.message).toBe('nope');
    expect(e.statusCode).toBe(418);
    expect(e.code).toBe('TEAPOT');
    expect(e.isOperational).toBe(true);
    expect(e instanceof Error).toBe(true);
  });

  test('createValidationError → 400 / VALIDATION_ERROR', () => {
    const e = createValidationError('email', 'required');
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.message).toMatch(/email/);
  });

  test('createNotFoundError → 404 / NOT_FOUND', () => {
    const e = createNotFoundError('Graph');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
  });

  test('createForbiddenError → 403 / FORBIDDEN', () => {
    expect(createForbiddenError().statusCode).toBe(403);
    expect(createForbiddenError().code).toBe('FORBIDDEN');
  });

  test('createUnauthorizedError → 401 / UNAUTHORIZED', () => {
    expect(createUnauthorizedError().statusCode).toBe(401);
  });

  test('createRateLimitError → 429 / RATE_LIMIT_EXCEEDED', () => {
    expect(createRateLimitError().statusCode).toBe(429);
    expect(createRateLimitError().code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('errorHandler middleware', () => {
  test('formats Sequelize validation errors as 400 with details', () => {
    const err = {
      name: 'SequelizeValidationError',
      errors: [
        { path: 'email', message: 'invalid', value: 'x' },
      ],
      message: 'val',
      stack: 's',
    };
    const res = makeRes();
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email', message: 'invalid', value: 'x' }],
    }));
  });

  test('formats unique constraint errors as 409', () => {
    const err = {
      name: 'SequelizeUniqueConstraintError',
      errors: [{ path: 'email' }],
      message: 'dup',
      stack: 's',
    };
    const res = makeRes();
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'UNIQUE_CONSTRAINT_ERROR',
      field: 'email',
    }));
  });

  test('formats foreign key constraint errors as 400', () => {
    const err = {
      name: 'SequelizeForeignKeyConstraintError',
      fields: ['user_id'],
      message: 'fk',
      stack: 's',
    };
    const res = makeRes();
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'FOREIGN_KEY_ERROR',
      field: 'user_id',
    }));
  });

  test('formats multer LIMIT_FILE_SIZE as 413', () => {
    const err = { code: 'LIMIT_FILE_SIZE', message: 'too big', stack: 's' };
    const res = makeRes();
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'FILE_TOO_LARGE',
    }));
  });

  test('formats multer LIMIT_UNEXPECTED_FILE as 400', () => {
    const err = { code: 'LIMIT_UNEXPECTED_FILE', message: '', stack: '' };
    const res = makeRes();
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'UNEXPECTED_FILE',
    }));
  });

  test('uses err.statusCode for AppError-style errors', () => {
    const err = new AppError('forbidden', 403, 'FORBIDDEN');
    const res = makeRes();
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'forbidden',
      code: 'FORBIDDEN',
    }));
  });

  test('falls back to 500 internal server error', () => {
    const err = new Error('mystery');
    const res = makeRes();
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERNAL_SERVER_ERROR',
    }));
  });

  test('hides stack trace in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const err = new Error('mystery');
      const res = makeRes();
      errorHandler(err, makeReq(), res, jest.fn());
      const payload = res.json.mock.calls[0][0];
      expect(payload.error).toBe('Internal server error');
      expect(payload.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('notFoundHandler', () => {
  test('responds with 404 and original URL', () => {
    const res = makeRes();
    notFoundHandler(makeReq({ originalUrl: '/missing' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NOT_FOUND',
      path: '/missing',
    }));
  });
});
