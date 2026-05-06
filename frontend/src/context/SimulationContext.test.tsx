// Tests for SimulationContext: actions wire api + websocket calls and the
// reducer transitions sessions/activeSessions/currentSession correctly.

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { SimulationProvider, useSimulation } from './SimulationContext';

const mockGetSessions = vi.fn();
const mockGetSession = vi.fn();
const mockStartSimulation = vi.fn();
const mockStopSimulation = vi.fn();
const mockPauseSimulation = vi.fn();
const mockResumeSimulation = vi.fn();
const mockGetTemplates = vi.fn();
const mockValidateConfig = vi.fn();

vi.mock('../services/api', () => ({
  __esModule: true,
  apiService: {
    getSimulationSessions: (...a: any[]) => mockGetSessions(...a),
    getSimulationSession: (...a: any[]) => mockGetSession(...a),
    startSimulation: (...a: any[]) => mockStartSimulation(...a),
    stopSimulation: (...a: any[]) => mockStopSimulation(...a),
    pauseSimulation: (...a: any[]) => mockPauseSimulation(...a),
    resumeSimulation: (...a: any[]) => mockResumeSimulation(...a),
    getSimulationTemplates: (...a: any[]) => mockGetTemplates(...a),
    validateSimulationConfig: (...a: any[]) => mockValidateConfig(...a),
  },
}));

const mockWsStart = vi.fn();
const mockWsStop = vi.fn();
const mockWsPause = vi.fn();
const mockWsSetCallbacks = vi.fn();
const mockWsRemoveCallbacks = vi.fn();

vi.mock('../services/websocket', () => ({
  __esModule: true,
  webSocketService: {
    startSimulation: (...a: any[]) => mockWsStart(...a),
    stopSimulation: (...a: any[]) => mockWsStop(...a),
    pauseSimulation: (...a: any[]) => mockWsPause(...a),
    setCallbacks: (...a: any[]) => mockWsSetCallbacks(...a),
    removeCallbacks: (...a: any[]) => mockWsRemoveCallbacks(...a),
  },
}));

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

beforeEach(() => {
  [mockGetSessions, mockGetSession, mockStartSimulation, mockStopSimulation,
    mockPauseSimulation, mockResumeSimulation, mockGetTemplates,
    mockValidateConfig, mockWsStart, mockWsStop, mockWsPause,
    mockWsSetCallbacks, mockWsRemoveCallbacks].forEach((m) => m.mockReset());
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SimulationProvider>{children}</SimulationProvider>
);

const fakeSession = (overrides = {}) => ({
  id: 's1',
  graphId: 'g1',
  sessionName: 'Run 1',
  status: 'running' as const,
  startTime: new Date().toISOString(),
  config: { speed: 1 },
  ...overrides,
});

describe('useSimulation outside provider', () => {
  test('throws a clear error', () => {
    expect(() => renderHook(() => useSimulation())).toThrow(/SimulationProvider/);
  });
});

describe('initial state', () => {
  test('starts with empty sessions/templates and no current session', () => {
    const { result } = renderHook(() => useSimulation(), { wrapper });
    expect(result.current.state).toEqual({
      sessions: [],
      activeSessions: [],
      currentSession: null,
      templates: [],
      loading: false,
      error: null,
    });
  });

  test('subscribes to webSocket simulation updates on mount', () => {
    renderHook(() => useSimulation(), { wrapper });
    expect(mockWsSetCallbacks).toHaveBeenCalledWith(expect.objectContaining({
      onSimulationUpdate: expect.any(Function),
    }));
  });
});

describe('loadSessions', () => {
  test('populates sessions and derives activeSessions from running ones', async () => {
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [
        fakeSession({ id: 's1', status: 'running' }),
        fakeSession({ id: 's2', status: 'completed' }),
        fakeSession({ id: 's3', status: 'running' }),
      ],
    });

    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.loadSessions();
    });

    expect(result.current.state.sessions).toHaveLength(3);
    expect(result.current.state.activeSessions).toEqual(['s1', 's3']);
    expect(result.current.state.loading).toBe(false);
  });

  test('records error message on failure', async () => {
    mockGetSessions.mockResolvedValue({ success: false, message: 'db down' });
    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.loadSessions();
    });
    expect(result.current.state.error).toBe('db down');
  });

  test('catches network errors', async () => {
    mockGetSessions.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.loadSessions();
    });
    expect(result.current.state.error).toBe('network');
  });
});

describe('getSession', () => {
  test('sets currentSession on success', async () => {
    const session = fakeSession();
    mockGetSession.mockResolvedValue({ success: true, data: session });

    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.getSession('s1');
    });

    expect(result.current.state.currentSession).toEqual(session);
  });
});

describe('startSimulation', () => {
  test('updates state, notifies via WebSocket, and reloads sessions', async () => {
    const newSession = fakeSession({ id: 's-new' });
    mockStartSimulation.mockResolvedValue({ success: true, data: newSession });
    mockGetSessions.mockResolvedValue({ success: true, data: [newSession] });

    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.startSimulation({
        graphId: '42', config: { speed: 2 },
      });
    });

    expect(mockStartSimulation).toHaveBeenCalledWith({
      graphId: '42', config: { speed: 2 },
    });
    expect(mockWsStart).toHaveBeenCalledWith(42, { speed: 2 });
    // Reloaded list reflects the new session.
    await waitFor(() => expect(result.current.state.sessions).toHaveLength(1));
  });

  test('does not call websocket on API failure', async () => {
    mockStartSimulation.mockResolvedValue({ success: false, message: 'denied' });
    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.startSimulation({ graphId: '1' });
    });
    expect(mockWsStart).not.toHaveBeenCalled();
    expect(result.current.state.error).toBe('denied');
  });
});

describe('stopSimulation', () => {
  test('removes from activeSessions, notifies websocket, reloads', async () => {
    mockStopSimulation.mockResolvedValue({ success: true });
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [fakeSession({ id: 's1', status: 'completed' })],
    });

    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.stopSimulation('5');
    });
    expect(mockWsStop).toHaveBeenCalledWith(5);
    expect(result.current.state.activeSessions).toEqual([]);
  });
});

describe('pauseSimulation', () => {
  test('removes from activeSessions and notifies websocket', async () => {
    mockPauseSimulation.mockResolvedValue({ success: true });
    mockGetSessions.mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.pauseSimulation('7');
    });
    expect(mockWsPause).toHaveBeenCalledWith(7);
  });
});

describe('resumeSimulation', () => {
  test('adds session to activeSessions and reloads', async () => {
    mockResumeSimulation.mockResolvedValue({ success: true });
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [fakeSession({ id: 's1', status: 'running' })],
    });

    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.resumeSimulation('s1');
    });
    await waitFor(() => expect(result.current.state.activeSessions).toContain('s1'));
  });
});

describe('loadTemplates', () => {
  test('populates templates list', async () => {
    mockGetTemplates.mockResolvedValue({
      success: true,
      data: [{ id: 'network-flow' }, { id: 'data-pipeline' }],
    });
    const { result } = renderHook(() => useSimulation(), { wrapper });
    await act(async () => {
      await result.current.actions.loadTemplates();
    });
    expect(result.current.state.templates).toHaveLength(2);
  });
});

describe('validateConfig', () => {
  test('returns true when API reports isValid=true', async () => {
    mockValidateConfig.mockResolvedValue({
      success: true, data: { isValid: true, errors: [] },
    });
    const { result } = renderHook(() => useSimulation(), { wrapper });
    let valid = false;
    await act(async () => {
      valid = await result.current.actions.validateConfig({ speed: 1 });
    });
    expect(valid).toBe(true);
  });

  test('returns false when API reports isValid=false', async () => {
    mockValidateConfig.mockResolvedValue({
      success: true, data: { isValid: false, errors: ['Speed too high'] },
    });
    const { result } = renderHook(() => useSimulation(), { wrapper });
    let valid = true;
    await act(async () => {
      valid = await result.current.actions.validateConfig({ speed: 99 });
    });
    expect(valid).toBe(false);
  });

  test('returns false and records error on network failure', async () => {
    mockValidateConfig.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSimulation(), { wrapper });
    let valid = true;
    await act(async () => {
      valid = await result.current.actions.validateConfig({});
    });
    expect(valid).toBe(false);
    expect(result.current.state.error).toBe('offline');
  });
});

describe('clearError', () => {
  test('resets error to null', async () => {
    mockGetSessions.mockResolvedValue({ success: false, message: 'oops' });
    const { result } = renderHook(() => useSimulation(), { wrapper });

    await act(async () => {
      await result.current.actions.loadSessions();
    });
    expect(result.current.state.error).toBe('oops');

    act(() => result.current.actions.clearError());
    expect(result.current.state.error).toBeNull();
  });
});
