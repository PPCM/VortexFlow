/**
 * API-surface test for the Particle Simulator (Phase 2).
 *
 * Until Phase 3 lands the implementation, the simulator's public mutators
 * intentionally throw `NotImplementedError`. These tests lock the public API
 * (class name, method signatures, exported types) and verify the stub
 * behaviour — they'll be replaced/extended by real behavioural tests when
 * Phase 3 ships.
 */

import { describe, test, expect } from 'vitest';
import {
  ParticleSimulator,
  NotImplementedError,
  type GraphInput,
  type NodeRole,
  type DropPolicy,
} from './particleSimulator';

const trivialGraph: GraphInput = {
  nodes: [
    { id: 'A', nodeRole: 'generator', particleGeneration: 1 },
    { id: 'B', nodeRole: 'sink' },
  ],
  links: [{ source: 'A', target: 'B', particleSpeed: 1 }],
};

describe('ParticleSimulator (Phase 2 stub)', () => {
  test('can be instantiated with a minimal graph', () => {
    const sim = new ParticleSimulator(trivialGraph);
    expect(sim).toBeInstanceOf(ParticleSimulator);
  });

  test('accepts SimulatorOptions including a custom random source', () => {
    const sim = new ParticleSimulator(trivialGraph, {
      maxDtMs: 50,
      random: () => 0.5,
      defaultGenerationPerSecond: 2,
      onParticleReleased: () => {
        /* noop */
      },
    });
    expect(sim).toBeInstanceOf(ParticleSimulator);
  });

  test.each([
    ['start', (s: ParticleSimulator) => s.start()],
    ['pause', (s: ParticleSimulator) => s.pause()],
    ['stop', (s: ParticleSimulator) => s.stop()],
    ['tick', (s: ParticleSimulator) => s.tick(16)],
    ['getStats', (s: ParticleSimulator) => s.getStats()],
    ['onTick', (s: ParticleSimulator) => s.onTick(() => {})],
    ['dispose', (s: ParticleSimulator) => s.dispose()],
  ] as const)('%s() throws NotImplementedError until Phase 3', (_name, invoke) => {
    const sim = new ParticleSimulator(trivialGraph);
    expect(() => invoke(sim)).toThrow(NotImplementedError);
  });

  test('NotImplementedError carries a useful message', () => {
    const sim = new ParticleSimulator(trivialGraph);
    expect(() => sim.start()).toThrow(/start.*not implemented yet.*Phase 3/);
  });
});

describe('exported types are usable', () => {
  // These are compile-time assertions — if the types are broken, the file
  // won't compile and Vitest will fail at collection time. The runtime
  // expectations are trivially true.
  test('NodeRole enum values', () => {
    const roles: NodeRole[] = ['generator', 'relay', 'sink'];
    expect(roles).toHaveLength(3);
  });

  test('DropPolicy enum values', () => {
    const policies: DropPolicy[] = ['tail', 'head', 'reject'];
    expect(policies).toHaveLength(3);
  });
});
