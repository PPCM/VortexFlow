import type { Mock } from 'vitest';
// Unit tests for the WebSocketService.
// socket.io-client is mocked; we drive the service directly and verify it
// forwards calls to the socket only when connected.

vi.mock('socket.io-client', () => {
  const socket = {
    id: 'sock-test',
    connected: true,
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    __esModule: true,
    io: vi.fn(() => socket),
    default: vi.fn(() => socket),
    Socket: function Socket() {},
  };
});

// Suppress the service's verbose console.log noise.
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

import { io } from 'socket.io-client';
import { webSocketService } from './websocket';

const mockSocket = (io as unknown as Mock).mock.results[0].value;

const setConnected = (v: boolean) => {
  // @ts-ignore — internal field, set so emit-guarded methods proceed
  webSocketService.isConnected = v;
};

beforeEach(() => {
  mockSocket.emit.mockClear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
});

describe('WebSocketService — connection', () => {
  test('constructor recovered a mocked socket (io factory ran at import time)', () => {
    // The fact that mockSocket exists means io() was called during module
    // construction. We don't assert against the io mock directly because the
    // single call happens before any test setup runs.
    expect(mockSocket).toBeTruthy();
    expect(mockSocket.id).toBe('sock-test');
  });
});

describe('WebSocketService — emit-guarded methods', () => {
  test('joinRoom emits join_room when connected', () => {
    setConnected(true);
    webSocketService.joinRoom('room-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('join_room', 'room-1');
  });

  test('joinRoom no-ops when disconnected', () => {
    setConnected(false);
    webSocketService.joinRoom('room-1');
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  test('leaveRoom emits leave_room when connected', () => {
    setConnected(true);
    webSocketService.leaveRoom('room-2');
    expect(mockSocket.emit).toHaveBeenCalledWith('leave_room', 'room-2');
  });

  test('startSimulation emits start_simulation with the payload', () => {
    setConnected(true);
    webSocketService.startSimulation(7, { speed: 2 });
    expect(mockSocket.emit).toHaveBeenCalledWith('start_simulation', {
      graphId: 7, config: { speed: 2 },
    });
  });

  test('stopSimulation emits stop_simulation', () => {
    setConnected(true);
    webSocketService.stopSimulation(7);
    expect(mockSocket.emit).toHaveBeenCalledWith('stop_simulation', { graphId: 7 });
  });

  test('pauseSimulation emits pause_simulation', () => {
    setConnected(true);
    webSocketService.pauseSimulation(7);
    expect(mockSocket.emit).toHaveBeenCalledWith('pause_simulation', { graphId: 7 });
  });

  test('updateSimulationConfig emits update_simulation_config', () => {
    setConnected(true);
    webSocketService.updateSimulationConfig(7, { speed: 3 });
    expect(mockSocket.emit).toHaveBeenCalledWith('update_simulation_config', {
      graphId: 7, config: { speed: 3 },
    });
  });

  test('updateGraph emits update_graph', () => {
    setConnected(true);
    webSocketService.updateGraph(7, { title: 'New' });
    expect(mockSocket.emit).toHaveBeenCalledWith('update_graph', {
      graphId: 7, changes: { title: 'New' },
    });
  });

  test('sendCursorPosition emits cursor_position', () => {
    setConnected(true);
    webSocketService.sendCursorPosition(1, { x: 10, y: 20 });
    expect(mockSocket.emit).toHaveBeenCalledWith('cursor_position', {
      graphId: 1, position: { x: 10, y: 20 },
    });
  });

  test('sendChatMessage emits chat_message', () => {
    setConnected(true);
    webSocketService.sendChatMessage('room-1', 'hello');
    expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', {
      roomId: 'room-1', message: 'hello',
    });
  });

  test('emit forwards to underlying socket only when connected', () => {
    setConnected(true);
    webSocketService.emit('foo', { bar: 1 });
    expect(mockSocket.emit).toHaveBeenCalledWith('foo', { bar: 1 });

    mockSocket.emit.mockClear();
    setConnected(false);
    webSocketService.emit('foo', { bar: 1 });
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});

describe('WebSocketService — utilities', () => {
  test('setCallbacks merges new callbacks into existing ones', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    webSocketService.setCallbacks({ onConnect: cb1 });
    webSocketService.setCallbacks({ onDisconnect: cb2 });
    // @ts-ignore — peek at private field
    expect(webSocketService.callbacks.onConnect).toBe(cb1);
    // @ts-ignore
    expect(webSocketService.callbacks.onDisconnect).toBe(cb2);
  });

  test('removeCallbacks empties the callback bag', () => {
    webSocketService.setCallbacks({ onConnect: vi.fn() });
    webSocketService.removeCallbacks();
    // @ts-ignore
    expect(webSocketService.callbacks).toEqual({});
  });

  test('isSocketConnected reflects connected state and socket.connected', () => {
    setConnected(true);
    mockSocket.connected = true;
    expect(webSocketService.isSocketConnected()).toBe(true);

    mockSocket.connected = false;
    expect(webSocketService.isSocketConnected()).toBe(false);
  });

  test('getSocketId returns the underlying socket id', () => {
    expect(webSocketService.getSocketId()).toBe('sock-test');
  });

  test('on/off forward to the underlying socket', () => {
    const cb = vi.fn();
    webSocketService.on('foo', cb);
    expect(mockSocket.on).toHaveBeenCalledWith('foo', cb);

    webSocketService.off('foo', cb);
    expect(mockSocket.off).toHaveBeenCalledWith('foo', cb);
  });
});
