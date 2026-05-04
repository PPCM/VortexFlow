// Global Jest setup: silence backend logger and console noise during tests.

jest.mock('../src/utils/logger', () => {
  const noop = () => {};
  const fakeLogger = {
    info: noop,
    error: noop,
    warn: noop,
    debug: noop,
    log: noop,
    child: () => fakeLogger,
  };
  return {
    logger: fakeLogger,
    createChildLogger: () => fakeLogger,
    logPerformance: noop,
    logUserActivity: noop,
    logDatabaseQuery: noop,
    logSecurityEvent: noop,
    logApiRequest: (req, res, next) => next(),
    logError: noop,
    loggers: {
      auth: fakeLogger,
      graph: fakeLogger,
      simulation: fakeLogger,
      websocket: fakeLogger,
      database: fakeLogger,
      api: fakeLogger,
    },
    info: noop,
    error: noop,
    warn: noop,
    debug: noop,
  };
});

// dotValidator and other backend code use console.log for debug traces.
// Silence them so test output stays readable.
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
