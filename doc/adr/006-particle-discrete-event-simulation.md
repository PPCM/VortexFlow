# ADR-006: Particle simulation moves from continuous animation to discrete event simulation (DES)

- **Status:** Proposed
- **Date:** 2026-05-11
- **Tags:** frontend, simulation, dot, renderer, performance

## Context

VortexFlow currently renders particles via `3d-force-graph`'s
`linkDirectionalParticles(link)`, which paints a fixed number of particles
continuously circulating along each link as long as the simulation is
running. This produces a pleasing animation but has structural limits:

- Each link animates **independently**. There is no notion of a particle
  arriving at a node and being routed onward.
- Nodes cannot **accumulate** particles. A bottleneck (1 input ≫ 1 output)
  is not visible — every link displays its own steady flow.
- The DOT 3D spec defines `queue_size`, `processing_time`, `failure_rate`,
  `maxParticleProcessing` (per node) and `maxParticleFlow` (per link),
  but the runtime ignores them. They live only in the validator.
- `simulationStats.totalParticles / averageLatency / bottleneckNodes`
  are derived heuristically (in-degree, scene particle count) rather
  than measured. They look right, but they don't _mean_ anything.
- The one-shot trace (`handleEmitTrace`) already approximates a discrete
  cascade — it tracks particles per node via `setTimeout` and a visited
  set — but it's a separate code path that bypasses the continuous mode.

We need a simulation model where:

1. Specific nodes **emit** particles at a defined rate.
2. Particles **transit** along links at link-specific speeds.
3. Nodes receive particles into a **queue**, optionally bounded.
4. Queues that overflow **drop** particles according to a configurable
   policy.
5. The renderer visualizes accumulation (node grows) and saturation
   (flash / counter on drop).

## Decision

Replace the continuous animation model with a **discrete event simulation
(DES)** executed in the browser:

- A new `ParticleSimulator` service owns the logical state (particles in
  transit, per-node queues, per-node stats).
- The simulator advances on every `requestAnimationFrame`, with a clamped
  `dt` to tolerate background-tab throttling.
- `3d-force-graph` is kept as the **renderer**, but is driven by the
  simulator: `emitParticle(link)` is called whenever the simulator
  releases a particle onto a link. `linkDirectionalParticles(link)`
  returns 0 — continuous animation is off.
- The DOT 3D surface gains two new attributes (see ADR-005 triple invariant):
  - **`nodeRole`** (enum: `generator | relay | sink`, default `relay`) —
    role-based emission. Only `generator` nodes spawn particles. `sink`
    nodes absorb particles without further routing. **V1 is strict**:
    no implicit fallback "everyone emits" — graphs without `nodeRole`
    will not animate until annotated.
  - **`dropPolicy`** (enum: `tail | head | reject`, default `tail`) —
    behaviour when a particle arrives at a node whose queue is full.
    Only meaningful when `queue_size` is also defined.
- Existing attributes (`particleGeneration`, `maxParticleProcessing`,
  `queue_size`, `processing_time`, `failure_rate`, `maxParticleFlow`,
  `particleSpeed`) keep their names and gain real runtime semantics.

Concretely, this means:

- The simulator is the **single source of truth** for `totalParticles`,
  `averageLatency`, `bottleneckNodes`, and a new `droppedCount`.
- Nodes visually grow with queue occupancy (capped at 2× base size).
- A drop triggers a brief red flash plus an incrementing on-node counter.
- The one-shot `handleEmitTrace` is realigned: it respects `nodeRole`
  too, so the one-shot button always fires from the same set of
  generators that the continuous simulation does.
- Routing at a node with M outgoing links: weighted by `maxParticleFlow`,
  with round-robin as fallback when no weights are defined.
- Default values when an attribute is missing on a node where it would
  matter:
  - `nodeRole=generator` without `particleGeneration` → 1 particle/sec
  - `queue_size` undefined → unbounded queue (no drops)
  - `dropPolicy` undefined → `tail` (drops the incoming particle)
  - `failure_rate` undefined → 0 (no random drops)

## Consequences

Positive:

- **Semantics finally match the spec**. The DOT 3D attributes that
  already existed but were ignored at runtime now have a behaviour.
- **Real metrics**: queue sizes, drops, throughput, latency are measured,
  not guessed. The HUD stats become meaningful.
- **Bottleneck visualization**: visible immediately on overload, not
  inferred from topology.
- **Convergence and divergence look right**: M inputs → 1 node → 1 output
  shows accumulation; 1 input → 1 node → M outputs shows distribution
  weighted by `maxParticleFlow`.
- **One source of decision** for who emits (single rule in the simulator
  consumed by both continuous and one-shot paths).

Negative:

- **Breaking change for existing graphs**: graphs without `nodeRole`
  will not emit. They must be annotated. We chose strict V1 over
  silent fallback to keep the model honest. Migration cost is real but
  contained — `nodeRole=generator` is a one-line addition per emitter.
- **CPU cost**: a JS loop that advances N particles 60 times per second
  is heavier than letting WebGL animate fixed-rate streams. Mitigations
  (RAF throttle, optional Web Worker) listed in Phase 7 of the
  implementation plan.
- **Renderer file is already ~1600 lines**. The integration adds a hook
  (`useParticleSimulator`) and removes the `linkDirectionalParticles`
  branch, so the net delta should be neutral, but the file is fragile.
- **Three-place invariant (ADR-005) must be honoured** for two new
  attributes. Triple update validated in Phase 1.

## Alternatives considered

- **Option A — visual-only indicators** (halo / size based on theoretical
  imbalance, without changing the simulation). Cheap (~0.5d) and pretty,
  but does not actually simulate accumulation or drops — the spec
  attributes stay ignored, the stats stay heuristic. Rejected as a
  long-term direction.
- **Option B — modulated continuous flow** (adjust
  `linkDirectionalParticles` dynamically based on graph topology).
  Better than A but still statistical: individual particles don't
  travel — the visual is a distribution. Cannot model `queue_size`,
  `processing_time`, `failure_rate`. Rejected as the target, but
  acceptable as a stopgap if DES schedule slips.
- **Server-driven simulation** (re-activate `routes/simulation.js`).
  Rejected: ADR-002 already decided to run simulation in the browser
  for latency and offline support. Re-opening that decision is out of
  scope.
- **Implicit fallback "everyone emits" when `nodeRole` is missing**.
  Considered for backwards-compatibility, rejected. The rule must be
  observable from the graph source; magic defaults make graphs behave
  differently depending on what other attributes are present, which
  is exactly the kind of surprise we want to avoid.
