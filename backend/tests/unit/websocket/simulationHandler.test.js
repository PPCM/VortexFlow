// Unit tests for the SimulationHandler WebSocket coordinator.
//
// We mock Socket.IO and the Sequelize models, then drive the handler's
// public methods directly. SimulationEngine internals (DOT parsing, physics)
// are out of scope — handler tests only verify routing, room management,
// and DB session state transitions.

const mockSessionFindOne = jest.fn();

jest.mock('../../../src/models', () => ({
  SimulationSession: { findOne: (...a) => mockSessionFindOne(...a) },
  Graph: {},
  User: {},
  GraphVersion: {},
  GraphShare: {},
}));

const SimulationHandler = require('../../../src/websocket/simulationHandler');

const makeIo = () => {
  // Minimal Socket.IO server stub: tracks `on('connection', cb)` listeners
  // and `to(room).emit(event, payload)`.
  const ioEmits = [];
  const adapter = { rooms: new Map() };
  const io = {
    _connectionListeners: [],
    on: jest.fn((event, cb) => {
      if (event === 'connection') io._connectionListeners.push(cb);
    }),
    to: jest.fn((room) => ({
      emit: (event, payload) => ioEmits.push({ room, event, payload }),
    })),
    emits: ioEmits,
    sockets: { adapter },
  };
  return { io, adapter };
};

const makeSocket = () => {
  const socket = {
    id: 'sock-1',
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
  };
  return socket;
};

beforeEach(() => {
  mockSessionFindOne.mockReset();
});

// ----------------------------------------------------------------------------
// constructor wires socket events
// ----------------------------------------------------------------------------
describe('constructor', () => {
  test('subscribes to the io "connection" event', () => {
    const { io } = makeIo();
    new SimulationHandler(io);
    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  test('on connection, registers handlers for the simulation lifecycle events', () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    expect(handler.activeSessions).toBeInstanceOf(Map);

    const socket = makeSocket();
    // Fire the connection listener with a fake socket and verify the events
    // it subscribes to.
    io._connectionListeners[0](socket);
    const listenedEvents = socket.on.mock.calls.map((c) => c[0]);
    expect(listenedEvents).toEqual(expect.arrayContaining([
      'join-simulation',
      'leave-simulation',
      'start-simulation',
      'stop-simulation',
      'pause-simulation',
      'resume-simulation',
      'update-simulation-config',
      'disconnect',
    ]));
  });
});

// ----------------------------------------------------------------------------
// handleJoinSimulation
// ----------------------------------------------------------------------------
describe('handleJoinSimulation', () => {
  test('throws when the session is not found for this user', async () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    mockSessionFindOne.mockResolvedValue(null);

    await expect(
      handler.handleJoinSimulation(makeSocket(), { sessionId: 's1', userId: 'u1' }),
    ).rejects.toThrow(/not found/i);
  });

  test('joins the room and emits the current session+graph payload', async () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    mockSessionFindOne.mockResolvedValue({
      id: 's1',
      session_name: 'Run 1',
      status: 'running',
      config: { speed: 1 },
      start_time: new Date('2026-05-05T10:00:00Z'),
      graph: {
        id: 'g1', title: 'My Graph', dot_code: 'digraph G { A -> B }',
      },
    });
    const socket = makeSocket();

    await handler.handleJoinSimulation(socket, { sessionId: 's1', userId: 'u1' });

    expect(socket.join).toHaveBeenCalledWith('simulation-s1');
    expect(socket.sessionId).toBe('s1');
    expect(socket.userId).toBe('u1');
    expect(socket.emit).toHaveBeenCalledWith('simulation-joined', expect.objectContaining({
      session: expect.objectContaining({ id: 's1', sessionName: 'Run 1' }),
      graph: expect.objectContaining({ id: 'g1', title: 'My Graph' }),
    }));
  });

  test('also forwards current simulation state when the session is active', async () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    handler.activeSessions.set('s1', {
      simulation: { getCurrentState: () => ({ frame: 42 }) },
    });
    mockSessionFindOne.mockResolvedValue({
      id: 's1', session_name: 'r', status: 'running', config: {},
      start_time: new Date(), graph: { id: 'g1', title: 't', dot_code: 'd' },
    });
    const socket = makeSocket();

    await handler.handleJoinSimulation(socket, { sessionId: 's1', userId: 'u1' });

    const events = socket.emit.mock.calls.map((c) => c[0]);
    expect(events).toEqual(expect.arrayContaining([
      'simulation-joined',
      'simulation-state',
    ]));
  });
});

// ----------------------------------------------------------------------------
// handleLeaveSimulation
// ----------------------------------------------------------------------------
describe('handleLeaveSimulation', () => {
  test('leaves the room and emits simulation-left', async () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    const socket = makeSocket();

    await handler.handleLeaveSimulation(socket, { sessionId: 's1' });

    expect(socket.leave).toHaveBeenCalledWith('simulation-s1');
    expect(socket.emit).toHaveBeenCalledWith('simulation-left', { sessionId: 's1' });
  });
});

// ----------------------------------------------------------------------------
// handleDisconnection
// ----------------------------------------------------------------------------
describe('handleDisconnection', () => {
  test('auto-pauses an active simulation when the room is empty', () => {
    const { io, adapter } = makeIo();
    const handler = new SimulationHandler(io);
    const pause = jest.fn();
    handler.activeSessions.set('s1', { simulation: { pause } });
    // Empty room → pause
    adapter.rooms.set('simulation-s1', new Set());

    const socket = makeSocket();
    socket.sessionId = 's1';
    socket.userId = 'u1';
    handler.handleDisconnection(socket);

    expect(pause).toHaveBeenCalled();
  });

  test('does not pause when other clients are still connected', () => {
    const { io, adapter } = makeIo();
    const handler = new SimulationHandler(io);
    const pause = jest.fn();
    handler.activeSessions.set('s1', { simulation: { pause } });
    adapter.rooms.set('simulation-s1', new Set(['other-sock']));

    const socket = makeSocket();
    socket.sessionId = 's1';
    handler.handleDisconnection(socket);

    expect(pause).not.toHaveBeenCalled();
  });

  test('no-op when the disconnecting socket was never tied to a session', () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    const socket = makeSocket();
    expect(() => handler.handleDisconnection(socket)).not.toThrow();
  });
});

// ----------------------------------------------------------------------------
// cleanup
// ----------------------------------------------------------------------------
describe('cleanup', () => {
  test('stops every active simulation and writes cancelled state to DB', async () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);

    const stop1 = jest.fn();
    const stop2 = jest.fn();
    const update1 = jest.fn().mockResolvedValue(undefined);
    const update2 = jest.fn().mockResolvedValue(undefined);

    handler.activeSessions.set('s1', {
      simulation: { stop: stop1 },
      session: { update: update1 },
      startTime: Date.now() - 5000,
    });
    handler.activeSessions.set('s2', {
      simulation: { stop: stop2 },
      session: { update: update2 },
      startTime: Date.now() - 1000,
    });

    await handler.cleanup();

    expect(stop1).toHaveBeenCalled();
    expect(stop2).toHaveBeenCalled();
    expect(update1).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      end_time: expect.any(Date),
      duration: expect.any(Number),
    }));
    expect(handler.activeSessions.size).toBe(0);
  });

  test('still clears the map when one session update throws', async () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    handler.activeSessions.set('s1', {
      simulation: { stop: jest.fn() },
      session: { update: jest.fn().mockRejectedValue(new Error('db')) },
      startTime: Date.now(),
    });
    handler.activeSessions.set('s2', {
      simulation: { stop: jest.fn() },
      session: { update: jest.fn().mockResolvedValue(undefined) },
      startTime: Date.now(),
    });

    await handler.cleanup();
    expect(handler.activeSessions.size).toBe(0);
  });

  test('cleanup on an empty map is a no-op', async () => {
    const { io } = makeIo();
    const handler = new SimulationHandler(io);
    await expect(handler.cleanup()).resolves.toBeUndefined();
  });
});
