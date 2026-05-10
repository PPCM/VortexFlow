# ADR-003: Migrate frontend build from CRA to Vite

- **Status:** Accepted
- **Date:** 2026-05-10 *(retroactive — migration done in commit `09f5f25`)*
- **Tags:** frontend, build, tooling

## Context

The frontend was bootstrapped with **Create React App** (CRA, `react-scripts`).
By 2025, CRA was effectively unmaintained — issue tracker dormant, no React
19 support, slow dev server, opaque webpack config. Day-to-day pain points:

- Cold start of `npm start` was ~12-15 seconds even on a fast laptop.
- HMR was unreliable on TypeScript components.
- Adding non-default features (e.g. monorepo aliasing, a single-file webpack
  override) required `eject` or hacks like `craco`.
- Testing setup was Jest + custom resolvers, with growing friction around
  ESM-only packages (`monaco-editor`, `@uiw/react-codemirror`).

## Decision

Migrate to **Vite + Vitest** (commit `09f5f25`):

- `vite` for dev server (`npm run dev` on `:3000`) and production build
  (`vite build` → `frontend/build/`).
- `vitest` for tests, with `vitest/globals` so test files don't need to
  import `describe / test / expect / vi`.
- Test files mock heavy editor packages (`monaco-editor`, codemirror
  sub-packages) via `vi.mock()`. `vite.config.ts` aliases `monaco-editor` to
  `src/test-stubs/empty.ts` so the import resolves before the mock kicks in.
- Manual chunk split for the two heaviest stacks (Three.js + force-graph,
  CodeMirror) — see ADR on bundle strategy *(future)*.

`react-scripts` and the entire CRA toolchain were removed.

## Consequences

Positive:

- **Cold start ~1-2 s**, HMR ~100 ms.
- **TypeScript support is native** (no Babel-vs-tsc dance).
- **Vite config is one short file** (`vite.config.ts` ~50 lines).
- **First-class ESM support**: monaco / codemirror just work (with the
  alias workaround for tests).
- **Vitest reuses the Vite resolver**, so tests and dev server can't drift
  apart.

Negative:

- **Some `process.env.X` references became `import.meta.env.X`**, with the
  Vite-specific constraint that browser-exposed vars must be prefixed `VITE_`.
  Code that referenced `REACT_APP_*` was rewritten; `vite-env.d.ts` declares
  the typed shape.
- **Vitest's API differs from Jest** in subtle ways (`vi.useFakeTimers`,
  `vi.mock` hoisting, `globalThis` instead of `global`). Backend tests
  (still Jest) and frontend tests (now Vitest) require slightly different
  mental models.
- **Some Jest-specific community plugins don't have Vitest equivalents.**
  Not a blocker today.

## Alternatives considered

- **Stay on CRA**: rejected — unmaintained, slow, no React 19.
- **Migrate to Next.js**: rejected — VortexFlow is a SPA with one entry
  point, no SSR need, no file-based routing requirement. Next would have
  added complexity without a payoff.
- **`craco` + custom webpack**: rejected — patches the symptom (eject), not
  the cause (CRA is dead).
- **Rspack / Turbopack**: rejected — too early for a small project to bet
  on a non-stable tool.
