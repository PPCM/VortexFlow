/**
 * Tests for the useParticleSimulator React hook.
 *
 * The hook wires a ParticleSimulator instance to React state + the rAF loop.
 * The simulator itself is heavily tested elsewhere — these tests focus on the
 * binding: lifecycle, stats surfacing, hasGenerators flag, and callback
 * forwarding.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useParticleSimulator } from './useParticleSimulator';

// Minimal stable rAF stub: each requestAnimationFrame call is queued, and
// we drain the queue manually via `flushFrames`. Keeps tests deterministic.
let frameCallbacks: Array<(t: number) => void> = [];
let simulatedTime = 0;

beforeEach(() => {
  frameCallbacks = [];
  simulatedTime = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    frameCallbacks.push(cb);
    return frameCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frameCallbacks[id - 1] = () => {};
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushFrames(count: number, dtPerFrame = 16.67) {
  for (let i = 0; i < count; i++) {
    simulatedTime += dtPerFrame;
    const cbs = frameCallbacks;
    frameCallbacks = [];
    for (const cb of cbs) cb(simulatedTime);
  }
}

const trivialGraph = () => ({
  nodes: [
    { id: 'A', nodeRole: 'generator' as const, particleGeneration: 100 },
    { id: 'B', nodeRole: 'sink' as const },
  ],
  links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
});

describe('useParticleSimulator', () => {
  test('returns null stats and hasGenerators=false on an empty graph', () => {
    const { result } = renderHook(() =>
      useParticleSimulator({
        graphData: { nodes: [], links: [] },
        isRunning: false,
      })
    );
    expect(result.current.stats).toBeNull();
    expect(result.current.hasGenerators).toBe(false);
  });

  test('detects generators in the graph', () => {
    const graphData = trivialGraph();
    const { result } = renderHook(() =>
      useParticleSimulator({
        graphData,
        isRunning: false,
      })
    );
    expect(result.current.hasGenerators).toBe(true);
  });

  test('detects absence of generators (only relays / sinks)', () => {
    const { result } = renderHook(() =>
      useParticleSimulator({
        graphData: {
          nodes: [
            { id: 'A', nodeRole: 'relay' },
            { id: 'B', nodeRole: 'sink' },
          ],
          links: [{ source: 'A', target: 'B', particleSpeed: 6 }],
        },
        isRunning: false,
      })
    );
    expect(result.current.hasGenerators).toBe(false);
  });

  test('does not run frames when isRunning is false', () => {
    const onReleased = vi.fn();
    const graphData = trivialGraph();
    renderHook(() =>
      useParticleSimulator({
        graphData,
        isRunning: false,
        onParticleReleased: onReleased,
      })
    );
    act(() => flushFrames(30));
    expect(onReleased).not.toHaveBeenCalled();
  });

  test('drives the simulator and fires onParticleReleased when isRunning', () => {
    const onReleased = vi.fn();
    const graphData = trivialGraph();
    renderHook(() =>
      useParticleSimulator({
        graphData,
        isRunning: true,
        onParticleReleased: onReleased,
      })
    );
    // particleGeneration=100/s → 1 every 10ms. ~60 frames of 16.67ms = 1000ms
    // simulated, but dt is clamped to 33ms by default per the simulator, so
    // we still expect at least a handful of emissions.
    act(() => flushFrames(120));
    expect(onReleased).toHaveBeenCalled();
    expect(onReleased.mock.calls[0][0]).toMatch(/^A->B/);
  });

  test('surfaces stats via React state after a tick', () => {
    // graphData must be referentially stable (documented contract). If we
    // pass `trivialGraph()` inline, each setStats-driven rerender would
    // construct a new object → infinite recreate loop.
    const graphData = trivialGraph();
    const { result } = renderHook(() =>
      useParticleSimulator({
        graphData,
        isRunning: true,
      })
    );
    act(() => flushFrames(60));
    expect(result.current.stats).not.toBeNull();
    expect(result.current.stats!.totalEmitted).toBeGreaterThan(0);
  });

  test('resets stats when isRunning flips from true to false to true', () => {
    const graphData = trivialGraph();
    const { result, rerender } = renderHook(
      (props: { isRunning: boolean }) =>
        useParticleSimulator({ graphData, isRunning: props.isRunning }),
      { initialProps: { isRunning: true } }
    );
    act(() => flushFrames(60));
    const firstRunEmitted = result.current.stats!.totalEmitted;
    expect(firstRunEmitted).toBeGreaterThan(0);

    rerender({ isRunning: false });
    // pause keeps state; resume calls start() which resets
    rerender({ isRunning: true });
    act(() => flushFrames(5));
    // After fresh start, totalEmitted should be less than (or equal to a
    // single tick's worth of) the previous run.
    expect(result.current.stats!.totalEmitted).toBeLessThan(firstRunEmitted);
  });

  test('disposes the simulator on unmount', () => {
    const onReleased = vi.fn();
    const graphData = trivialGraph();
    const { unmount } = renderHook(() =>
      useParticleSimulator({
        graphData,
        isRunning: true,
        onParticleReleased: onReleased,
      })
    );
    act(() => flushFrames(60));
    const callsBeforeUnmount = onReleased.mock.calls.length;
    expect(callsBeforeUnmount).toBeGreaterThan(0);

    unmount();
    act(() => flushFrames(60));
    // No more callbacks after unmount
    expect(onReleased.mock.calls.length).toBe(callsBeforeUnmount);
  });

  test('keeps the latest onParticleReleased callback without recreating the simulator', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const graphData = trivialGraph();
    const { rerender } = renderHook(
      (props: { cb: typeof cb1 }) =>
        useParticleSimulator({
          graphData,
          isRunning: true,
          onParticleReleased: props.cb,
        }),
      { initialProps: { cb: cb1 } }
    );
    act(() => flushFrames(30));
    expect(cb1).toHaveBeenCalled();
    const cb1Calls = cb1.mock.calls.length;

    rerender({ cb: cb2 });
    act(() => flushFrames(30));
    expect(cb2).toHaveBeenCalled();
    // cb1 should have stopped receiving calls after the swap
    expect(cb1.mock.calls.length).toBe(cb1Calls);
  });
});
