// Builds a minimal Express app for route integration tests.
// Wires body parsers + an in-memory session shim, then mounts the chosen router.
//
// Models, rate limiters, etc. are expected to be mocked from the calling test
// file via jest.mock() BEFORE requiring this helper.

const express = require('express');
const { errorHandler } = require('../../../src/middleware/errorHandler');

/**
 * @param {express.Router} router    Router to mount
 * @param {string}        mountPath  Path to mount the router at (e.g. '/api/auth')
 * @param {Object}        opts
 * @param {Object}        [opts.session]  Initial session content for `req.session`.
 *                                        Pass null/undefined to simulate no session.
 *                                        Defaults to an empty object {} so routes
 *                                        that write to `req.session` keep working.
 * @param {Object}        [opts.user]     If provided, attach as `req.user` on every
 *                                        request — used to simulate the result of
 *                                        validateSession when testing routes that
 *                                        rely on it but don't apply it inline.
 */
function buildTestApp(router, mountPath, opts = {}) {
  const app = express();
  // Match production limits in server.js so route-level size checks (e.g.
  // /api/public/parse-dot rejects >1MB) get reached instead of being clipped
  // by the default 100KB body parser limit.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // In-memory session shim. The real express-session is overkill for unit-ish
  // integration tests and pulls Redis. Routes only use req.session.{get,set}
  // and req.session.destroy(cb), which is what we replicate here.
  app.use((req, _res, next) => {
    const initial = 'session' in opts ? opts.session : {};
    req.session = initial == null ? null : { ...initial };
    if (req.session) {
      req.session.destroy = (cb) => {
        Object.keys(req.session).forEach((k) => {
          if (k !== 'destroy') delete req.session[k];
        });
        if (cb) cb(null);
      };
    }
    next();
  });

  if (opts.user !== undefined) {
    app.use((req, _res, next) => {
      req.user = opts.user;
      next();
    });
  }

  app.use(mountPath, router);
  app.use(errorHandler);
  return app;
}

module.exports = { buildTestApp };
