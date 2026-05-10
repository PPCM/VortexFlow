# VortexFlow Frontend — Documentation Index

Frontend-specific reference docs. For the project-wide picture (system
diagram, backend layers, data model, simulation pipeline, DOT 3D invariant),
start with [`/ARCHITECTURE.md`](../../ARCHITECTURE.md) at the repo root.

## Topic guides

| Doc | Scope |
|---|---|
| [`RENDERER.md`](./RENDERER.md) | `GraphRenderer3D` load-bearing behaviors (auto-zoom, particle-material patch, particle-emit semantics, stats fallback) — must-read before touching the renderer |

## Stack at a glance

| Layer | Choice |
|---|---|
| Framework | React 19 (functional components only) |
| Build / dev server | Vite 6 (see [ADR-003](../../doc/adr/003-vite-over-cra.md)) |
| Language | TypeScript 5 |
| Tests | Vitest + React Testing Library + jsdom |
| State | Local `useState` + React Context (Auth / Graph / Simulation / Notification) |
| UI library | MUI 7 (custom dark theme, green `#4caf50` + orange `#ff6b35`) |
| Editor | Monaco (`@monaco-editor/react`) and CodeMirror (`@uiw/react-codemirror`) — both loaded, see `DOTEditor` vs `DOTCodeMirrorEditor` |
| 3D rendering | Three.js via `3d-force-graph` |
| HTTP | Axios with `withCredentials: true` (session cookies) |
| Realtime | `socket.io-client` |
| Routing | React Router v7 |

## Folder layout

```
frontend/src/
  components/
    admin/          AdminPanel, BulkActionsBar, PasswordResetDialog, UserManagementDialog
    auth/           LoginPage, RegisterPage
    common/         ErrorBoundary, LoadingPage, NotFoundPage, NotificationButton, NotificationProvider
    dashboard/      Dashboard
    graphs/         GraphEditor, GraphViewer, GraphList, GraphRenderer3D, DOTEditor, DOTCodeMirrorEditor, DotTo3DConverter
    layout/         Navigation
    user/           UserProfile
  context/          AuthContext, GraphContext, SimulationContext (each exports a useXxx hook)
  services/         api.ts, adminService.ts, errorHandler.ts, websocket.ts
  types/            index.ts (centralized type definitions)
  @types/           Ambient module declarations (3d-force-graph.d.ts)
  test-stubs/       Empty stubs for ESM-only test mocks (monaco)
  hooks/            Empty today — see "Custom hooks"
  App.tsx           Provider tree + routes + ProtectedRoute
  main.tsx          Entry point
```

For file naming conventions (`PascalCase.tsx` for components,
`XxxContext.tsx` for contexts, etc.) see
[`doc/STYLE_GUIDE.md` §2](../../doc/STYLE_GUIDE.md#2-file-naming--frontend-frontendsrc).

## Provider tree

Fixed and ordered. New global state slots **into** this tree, not bypassing it.

```
ErrorBoundary
  ThemeProvider (MUI dark theme)
    Router (React Router)
      AuthProvider          ← session-aware; everything below assumes this
        GraphProvider       ← needs Auth
          SimulationProvider
            NotificationProvider
              AppLayout     ← shows Navigation if user && !NO_NAV_PATHS
                Routes
```

The order matters: `AuthProvider` is above `GraphProvider` because graph
fetches need the user's session. Don't reorder without a reason.

## Routing

All routes are declared in `App.tsx`. Auth pages stay eagerly loaded
(small, render before login). The heavy pages are lazy-loaded with
`React.lazy` + `<Suspense>`:

| Path | Component | Auth | Lazy |
|---|---|---|---|
| `/login`, `/register` | `LoginPage`, `RegisterPage` | public-only | no |
| `/dashboard` | `Dashboard` | required | no |
| `/graphs` | `GraphList` | required | no |
| `/graphs/create`, `/graphs/:id/edit` | `GraphEditor` | required | **yes** |
| `/graphs/:id/view` | `GraphViewer` | required | **yes** |
| `/profile` | `UserProfile` | required | no |
| `/admin` | `AdminPanel` | admin | **yes** |

`<ProtectedRoute>` (defined in `App.tsx`) handles auth/role gating. Don't
reimplement it per route.

`NO_NAV_PATHS` hides the left navigation on `/login`, `/register`,
`/forgot-password`, `/reset-password` even when a session is still active —
covers the case of a user manually visiting `/login` to switch accounts.

## Services

| File | Role |
|---|---|
| `services/api.ts` | Axios instance, `baseURL` = `VITE_API_URL` (fallback `http://localhost:5000/api`), `withCredentials: true`. Used by every non-WebSocket backend call. |
| `services/adminService.ts` | Admin-specific endpoints (user CRUD, role changes). Wraps `apiService.client`. |
| `services/errorHandler.ts` | Central error formatting. `setupAxiosErrorInterceptor` is wired in `App.tsx`. |
| `services/websocket.ts` | `socket.io-client` connection. Used for graph-collab events (cursor, chat, graph-update). **Not** used for simulation — see [ADR-002](../../doc/adr/002-browser-side-simulation.md). |

`adminService.ts` is the only service with a `Service` suffix; the others
don't. New services should follow the **non-suffixed** form
(see [STYLE_GUIDE §2 deviation note](../../doc/STYLE_GUIDE.md#2-file-naming--frontend-frontendsrc)).

## State management

- **Local component state** → `useState`.
- **Multi-field forms with linked validation** → `useReducer`.
- **Cross-route, cross-component state** → an existing Context.
- **Server state** is currently not cached (no React Query / SWR). Fetching
  is done directly in components or contexts via `apiService`. Adding a
  cache layer is an open question — not on the immediate roadmap.

## Custom hooks

There is **no `hooks/` content today**. Custom hooks live inside contexts
(`AuthContext` exports `useAuth`, `GraphContext` exports `useGraph`, etc.).

If you write a reusable hook that isn't bound to a context (e.g.
`useDebounce`, `useKeyboardShortcut`), create `frontend/src/hooks/useXxx.ts`
and colocate its test as `useXxx.test.ts`.

## 3D rendering

`components/graphs/GraphRenderer3D.tsx` does the heavy lifting:

1. Receives a DOT source from `GraphEditor` / `GraphViewer`.
2. Calls `${VITE_API_URL}/public/parse-dot` via `fetch` (not axios — historical;
   see [open dette in changelog](../../doc/changelog/)) to parse the DOT into a
   `{nodes, links}` structure.
3. Falls back to `DotTo3DConverter.parseDotToGraphDataFrontend` if the
   backend is unreachable.
4. Hands the data to `3d-force-graph`, which uses Three.js to render and
   animate.

The renderer carries multiple **load-bearing behaviors** that aren't
self-evident from the code. See [`RENDERER.md`](./RENDERER.md) — read it
before changing anything in `GraphRenderer3D.tsx`.

## Bundle strategy

Vite manual chunk split (in `vite.config.ts`):

| Chunk | Contents | Why |
|---|---|---|
| `three` | `three`, `3d-force-graph`, `three-spritetext` | Heavy, only used in `GraphRenderer3D` |
| `codemirror` | `@codemirror/*`, `@uiw/react-codemirror` | Heavy, only used in `DOTCodeMirrorEditor` |
| (default) | rest | Vite handles auto-splitting |

`chunkSizeWarningLimit` is raised to 800 kB to silence the no-op warning on
the now-isolated `three` chunk.

Don't merge these back into the default chunk without a measurement showing
it helps.

## Testing

See [`doc/STYLE_GUIDE.md` §10](../../doc/STYLE_GUIDE.md#10-tests) for the full
rules. Key Vitest-specifics:

- `vi.fn()`, `vi.mock()` (never `jest.*`).
- `vitest/globals` exposes `describe`, `test`, `expect`, `beforeEach`,
  `afterEach`, `vi` without imports (configured in `vite.config.ts`).
- For form submissions in jsdom, use `fireEvent.submit(form)` — not
  `userEvent.click(submitButton)`.
- Tests that mount `GraphRenderer3D` must stub `ResizeObserver`,
  `three-spritetext`, and mock `3d-force-graph` as a chainable spy. The
  renderer's parser calls `fetch(...)`, so stub `globalThis.fetch`.
- Don't render `App` from a test without first mocking `services/api` —
  the auth probe runs on mount.

## Pointers

| Topic | Doc |
|---|---|
| Renderer load-bearing behaviors | [`RENDERER.md`](./RENDERER.md) |
| Architecture overview | [`/ARCHITECTURE.md`](../../ARCHITECTURE.md) |
| Code conventions | [`/doc/STYLE_GUIDE.md`](../../doc/STYLE_GUIDE.md) |
| Contribution workflow | [`/CONTRIBUTING.md`](../../CONTRIBUTING.md) |
| Architecture decisions | [`/doc/adr/`](../../doc/adr/) |
| DOT 3D specification | [`/doc/dot-3d/`](../../doc/dot-3d/) |
