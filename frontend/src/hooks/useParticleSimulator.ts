import { useEffect, useRef, useState } from 'react';

import {
  ParticleSimulator,
  type GraphInput,
  type LinkInput,
  type NodeInput,
  type SimulatorStats,
} from '../services/particleSimulator';

/**
 * Subset of the renderer's ForceGraphNode that the simulator cares about.
 * Kept structural (not imported from GraphRenderer3D) so the hook stays
 * self-contained and unit-testable without pulling Three.js.
 */
interface RendererGraphNode {
  id: string;
  nodeRole?: 'generator' | 'relay' | 'sink';
  particleGeneration?: number;
  maxParticleProcessing?: number;
  queue_size?: number;
  processing_time?: number;
  failure_rate?: number;
  dropPolicy?: 'tail' | 'head' | 'reject';
}

/**
 * Renderer link as exposed by 3d-force-graph: `source` and `target` are
 * either strings (before the engine resolves them) or node-object references
 * (after the first cooldown tick). Both are tolerated here.
 */
interface RendererGraphLink {
  source: string | { id: string };
  target: string | { id: string };
  particleSpeed?: number;
  maxParticleFlow?: number;
}

export interface UseParticleSimulatorOptions {
  /**
   * The parsed graph. **Must be referentially stable** — only swap the
   * reference when the topology (nodes / links / DES attributes) genuinely
   * changes. The simulator is recreated each time the reference changes.
   */
  graphData: { nodes: RendererGraphNode[]; links: RendererGraphLink[] };
  /** Drives `start()` / `pause()`. */
  isRunning: boolean;
  /**
   * Wired to `ParticleSimulator.options.onParticleReleased`. Use it to call
   * `forceGraphRef.current.emitParticle(link)` so the visual animation
   * matches each logical release. The latest reference is read on every
   * call — safe to pass a fresh closure each render.
   */
  onParticleReleased?: (linkId: string, particleId: string) => void;
}

export interface UseParticleSimulatorResult {
  /** Latest stats snapshot, or null before the first tick / after dispose. */
  stats: SimulatorStats | null;
  /** True when at least one node has `nodeRole === 'generator'`. */
  hasGenerators: boolean;
}

function toGraphInput(data: UseParticleSimulatorOptions['graphData']): GraphInput {
  const nodes: NodeInput[] = data.nodes.map((n) => ({
    id: n.id,
    nodeRole: n.nodeRole,
    particleGeneration: n.particleGeneration,
    maxParticleProcessing: n.maxParticleProcessing,
    queue_size: n.queue_size,
    processing_time: n.processing_time,
    failure_rate: n.failure_rate,
    dropPolicy: n.dropPolicy,
  }));
  const links: LinkInput[] = data.links.map((l) => ({
    source: typeof l.source === 'string' ? l.source : l.source.id,
    target: typeof l.target === 'string' ? l.target : l.target.id,
    particleSpeed: l.particleSpeed,
    maxParticleFlow: l.maxParticleFlow,
  }));
  return { nodes, links };
}

/**
 * React binding for `ParticleSimulator`. Owns the simulator instance,
 * drives it via `requestAnimationFrame`, surfaces stats as React state,
 * and forwards `onParticleReleased` to the visual emitter.
 *
 * Integration contract for the renderer (Phase 4):
 *   const { stats, hasGenerators } = useParticleSimulator({
 *     graphData: currentGraphData,
 *     isRunning: simulationRunning,
 *     onParticleReleased: (linkId) => forceGraphRef.current?.emitParticle(link),
 *   });
 */
export function useParticleSimulator({
  graphData,
  isRunning,
  onParticleReleased,
}: UseParticleSimulatorOptions): UseParticleSimulatorResult {
  const simulatorRef = useRef<ParticleSimulator | null>(null);
  const onReleasedRef = useRef(onParticleReleased);
  const [stats, setStats] = useState<SimulatorStats | null>(null);

  // Keep the callback ref fresh without recreating the simulator.
  useEffect(() => {
    onReleasedRef.current = onParticleReleased;
  }, [onParticleReleased]);

  // (Re)create the simulator whenever the graphData reference changes.
  useEffect(() => {
    if (!graphData.nodes.length) return undefined;

    const sim = new ParticleSimulator(toGraphInput(graphData), {
      onParticleReleased: (linkId, particleId) => {
        onReleasedRef.current?.(linkId, particleId);
      },
    });
    simulatorRef.current = sim;
    const unsubscribe = sim.onTick((snapshot) => {
      setStats(snapshot);
    });

    return () => {
      unsubscribe();
      sim.dispose();
      simulatorRef.current = null;
      setStats(null);
    };
  }, [graphData]);

  // Drive the rAF loop based on isRunning + simulator availability.
  useEffect(() => {
    const sim = simulatorRef.current;
    if (!sim) return undefined;
    if (!isRunning) {
      sim.pause();
      return undefined;
    }
    sim.start();
    let lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let rafId = 0;
    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      sim.tick(dt);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      // Intentionally do NOT call sim.pause() here. When graphData changes,
      // the create-effect's cleanup (which ran first because of effect-order)
      // has already disposed this simulator instance, so calling pause()
      // would throw. The rAF cancel above is enough to stop the loop, and
      // the next mount of this effect will call start() or pause() again
      // depending on isRunning.
    };
  }, [isRunning, graphData]);

  const hasGenerators = graphData.nodes.some((n) => n.nodeRole === 'generator');

  return { stats, hasGenerators };
}
