// Tests for GraphContext: graph CRUD actions, DOT validation/parsing,
// simulation start/stop/pause, selection toggling, filters.

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { GraphProvider, useGraph } from './GraphContext';

const mockGetGraphs = jest.fn();
const mockGetGraph = jest.fn();
const mockCreateGraph = jest.fn();
const mockUpdateGraphApi = jest.fn();
const mockDeleteGraph = jest.fn();
const mockDuplicateGraph = jest.fn();
const mockValidateDot = jest.fn();
const mockParseDot = jest.fn();
const mockStartSim = jest.fn();
const mockStopSim = jest.fn();
const mockPauseSim = jest.fn();
const mockHandleApiError = jest.fn((..._args: any[]) => 'mapped');

jest.mock('../services/api', () => ({
  __esModule: true,
  apiService: {
    getGraphs: (...a: any[]) => mockGetGraphs(...a),
    getGraph: (...a: any[]) => mockGetGraph(...a),
    createGraph: (...a: any[]) => mockCreateGraph(...a),
    updateGraph: (...a: any[]) => mockUpdateGraphApi(...a),
    deleteGraph: (...a: any[]) => mockDeleteGraph(...a),
    duplicateGraph: (...a: any[]) => mockDuplicateGraph(...a),
    validateDot: (...a: any[]) => mockValidateDot(...a),
    parseDot: (...a: any[]) => mockParseDot(...a),
    startSimulation: (...a: any[]) => mockStartSim(...a),
    stopSimulation: (...a: any[]) => mockStopSim(...a),
    pauseSimulation: (...a: any[]) => mockPauseSim(...a),
    handleApiError: (...a: any[]) => mockHandleApiError(...a),
  },
}));

const mockWsUpdateGraph = jest.fn();
const mockWsStartSim = jest.fn();
const mockWsStopSim = jest.fn();
const mockWsPauseSim = jest.fn();

jest.mock('../services/websocket', () => ({
  __esModule: true,
  webSocketService: {
    updateGraph: (...a: any[]) => mockWsUpdateGraph(...a),
    startSimulation: (...a: any[]) => mockWsStartSim(...a),
    stopSimulation: (...a: any[]) => mockWsStopSim(...a),
    pauseSimulation: (...a: any[]) => mockWsPauseSim(...a),
  },
}));

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

beforeEach(() => {
  [
    mockGetGraphs, mockGetGraph, mockCreateGraph, mockUpdateGraphApi,
    mockDeleteGraph, mockDuplicateGraph, mockValidateDot, mockParseDot,
    mockStartSim, mockStopSim, mockPauseSim,
    mockWsUpdateGraph, mockWsStartSim, mockWsStopSim, mockWsPauseSim,
  ].forEach((m) => m.mockReset());
  mockHandleApiError.mockClear().mockImplementation((..._args: any[]) => 'mapped');
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GraphProvider>{children}</GraphProvider>
);

const fakeGraph = (overrides = {}) => ({
  id: 1, title: 'G', description: 'd', is_public: false, dot_code: 'digraph G { A -> B }',
  ...overrides,
} as any);

// ----------------------------------------------------------------------------
// Hook outside provider
// ----------------------------------------------------------------------------
describe('useGraph outside provider', () => {
  test('throws a clear error', () => {
    expect(() => renderHook(() => useGraph())).toThrow(/GraphProvider/);
  });
});

// ----------------------------------------------------------------------------
// loadGraphs
// ----------------------------------------------------------------------------
describe('loadGraphs', () => {
  test('populates state.graphs and stores filters when provided', async () => {
    mockGetGraphs.mockResolvedValue({
      success: true, data: { data: [fakeGraph()] },
    });
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => {
      await result.current.loadGraphs({ page: 2 } as any);
    });
    expect(result.current.state.graphs).toHaveLength(1);
    expect(result.current.state.filters).toEqual({ page: 2 });
  });

  test('records backend error message on failure', async () => {
    mockGetGraphs.mockResolvedValue({ success: false, message: 'forbidden' });
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => {
      await result.current.loadGraphs();
    });
    expect(result.current.state.error).toBe('forbidden');
  });

  test('catches network errors via handleApiError', async () => {
    mockGetGraphs.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => {
      await result.current.loadGraphs();
    });
    expect(mockHandleApiError).toHaveBeenCalled();
    expect(result.current.state.error).toBe('mapped');
  });
});

// ----------------------------------------------------------------------------
// loadGraph
// ----------------------------------------------------------------------------
describe('loadGraph', () => {
  test('sets currentGraph and graphData on success', async () => {
    const g = fakeGraph();
    (g as any).data = { nodes: [], edges: [] };
    mockGetGraph.mockResolvedValue({ success: true, data: g });
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => {
      await result.current.loadGraph(1);
    });
    expect(result.current.state.currentGraph).toBe(g);
    expect(result.current.state.graphData).toEqual({ nodes: [], edges: [] });
  });
});

// ----------------------------------------------------------------------------
// createGraph
// ----------------------------------------------------------------------------
describe('createGraph', () => {
  test('returns true and reloads graph list on success', async () => {
    const g = fakeGraph({ id: 7 });
    mockCreateGraph.mockResolvedValue({ success: true, data: g });
    mockGetGraphs.mockResolvedValue({ success: true, data: { data: [g] } });

    const { result } = renderHook(() => useGraph(), { wrapper });
    let outcome = false;
    await act(async () => {
      outcome = await result.current.createGraph({ title: 'X' } as any);
    });
    expect(outcome).toBe(true);
    expect(result.current.state.currentGraph).toBe(g);
    expect(mockGetGraphs).toHaveBeenCalled();
  });

  test('returns false on failure', async () => {
    mockCreateGraph.mockResolvedValue({ success: false, message: 'bad title' });
    const { result } = renderHook(() => useGraph(), { wrapper });
    let outcome = true;
    await act(async () => {
      outcome = await result.current.createGraph({ title: '' } as any);
    });
    expect(outcome).toBe(false);
    expect(result.current.state.error).toBe('bad title');
  });
});

// ----------------------------------------------------------------------------
// updateGraph
// ----------------------------------------------------------------------------
describe('updateGraph', () => {
  test('returns true and notifies WebSocket on success', async () => {
    const g = fakeGraph();
    mockUpdateGraphApi.mockResolvedValue({ success: true, data: g });

    const { result } = renderHook(() => useGraph(), { wrapper });
    let outcome = false;
    await act(async () => {
      outcome = await result.current.updateGraph(1, { title: 'New' } as any);
    });
    expect(outcome).toBe(true);
    expect(mockWsUpdateGraph).toHaveBeenCalledWith(1, { title: 'New' });
    expect(result.current.state.currentGraph).toBe(g);
  });

  test('returns false on failure and skips WebSocket notification', async () => {
    mockUpdateGraphApi.mockResolvedValue({ success: false, message: 'denied' });
    const { result } = renderHook(() => useGraph(), { wrapper });
    let outcome = true;
    await act(async () => {
      outcome = await result.current.updateGraph(1, { title: 'New' } as any);
    });
    expect(outcome).toBe(false);
    expect(mockWsUpdateGraph).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// saveGraph (dispatches to update or create)
// ----------------------------------------------------------------------------
describe('saveGraph', () => {
  test('routes to updateGraph when payload has an id', async () => {
    mockUpdateGraphApi.mockResolvedValue({ success: true, data: fakeGraph() });
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => {
      await result.current.saveGraph({ id: 3, title: 'X' } as any);
    });
    expect(mockUpdateGraphApi).toHaveBeenCalledWith(3, expect.objectContaining({ id: 3 }));
    expect(mockCreateGraph).not.toHaveBeenCalled();
  });

  test('routes to createGraph when payload has no id', async () => {
    mockCreateGraph.mockResolvedValue({ success: true, data: fakeGraph() });
    mockGetGraphs.mockResolvedValue({ success: true, data: { data: [] } });
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => {
      await result.current.saveGraph({ title: 'X' } as any);
    });
    expect(mockCreateGraph).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// deleteGraph
// ----------------------------------------------------------------------------
describe('deleteGraph', () => {
  test('returns true, reloads list, and clears currentGraph if it was the deleted one', async () => {
    mockDeleteGraph.mockResolvedValue({ success: true });
    mockGetGraphs.mockResolvedValue({ success: true, data: { data: [] } });
    const g = fakeGraph();
    mockGetGraph.mockResolvedValue({ success: true, data: g });

    const { result } = renderHook(() => useGraph(), { wrapper });
    // Load it as current first.
    await act(async () => { await result.current.loadGraph(1); });
    expect(result.current.state.currentGraph).toBe(g);

    let outcome = false;
    await act(async () => {
      outcome = await result.current.deleteGraph(1);
    });
    expect(outcome).toBe(true);
    expect(result.current.state.currentGraph).toBeNull();
    expect(result.current.state.graphData).toBeNull();
  });

  test('keeps currentGraph if a different graph was deleted', async () => {
    mockDeleteGraph.mockResolvedValue({ success: true });
    mockGetGraphs.mockResolvedValue({ success: true, data: { data: [] } });
    const g = fakeGraph({ id: 5 });
    mockGetGraph.mockResolvedValue({ success: true, data: g });

    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => { await result.current.loadGraph(5); });

    await act(async () => { await result.current.deleteGraph(99); });
    expect(result.current.state.currentGraph).toBe(g);
  });
});

// ----------------------------------------------------------------------------
// duplicateGraph
// ----------------------------------------------------------------------------
describe('duplicateGraph', () => {
  test('returns true on success and reloads list', async () => {
    mockDuplicateGraph.mockResolvedValue({ success: true, data: fakeGraph() });
    mockGetGraphs.mockResolvedValue({ success: true, data: { data: [] } });
    const { result } = renderHook(() => useGraph(), { wrapper });
    let outcome = false;
    await act(async () => {
      outcome = await result.current.duplicateGraph(1, 'Copy');
    });
    expect(outcome).toBe(true);
    expect(mockDuplicateGraph).toHaveBeenCalledWith(1, 'Copy');
  });
});

// ----------------------------------------------------------------------------
// DOT validation/parsing
// ----------------------------------------------------------------------------
describe('validateDot / parseDot', () => {
  test('validateDot returns the response data block', async () => {
    mockValidateDot.mockResolvedValue({ data: { isValid: true, errors: [] } });
    const { result } = renderHook(() => useGraph(), { wrapper });
    let r: any;
    await act(async () => {
      r = await result.current.validateDot('digraph G { A -> B }');
    });
    expect(r).toEqual({ isValid: true, errors: [] });
  });

  test('parseDot updates graphData on success', async () => {
    mockParseDot.mockResolvedValue({
      success: true, data: { nodes: [{ id: 'A' }], edges: [] },
    });
    const { result } = renderHook(() => useGraph(), { wrapper });
    let r: any;
    await act(async () => {
      r = await result.current.parseDot('digraph G { A -> B }');
    });
    expect(r).toEqual({ nodes: [{ id: 'A' }], edges: [] });
    expect(result.current.state.graphData).toEqual({ nodes: [{ id: 'A' }], edges: [] });
  });

  test('parseDot returns null and records error on failure', async () => {
    mockParseDot.mockResolvedValue({ success: false, message: 'bad DOT' });
    const { result } = renderHook(() => useGraph(), { wrapper });
    let r: any = 'not-null';
    await act(async () => {
      r = await result.current.parseDot('not DOT');
    });
    expect(r).toBeNull();
    expect(result.current.state.error).toBe('bad DOT');
  });
});

// ----------------------------------------------------------------------------
// Simulation actions (require currentGraph)
// ----------------------------------------------------------------------------
describe('startSimulation', () => {
  test('no-ops without a currentGraph', async () => {
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => {
      await result.current.startSimulation({ speed: 1 } as any);
    });
    expect(mockStartSim).not.toHaveBeenCalled();
  });

  // The simulation runs entirely client-side now (no backend session, no
  // WebSocket dispatch). The context only mirrors the on/off state.
  test('initialises simulation state with isRunning=true', async () => {
    const g = fakeGraph();
    mockGetGraph.mockResolvedValue({ success: true, data: g });

    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => { await result.current.loadGraph(1); });
    await act(async () => {
      await result.current.startSimulation({ speed: 2 } as any);
    });

    expect(mockStartSim).not.toHaveBeenCalled();
    expect(mockWsStartSim).not.toHaveBeenCalled();
    expect(result.current.simulationState).toEqual(expect.objectContaining({
      config: expect.objectContaining({ speed: 2, isRunning: true, isPaused: false }),
      particles: [],
    }));
  });
});

describe('stopSimulation / pauseSimulation', () => {
  test('stop clears the simulation state without backend calls', async () => {
    const g = fakeGraph();
    mockGetGraph.mockResolvedValue({ success: true, data: g });

    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => { await result.current.loadGraph(1); });
    await act(async () => { await result.current.startSimulation({ speed: 1 } as any); });
    await act(async () => { await result.current.stopSimulation(); });

    expect(mockStopSim).not.toHaveBeenCalled();
    expect(mockWsStopSim).not.toHaveBeenCalled();
    expect(result.current.simulationState).toBeNull();
  });

  test('pause toggles isPaused on the local config', async () => {
    const g = fakeGraph();
    mockGetGraph.mockResolvedValue({ success: true, data: g });

    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => { await result.current.loadGraph(1); });
    await act(async () => { await result.current.startSimulation({ speed: 1 } as any); });
    await act(async () => { await result.current.pauseSimulation(); });

    expect(mockPauseSim).not.toHaveBeenCalled();
    expect(mockWsPauseSim).not.toHaveBeenCalled();
    expect(result.current.simulationState?.config.isPaused).toBe(true);
  });
});

describe('updateSimulationConfig', () => {
  test('merges new config into the simulation state', async () => {
    const g = fakeGraph();
    mockGetGraph.mockResolvedValue({ success: true, data: g });

    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => { await result.current.loadGraph(1); });
    await act(async () => { await result.current.startSimulation({ speed: 1 } as any); });

    await act(async () => {
      await result.current.updateSimulationConfig({ speed: 5 } as any);
    });
    expect(result.current.simulationState?.config).toEqual(
      expect.objectContaining({ speed: 5, isRunning: true }),
    );
  });
});

// ----------------------------------------------------------------------------
// Selection helpers + filters + clearError
// ----------------------------------------------------------------------------
describe('selection helpers', () => {
  test('selectNode toggles', () => {
    const { result } = renderHook(() => useGraph(), { wrapper });
    act(() => result.current.selectNode('A'));
    expect(result.current.state.selectedNodes).toEqual(['A']);
    act(() => result.current.selectNode('A'));
    expect(result.current.state.selectedNodes).toEqual([]);
  });

  test('selectEdge toggles independently of nodes', () => {
    const { result } = renderHook(() => useGraph(), { wrapper });
    act(() => result.current.selectEdge('A->B'));
    expect(result.current.state.selectedEdges).toEqual(['A->B']);
    act(() => result.current.selectEdge('A->B'));
    expect(result.current.state.selectedEdges).toEqual([]);
  });

  test('clearSelection wipes both selections', () => {
    const { result } = renderHook(() => useGraph(), { wrapper });
    act(() => {
      result.current.selectNode('A');
      result.current.selectEdge('A->B');
    });
    act(() => result.current.clearSelection());
    expect(result.current.state.selectedNodes).toEqual([]);
    expect(result.current.state.selectedEdges).toEqual([]);
  });
});

describe('setFilters / clearError', () => {
  test('setFilters stores the new filter object', () => {
    const { result } = renderHook(() => useGraph(), { wrapper });
    act(() => result.current.setFilters({ category: 'demo' } as any));
    expect(result.current.state.filters).toEqual({ category: 'demo' });
  });

  test('clearError resets error to null', async () => {
    mockGetGraphs.mockResolvedValue({ success: false, message: 'oops' });
    const { result } = renderHook(() => useGraph(), { wrapper });
    await act(async () => { await result.current.loadGraphs(); });
    expect(result.current.state.error).toBe('oops');
    act(() => result.current.clearError());
    expect(result.current.state.error).toBeNull();
  });
});
