/**
 * Behaviour tests for ParticleSimulator (Phase 3).
 *
 * The simulator is pure data — these tests drive it with explicit `tick(dt)`
 * calls (no rAF), with a seeded random source where stochastic behaviour
 * matters, and a generous maxDtMs so a few ticks cover seconds of simulated
 * time.
 */

import { describe, test, expect, vi } from 'vitest';
import {
  ParticleSimulator,
  type GraphInput,
  type NodeRole,
  type DropPolicy,
} from './particleSimulator';

// Default options reused by most tests.
const wideDt = (extra: Partial<{ random: () => number }> = {}) => ({
  maxDtMs: 10_000,
  random: extra.random ?? (() => 0.5),
});

/**
 * Build a simple linear graph: generator A → relay B → sink C.
 * Caller can override per-node and per-link attributes.
 */
function linearGraph(overrides: {
  A?: Partial<GraphInput['nodes'][number]>;
  B?: Partial<GraphInput['nodes'][number]>;
  C?: Partial<GraphInput['nodes'][number]>;
  AB?: Partial<GraphInput['links'][number]>;
  BC?: Partial<GraphInput['links'][number]>;
} = {}): GraphInput {
  return {
    nodes: [
      { id: 'A', nodeRole: 'generator' as NodeRole, particleGeneration: 1, ...overrides.A },
      { id: 'B', nodeRole: 'relay' as NodeRole, ...overrides.B },
      { id: 'C', nodeRole: 'sink' as NodeRole, ...overrides.C },
    ],
    links: [
      { source: 'A', target: 'B', particleSpeed: 6, ...overrides.AB },
      { source: 'B', target: 'C', particleSpeed: 6, ...overrides.BC },
    ],
  };
}

// ─── Construction & defaults ───────────────────────────────────────────────

describe('ParticleSimulator — construction & defaults', () => {
  test('instantiates with a minimal graph', () => {
    const sim = new ParticleSimulator(linearGraph(), wideDt());
    expect(sim).toBeInstanceOf(ParticleSimulator);
  });

  test('start() is idempotent and resets stats', () => {
    const sim = new ParticleSimulator(linearGraph(), wideDt());
    sim.start();
    sim.tick(1000);
    const before = sim.getStats().totalEmitted;
    expect(before).toBeGreaterThan(0);
    sim.start();
    expect(sim.getStats().totalEmitted).toBe(0);
  });

  test('generates link ids from source->target when not provided', () => {
    const sim = new ParticleSimulator(linearGraph(), wideDt());
    const released: string[] = [];
    sim.dispose();
    const sim2 = new ParticleSimulator(linearGraph(), {
      ...wideDt(),
      onParticleReleased: (linkId) => released.push(linkId),
    });
    sim2.start();
    sim2.tick(1100); // 1.1s → at least 1 emission
    expect(released[0]).toMatch(/^A->B/);
  });
});

// ─── Phase 3a: emission ────────────────────────────────────────────────────

describe('ParticleSimulator — emission (3a)', () => {
  test('only generators emit', () => {
    const sim = new ParticleSimulator(
      {
        nodes: [
          // No generators here — only a relay and a sink.
          { id: 'A', nodeRole: 'relay' },
          { id: 'B', nodeRole: 'sink' },
        ],
        links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    sim.tick(5000);
    expect(sim.getStats().totalEmitted).toBe(0);
  });

  test('generator emits at particleGeneration rate', () => {
    const sim = new ParticleSimulator(
      linearGraph({ A: { particleGeneration: 10 } }), // 10 p/s
      wideDt()
    );
    sim.start();
    sim.tick(1000); // 1 second simulated
    expect(sim.getStats().totalEmitted).toBe(10);
  });

  test('emission is regular (deterministic) — exactly 1 every 100ms at 10p/s', () => {
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 10 } }), wideDt());
    sim.start();
    for (let i = 0; i < 10; i++) sim.tick(100);
    expect(sim.getStats().totalEmitted).toBe(10);
  });

  test('multiple small ticks accumulate properly', () => {
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 5 } }), wideDt());
    sim.start();
    // 5 p/s = 1 every 200ms. After 1s of cumulative ticking we expect 5.
    for (let i = 0; i < 100; i++) sim.tick(10);
    expect(sim.getStats().totalEmitted).toBe(5);
  });

  test('generator without outgoing link drops with reason no_outlet', () => {
    const sim = new ParticleSimulator(
      {
        nodes: [{ id: 'A', nodeRole: 'generator', particleGeneration: 5 }],
        links: [],
      },
      wideDt()
    );
    sim.start();
    sim.tick(1000);
    const stats = sim.getStats();
    expect(stats.totalEmitted).toBe(0);
    expect(stats.totalDropped).toBe(5);
    expect(stats.queues.get('A')?.droppedCount).toBe(5);
  });

  test('default generation rate of 1/s applies when particleGeneration is omitted on a generator', () => {
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator' }, // no particleGeneration
          { id: 'C', nodeRole: 'sink' },
        ],
        links: [{ source: 'A', target: 'C', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    sim.tick(3000);
    expect(sim.getStats().totalEmitted).toBe(3);
  });

  test('particleGeneration on relay/sink is ignored', () => {
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'relay', particleGeneration: 100 },
          { id: 'B', nodeRole: 'sink', particleGeneration: 100 },
        ],
        links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    sim.tick(2000);
    expect(sim.getStats().totalEmitted).toBe(0);
  });

  test('onParticleReleased callback fires with linkId and particleId', () => {
    const onReleased = vi.fn();
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 3 } }), {
      ...wideDt(),
      onParticleReleased: onReleased,
    });
    sim.start();
    sim.tick(1000);
    expect(onReleased).toHaveBeenCalledTimes(3);
    expect(onReleased.mock.calls[0][0]).toMatch(/^A->B/);
    expect(onReleased.mock.calls[0][1]).toMatch(/^p\d+$/);
  });
});

// ─── Phase 3b: transit & arrival ───────────────────────────────────────────

describe('ParticleSimulator — transit & arrival (3b)', () => {
  test('particle does not arrive before its expected transit time', () => {
    // A (gen 1/s) → C (sink), particleSpeed=6 → internal speed 0.018 → arrival ~926ms
    // after emission. With small ticks we can observe both states.
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 1 },
          { id: 'C', nodeRole: 'sink' },
        ],
        links: [{ source: 'A', target: 'C', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    // Sim time = 1500ms after 15×100ms. Emission was at t=1000ms; transit needs
    // 926ms more, so arrival expected around t≈1926ms — not yet at t=1500ms.
    for (let i = 0; i < 15; i++) sim.tick(100);
    expect(sim.getStats().totalEmitted).toBe(1);
    expect(sim.getStats().totalArrived).toBe(0);

    // Continue past the expected arrival time.
    for (let i = 0; i < 10; i++) sim.tick(100); // sim time = 2500ms
    expect(sim.getStats().totalArrived).toBe(1);
  });

  test('latency is tracked end-to-end across multiple hops', () => {
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 1 } }), wideDt());
    sim.start();
    // Drive long enough for at least one particle to traverse A→B→C
    for (let i = 0; i < 50; i++) sim.tick(100);
    const stats = sim.getStats();
    expect(stats.totalArrived).toBeGreaterThan(0);
    expect(stats.averageLatencyMs).toBeGreaterThan(0);
    expect(Number.isNaN(stats.averageLatencyMs)).toBe(false);
  });

  test('averageLatencyMs is NaN before any arrival', () => {
    const sim = new ParticleSimulator(linearGraph(), wideDt());
    sim.start();
    sim.tick(100); // not enough to reach the sink yet
    expect(Number.isNaN(sim.getStats().averageLatencyMs)).toBe(true);
  });

  test('particlesInFlight reflects active transit', () => {
    const sim = new ParticleSimulator(
      linearGraph({ A: { particleGeneration: 10 } }), // burst
      wideDt()
    );
    sim.start();
    sim.tick(500); // emit some, none arrived yet
    const stats = sim.getStats();
    expect(stats.particlesInFlight).toBeGreaterThan(0);
  });

  test('arriving at a relay enqueues into its pending list', () => {
    // particleSpeed high enough to reach B during the test
    // Slow processing so the queue actually builds up.
    const sim = new ParticleSimulator(
      linearGraph({
        A: { particleGeneration: 5 },
        B: { processing_time: 5000, maxParticleProcessing: 0 }, // no slots → everything queues
      }),
      wideDt()
    );
    sim.start();
    sim.tick(2000);
    const stats = sim.getStats();
    expect(stats.queues.get('B')!.size).toBeGreaterThan(0);
  });
});

// ─── Lifecycle ─────────────────────────────────────────────────────────────

describe('ParticleSimulator — lifecycle', () => {
  test('tick is a no-op when not running', () => {
    const sim = new ParticleSimulator(linearGraph(), wideDt());
    // start has NOT been called
    sim.tick(5000);
    expect(sim.getStats().totalEmitted).toBe(0);
  });

  test('pause suspends advancement but keeps state', () => {
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 2 } }), wideDt());
    sim.start();
    sim.tick(1000); // 2 emissions
    const before = sim.getStats().totalEmitted;
    sim.pause();
    sim.tick(5000); // should not progress
    expect(sim.getStats().totalEmitted).toBe(before);
  });

  test('stop resets stats and queues', () => {
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 5 } }), wideDt());
    sim.start();
    sim.tick(1000);
    expect(sim.getStats().totalEmitted).toBeGreaterThan(0);
    sim.stop();
    expect(sim.getStats().totalEmitted).toBe(0);
    expect(sim.getStats().particlesInFlight).toBe(0);
  });

  test('dispose makes the instance unusable', () => {
    const sim = new ParticleSimulator(linearGraph(), wideDt());
    sim.dispose();
    expect(() => sim.start()).toThrow(/disposed/);
    expect(() => sim.tick(100)).toThrow(/disposed/);
  });

  test('onTick fires after each tick and returns an unsubscribe function', () => {
    const sim = new ParticleSimulator(linearGraph(), wideDt());
    const cb = vi.fn();
    const unsubscribe = sim.onTick(cb);
    sim.start();
    sim.tick(1000);
    sim.tick(1000);
    expect(cb).toHaveBeenCalledTimes(2);
    unsubscribe();
    sim.tick(1000);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  test('dt is clamped to maxDtMs', () => {
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 10 } }), {
      maxDtMs: 100,
    });
    sim.start();
    sim.tick(100_000); // would emit 1000 particles unclamped; clamped → 1 emission (100ms * 10/s)
    expect(sim.getStats().totalEmitted).toBe(1);
  });

  test('dt of 0 or negative is a no-op (does not advance time)', () => {
    const sim = new ParticleSimulator(linearGraph({ A: { particleGeneration: 1 } }), wideDt());
    sim.start();
    sim.tick(0);
    sim.tick(-100);
    expect(sim.getStats().totalEmitted).toBe(0);
  });
});

// ─── Phase 3c: queue, drop, processing slots ───────────────────────────────

describe('ParticleSimulator — queue, dropPolicy, processing (3c)', () => {
  test('queue grows when generation > processing capacity', () => {
    // A generates 10/s, B has 1 slot * processing_time=2000ms = 0.5/s throughput
    const sim = new ParticleSimulator(
      linearGraph({
        A: { particleGeneration: 10 },
        B: { maxParticleProcessing: 1, processing_time: 2000, queue_size: 100 },
        AB: { particleSpeed: 6 },
        BC: { particleSpeed: 6 },
      }),
      wideDt()
    );
    sim.start();
    sim.tick(2000);
    expect(sim.getStats().queues.get('B')!.size).toBeGreaterThan(0);
  });

  test('dropPolicy=tail drops the incoming particle when queue is full', () => {
    // Burst arrivals at a relay with queue_size=2, dropPolicy=tail.
    // No outlet processing → all particles past the 2nd get dropped.
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 10 },
          {
            id: 'B',
            nodeRole: 'relay',
            queue_size: 2,
            dropPolicy: 'tail',
            maxParticleProcessing: 0,
          },
        ],
        links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    sim.tick(2000); // generate + transit
    const stats = sim.getStats();
    expect(stats.queues.get('B')!.size).toBeLessThanOrEqual(2);
    expect(stats.queues.get('B')!.droppedCount).toBeGreaterThan(0);
  });

  test('dropPolicy=head drops the oldest queued particle', () => {
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 10 },
          {
            id: 'B',
            nodeRole: 'relay',
            queue_size: 1,
            dropPolicy: 'head',
            maxParticleProcessing: 0,
          },
        ],
        links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    sim.tick(2000);
    const stats = sim.getStats();
    expect(stats.queues.get('B')!.size).toBe(1);
    expect(stats.queues.get('B')!.droppedCount).toBeGreaterThan(0);
  });

  test('queue_size undefined → no drops by queue full', () => {
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 10 },
          {
            id: 'B',
            nodeRole: 'relay',
            // queue_size undefined → unbounded
            maxParticleProcessing: 0,
          },
        ],
        links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    sim.tick(2000);
    expect(sim.getStats().queues.get('B')!.droppedCount).toBe(0);
    expect(sim.getStats().queues.get('B')!.size).toBeGreaterThan(5);
  });

  test('processing_time delays release from a slot', () => {
    const sim = new ParticleSimulator(
      linearGraph({
        A: { particleGeneration: 1 },
        B: { maxParticleProcessing: 10, processing_time: 5000 },
        AB: { particleSpeed: 6 },
        BC: { particleSpeed: 6 },
      }),
      wideDt()
    );
    sim.start();
    // Drive in small ticks for a fluid pipeline. With 5000ms processing_time,
    // even the first emitted particle (at t=1000ms) won't reach C before
    // t ≈ 1000 + 926 (transit) + 5000 (slot) + 926 (transit) ≈ 7852ms.
    for (let i = 0; i < 70; i++) sim.tick(100); // sim time = 7000ms
    expect(sim.getStats().totalArrived).toBe(0);

    // Continue past the expected arrival.
    for (let i = 0; i < 30; i++) sim.tick(100); // sim time = 10000ms
    expect(sim.getStats().totalArrived).toBeGreaterThan(0);
  });

  test('maxParticleProcessing caps parallel slots', () => {
    // Burst of arrivals — only 2 should be in slots at once
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 100 },
          {
            id: 'B',
            nodeRole: 'relay',
            maxParticleProcessing: 2,
            processing_time: 10000, // long enough to keep slots busy
            queue_size: 100,
          },
          { id: 'C', nodeRole: 'sink' },
        ],
        links: [
          { source: 'A', target: 'B', particleSpeed: 6 },
          { source: 'B', target: 'C', particleSpeed: 6 },
        ],
      },
      wideDt()
    );
    sim.start();
    sim.tick(2000);
    // None has finished processing yet (processing_time=10000)
    expect(sim.getStats().totalArrived).toBe(0);
    // But queue should have plenty of pending particles (more than 2)
    expect(sim.getStats().queues.get('B')!.size).toBeGreaterThan(2);
  });

  test('failure_rate=1.0 drops every particle at output', () => {
    const sim = new ParticleSimulator(
      linearGraph({
        A: { particleGeneration: 5 },
        B: { failure_rate: 1.0, processing_time: 0 },
        AB: { particleSpeed: 6 },
        BC: { particleSpeed: 6 },
      }),
      { ...wideDt(), random: () => 0 } // always less than 1.0
    );
    sim.start();
    for (let i = 0; i < 30; i++) sim.tick(100);
    const stats = sim.getStats();
    expect(stats.totalArrived).toBe(0);
    expect(stats.totalDropped).toBeGreaterThan(0);
  });

  test('failure_rate=0 means no drop at output', () => {
    const sim = new ParticleSimulator(
      linearGraph({
        A: { particleGeneration: 5 },
        B: { failure_rate: 0, processing_time: 0 },
      }),
      wideDt()
    );
    sim.start();
    for (let i = 0; i < 30; i++) sim.tick(100);
    expect(sim.getStats().totalDropped).toBe(0);
  });

  test('relay with no outgoing link drops at output with no_outlet', () => {
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 2 },
          { id: 'B', nodeRole: 'relay', processing_time: 0 }, // no outgoing
        ],
        links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
      },
      wideDt()
    );
    sim.start();
    for (let i = 0; i < 30; i++) sim.tick(100);
    const stats = sim.getStats();
    expect(stats.totalArrived).toBe(0);
    expect(stats.queues.get('B')!.droppedCount).toBeGreaterThan(0);
  });
});

// ─── Phase 3d: routing ─────────────────────────────────────────────────────

describe('ParticleSimulator — routing (3d)', () => {
  test('round-robin when no weights are defined', () => {
    // Generator with 3 outgoing links to 3 sinks, no maxParticleFlow defined.
    // 6 emissions → exactly 2 on each outgoing link.
    const released = new Map<string, number>();
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 6 },
          { id: 'X', nodeRole: 'sink' },
          { id: 'Y', nodeRole: 'sink' },
          { id: 'Z', nodeRole: 'sink' },
        ],
        links: [
          { source: 'A', target: 'X', particleSpeed: 6 },
          { source: 'A', target: 'Y', particleSpeed: 6 },
          { source: 'A', target: 'Z', particleSpeed: 6 },
        ],
      },
      {
        ...wideDt(),
        onParticleReleased: (linkId) => released.set(linkId, (released.get(linkId) ?? 0) + 1),
      }
    );
    sim.start();
    sim.tick(1000); // 6 particles
    const counts = Array.from(released.values()).sort();
    expect(counts).toEqual([2, 2, 2]);
  });

  test('weighted routing by maxParticleFlow distributes proportionally', () => {
    // 100 emissions, weights 80/20 → ~80/20 split. Use seeded random for determinism.
    const released = new Map<string, number>();
    let i = 0;
    const seededRandom = () => {
      // Pseudo-random: returns 0.0, 0.01, 0.02, ... 0.99 cyclically
      i = (i + 1) % 100;
      return i / 100;
    };
    const sim = new ParticleSimulator(
      {
        nodes: [
          { id: 'A', nodeRole: 'generator', particleGeneration: 100 },
          { id: 'X', nodeRole: 'sink' },
          { id: 'Y', nodeRole: 'sink' },
        ],
        links: [
          { source: 'A', target: 'X', particleSpeed: 6, maxParticleFlow: 80 },
          { source: 'A', target: 'Y', particleSpeed: 6, maxParticleFlow: 20 },
        ],
      },
      {
        ...wideDt(),
        random: seededRandom,
        onParticleReleased: (linkId) => released.set(linkId, (released.get(linkId) ?? 0) + 1),
      }
    );
    sim.start();
    sim.tick(1000);
    const xCount = Array.from(released).find(([id]) => id.startsWith('A->X'))?.[1] ?? 0;
    const yCount = Array.from(released).find(([id]) => id.startsWith('A->Y'))?.[1] ?? 0;
    expect(xCount + yCount).toBe(100);
    // With the cyclic seed: r < 80 → X (80 cases), r < 100 → Y (20 cases)
    expect(xCount).toBe(80);
    expect(yCount).toBe(20);
  });

  test('seeded random produces deterministic routing', () => {
    const run = () => {
      const released: string[] = [];
      const sim = new ParticleSimulator(
        {
          nodes: [
            { id: 'A', nodeRole: 'generator', particleGeneration: 4 },
            { id: 'X', nodeRole: 'sink' },
            { id: 'Y', nodeRole: 'sink' },
          ],
          links: [
            { source: 'A', target: 'X', particleSpeed: 6, maxParticleFlow: 50 },
            { source: 'A', target: 'Y', particleSpeed: 6, maxParticleFlow: 50 },
          ],
        },
        {
          ...wideDt(),
          random: () => 0.3, // always X (cumul=50; 0.3*100=30 < 50)
          onParticleReleased: (linkId) => released.push(linkId),
        }
      );
      sim.start();
      sim.tick(1000);
      return released;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(a.every((id) => id.startsWith('A->X'))).toBe(true);
  });
});

// ─── Type smoke tests ──────────────────────────────────────────────────────

describe('exported types are usable', () => {
  test('NodeRole enum values', () => {
    const roles: NodeRole[] = ['generator', 'relay', 'sink'];
    expect(roles).toHaveLength(3);
  });

  test('DropPolicy enum values', () => {
    const policies: DropPolicy[] = ['tail', 'head', 'reject'];
    expect(policies).toHaveLength(3);
  });
});
