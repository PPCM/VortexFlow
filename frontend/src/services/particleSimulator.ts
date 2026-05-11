/**
 * Particle Simulator — Discrete Event Simulation (DES) for VortexFlow.
 *
 * Owns the *logical* state of all particles in transit and all per-node queues.
 * Pure TypeScript, no React or Three.js dependency — testable in isolation.
 *
 * See ADR-006 for the design rationale. The decisions locked there are:
 *   - V1 strict on nodeRole: no fallback "everyone emits".
 *   - Routing at a node with M outgoing links: weighted by maxParticleFlow,
 *     round-robin fallback when no weights are defined.
 *   - dt clamped to 33 ms to tolerate background-tab throttling.
 *   - Stats reset on start (`start()` clears all queues + counters).
 *   - dropPolicy without queue_size is meaningless — the queue is unbounded.
 *   - particleGeneration on relay/sink is ignored (validator warns at parse time).
 *
 * Integration (Phase 4): the renderer wraps this class in a thin React hook
 * (`useParticleSimulator`) and calls `forceGraphRef.current.emitParticle(link)`
 * whenever the simulator releases a particle. The simulator does NOT touch
 * 3d-force-graph itself — it stays in pure data land.
 *
 * Implementation lives in subsequent phases:
 *   - Phase 3a: emission (generator nodes spawn particles at `particleGeneration` /s).
 *   - Phase 3b: transit + arrival (advance t, detect t≥1, enqueue on target node).
 *   - Phase 3c: queue, processing, drop (queue_size + dropPolicy + processing_time
 *     + failure_rate).
 *   - Phase 3d: outbound routing (weighted by maxParticleFlow, round-robin fallback).
 *
 * Until Phase 3 lands, all public mutators throw — only the type surface and
 * the constructor signature are stable.
 */

// ─── Domain types ──────────────────────────────────────────────────────────

export type NodeRole = 'generator' | 'relay' | 'sink';
export type DropPolicy = 'tail' | 'head' | 'reject';

/** Why a particle was dropped — surfaced in per-node stats for diagnostics. */
export type DropReason = 'queue_full' | 'failure_rate' | 'no_outlet';

export type ParticleId = string;
export type NodeId = string;
export type LinkId = string;

/**
 * A single particle being tracked by the simulator.
 *
 * A particle is in exactly one of three states at any time:
 *   - In transit on a link    → `linkId` is set, `t` ∈ [0, 1).
 *   - Queued on a node        → `linkId` is null, parked in `NodeQueue.pending`.
 *   - Released from the system → no longer tracked (sink arrival, drop,
 *                                or failure_rate trigger).
 */
export interface Particle {
  id: ParticleId;
  linkId: LinkId | null;
  /** Position along the current link, 0 → 1. Ignored when linkId is null. */
  t: number;
  /** Speed in link-fraction per millisecond (already normalised). */
  speed: number;
  /** Monotonic timestamp (ms) for latency computation. */
  bornAt: number;
}

/**
 * Per-node queue state. Owned by the simulator, exposed read-only via stats.
 *
 * `pending` is FIFO. `dropPolicy=tail` drops the incoming particle (no change
 * to pending). `dropPolicy=head` drops `pending[0]` to make room. `reject` is
 * functionally identical to `tail` but semantically signals "this node refuses
 * load" — useful for downstream diagnostics.
 */
export interface NodeQueue {
  nodeId: NodeId;
  pending: Particle[];
  /** Total number of drops over the lifetime of the simulator instance. */
  droppedCount: number;
  /** Drops broken down by reason. */
  droppedReasons: Map<DropReason, number>;
  /** Timestamp (ms) of the last release from this queue — respects processing_time. */
  lastProcessedAt: number;
  /** Round-robin cursor over outgoing links — used when no maxParticleFlow weights. */
  roundRobinCursor: number;
}

/**
 * Snapshot of the simulator state. Returned by `getStats()` and pushed to
 * subscribers via `onTick`. Mutating the returned object has no effect on
 * the simulator — it's a defensive copy.
 */
export interface SimulatorStats {
  /** Particles currently in transit on a link. */
  particlesInFlight: number;
  /** Total particles emitted since the last `start()`. */
  totalEmitted: number;
  /** Total particles that reached a sink (or were absorbed at the end of a chain). */
  totalArrived: number;
  /** Total particles dropped for any reason. */
  totalDropped: number;
  /** Average latency from emission to arrival, in ms. NaN if no arrivals yet. */
  averageLatencyMs: number;
  /** Per-node snapshot: current queue size and cumulative drops. */
  queues: Map<NodeId, { size: number; droppedCount: number }>;
}

// ─── Inputs ────────────────────────────────────────────────────────────────

/**
 * Node input as parsed from a DOT graph. All DES attributes are optional;
 * defaults are applied internally (see ADR-006 §"Default values").
 */
export interface NodeInput {
  id: NodeId;
  nodeRole?: NodeRole;
  particleGeneration?: number;
  maxParticleProcessing?: number;
  queue_size?: number;
  processing_time?: number;
  failure_rate?: number;
  dropPolicy?: DropPolicy;
}

export interface LinkInput {
  id?: LinkId;
  source: NodeId;
  target: NodeId;
  particleSpeed?: number;
  maxParticleFlow?: number;
}

export interface GraphInput {
  nodes: NodeInput[];
  links: LinkInput[];
}

// ─── Simulator options ─────────────────────────────────────────────────────

export interface SimulatorOptions {
  /**
   * Maximum dt accepted in `tick(dt)`. Anything larger is clamped to this
   * value. Default 33 ms (~30 Hz). Keeps the simulator from "jumping" when
   * the tab is backgrounded and rAF callbacks coalesce.
   */
  maxDtMs?: number;
  /**
   * Injectable random source for failure_rate sampling and round-robin
   * tie-breaks. Default `Math.random`. Seedable in tests.
   */
  random?: () => number;
  /**
   * Default particleGeneration applied to a `generator` node that omits it.
   * Default 1 (one particle per second).
   */
  defaultGenerationPerSecond?: number;
  /**
   * Optional callback fired whenever the simulator emits a particle onto a
   * link. The renderer wires this to `forceGraphRef.current.emitParticle(link)`
   * so that the visual animation matches the logical release. The callback
   * is called synchronously inside `tick()`.
   */
  onParticleReleased?: (linkId: LinkId, particleId: ParticleId) => void;
}

export type StatsListener = (stats: SimulatorStats) => void;

// ─── Class ─────────────────────────────────────────────────────────────────

/**
 * Discrete event simulator. Construct once per graph; dispose to clean up.
 *
 * Typical lifecycle:
 *   const sim = new ParticleSimulator(graph, { onParticleReleased });
 *   sim.start();
 *   // ... rAF loop calls sim.tick(dt) ...
 *   sim.pause();
 *   sim.stop();    // resets state, keeps subscriptions
 *   sim.dispose(); // releases subscriptions, sim is no longer usable
 *
 * Mutators throw `NotImplementedError` until Phase 3.
 */
export class ParticleSimulator {
  constructor(_graph: GraphInput, _options: SimulatorOptions = {}) {
    // Phase 3 will:
    //   - Validate the graph (at least one nodeRole=generator, otherwise warn).
    //   - Build internal maps: nodes by id, links by id, outgoing-links-by-node,
    //     incoming-links-by-node.
    //   - Apply defaults: particleGeneration (1/s for generators), failure_rate
    //     (0), queue_size (∞), dropPolicy (tail), processing_time (0).
    //   - Build per-node queues with empty pending arrays.
  }

  /** Start the autoplay loop. Resets stats and queues per D5. */
  start(): void {
    throw new NotImplementedError('start');
  }

  /** Pause the autoplay loop. State is preserved. */
  pause(): void {
    throw new NotImplementedError('pause');
  }

  /** Stop and reset all queues + counters. Same as start→pause→clear. */
  stop(): void {
    throw new NotImplementedError('stop');
  }

  /**
   * Advance the simulation by `dt` milliseconds. Idempotent when paused
   * (no-op). `dt` is clamped to `maxDtMs` (default 33 ms).
   *
   * Manual ticking is useful for deterministic tests — drive the simulator
   * with fixed dt values and assert on `getStats()` between ticks.
   */
  tick(_dt: number): void {
    throw new NotImplementedError('tick');
  }

  /** Snapshot of the current state. Cheap — safe to call every frame. */
  getStats(): SimulatorStats {
    throw new NotImplementedError('getStats');
  }

  /**
   * Subscribe to stats updates. The callback is invoked after each `tick()`
   * that produced a change. Returns an unsubscribe function.
   */
  onTick(_listener: StatsListener): () => void {
    throw new NotImplementedError('onTick');
  }

  /** Release resources and unsubscribe all listeners. The instance becomes unusable. */
  dispose(): void {
    throw new NotImplementedError('dispose');
  }
}

/**
 * Thrown by public mutators until Phase 3 lands the implementation. Lets
 * callers (and tests) explicitly assert on the "stub" state without
 * accidentally suppressing real errors.
 */
export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`ParticleSimulator.${method}() is not implemented yet (Phase 3).`);
    this.name = 'NotImplementedError';
  }
}
