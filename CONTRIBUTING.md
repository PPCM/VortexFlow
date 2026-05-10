# Contributing to VortexFlow

Thanks for taking the time. This document covers the **workflow** — how to
get set up, run things, and submit changes. For the **code conventions**
themselves, see [`doc/STYLE_GUIDE.md`](./doc/STYLE_GUIDE.md). For the
**architecture**, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## TL;DR

```bash
git clone https://github.com/PPCM/VortexFlow.git
cd VortexFlow
cp .env.example .env                              # root (Docker compose)
cp backend/.env.example backend/.env              # backend (DB, Redis, session)
# create frontend/.env if missing — see "Setup" below

(cd backend && npm install && npm run setup-db)
(cd frontend && npm install --legacy-peer-deps)

./scripts/start-vortexflow.sh                     # backend + frontend
```

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **24.x** | CI runs Node 24 (`actions/setup-node@v5`). Backend `engines.node` requires `>=24.0.0`. Use Node 24 locally. |
| PostgreSQL | 14+ | Backing store. Local install or Docker. |
| Redis | 6+ | Session store and (potentially) cache. |
| Docker / Docker Compose | optional | Quickest path to a local stack via the root `docker-compose.yml`. |
| `gh` CLI | optional | Used by some helper commands; not required to contribute. |

---

## 2. Setup

```bash
# 1. Clone
git clone https://github.com/PPCM/VortexFlow.git
cd VortexFlow

# 2. Environment files (none of them are committed)
cp .env.example .env                          # root — used by docker-compose
cp backend/.env.example backend/.env          # backend — DB, Redis, sessions
cp frontend/.env.example frontend/.env        # frontend — VITE_API_URL, VITE_WS_URL

# 3. Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..
#                          ^^^^^^^^^^^^^^^^^^^
#  React 19 isn't yet listed as a peer of every MUI / testing-library version.
#  Don't drop the flag without checking that npm install succeeds without it.

# 4. Database
cd backend && npm run setup-db                # creates schema + seeded admin
```

The seeded admin email and password are read from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` in `backend/.env`. The defaults shipped in
`backend/.env.example` are public — **change them for any non-local
deployment.**

---

## 3. Running locally

There are three ways, pick whichever fits your workflow.

### A. Top-level orchestration (recommended for "just run everything")

```bash
./scripts/start-vortexflow.sh           # both services + health probes
./scripts/stop-vortexflow.sh
./scripts/dev-commands.sh status        # health check both services
./scripts/dev-commands.sh logs be       # tail backend logs (or `logs fe`)
./scripts/dev-commands.sh test          # probe /api/health, login, /api/dashboard/stats
```

These scripts default to `HOST=192.168.5.30` (the dev box). Override per-run:

```bash
HOST=localhost ./scripts/start-vortexflow.sh
```

### B. Backend on its own

```bash
cd backend
npm run dev                # nodemon server.js
npm run dev:env            # idem with `dotenv` preload (use if env vars don't load)
```

### C. Frontend on its own

```bash
cd frontend
npm run dev                # Vite on :3000
```

---

## 4. Running tests

### Backend (Jest)

```bash
cd backend
npm test                                   # all suites
npm run test:unit                          # tests/unit/**
npm run test:integration                   # tests/integration/**
npm run test:coverage                      # adds --coverage
npm test -- path/to/file.test.js           # single file
```

### Frontend (Vitest)

```bash
cd frontend
npm test                                   # one shot
npm run test:watch                         # watch mode
npm run test:coverage                      # v8 coverage
npm test -- ComponentName.test.tsx         # single file
```

The frontend test suite uses **Vitest globals** (`describe`, `test`, `expect`,
`vi`) — no imports needed. Mocks use `vi.fn()` / `vi.mock()` — never `jest.*`.

---

## 5. Lint, typecheck, build

These three must be clean before opening a PR — CI rejects otherwise.

```bash
# Backend
(cd backend && npm run lint)

# Frontend
(cd frontend && npm run lint)              # ESLint 9 flat config — repo is lint-clean
(cd frontend && npx tsc --noEmit)          # TypeScript check
(cd frontend && npm run build)             # production build smoke-test
```

There is **no pre-commit hook** today (Husky / lint-staged are not wired up
— planned). It's on you to run the checks above before pushing.

---

## 6. Code conventions

See [`doc/STYLE_GUIDE.md`](./doc/STYLE_GUIDE.md) for the full set:

- **Languages**: code comments in English, UI strings in French, docs in
  English, commit messages in French.
- **File naming** per layer (frontend / backend) is documented as tables.
- **Identifiers**: camelCase for vars/functions, PascalCase for components
  and Sequelize models, SCREAMING_SNAKE_CASE for module constants,
  snake_case for DB columns and kebab-case for URL paths.
- **React**: functional components only, fixed provider tree,
  `<ProtectedRoute>` for auth-guarded routes, lazy-load heavy pages.
- **Backend**: every async route handler wrapped in `asyncHandler`, errors
  thrown to the central error middleware, never `console.log` (use the
  Winston logger).

---

## 7. Pull request workflow

1. **Branch from `main`.** Use `feature/<slug>`, `fix/<slug>`, `chore/<slug>`,
   `doc/<slug>` as a prefix. (Solo work is currently committed directly on
   `main`; branches become important when contributors join.)
2. **Make focused changes.** One concern per PR. Don't bundle unrelated
   refactors. The current style guide enforces "surgical changes" — every
   modified line should trace back to the PR's stated goal.
3. **Add or update tests** for the changed behavior. New utilities need at
   least one unit test.
4. **Update `doc/changelog/YYYY-MM-DD.md`** for today's date. One line per
   modified file. If a change reverts a same-day modification, **delete the
   line** instead of writing "added then removed".
5. **Run lint + typecheck + tests + build** locally for both packages
   (commands in §5). PR will fail CI otherwise.
6. **Open the PR against `main`.** Title in French, present tense
   (e.g. `Auth: corrige la fenêtre de session sliding`).
7. **PR description**: state what you changed and why. Don't paste tool
   outputs. Don't add AI attribution lines (this applies to commits, PR
   bodies, comments, and code).
8. **CI must pass.** It runs `npm ci` + lint + tests for both packages, plus
   `tsc --noEmit` and `vite build` for the frontend.

---

## 8. Commit messages

Format documented in [`doc/STYLE_GUIDE.md` section 12](./doc/STYLE_GUIDE.md#12-git-workflow).

Quick recap:

- French, present tense, ≤ 70-char first line.
- `<scope>: <subject>` for scoped changes (e.g. `GraphRenderer3D: …`,
  `CI: …`, `Doc: …`).
- `<subject>` (no scope) for repo-wide changes.
- Body wrapped at ~72 chars, only when useful.
- **No** `Co-Authored-By`, **no** `Generated with Claude Code`, **no**
  mention of AI assistance.

---

## 9. Reporting bugs / suggesting features

Open a GitHub issue at <https://github.com/PPCM/VortexFlow/issues>.
Please include:

- VortexFlow commit / branch
- Node version, browser if relevant
- Steps to reproduce
- Expected vs actual behavior

There's no formal triage SLA — this is a small project with a single active
maintainer.

---

## 10. Security disclosures

See [`SECURITY.md`](./SECURITY.md). In short:

- **Don't** open a public issue or PR for vulnerabilities.
- Email the maintainer at `pierre@redtrash.fr` with the commit hash, impact,
  and reproduction steps.
- Acknowledgement target: 7 days; fix or mitigation plan: 30 days.

---

## 11. License

[MIT](./LICENSE).

---

## 12. Pointers

| Topic | Doc |
|---|---|
| Code conventions | [`doc/STYLE_GUIDE.md`](./doc/STYLE_GUIDE.md) |
| Architecture | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Backend topic guides | [`backend/doc/`](./backend/doc/) |
| DOT 3D specification | [`doc/dot-3d/`](./doc/dot-3d/) |
| Day-by-day changelog | [`doc/changelog/`](./doc/changelog/) |
| Architecture decisions | [`doc/adr/`](./doc/adr/) |
