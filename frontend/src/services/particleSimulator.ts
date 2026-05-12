/**
 * Particle Simulator — Discrete Event Simulation (DES) for VortexFlow.
 *
 * Owns the *logical* state of all particles in transit, all per-node queues,
 * and all parallel processing slots. Pure TypeScript, no React or Three.js
 * dependency — testable in isolation.
 *
 * Design rationale: ADR-006.
 *
 * Locked decisions applied below:
 *   - V1 strict on nodeRole — no fallback "everyone emits".
 *   - Routing at a node with M outgoing links: weighted by maxParticleFlow,
 *     round-robin fallback when no weights are defined.
 *   - dt clamped to options.maxDtMs (default 33 ms).
 *   - Stats reset on `start()`.
 *   - dropPolicy without queue_size is meaningless — validated/warned at parse.
 *   - particleGeneration on relay/sink is ignored (zeroed at construction).
 *   - Emission is regular deterministic: 1 particle every (1000 / rate) ms,
 *     accumulator-based (no Poisson jitter — predictable tests + visuals).
 *   - Processing model: parallel slots — maxParticleProcessing = number of
 *     concurrent workers, processing_time = ms each worker stays busy.
 *   - failure_rate is sampled at the *output* of a node (after processing).
 *   - Speed calibration matches the existing one-shot `handleEmitTrace`:
 *     speed_internal = particleSpeed × 0.003  (fraction-of-link per 16.67-ms tick)
 *     arrival_ms     = (1 / speed_internal) × 16.67
 *
 * Integration (Phase 4): a thin React hook `useParticleSimulator` will own
 * a `ParticleSimulator` instance, drive it via rAF, and wire
 * `onParticleReleased` to `forceGraphRef.current.emitParticle(link)` so the
 * visual animation matches each logical release. The simulator itself does
 * NOT touch 3d-force-graph.
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
 * State is implicit from `linkId`:
 *   - linkId set, t ∈ [0, 1) → in transit on a link
 *   - linkId === null         → queued or being processed on a node
 */
export interface Particle {
  id: ParticleId;
  linkId: LinkId | null;
  /** Position along the current link, 0 → 1. Ignored when linkId is null. */
  t: number;
  /** Speed in link-fraction per 16.67-ms tick (already normalised). */
  speed: number;
  /** Simulator time (ms) at which the particle was emitted — for latency. */
  bornAt: number;
}

export interface NodeQueue {
  nodeId: NodeId;
  pending: Particle[];
  droppedCount: number;
  droppedReasons: Map<DropReason, number>;
  /** Cursor used by the round-robin fallback when no maxParticleFlow weights. */
  roundRobinCursor: number;
}

export interface SimulatorStats {
  /** Particles currently advancing on a link. */
  particlesInFlight: number;
  /** Cumulative emissions since the last `start()`. */
  totalEmitted: number;
  /** Cumulative arrivals at a sink (or end-of-chain absorption). */
  totalArrived: number;
  /** Cumulative drops, all reasons combined. */
  totalDropped: number;
  /** Average end-to-end latency, in ms. NaN before any arrival. */
  averageLatencyMs: number;
  /** Per-node snapshot. */
  queues: Map<NodeId, { size: number; droppedCount: number }>;
}

// ─── Inputs ────────────────────────────────────────────────────────────────

export interface NodeInput {
  id: NodeId;
  nodeRole?: NodeRole;
  /** Particles per second (only meaningful for generators). */
  particleGeneration?: number;
  /** Maximum parallel processing slots (default Infinity = unbounded throughput). */
  maxParticleProcessing?: number;
  /** Maximum FIFO queue size before dropPolicy kicks in (default unbounded). */
  queue_size?: number;
  /** Time (ms) a processing slot stays busy per particle (default 0 = instant). */
  processing_time?: number;
  /** Probability [0, 1] that a particle is dropped at the output (default 0). */
  failure_rate?: number;
  dropPolicy?: DropPolicy;
}

export interface LinkInput {
  id?: LinkId;
  source: NodeId;
  target: NodeId;
  /** Multiplier; default 1.0. Internal speed = particleSpeed × 0.003 per tick. */
  particleSpeed?: number;
  /** Weight for output routing on the source node. */
  maxParticleFlow?: number;
}

export interface GraphInput {
  nodes: NodeInput[];
  links: LinkInput[];
}

// ─── Simulator options ─────────────────────────────────────────────────────

export interface SimulatorOptions {
  maxDtMs?: number;
  random?: () => number;
  defaultGenerationPerSecond?: number;
  onParticleReleased?: (linkId: LinkId, particleId: ParticleId) => void;
}

export type StatsListener = (stats: SimulatorStats) => void;

// ─── Constants ─────────────────────────────────────────────────────────────

/** Minimum/maximum internal speed (fraction-of-link per tick) — clamp range. */
const MIN_INTERNAL_SPEED = 0.001;
const MAX_INTERNAL_SPEED = 0.02;
/** Particle-speed multiplier to internal-speed (matches `handleEmitTrace`). */
const SPEED_SCALE = 0.003;
/** Tick duration in ms at 60 fps — used to convert internal speed to ms/tick. */
const TICK_MS = 16.67;

const DEFAULT_OPTIONS: Required<Omit<SimulatorOptions, 'onParticleReleased'>> = {
  maxDtMs: 33,
  random: Math.random,
  defaultGenerationPerSecond: 1,
};

// ─── Internal state ────────────────────────────────────────────────────────

interface ResolvedNode {
  id: NodeId;
  nodeRole: NodeRole;
  /** Particles per second. 0 for relay/sink. */
  particleGeneration: number;
  /** Number of parallel processing slots (Infinity = unbounded). */
  maxParticleProcessing: number;
  /** Maximum FIFO queue size (undefined = unbounded). */
  queue_size: number | undefined;
  processing_time: number;
  failure_rate: number;
  dropPolicy: DropPolicy;
}

interface ResolvedLink {
  id: LinkId;
  source: NodeId;
  target: NodeId;
  particleSpeed: number;
  maxParticleFlow: number;
}

interface ProcessingSlot {
  particleId: ParticleId;
  releaseAt: number;
}

interface InternalStats {
  totalEmitted: number;
  totalArrived: number;
  totalDropped: number;
  latencySumMs: number;
}

// ─── Class ─────────────────────────────────────────────────────────────────

export class ParticleSimulator {
  private readonly options: Required<Omit<SimulatorOptions, 'onParticleReleased'>> & {
    onParticleReleased?: SimulatorOptions['onParticleReleased'];
  };

  private readonly nodes = new Map<NodeId, ResolvedNode>();
  private readonly links = new Map<LinkId, ResolvedLink>();
  private readonly outgoing = new Map<NodeId, LinkId[]>();
  private readonly queues = new Map<NodeId, NodeQueue>();
  private readonly slots = new Map<NodeId, ProcessingSlot[]>();
  private readonly generatorAccumulators = new Map<NodeId, number>();
  private readonly particles = new Map<ParticleId, Particle>();
  private readonly listeners = new Set<StatsListener>();

  private running = false;
  private disposed = false;
  private now = 0;
  private particleIdCounter = 0;
  private stats: InternalStats = { totalEmitted: 0, totalArrived: 0, totalDropped: 0, latencySumMs: 0 };

  constructor(graph: GraphInput, options: SimulatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Resolve nodes with defaults
    for (const node of graph.nodes) {
      this.nodes.set(node.id, this.resolveNode(node));
      this.queues.set(node.id, this.makeEmptyQueue(node.id));
      this.slots.set(node.id, []);
      this.generatorAccumulators.set(node.id, 0);
    }

    // Resolve links with defaults + build outgoing adjacency
    let counter = 0;
    for (const link of graph.links) {
      const id = link.id ?? `${link.source}->${link.target}#${counter++}`;
      this.links.set(id, {
        id,
        source: link.source,
        target: link.target,
        particleSpeed: link.particleSpeed ?? 1.0,
        maxParticleFlow: link.maxParticleFlow ?? 0,
      });
      if (!this.outgoing.has(link.source)) this.outgoing.set(link.source, []);
      this.outgoing.get(link.source)!.push(id);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────

  start(): void {
    this.assertNotDisposed();
    this.resetState();
    this.running = true;
  }

  pause(): void {
    this.assertNotDisposed();
    this.running = false;
  }

  stop(): void {
    this.assertNotDisposed();
    this.running = false;
    this.resetState();
  }

  tick(dt: number): void {
    this.assertNotDisposed();
    if (!this.running) return;
    const clamped = Math.min(Math.max(dt, 0), this.options.maxDtMs);
    if (clamped === 0) return;
    this.now += clamped;

    this.tickEmission(clamped);
    this.tickTransit(clamped);
    this.tickProcessing();

    if (this.listeners.size > 0) {
      const snapshot = this.getStats();
      for (const cb of this.listeners) cb(snapshot);
    }
  }

  getStats(): SimulatorStats {
    this.assertNotDisposed();
    const queues = new Map<NodeId, { size: number; droppedCount: number }>();
    for (const [nodeId, q] of this.queues) {
      queues.set(nodeId, { size: q.pending.length, droppedCount: q.droppedCount });
    }
    let inFlight = 0;
    for (const p of this.particles.values()) {
      if (p.linkId !== null) inFlight++;
    }
    return {
      particlesInFlight: inFlight,
      totalEmitted: this.stats.totalEmitted,
      totalArrived: this.stats.totalArrived,
      totalDropped: this.stats.totalDropped,
      averageLatencyMs:
        this.stats.totalArrived > 0 ? this.stats.latencySumMs / this.stats.totalArrived : NaN,
      queues,
    };
  }

  onTick(listener: StatsListener): () => void {
    this.assertNotDisposed();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.running = false;
    this.disposed = true;
    this.listeners.clear();
    this.particles.clear();
    this.queues.clear();
    this.slots.clear();
    this.generatorAccumulators.clear();
    this.nodes.clear();
    this.links.clear();
    this.outgoing.clear();
  }

  // ─── Resolve / construction helpers ────────────────────────────────────

  private resolveNode(node: NodeInput): ResolvedNode {
    const role: NodeRole = node.nodeRole ?? 'relay';
    // particleGeneration only applies to generators; zeroed for relay/sink
    // (validator emits a warning when this happens — see dotValidator).
    const rawGen = node.particleGeneration;
    const particleGeneration =
      role === 'generator'
        ? rawGen !== undefined && rawGen > 0
          ? rawGen
          : this.options.defaultGenerationPerSecond
        : 0;
    return {
      id: node.id,
      nodeRole: role,
      particleGeneration,
      maxParticleProcessing: node.maxParticleProcessing ?? Infinity,
      queue_size: node.queue_size,
      processing_time: node.processing_time ?? 0,
      failure_rate: node.failure_rate ?? 0,
      dropPolicy: node.dropPolicy ?? 'tail',
    };
  }

  private makeEmptyQueue(nodeId: NodeId): NodeQueue {
    return {
      nodeId,
      pending: [],
      droppedCount: 0,
      droppedReasons: new Map(),
      roundRobinCursor: 0,
    };
  }

  private resetState(): void {
    this.now = 0;
    this.particleIdCounter = 0;
    this.particles.clear();
    this.stats = { totalEmitted: 0, totalArrived: 0, totalDropped: 0, latencySumMs: 0 };
    for (const nodeId of this.nodes.keys()) {
      this.queues.set(nodeId, this.makeEmptyQueue(nodeId));
      this.slots.set(nodeId, []);
      this.generatorAccumulators.set(nodeId, 0);
    }
  }

  // ─── Tick phases ───────────────────────────────────────────────────────

  /** Phase 3a: generators emit at their configured rate (regular deterministic). */
  private tickEmission(dt: number): void {
    for (const node of this.nodes.values()) {
      if (node.nodeRole !== 'generator' || node.particleGeneration <= 0) continue;
      const intervalMs = 1000 / node.particleGeneration;
      const acc = (this.generatorAccumulators.get(node.id) ?? 0) + dt;
      let toEmit = Math.floor(acc / intervalMs);
      this.generatorAccumulators.set(node.id, acc - toEmit * intervalMs);
      while (toEmit-- > 0) {
        this.routeOutFromGenerator(node.id);
      }
    }
  }

  /** Phase 3b: advance all in-transit particles, fire arrivals. */
  private tickTransit(dt: number): void {
    const ticks = dt / TICK_MS;
    const arrived: Particle[] = [];
    for (const p of this.particles.values()) {
      if (p.linkId === null) continue;
      p.t += p.speed * ticks;
      if (p.t >= 1) arrived.push(p);
    }
    for (const p of arrived) {
      const link = this.links.get(p.linkId!);
      this.particles.delete(p.id);
      if (!link) continue;
      this.handleArrival(link.target, p);
    }
  }

  /** Phase 3c: release finished slots, refill from queues. */
  private tickProcessing(): void {
    for (const node of this.nodes.values()) {
      if (node.nodeRole === 'sink') continue;
      const slots = this.slots.get(node.id)!;
      const q = this.queues.get(node.id)!;

      // Step 1: release finished slots
      let i = 0;
      while (i < slots.length) {
        if (slots[i].releaseAt <= this.now) {
          const particleId = slots[i].particleId;
          slots.splice(i, 1);
          this.releaseFromSlot(node, particleId);
        } else {
          i++;
        }
      }

      // Step 2: fill empty slots from queue
      while (slots.length < node.maxParticleProcessing && q.pending.length > 0) {
        const p = q.pending.shift()!;
        slots.push({ particleId: p.id, releaseAt: this.now + node.processing_time });
        // The particle stays in this.particles (linkId stays null while processing).
      }
    }
  }

  // ─── Arrival / routing / emission helpers ──────────────────────────────

  private handleArrival(targetId: NodeId, p: Particle): void {
    const target = this.nodes.get(targetId);
    if (!target) {
      // Edge points to an unknown node — treat as drop (no_outlet).
      this.recordDrop(targetId, 'no_outlet');
      return;
    }
    if (target.nodeRole === 'sink') {
      // Absorbed at sink.
      this.stats.totalArrived++;
      this.stats.latencySumMs += this.now - p.bornAt;
      return;
    }
    // Relay or generator (C1): enqueue.
    this.enqueue(target, p);
  }

  /** Place an arriving particle into the target node's queue (applies dropPolicy). */
  private enqueue(node: ResolvedNode, p: Particle): void {
    const q = this.queues.get(node.id)!;
    if (node.queue_size !== undefined && q.pending.length >= node.queue_size) {
      if (node.dropPolicy === 'head' && q.pending.length > 0) {
        const dropped = q.pending.shift()!;
        this.particles.delete(dropped.id);
        this.recordDrop(node.id, 'queue_full');
        // fall through: push incoming
      } else {
        // tail / reject: drop incoming
        this.particles.delete(p.id);
        this.recordDrop(node.id, 'queue_full');
        return;
      }
    }
    p.linkId = null;
    p.t = 0;
    q.pending.push(p);
    // Make sure the particle is tracked (it is, since handleArrival was called
    // on a particle already in this.particles via tickTransit's arrival list).
    this.particles.set(p.id, p);
  }

  /** Move a particle from a processing slot onto an outgoing link (or drop). */
  private releaseFromSlot(node: ResolvedNode, particleId: ParticleId): void {
    const p = this.particles.get(particleId);
    if (!p) return;
    // failure_rate sampled at the output
    if (node.failure_rate > 0 && this.options.random() < node.failure_rate) {
      this.particles.delete(particleId);
      this.recordDrop(node.id, 'failure_rate');
      return;
    }
    const outgoing = this.outgoing.get(node.id);
    if (!outgoing || outgoing.length === 0) {
      this.particles.delete(particleId);
      this.recordDrop(node.id, 'no_outlet');
      return;
    }
    const linkId = this.pickOutgoing(node.id, outgoing);
    this.sendOnLink(p, linkId);
  }

  /**
   * Phase 3d — outbound routing. Weighted by maxParticleFlow when at least one
   * link has a positive weight, otherwise round-robin.
   */
  private pickOutgoing(nodeId: NodeId, outgoing: LinkId[]): LinkId {
    if (outgoing.length === 1) return outgoing[0];
    let totalWeight = 0;
    const weights: number[] = [];
    for (const id of outgoing) {
      const w = this.links.get(id)!.maxParticleFlow;
      const safe = w > 0 ? w : 0;
      weights.push(safe);
      totalWeight += safe;
    }
    if (totalWeight > 0) {
      const r = this.options.random() * totalWeight;
      let cumul = 0;
      for (let i = 0; i < outgoing.length; i++) {
        cumul += weights[i];
        if (r < cumul) return outgoing[i];
      }
      return outgoing[outgoing.length - 1];
    }
    // Round-robin fallback
    const q = this.queues.get(nodeId)!;
    const idx = q.roundRobinCursor % outgoing.length;
    q.roundRobinCursor = (q.roundRobinCursor + 1) % outgoing.length;
    return outgoing[idx];
  }

  /**
   * Emit a generator's own particle directly onto an outgoing link.
   * Bypasses the queue and slots (a generator's emission is push, not pull).
   * This is the *only* place `totalEmitted` is incremented — routing of
   * relayed traffic uses `sendOnLink` directly which does not bump the counter.
   */
  private routeOutFromGenerator(nodeId: NodeId): void {
    const outgoing = this.outgoing.get(nodeId);
    if (!outgoing || outgoing.length === 0) {
      this.recordDrop(nodeId, 'no_outlet');
      return;
    }
    const linkId = this.pickOutgoing(nodeId, outgoing);
    const p: Particle = {
      id: `p${++this.particleIdCounter}`,
      linkId: null,
      t: 0,
      speed: 0,
      bornAt: this.now,
    };
    this.particles.set(p.id, p);
    this.stats.totalEmitted++;
    this.sendOnLink(p, linkId);
  }

  /** Put a particle in transit on a link, set its speed, fire the callback. */
  private sendOnLink(p: Particle, linkId: LinkId): void {
    const link = this.links.get(linkId)!;
    const speed = Math.max(MIN_INTERNAL_SPEED, Math.min(MAX_INTERNAL_SPEED, link.particleSpeed * SPEED_SCALE));
    p.linkId = linkId;
    p.t = 0;
    p.speed = speed;
    this.options.onParticleReleased?.(linkId, p.id);
  }

  private recordDrop(nodeId: NodeId, reason: DropReason): void {
    const q = this.queues.get(nodeId);
    if (!q) return;
    q.droppedCount++;
    q.droppedReasons.set(reason, (q.droppedReasons.get(reason) ?? 0) + 1);
    this.stats.totalDropped++;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('ParticleSimulator has been disposed and is no longer usable.');
    }
  }
}
