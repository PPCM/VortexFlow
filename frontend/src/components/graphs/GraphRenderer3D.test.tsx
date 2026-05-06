// Tests for GraphRenderer3D — focused on the load-bearing UX rules listed
// in CLAUDE.md (auto-zoom, particles gated by simulationRunning,
// one-shot Émission particules, toolbar/panel sync). The 3d-force-graph
// instance and the DOT parser are mocked so we can assert what the
// component asks them to do without spinning up Three.js or the backend.

import type { Mock } from 'vitest';
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';

// ----------------------------------------------------------------------------
// 3d-force-graph mock: every method is a chainable spy that returns `this`,
// except getters like `cameraPosition()`, `scene()`, `graphData()` and
// `emitParticle()` which return canned data.
// ----------------------------------------------------------------------------
const fgState: {
  callbacks: Record<string, any>;
  cameraStack: Array<{ x: number; y: number; z: number }>;
  cameraCalls: any[][];
  zoomToFitCalls: any[][];
  emitParticleCalls: any[];
  destructorCalls: number;
  scene: { traverse: (fn: (obj: any) => void) => void };
  data: { nodes: any[]; links: any[] };
} = {
  callbacks: {},
  cameraStack: [{ x: 0, y: 0, z: 270 }],
  cameraCalls: [],
  zoomToFitCalls: [],
  emitParticleCalls: [],
  destructorCalls: 0,
  scene: { traverse: () => {} },
  data: { nodes: [], links: [] },
};

const makeFG = () => {
  const fg: any = {};
  const chain = (name: string) => (...args: any[]) => {
    if (typeof args[0] === 'function') {
      fgState.callbacks[name] = args[0];
    }
    return fg;
  };
  // Configuration setters that the renderer calls — all chainable.
  [
    'width', 'height', 'backgroundColor', 'graphData', 'nodeLabel', 'nodeVal',
    'nodeColor', 'nodeThreeObject', 'linkLabel', 'linkThreeObjectExtend',
    'linkThreeObject', 'linkPositionUpdate', 'linkColor', 'linkWidth',
    'linkCurvature', 'linkCurveRotation', 'linkDirectionalArrowLength',
    'linkDirectionalArrowRelPos', 'linkDirectionalArrowColor',
    'linkDirectionalArrowResolution', 'linkOpacity',
    'linkDirectionalParticles', 'linkDirectionalParticleSpeed',
    'linkDirectionalParticleColor', 'linkDirectionalParticleWidth',
    'showNavInfo', 'enableNodeDrag', 'enableNavigationControls',
    'cooldownTicks', 'onEngineStop',
  ].forEach((m) => { fg[m] = chain(m); });

  // Data accessors / live-instance helpers.
  fg.graphData = (data?: any) => {
    if (data) { fgState.data = data; return fg; }
    return fgState.data;
  };
  fg.scene = () => fgState.scene;
  fg.cameraPosition = (target?: any, _lookAt?: any, transitionMs?: number) => {
    if (target) {
      fgState.cameraCalls.push([target, _lookAt, transitionMs]);
      // Simulate the camera ending up at the requested position right away
      // (good enough for what the tests assert on).
      fgState.cameraStack.push({ ...target });
      return fg;
    }
    return fgState.cameraStack[fgState.cameraStack.length - 1];
  };
  fg.zoomToFit = (transitionMs: number, padding: number) => {
    fgState.zoomToFitCalls.push([transitionMs, padding]);
    // After a snap-fit the camera ends up at a smaller distance.
    fgState.cameraStack.push({ x: 0, y: 0, z: 96 });
    return fg;
  };
  fg.emitParticle = (link: any) => {
    fgState.emitParticleCalls.push(link);
  };
  fg.d3Force = () => null;
  fg.d3ReheatSimulation = () => fg;
  fg.nodeRelSize = chain('nodeRelSize');
  fg._destructor = () => { fgState.destructorCalls += 1; };
  return fg;
};

vi.mock('3d-force-graph', () => ({
  default: () => () => makeFG(),
}));

// SpriteText wraps a small Three.js sprite — replace it with a plain object
// that has the surface the renderer touches.
vi.mock('three-spritetext', () => ({
  default: class {
    color = '';
    textHeight = 0;
    padding = 0;
    borderRadius = 0;
    backgroundColor = '';
    renderOrder = 0;
    material: any = { depthTest: true, depthWrite: false, transparent: true, alphaTest: 0 };
    position: any = { x: 0, y: 0, z: 0 };
    constructor(public text: string) {}
  },
}));

// jsdom doesn't ship ResizeObserver — give it a stub that never fires.
(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import GraphRenderer3D from './GraphRenderer3D';

const DOT = 'digraph G { A -> B; B -> C; A -> C; }';

// DotTo3DConverter goes through `fetch` to the backend's /parse-dot endpoint.
// Stub the global fetch so that path returns a deterministic graph.
const SAMPLE_PARSE = {
  nodes: [
    { id: 'A', name: 'A', particleGeneration: 5, maxParticleProcessing: 3 },
    { id: 'B', name: 'B' },
    { id: 'C', name: 'C' },
  ],
  links: [
    { source: 'A', target: 'B', name: 'a-b' },
    { source: 'B', target: 'C', name: 'b-c' },
    { source: 'A', target: 'C', name: 'a-c' },
  ],
};

beforeEach(() => {
  fgState.callbacks = {};
  fgState.cameraStack = [{ x: 0, y: 0, z: 270 }];
  fgState.cameraCalls = [];
  fgState.zoomToFitCalls = [];
  fgState.emitParticleCalls = [];
  fgState.destructorCalls = 0;
  fgState.data = { nodes: [], links: [] };
  fgState.scene = { traverse: () => {} };

  // The renderer's parser reads `nodes` and `links` straight off the response
  // body, so we don't need the success/data envelope here.
  (globalThis as any).fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => SAMPLE_PARSE,
  });
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

// Helper: drive React past the renderer's setTimeout(300ms) init step plus
// the cameraPosition animation duration (1000ms). Real timers are used so
// the chained setTimeouts inside one-shot trace also work.
const advancePastInit = () => waitFor(
  () => expect(fgState.zoomToFitCalls.length).toBeGreaterThan(0),
  { timeout: 2000 },
);

// ----------------------------------------------------------------------------
// Auto-zoom on open
// ----------------------------------------------------------------------------
describe('GraphRenderer3D — auto-zoom on open', () => {
  test('snap-fits, then animates the camera to half the fitted distance', async () => {
    render(<GraphRenderer3D dotContent={DOT} isValid />);
    await advancePastInit();

    // The trick: zoomToFit(0, padding) snaps without animating, then
    // cameraPosition(start, _, 0) restores the original view, and a final
    // cameraPosition(target, _, 1000) animates from there to half-distance.
    const [snapMs, snapPad] = fgState.zoomToFitCalls[0];
    expect(snapMs).toBe(0);
    expect(snapPad).toBeGreaterThanOrEqual(40);

    // We expect at least two cameraPosition writes: a restore-to-start with
    // duration 0, and an animated move with duration 1000.
    const animated = fgState.cameraCalls.filter(([, , ms]) => ms === 1000);
    const instant = fgState.cameraCalls.filter(([, , ms]) => ms === 0);
    expect(instant.length).toBeGreaterThanOrEqual(1);
    expect(animated.length).toBe(1);

    // The animated target's distance from origin should be half of the
    // post-fit distance (96 in the mock → 48).
    const target = animated[0][0];
    const dist = Math.hypot(target.x, target.y, target.z);
    expect(dist).toBeGreaterThan(40);
    expect(dist).toBeLessThan(60);
  });
});

// ----------------------------------------------------------------------------
// Particles gated by simulation state
// ----------------------------------------------------------------------------
describe('GraphRenderer3D — particles gated by simulationRunning', () => {
  test('linkDirectionalParticles returns 0 when the simulation is not running', async () => {
    render(<GraphRenderer3D dotContent={DOT} isValid isSimulationRunning={false} />);
    await advancePastInit();
    const cb = fgState.callbacks.linkDirectionalParticles;
    expect(cb({ name: 'a-b' })).toBe(0);
  });

  test('linkDirectionalParticles emits >0 once the simulation is running', async () => {
    const { rerender } = render(<GraphRenderer3D dotContent={DOT} isValid isSimulationRunning={false} />);
    await advancePastInit();

    rerender(<GraphRenderer3D dotContent={DOT} isValid isSimulationRunning />);
    // After the prop flips, updateParticleProperties re-runs — wait for the
    // callback to be reinstalled with the new behaviour.
    await waitFor(() => {
      expect(fgState.callbacks.linkDirectionalParticles({ name: 'a-b' })).toBeGreaterThan(0);
    });
  });
});

// ----------------------------------------------------------------------------
// Émission particules: one-shot trace
// ----------------------------------------------------------------------------
describe('GraphRenderer3D — Émission particules (one-shot trace)', () => {
  test('clicking the button emits a single particle from each emitter outgoing link', async () => {
    render(<GraphRenderer3D dotContent={DOT} isValid />);
    await advancePastInit();

    // The trace button lives in the left rail as an aria-labelled IconButton.
    const btn = screen.getByLabelText(/Émission particules/i);

    // Sample DOT has only `A` with particleGeneration → A is the lone
    // emitter. A's outgoing edges are A→B and A→C, so the immediate burst
    // is 2 particles. Cascading onto B re-emits along B→C — that arrival
    // happens on a setTimeout; we only assert the synchronous count to keep
    // the test deterministic.
    fgState.emitParticleCalls.length = 0;
    act(() => { fireEvent.click(btn); });
    expect(fgState.emitParticleCalls.length).toBe(2);
  });
});

// ----------------------------------------------------------------------------
// Toolbar / panel sync
// ----------------------------------------------------------------------------
describe('GraphRenderer3D — Start Simulation button delegates to onToggleSimulation', () => {
  test('clicking Start Simulation in the rail calls the parent toggle', async () => {
    const onToggle = vi.fn();
    render(
      <GraphRenderer3D
        dotContent={DOT}
        isValid
        isSimulationRunning={false}
        onToggleSimulation={onToggle}
      />,
    );
    await advancePastInit();

    const btn = screen.getByLabelText(/Start Simulation/i);
    fireEvent.click(btn);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('falls back to a local toggle if no parent callback is provided', async () => {
    render(<GraphRenderer3D dotContent={DOT} isValid isSimulationRunning={false} />);
    await advancePastInit();

    const btn = screen.getByLabelText(/Start Simulation/i);
    fireEvent.click(btn);
    // Local fallback flips the flag → label should switch to "Pause Simulation".
    await screen.findByLabelText(/Pause Simulation/i);
  });
});

// ----------------------------------------------------------------------------
// Cleanup
// ----------------------------------------------------------------------------
describe('GraphRenderer3D — cleanup on unmount', () => {
  test('calls _destructor on the force-graph instance', async () => {
    const { unmount } = render(<GraphRenderer3D dotContent={DOT} isValid />);
    await advancePastInit();
    unmount();
    expect(fgState.destructorCalls).toBeGreaterThanOrEqual(1);
  });
});
