const asyncHandler = require('../../../src/middleware/asyncHandler');

describe('asyncHandler', () => {
  test('returns a function', () => {
    expect(typeof asyncHandler(() => {})).toBe('function');
  });

  test('forwards req/res/next to wrapped fn', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(fn);
    const req = { id: 'r' };
    const res = { id: 's' };
    const next = jest.fn();

    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('catches async errors and forwards them to next', async () => {
    const boom = new Error('boom');
    const fn = jest.fn().mockRejectedValue(boom);
    const wrapped = asyncHandler(fn);
    const next = jest.fn();

    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  test('lets synchronous throws bubble up (not caught by Promise.resolve)', () => {
    // asyncHandler wraps via `Promise.resolve(fn(...))`. If fn throws
    // synchronously, the error escapes before Promise.resolve runs, so the
    // wrapper does NOT funnel it through `next`. Document that contract here.
    const wrapped = asyncHandler(() => { throw new Error('sync'); });
    expect(() => wrapped({}, {}, jest.fn())).toThrow('sync');
  });
});
