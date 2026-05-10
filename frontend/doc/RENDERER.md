# GraphRenderer3D — load-bearing behaviors

`frontend/src/components/graphs/GraphRenderer3D.tsx` is a ~1500-line
component that wraps `3d-force-graph` (Three.js + d3-force) and adds
VortexFlow-specific behavior on top.

The behaviors documented here are **non-obvious from reading the code** and
have caused regressions when refactored without care. If you're about to
touch this file, read this first.

---

## 1. Auto-zoom on open

**What happens**: 300 ms after the graph initializes, the camera snap-fits
to the graph's bounding box, then animates (1 s) to half the fitted
distance. The user sees a single visible zoom-in ending ~2× tighter than a
plain `zoomToFit()`.

**Why it's not a single `zoomToFit(ms, padding)`**: `3d-force-graph` silently
drops a **negative** padding value (which is what would tighten the fit).
Post-fit camera scaling is therefore required.

**Don't replace** this with a single `zoomToFit(ms, padding)` call thinking
it's equivalent — the camera will land at the default-padded distance and
small graphs will look distant.

---

## 2. Particle-material patch (every 200 ms for 5 s)

**What happens**: a `setInterval` (200 ms) walks the Three.js scene and
forces `opacity: 1, transparent: false` on small `SphereGeometry` meshes for
the first 5 seconds after the graph mounts. Then the interval self-stops.

**Why**: `3d-force-graph` creates `linkDirectionalParticles` with
`transparent: true` and `opacity: undefined` — which Three.js renders as
fully transparent. Without the patch, particles are invisible.

**Why self-stop after 5 s**: a previous version ran the interval at 5 Hz
forever, which was wasteful (the patch is only needed during the initial
particle-mesh creation burst). 5 seconds covers all observed cases.

**Don't remove** the interval. **Don't extend it indefinitely** — that
regressed perf once.

Cleanup is in the `useEffect`'s return — preserve it.

---

## 3. Particles only emit while a simulation is running

**What**: `linkDirectionalParticles` returns **0** unless both `showParticles`
and `simulationRunning` are true. An idle graph is static.

**Why**: the default of `3d-force-graph` is to keep particles flowing forever
once enabled, which:
- burns CPU/GPU when the user isn't watching a sim,
- visually misleads users who think a graph "is simulating" when it's just
  a screensaver.

**Don't** flip this back to always-on without a UX decision. If you do, also
update the panel label.

---

## 4. Toolbar ↔ panel sync — single source of truth

**What**: the panel "Start/Pause Simulation" button and the toolbar ▶ icon
must do the same thing.

**Mechanism**: the renderer accepts an `onToggleSimulation` prop from
`GraphViewer`. The panel button delegates to it. If the prop is missing, it
falls back to a local state (defensive).

**Don't** reintroduce a separate local-only toggle in the panel — that
created a desync where the toolbar showed "running" while the panel showed
"stopped" (or vice-versa). The audit history has the original incident.

---

## 5. "Émission particules" is **one-shot**, not a flag

**What**: each click of the "Émission particules" button fires a **single**
particle from every emitter, cascading through the graph along outgoing
links. A visited set prevents cycle storms (depth cap 15).

**Cascade timing**: `setTimeout` per hop, calibrated as
`(1 / particleSpeed) * 16.67 ms` (one frame at 60 fps scaled by speed).

**Emitter definition**:
- If any node defines `particleGeneration > 0`, only those are emitters.
- Otherwise, every node emits one particle.

**Why one-shot and not continuous**: the purpose of this button is to **trace
a path** — see the flow without accumulation. A continuous toggle would
defeat that.

**Don't** turn it back into a continuous flag. We had that, it broke the
"see the path clearly" use case.

---

## 6. Stats fallback for plain DOT graphs

**What**: when no node defines `particleGeneration` / `maxParticleProcessing`,
the simulation effect falls back to:
- particle count = `scene.particles.length` (whatever 3d-force-graph happens
  to be displaying)
- average traversal latency = derived from `particleSpeed`
- bottleneck count = nodes with topological in-degree > 1

This gives a plain (un-extended) DOT graph meaningful stats in the panel
instead of zeros across the board.

**Why this matters**: most demo graphs and quick-look graphs don't use the
VortexFlow extensions. Removing the fallback would make the stats panel
look broken on them.

**Don't** remove the fallback. If you change it, make sure
`tests/GraphRenderer3D.test.tsx` still covers the "no extensions defined"
case.

---

## 7. `setCurrentGraphData({nodes, links})` is required

**What**: any new init path **must** call
`setCurrentGraphData({ nodes, links })` after parsing the DOT.

**Why**: the stats effect reads `currentGraphData` to compute counts and
bottlenecks. Without that call, stats stay at zero forever even when the
scene is populated.

**Reference implementation**: the live `initializeGraph` in the bottom
`useEffect` of `GraphRenderer3D.tsx` does this — match the call site if you
write a parallel init path (e.g. for a "load template" feature).

---

## 8. DOT parsing pipeline (with fallback)

**Primary path**: `DotTo3DConverter.parseDotToGraphData(dotContent)` calls
`${VITE_API_URL}/public/parse-dot` via `fetch` (currently — there's an open
issue to migrate this to `apiService` axios for consistency).

**Fallback**: if the backend returns non-OK or throws, the converter falls
back to `parseDotToGraphDataFrontend(dotContent)` — a regex-based parser
that handles the common cases (edges, simple node attributes) but not the
full DOT grammar.

**Why a fallback**: lets visualizations work in offline / demo mode without
a backend reachable. The fallback is intentionally simpler than the backend
parser — it doesn't pretend to be authoritative.

**Don't** silently degrade UX when the backend is up but returns 4xx: the
current code logs the status and falls back, which can mask validation
errors. A future improvement would surface the backend error to the user
when status is 400 (bad DOT) rather than 5xx (backend down).

---

## Test coverage

`frontend/src/components/graphs/GraphRenderer3D.test.tsx` covers:

- Mount + init timing (the 300 ms setTimeout + 1000 ms camera animation).
- `globalThis.fetch` mocked to return a deterministic `{nodes, links}`.
- `3d-force-graph` mocked as a chainable spy that returns `this`.
- `ResizeObserver` stubbed (jsdom doesn't ship it).
- `three-spritetext` stubbed (pulls Three.js modules not worth instantiating
  in tests).

If you add a behavior that depends on browser APIs jsdom doesn't ship, stub
them at the top of the test file rather than mocking around them.

---

## Reference behaviors check-list for a renderer PR

Before merging a change to `GraphRenderer3D.tsx`, mentally walk through:

- [ ] Auto-zoom still produces a visible camera animation, ending tight (~2×
      zoomToFit).
- [ ] Particles still appear (the material patch interval still runs for the
      first 5 s).
- [ ] Particles stop when simulation is paused.
- [ ] Toolbar ▶ and panel "Start/Pause" both call the same handler.
- [ ] "Émission particules" emits one particle per emitter and stops (doesn't
      keep emitting).
- [ ] Stats panel shows non-zero values on a plain DOT graph (fallback works).
- [ ] `setCurrentGraphData` is called from every init path you added.
- [ ] Test suite still passes (`npm test -- GraphRenderer3D.test.tsx`).
- [ ] Lint clean.
