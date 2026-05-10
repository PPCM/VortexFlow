# ADR-002: Run particle simulation entirely in the browser

- **Status:** Accepted
- **Date:** 2026-05-10 *(retroactive — formalized after commit `542db32`)*
- **Tags:** frontend, simulation, performance

## Context

VortexFlow renders DOT graphs in 3D and simulates data flow as particles
moving along edges. The simulation produces per-frame position updates, edge
saturation stats, and bottleneck detection.

The original design split the simulation between server (computation,
authoritative state) and client (rendering only), wired over Socket.IO. This
introduced:

- A `SimulationSession` row created per run (Sequelize), with potentially
  long-lived state.
- A WebSocket round-trip per frame (or per batch of frames).
- A `routes/simulation.js` Express layer + a `websocket/simulationHandler.js`
  Socket.IO handler.

Profiling showed:

- The simulation is not computationally heavy — it's `O(particles × edges)`
  with `particles` typically < 1000.
- Socket.IO frame round-trips added perceptible latency on top of `3d-force-graph`'s
  already-batched render loop.
- The user-facing controls (start / pause / one-shot emit) weren't reading
  any server state — they were UI-only flags.

## Decision

Run the **simulation entirely client-side**, in `GraphRenderer3D.tsx`.
The backend has **no concept of a running simulation**:

- `GraphContext.startSimulation / pause / stop` flip a local
  `simulationState` boolean and nothing else. They do **not** call
  `/api/simulation/*` and do **not** emit on the socket.
- Particles, per-frame accumulation, and stats are computed locally using
  `3d-force-graph`'s directional particle API + custom Three.js scene walks.
- The dormant server-side simulation handler and routes were deleted in
  commit `542db32` (*Fix tests UUID + supprime l'infra simulation backend
  dormante*).

The Socket.IO channel is **kept**, but its purpose has shifted to graph-collab
events (cursor positions, chat, live graph-update) for an upcoming
multi-cursor feature.

The `SimulationSession` Sequelize model is kept on disk but no current code
path writes to it. It's preserved for a hypothetical future "shared
simulation room" feature — see Alternatives.

## Consequences

Positive:

- **Lower latency**: the 60 fps render loop runs without round-trips.
- **Simpler backend**: no simulation lifecycle, no socket handler to maintain.
- **Easier offline / demo mode**: visualizations work without a backend
  reachable, falling back to a frontend-only DOT parser if `/api/parse-dot`
  is down.

Negative:

- **No shared simulation state**: two users on the same graph see two
  independent simulations. Acceptable today (single-user editing), to be
  revisited when multi-user collab ships.
- **No persistent stats history**: simulation metrics aren't saved.
  Acceptable — they're meaningful only while watching the graph.
- **`SimulationSession` model is dead code in practice**, with the cost of
  keeping it consistent with associations in `models/index.js`.

## Alternatives considered

- **Keep server-authoritative simulation**: rejected because the round-trip
  cost wasn't justified by any feature that needed authoritative state.
- **Hybrid (compute server-side, render client-side)**: same problem.
- **WebRTC for collab simulation**: deferred. A future feature could reintroduce
  multi-user shared simulation via WebRTC peer connections without resurrecting
  the server-side handler.
- **Drop the `SimulationSession` model entirely**: rejected for now — the
  cost of keeping it is one small Sequelize file, and re-adding it later
  would require a migration.
