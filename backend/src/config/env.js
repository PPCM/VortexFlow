/**
 * Environment-variable validation, executed once at boot.
 *
 * The goal is to fail fast on configuration mistakes (missing or malformed
 * env vars) instead of crashing later with an opaque runtime error. In
 * production, stricter rules apply.
 *
 * Usage: `require('./config/env').validate()` at the top of server.js,
 * before anything else loads.
 */

const Joi = require('joi');

const envSchema = Joi.object({
  // Runtime
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().positive().default(5000),
  HOST: Joi.string().default('0.0.0.0'),

  // PostgreSQL — either a full DATABASE_URL, or the individual DB_* values.
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).optional(),
  DB_NAME: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.optional() }),
  DB_USER: Joi.string().optional(),
  DB_PASSWORD: Joi.string().allow('').optional(),
  DB_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().integer().positive().optional(),

  // Redis
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).default('redis://localhost:6379'),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // Sessions — SESSION_SECRET must exist and be non-trivial in production.
  SESSION_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().default('dev-only-insecure-secret'),
  }),
  SESSION_NAME: Joi.string().default('vortexflow-session'),
  SESSION_MAX_AGE: Joi.number().integer().positive().optional(),

  // Admin bootstrap — the prod guard for ADMIN_PASSWORD lives in utils/setup.js
  // (it knows the documented default and legacy default to reject). Here we
  // just enforce a syntactically valid email.
  ADMIN_EMAIL: Joi.string().email().optional(),
  ADMIN_PASSWORD: Joi.string().min(1).optional(),

  // CORS / frontend
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // Rate limiting (global /api limiter — applied in server.js)
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().positive().optional(),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().positive().optional(),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
}).unknown(true); // tolerate extra env vars (CI runners, deployment platforms, etc.)

/**
 * Validate process.env against the schema.
 *
 * Returns the (validated and defaulted) env object. Mutates process.env to
 * carry the defaults so the rest of the app can keep reading from
 * process.env.X as it does today.
 *
 * Throws if validation fails — the server should crash on boot rather than
 * silently mis-running.
 */
function validate(env = process.env) {
  const { error, value } = envSchema.validate(env, { abortEarly: false, stripUnknown: false });

  if (error) {
    const details = error.details.map((d) => `  - ${d.message}`).join('\n');
    throw new Error(
      `[FATAL] Environment validation failed:\n${details}\n` +
      'See backend/.env.example for the expected variables.'
    );
  }

  // Apply defaults back to the env object (process.env by default) so
  // downstream consumers can keep reading from process.env.X.
  for (const key of Object.keys(value)) {
    if (env[key] === undefined && value[key] !== undefined) {
      env[key] = String(value[key]);
    }
  }

  return value;
}

module.exports = { validate, envSchema };
