# VortexFlow Backend — Documentation Index

Backend-specific reference docs. For the project-wide picture (frontend +
backend + data model + simulation pipeline + DOT 3D invariant), start with
[`/ARCHITECTURE.md`](../../ARCHITECTURE.md) at the repo root.

## Topic guides

| Doc | Scope |
|---|---|
| [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) | Full REST API reference: endpoints, payloads, status codes |
| [`AUTHENTICATION.md`](./AUTHENTICATION.md) | Session lifecycle, roles, `validateSession` middleware |
| [`CONFIGURATION.md`](./CONFIGURATION.md) | Environment variables, defaults, production checklist |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Production deployment notes (currently being merged with `/doc/DEPLOYMENT.md` at the repo root) |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Local dev setup, code layout, common tasks |

## Stack at a glance

| Layer | Choice |
|---|---|
| Runtime | Node 18+ (CommonJS) |
| HTTP | Express + Helmet + CORS + compression + morgan + express-rate-limit |
| Sessions | `express-session` backed by Redis via `connect-redis` (no JWT) |
| Persistence | PostgreSQL via Sequelize (associations centralized in `src/models/index.js`) |
| Realtime | Socket.IO — currently for graph-collab events (cursor / chat / graph-update). The earlier server-side simulation handler was removed in commit `542db32`; simulation now runs entirely in the browser. |
| Logging | Winston (`src/utils/logger.js`) — use it instead of `console.*` |
| Validation | `joi` and `express-validator` |
| File uploads | `multer` → `backend/uploads/`, served at `/uploads` |

## Routes (mount summary)

| Mount | Auth |
|---|---|
| `/api/auth` | public |
| `/api/public` | public |
| `/api/system/health` | public *(special-cased before the protected `/api/system` mount)* |
| `/api/graphs` | mixed (per-route `validateSession`) |
| `/api/users` | `validateSession` (admin-only inside) |
| `/api/dashboard` | `validateSession` |
| `/api/admin` | own role checks |
| `/api/system/*` | `validateSession` |
| `/api/import-export` | `validateSession` |

See [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) for the per-endpoint details.

## Quickstart

```bash
cd backend
cp .env.example .env          # then edit values
npm install
npm run check-db              # verify Postgres connectivity
npm run setup-db              # create admin user, sync models
npm run dev                   # nodemon server.js
```

Health probe: `GET /api/system/health` (public) or `GET /api/health` (public).

For the full local setup and contribution workflow, see
[`DEVELOPMENT.md`](./DEVELOPMENT.md).

## Configuration

The seeded admin user is bootstrapped from `ADMIN_EMAIL` and `ADMIN_PASSWORD`
on first startup. Both default values in `.env.example` are placeholders and
**must not be used in production** — they're documented and public. See
[`CONFIGURATION.md`](./CONFIGURATION.md) for the full list of environment
variables and their defaults.

## Tests

| Command | Scope |
|---|---|
| `npm test` | All Jest suites |
| `npm run test:unit` | `tests/unit/**` only |
| `npm run test:integration` | `tests/integration/**` only |
| `npm run test:coverage` | Adds `--coverage` |
| `npm test -- path/to/file.test.js` | Single test file |

`tests/setup.js` is auto-loaded via `setupFilesAfterEnv` and silences the
Winston logger globally — put cross-suite mocks there.

When testing modules that install module-level timers (e.g. `utils/fileUpload.js`
has a 1h `setInterval`), call `jest.useFakeTimers()` before `require` to avoid
keeping the event loop alive after tests finish.

## Lint

```bash
npm run lint        # eslint . --ext .js (eslint:recommended only)
npm run lint:fix
```

The backend ESLint config is intentionally minimal (`.eslintrc.json` extends
`eslint:recommended`). The `eslint-config-airbnb-base` package is installed
in `devDependencies` but **not wired up** — reactivating it would surface
hundreds of stylistic violations. A migration to a stricter preset is
planned.
