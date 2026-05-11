# VortexFlow — Style Guide

Conventions actually followed by the codebase. When this document and the code
disagree, the code wins — open a PR to fix the doc, not the code (unless the
code is the deviation, in which case fix the code).

Sections marked **(deviation)** point at known inconsistencies that are being
tracked, not patterns to follow.

---

## 1. Languages

| Surface                                                | Language                          |
| ------------------------------------------------------ | --------------------------------- |
| Code comments                                          | English                           |
| User-facing strings (UI labels, errors shown to users) | French                            |
| Documentation (`*.md`)                                 | English                           |
| Commit messages                                        | French (matches the existing log) |
| Variable names                                         | English                           |

Existing code has French comments in places (e.g. older `LoginPage.tsx`).
Don't bulk-translate; convert opportunistically when you're already touching
the file. Don't introduce new French comments.

---

## 2. File naming — Frontend (`frontend/src/`)

| Layer                       | Path                 | Naming                  | Example                                     |
| --------------------------- | -------------------- | ----------------------- | ------------------------------------------- |
| React component             | `components/<area>/` | `PascalCase.tsx`        | `LoginPage.tsx`, `GraphRenderer3D.tsx`      |
| Component test (colocated)  | same dir             | `PascalCase.test.tsx`   | `LoginPage.test.tsx`                        |
| Component CSS (colocated)   | same dir             | `PascalCase.css`        | `AdminPanel.css`                            |
| React Context               | `context/`           | `XxxContext.tsx`        | `AuthContext.tsx`, `GraphContext.tsx`       |
| Service                     | `services/`          | `camelCase.ts`          | `api.ts`, `errorHandler.ts`, `websocket.ts` |
| Type definitions            | `types/index.ts`     | one file, named exports | `types/index.ts`                            |
| Ambient module declarations | `@types/`            | `*.d.ts`                | `3d-force-graph.d.ts`                       |
| Test stubs                  | `test-stubs/`        | `camelCase.ts`          | `empty.ts`                                  |

**Components are organized by feature area** (`auth/`, `graphs/`, `admin/`,
`dashboard/`, `user/`, `common/`, `layout/`), not by component type. Don't
introduce a `components/buttons/` or `components/forms/` directory.

**(deviation)** — `services/adminService.ts` uses a `Service` suffix; the
others (`api.ts`, `errorHandler.ts`, `websocket.ts`) don't. New services
should follow the **non-suffixed** form: `feature.ts`, not `featureService.ts`.

There is currently no `hooks/` directory. Custom hooks live inside contexts
(`AuthContext` exports `useAuth`, etc.). If you write a reusable hook that
isn't context-bound, create `hooks/useXxx.ts`.

---

## 3. File naming — Backend (`backend/src/`)

| Layer                | Path              | Naming                                             | Example                                         |
| -------------------- | ----------------- | -------------------------------------------------- | ----------------------------------------------- |
| Express route module | `routes/`         | `kebab-case.js` (lowercase, hyphens for compounds) | `auth.js`, `import-export.js`                   |
| Sequelize model      | `models/`         | `PascalCase.js` (matches the model name)           | `User.js`, `GraphShare.js`                      |
| Models barrel        | `models/index.js` | the **only** place that wires associations         |                                                 |
| Middleware           | `middleware/`     | `camelCase.js`                                     | `asyncHandler.js`, `errorHandler.js`, `auth.js` |
| Utility              | `utils/`          | `camelCase.js`                                     | `dotValidator.js`, `fileUpload.js`, `logger.js` |
| Service              | `services/`       | `camelCase.js`                                     | `emailService.js`                               |
| Sequelize config     | `config/`         | one file per concern                               | `database.js`                                   |

Tests live **outside** `src/`, mirrored by layer:

```
backend/tests/
  setup.js                       (Jest setupFilesAfterEnv)
  unit/
    models/<Name>.test.js
    middleware/<name>.test.js
    services/<name>.test.js
    utils/<name>.test.js
  integration/
    routes/<route>.test.js
```

---

## 4. Identifier naming

| Kind                                                       | Style                       | Example                                                 |
| ---------------------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| Variables, function parameters                             | `camelCase`                 | `userId`, `dotContent`                                  |
| Functions                                                  | `camelCase`                 | `validateSession`, `setupAdminUser`                     |
| React components, Sequelize models, classes, TS interfaces | `PascalCase`                | `GraphRenderer3D`, `User`, `ApiService`                 |
| Module-scope constants                                     | `SCREAMING_SNAKE_CASE`      | `API_BASE_URL`, `NO_NAV_PATHS`, `DEFAULT_GRAPH_OPTIONS` |
| Database columns                                           | `snake_case`                | `user_id`, `dot_code`, `permission_level`, `start_time` |
| URL path segments                                          | `kebab-case`                | `/api/import-export`, `/validate-dot`, `/parse-dot`     |
| Environment variables                                      | `SCREAMING_SNAKE_CASE`      | `SESSION_SECRET`, `VITE_API_URL`, `REDIS_URL`           |
| Vite-exposed env vars                                      | `VITE_*` prefix (mandatory) | `VITE_API_URL`, `VITE_WS_URL`                           |

**Don't** mirror DB column names into JS variables. Sequelize already maps
`user_id` ↔ `userId` via model attributes; use the camelCase form
everywhere in JS.

---

## 5. Imports

### Frontend (ES modules, TypeScript)

Order, **without blank lines between groups** (current style):

```ts
// 1. React + react-router
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Third-party (MUI, axios, …)
import { Box, Button } from '@mui/material';

// 3. Internal — absolute-style (services, contexts, types)
import apiService from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

// 4. Internal — same-folder relative
import { LoginForm } from './LoginForm';
```

`type` imports use the `import type` form when only types are needed.

### Backend (CommonJS)

Order, no blank lines between groups:

```js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authRateLimit, validateSession } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();
```

`router` declaration goes **last** in the import block, blank-line-separated
from the requires.

---

## 6. React patterns

- **Functional components only.** `React.FC<Props>` (or `FC<Props>` after
  named import) is the existing style. Don't introduce class components.
- **Local state** → `useState`. Multiple linked fields with reducer logic →
  `useReducer`. Cross-route state → an existing Context.
- **Side effects** → `useEffect` with an explicit dependency array. If you
  intentionally pin a partial deps list (e.g. load-on-mount), add:
  ```ts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // <one-line reason>
  ```
  See `AdminPanel.tsx` load effects for prior art.
- **Provider tree** is fixed and ordered:
  `ErrorBoundary → ThemeProvider → Router → AuthProvider → GraphProvider → SimulationProvider → NotificationProvider`.
  Don't add a 5th application-wide provider without a justification documented
  in an ADR (planned in `doc/adr/`).
- **Lazy load heavy routes** with `React.lazy` + `<Suspense>`. The current
  lazy split is `GraphEditor`, `GraphViewer`, `AdminPanel` — keep these
  lazy, and lazy-load any new heavy page.
- **Auth guard** uses `<ProtectedRoute>` from `App.tsx`. Don't reimplement
  it per route.

---

## 7. Backend patterns

- **All async route handlers wrapped in `asyncHandler`** (`middleware/asyncHandler.js`)
  to forward thrown errors to the central error middleware. Naked `async (req, res) =>`
  in routes is a lint-pass smell — wrap it.
- **Validation** → `express-validator`'s `body() / query() / param()` chain
  inside the route definition. The result of `validationResult(req)` is
  formatted by the errorHandler. `joi` is also installed and used at config
  boundaries (env-var validation, where it fits better).
- **Errors** → `throw` (or `next(err)`); never `res.status(500).json(...)`
  inline. Let `middleware/errorHandler.js` shape the response.
- **Logging** → `logger` from `utils/logger.js` (Winston). **No `console.log`
  / `console.error` in `src/`.** `morgan` is piped into the same logger.
- **Sessions** → never read or write the session map directly. Use
  `validateSession` middleware to populate `req.user`, then read `req.user.id`,
  `req.user.role`.
- **Sequelize associations** are wired in `models/index.js`. When you add a
  model, register its associations there, not inside the model file.
- **DB columns are `snake_case`**, but Sequelize attributes are exposed as
  `camelCase` to JS — use the camelCase form in code (`user.firstName`,
  not `user.first_name`).

---

## 8. Comments

- **English only** in new code.
- **WHY, not WHAT.** Don't restate what the code does. Document:
  - hidden constraints (e.g. "must run before X because Y")
  - invariants the code relies on
  - non-obvious workarounds with a link or commit ref
  - load-bearing behaviors (`GraphRenderer3D.tsx` has many — preserve them)
- **JSDoc** for public route handlers and exported helpers, with at least
  the path/method (for routes) and a one-line description. Existing
  `routes/auth.js` is a good template.
- **No emojis in code or commit messages.** Emojis in user-facing strings
  (UI text, notifications) are fine.
- **No AI attribution lines** in any artifact (commits, PRs, comments).

---

## 9. CSS / styling

- **MUI `sx` prop is the default** for component-scoped styling. Use it for
  layout, spacing, simple conditional styles.
- **`.css` file colocated with the component** only when `sx` isn't enough:
  global selectors, complex animations, third-party widget overrides. See
  `AdminPanel.css` as the reference case.
- **Theme tokens** (colors, typography, spacing scale, scrollbar) live in
  `App.tsx`'s `createTheme`. Don't hardcode `#4caf50` / `#ff6b35` in
  components — read from theme.
- The dark theme is the only theme. Don't add a light-theme path without a
  product decision documented in an ADR.

---

## 10. Tests

### Backend (Jest)

- File naming: `*.test.js` only. No `*.spec.js`.
- Location: `tests/unit/<layer>/<Name>.test.js` or `tests/integration/routes/<route>.test.js`.
- `tests/setup.js` is auto-loaded via `setupFilesAfterEnv` (configured in
  `backend/package.json`) and silences the Winston logger globally — put
  cross-suite mocks there.
- For modules that install module-level timers (e.g. `utils/fileUpload.js`'s
  1h `setInterval`), call `jest.useFakeTimers()` **before** `require` to
  avoid keeping the event loop alive after tests finish.

### Frontend (Vitest + React Testing Library + jsdom)

- File naming: `*.test.ts` / `*.test.tsx`, **colocated** with the source.
- Use `vi.fn()` / `vi.mock()` — not `jest.*`. `vitest/globals` exposes
  `describe`, `test`, `expect`, `beforeEach`, `afterEach`, `vi` without
  imports (configured in `vite.config.ts` `test.globals: true`).
- **Form submit** assertions: prefer `fireEvent.submit(form)` over
  `userEvent.click(submitButton)` — under jsdom + Vitest, the click fires
  but the form's native `submit` event doesn't.
- **Tests that mount `GraphRenderer3D`** (or anything using
  `ResizeObserver` / `three-spritetext`) must stub these at the top of the
  file: jsdom doesn't ship `ResizeObserver`, and `three-spritetext` pulls
  Three.js modules. `3d-force-graph` is best mocked as a chainable spy
  that returns `this` — see `GraphRenderer3D.test.tsx` for the pattern.
- The renderer's parser calls `fetch(${VITE_API_URL}/public/parse-dot)`,
  so stub `globalThis.fetch` to bypass the backend.
- **Don't render `App` from a test** without first mocking `services/api`
  — the auth probe runs on mount and will hang the test.

---

## 11. Lint & format

| Tool                                                         | Status                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend ESLint (`eslint.config.js`, ESLint 9 flat config)   | Wired, repo lint-clean. Keep it that way — CI will fail otherwise.                                                                                                                                                                                |
| Backend ESLint (`.eslintrc.json`, `eslint:recommended` only) | Minimal. Migration to a stricter preset is planned.                                                                                                                                                                                               |
| Prettier                                                     | Wired at the repo root (`.prettierrc.json`). Runs on commit via lint-staged for `*.{json,md,yml,yaml}`. Source files are **not** Prettier-reformatted in bulk (see `.prettierignore`) — ESLint handles them on save / on commit.                  |
| `.editorconfig`                                              | Present at the repo root. 2-space indent, LF line endings, final newline, trim trailing whitespace (except in Markdown).                                                                                                                          |
| Husky + lint-staged                                          | Pre-commit hook (`.husky/pre-commit`) runs lint-staged: Prettier on config/docs, `npm run lint -- --fix` on the affected sub-package for changed JS/TS files. To bypass in a true emergency: `git commit --no-verify` (don't make a habit of it). |
| `unused-vars` (frontend)                                     | `@typescript-eslint/no-unused-vars` ignores caught errors named `_`, `err`, `error` — keep error bindings even when unused, for stack traces.                                                                                                     |

**Before committing**, both packages must lint-clean:

```bash
( cd backend && npm run lint )
( cd frontend && npm run lint )
```

---

## 12. Git workflow

- **Commit messages**: French, present tense, **no body unless useful**.
  - `<scope>: <subject>` for scoped changes (e.g. `GraphRenderer3D: …`,
    `CI: …`, `Doc: …`).
  - `<subject>` for repo-wide changes (e.g. `Ignore les artefacts runtime`).
  - First line ≤ ~70 chars. Body wrapped at ~72 if added.
- **No AI attribution** anywhere: no `Co-Authored-By`, no `Generated with
Claude Code`, no `Anthropic` mention in commits, PR descriptions, comments,
  or code.
- **Branches**: working directly on `main` is current practice for this solo
  repo. If branches are introduced, use `feature/<slug>`, `fix/<slug>`,
  `chore/<slug>`.
- **Daily changelog** under `doc/changelog/YYYY-MM-DD.md`. One line per file
  modified, listing the actual change. If a change is reverted within the
  day, **delete the line** rather than logging "added then removed".
- **Never commit secrets**. `.env` files are gitignored and must stay so.

---

## 13. Pointers

- Architecture overview → [`/ARCHITECTURE.md`](../ARCHITECTURE.md)
- Backend topic guides → [`/backend/doc/`](../backend/doc/)
- DOT 3D specification → [`/doc/dot-3d/`](./dot-3d/)
- Architecture decisions → [`doc/adr/`](./adr/)
- Contribution workflow → [`/CONTRIBUTING.md`](../CONTRIBUTING.md)
