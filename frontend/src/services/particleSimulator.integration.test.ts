/**
 * End-to-end scenario tests for ParticleSimulator (Phase 7).
 *
 * Unit tests in particleSimulator.test.ts cover each branch in isolation.
 * The tests below stress the simulator on realistic topologies:
 * convergence (M sources → 1 node), divergence with weighted routing,
 * cycles (no infinite cascade), and saturation with drops.
 *
 * A perf smoke test at the bottom ensures the simulator stays cheap
 * enough to drive in a browser rAF loop.
 */

import { describe, test, expect } from 'vitest';
import { ParticleSimulator, type GraphInput } from './particleSimulator';

// Deterministic random source used by every scenario that involves probabilistic
// behaviour (weighted routing, failure_rate). Without seeding, weighted routing
// would be statistical and the assertions would flake.
function cyclicRandom(seed = 0): () => number {
  let i = seed;
  return () => {
    i = (i + 1) % 100;
    return i / 100;
  };
}

const wideDt = (random?: () => number) => ({
  maxDtMs: 10_000,
  random: random ?? cyclicRandom(),
});

// ─── Scenario 1: Convergence ───────────────────────────────────────────────

describe('Scenario: convergence (3 sources → 1 relay → 1 sink)', () => {
  test('queue grows when total input rate exceeds processing rate', () => {
    // Total input = 3 × 10 = 30 p/s. Processing: 1 slot, processing_time=66ms
    // → ~15 p/s out. Sustained 15/s deficit → queue grows.
    const graph: GraphInput = {
      nodes: [
        { id: 'A1', nodeRole: 'generator', particleGeneration: 10 },
        { id: 'A2', nodeRole: 'generator', particleGeneration: 10 },
        { id: 'A3', nodeRole: 'generator', particleGeneration: 10 },
        {
          id: 'B',
          nodeRole: 'relay',
          maxParticleProcessing: 1,
          processing_time: 66, // 1 / 0.015s ≈ 66.7ms
        },
        { id: 'C', nodeRole: 'sink' },
      ],
      links: [
        { source: 'A1', target: 'B', particleSpeed: 6 },
        { source: 'A2', target: 'B', particleSpeed: 6 },
        { source: 'A3', target: 'B', particleSpeed: 6 },
        { source: 'B', target: 'C', particleSpeed: 6 },
      ],
    };
    const sim = new ParticleSimulator(graph, wideDt());
    sim.start();
    // Drive 3 seconds of small ticks. Expect ~90 emissions, ~45 arrived,
    // queue around 30+ pending.
    for (let i = 0; i < 30; i++) sim.tick(100);
    const stats = sim.getStats();
    expect(stats.totalEmitted).toBeGreaterThanOrEqual(85);
    expect(stats.totalArrived).toBeLessThan(stats.totalEmitted);
    expect(stats.queues.get('B')!.size).toBeGreaterThan(10);
  });
});

// ─── Scenario 2: Divergence with weighted routing ──────────────────────────

describe('Scenario: divergence (1 source → 3 sinks, weighted 50/30/20)', () => {
  test('outputs distribute proportionally to maxParticleFlow', () => {
    const counts = new Map<string, number>();
    const graph: GraphInput = {
      nodes: [
        { id: 'A', nodeRole: 'generator', particleGeneration: 100 },
        { id: 'X', nodeRole: 'sink' },
        { id: 'Y', nodeRole: 'sink' },
        { id: 'Z', nodeRole: 'sink' },
      ],
      links: [
        { source: 'A', target: 'X', particleSpeed: 6, maxParticleFlow: 50 },
        { source: 'A', target: 'Y', particleSpeed: 6, maxParticleFlow: 30 },
        { source: 'A', target: 'Z', particleSpeed: 6, maxParticleFlow: 20 },
      ],
    };
    const sim = new ParticleSimulator(graph, {
      ...wideDt(),
      onParticleReleased: (linkId) => counts.set(linkId, (counts.get(linkId) ?? 0) + 1),
    });
    sim.start();
    sim.tick(1000); // 100 emissions
    const x = Array.from(counts).find(([id]) => id.startsWith('A->X'))?.[1] ?? 0;
    const y = Array.from(counts).find(([id]) => id.startsWith('A->Y'))?.[1] ?? 0;
    const z = Array.from(counts).find(([id]) => id.startsWith('A->Z'))?.[1] ?? 0;
    expect(x + y + z).toBe(100);
    // Cyclic seed: r=i/100 for i=1..100. cumul [0,50)→X (50), [50,80)→Y (30), [80,100)→Z (20)
    expect(x).toBe(50);
    expect(y).toBe(30);
    expect(z).toBe(20);
  });
});

// ─── Scenario 3: Cycle ─────────────────────────────────────────────────────

describe('Scenario: cycle (A → B → C → B)', () => {
  test('handles a directed cycle without crashing or runaway state', () => {
    const graph: GraphInput = {
      nodes: [
        { id: 'A', nodeRole: 'generator', particleGeneration: 1 },
        { id: 'B', nodeRole: 'relay', maxParticleProcessing: 10, processing_time: 0 },
        { id: 'C', nodeRole: 'relay', maxParticleProcessing: 10, processing_time: 0 },
      ],
      links: [
        { source: 'A', target: 'B', particleSpeed: 6 },
        { source: 'B', target: 'C', particleSpeed: 6 },
        { source: 'C', target: 'B', particleSpeed: 6 }, // cycle back into B
      ],
    };
    const sim = new ParticleSimulator(graph, wideDt());
    sim.start();
    // Drive a few seconds; particles will start cycling. The key assertion is
    // that tick() never throws and getStats() stays consistent.
    expect(() => {
      for (let i = 0; i < 200; i++) sim.tick(50);
    }).not.toThrow();
    const stats = sim.getStats();
    // At least one emission should have happened.
    expect(stats.totalEmitted).toBeGreaterThan(0);
    // With cycles, particles keep moving — particlesInFlight can be high but finite.
    expect(stats.particlesInFlight).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(stats.particlesInFlight)).toBe(true);
  });
});

// ─── Scenario 4: Saturation with drops ─────────────────────────────────────

describe('Scenario: saturation (queue_size=5, dropPolicy=tail)', () => {
  test('queue caps at queue_size and excess arrivals are dropped', () => {
    const graph: GraphInput = {
      nodes: [
        { id: 'A', nodeRole: 'generator', particleGeneration: 100 },
        {
          id: 'B',
          nodeRole: 'relay',
          queue_size: 5,
          dropPolicy: 'tail',
          maxParticleProcessing: 1,
          processing_time: 200, // 5 p/s out → 95 p/s deficit
        },
        { id: 'C', nodeRole: 'sink' },
      ],
      links: [
        { source: 'A', target: 'B', particleSpeed: 6 },
        { source: 'B', target: 'C', particleSpeed: 6 },
      ],
    };
    const sim = new ParticleSimulator(graph, wideDt());
    sim.start();
    for (let i = 0; i < 30; i++) sim.tick(100); // 3 seconds
    const stats = sim.getStats();
    expect(stats.totalDropped).toBeGreaterThan(50);
    expect(stats.queues.get('B')!.size).toBeLessThanOrEqual(5);
    expect(stats.queues.get('B')!.droppedCount).toBeGreaterThan(50);
  });

  test('dropPolicy=head preserves queue size but drops the oldest', () => {
    const graph: GraphInput = {
      nodes: [
        { id: 'A', nodeRole: 'generator', particleGeneration: 50 },
        {
          id: 'B',
          nodeRole: 'relay',
          queue_size: 3,
          dropPolicy: 'head',
          maxParticleProcessing: 0, // no outflow at all
        },
      ],
      links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
    };
    const sim = new ParticleSimulator(graph, wideDt());
    sim.start();
    for (let i = 0; i < 20; i++) sim.tick(100); // 2 seconds
    const stats = sim.getStats();
    expect(stats.queues.get('B')!.size).toBe(3);
    expect(stats.queues.get('B')!.droppedCount).toBeGreaterThan(50);
  });
});

// ─── Perf smoke test ───────────────────────────────────────────────────────

describe('Perf: 100 nodes / ~200 links / 100 ticks', () => {
  test('100 ticks of a 100-node graph stay under 500 ms', () => {
    const nodes: GraphInput['nodes'] = [];
    const links: GraphInput['links'] = [];

    // 10 generators
    for (let i = 0; i < 10; i++) {
      nodes.push({ id: `N${i}`, nodeRole: 'generator', particleGeneration: 5 });
    }
    // 80 relays
    for (let i = 10; i < 90; i++) {
      nodes.push({ id: `N${i}`, nodeRole: 'relay', processing_time: 0 });
    }
    // 10 sinks
    for (let i = 90; i < 100; i++) {
      nodes.push({ id: `N${i}`, nodeRole: 'sink' });
    }
    // ~200 links — each non-sink fans out to 2 deterministic successors.
    for (let i = 0; i < 90; i++) {
      const t1 = (i + 1) % 100;
      const t2 = (i + 7) % 100;
      if (t1 !== i) links.push({ source: `N${i}`, target: `N${t1}`, particleSpeed: 6 });
      if (t2 !== i) links.push({ source: `N${i}`, target: `N${t2}`, particleSpeed: 6 });
    }

    const sim = new ParticleSimulator({ nodes, links }, { maxDtMs: 33 });
    sim.start();
    // Warm-up tick so JIT settles before measurement.
    sim.tick(16.67);

    const start = performance.now();
    for (let i = 0; i < 100; i++) sim.tick(16.67);
    const elapsed = performance.now() - start;

    // 5 ms per tick on average — comfortable margin for a 60 fps rAF loop.
    expect(elapsed).toBeLessThan(500);
    // Sanity: the simulator should have produced visible work.
    expect(sim.getStats().totalEmitted).toBeGreaterThan(0);
  });
});
