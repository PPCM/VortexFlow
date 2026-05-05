// Unit tests for the SimulationSession model logic (no DB).

const SimulationSession = require('../../../src/models/SimulationSession');

const buildSession = (overrides = {}) =>
  SimulationSession.build({
    graph_id: 'g1',
    user_id: 'u1',
    session_name: 'Run 1',
    status: 'running',
    duration: 0,
    start_time: new Date('2026-05-05T10:00:00Z'),
    session_data: {
      frames: [],
      metrics: {
        totalPackets: 0,
        avgLatency: 0,
        maxThroughput: 0,
        nodeUtilization: {},
      },
      events: [],
      config: {},
    },
    is_saved: false,
    tags: [],
    ...overrides,
  });

describe('lifecycle methods', () => {
  test('start sets status=running and a fresh start_time, saves only those', async () => {
    const s = buildSession({ status: 'paused', start_time: new Date('2025-01-01') });
    s.save = jest.fn().mockResolvedValue(s);

    const before = Date.now();
    await s.start();
    expect(s.status).toBe('running');
    expect(s.start_time.getTime()).toBeGreaterThanOrEqual(before);
    expect(s.save).toHaveBeenCalledWith({ fields: ['status', 'start_time'] });
  });

  test('pause sets status=paused', async () => {
    const s = buildSession();
    s.save = jest.fn().mockResolvedValue(s);

    await s.pause();
    expect(s.status).toBe('paused');
    expect(s.save).toHaveBeenCalledWith({ fields: ['status'] });
  });

  test('resume sets status=running', async () => {
    const s = buildSession({ status: 'paused' });
    s.save = jest.fn().mockResolvedValue(s);

    await s.resume();
    expect(s.status).toBe('running');
  });

  test('complete sets status=completed and computes duration in seconds', async () => {
    const start = new Date(Date.now() - 12_000);
    const s = buildSession({ start_time: start });
    s.save = jest.fn().mockResolvedValue(s);

    await s.complete();
    expect(s.status).toBe('completed');
    expect(s.end_time).toBeInstanceOf(Date);
    expect(s.duration).toBeGreaterThanOrEqual(11);
    expect(s.duration).toBeLessThanOrEqual(13);
  });

  test('fail records the error and computes duration', async () => {
    const start = new Date(Date.now() - 5_000);
    const s = buildSession({ start_time: start, notes: 'pre-existing' });
    s.save = jest.fn().mockResolvedValue(s);

    await s.fail(new Error('boom'));
    expect(s.status).toBe('failed');
    expect(s.notes).toMatch(/pre-existing/);
    expect(s.notes).toMatch(/Error: boom/);
    expect(s.duration).toBeGreaterThanOrEqual(4);
  });

  test('fail accepts a string error too', async () => {
    const s = buildSession({ start_time: new Date(Date.now() - 1000) });
    s.save = jest.fn().mockResolvedValue(s);
    await s.fail('disk full');
    expect(s.notes).toMatch(/Error: disk full/);
  });
});

describe('addFrame', () => {
  test('appends a frame with a timestamp and saves session_data only', async () => {
    const s = buildSession();
    s.save = jest.fn().mockResolvedValue(s);

    await s.addFrame({ packetCount: 10 });
    expect(s.session_data.frames).toHaveLength(1);
    expect(s.session_data.frames[0]).toEqual(expect.objectContaining({
      packetCount: 10,
      timestamp: expect.any(Number),
    }));
    expect(s.save).toHaveBeenCalledWith({ fields: ['session_data'] });
  });

  test('caps the rolling window at 1000 frames', async () => {
    // Seed with 1000 frames already, then add one more.
    const seeded = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const s = buildSession({
      session_data: { frames: seeded, metrics: {}, events: [], config: {} },
    });
    s.save = jest.fn().mockResolvedValue(s);

    await s.addFrame({ id: 'new' });
    expect(s.session_data.frames).toHaveLength(1000);
    // Oldest frame should have been dropped, newest kept.
    expect(s.session_data.frames[0].id).toBe(1);
    expect(s.session_data.frames[999].id).toBe('new');
  });
});

describe('updateMetrics', () => {
  test('shallow-merges new metrics into session_data.metrics', async () => {
    const s = buildSession({
      session_data: {
        frames: [],
        metrics: { totalPackets: 5, avgLatency: 2 },
        events: [],
        config: {},
      },
    });
    s.save = jest.fn().mockResolvedValue(s);

    await s.updateMetrics({ avgLatency: 3, maxThroughput: 50 });
    expect(s.session_data.metrics).toEqual({
      totalPackets: 5,
      avgLatency: 3,
      maxThroughput: 50,
    });
  });
});

describe('addEvent', () => {
  test('appends an event with timestamp', async () => {
    const s = buildSession();
    s.save = jest.fn().mockResolvedValue(s);

    await s.addEvent({ type: 'node-overload', node: 'A' });
    expect(s.session_data.events).toHaveLength(1);
    expect(s.session_data.events[0]).toEqual(expect.objectContaining({
      type: 'node-overload',
      node: 'A',
      timestamp: expect.any(Number),
    }));
  });
});

describe('export', () => {
  test('export("json") returns the public payload', () => {
    const s = buildSession({ id: 'sess-1', tags: ['demo'] });
    const exported = s.export('json');
    expect(exported).toEqual(expect.objectContaining({
      id: 'sess-1',
      graph_id: 'g1',
      session_name: 'Run 1',
      tags: ['demo'],
    }));
  });

  test('export("csv") flattens frame metrics', () => {
    const s = buildSession({
      session_data: {
        frames: [
          { timestamp: 1, metrics: { fps: 30, packets: 5 } },
          { timestamp: 2, metrics: { fps: 28, packets: 6 } },
        ],
        metrics: {},
        events: [],
        config: {},
      },
    });
    const csv = s.export('csv');
    expect(csv).toEqual([
      { timestamp: 1, fps: 30, packets: 5 },
      { timestamp: 2, fps: 28, packets: 6 },
    ]);
  });
});

describe('class helpers', () => {
  test('findByGraph orders by start_time DESC', () => {
    const findAll = jest.spyOn(SimulationSession, 'findAll').mockResolvedValue([]);
    SimulationSession.findByGraph('g1');
    expect(findAll).toHaveBeenCalledWith({
      where: { graph_id: 'g1' },
      order: [['start_time', 'DESC']],
    });
    findAll.mockRestore();
  });

  test('findByUser filters on user_id and orders by start_time DESC', () => {
    const findAll = jest.spyOn(SimulationSession, 'findAll').mockResolvedValue([]);
    SimulationSession.findByUser('u1');
    expect(findAll).toHaveBeenCalledWith({
      where: { user_id: 'u1' },
      order: [['start_time', 'DESC']],
    });
    findAll.mockRestore();
  });

  test('findRunning filters on status=running', () => {
    const findAll = jest.spyOn(SimulationSession, 'findAll').mockResolvedValue([]);
    SimulationSession.findRunning();
    expect(findAll).toHaveBeenCalledWith({ where: { status: 'running' } });
    findAll.mockRestore();
  });

  test('createSession seeds session_data with empty frames/events and config echo', async () => {
    const create = jest.spyOn(SimulationSession, 'create').mockResolvedValue({});
    await SimulationSession.createSession('g1', 'u1', { speed: 2, name: 'Test' });
    const args = create.mock.calls[0][0];
    expect(args.graph_id).toBe('g1');
    expect(args.user_id).toBe('u1');
    expect(args.session_name).toBe('Test');
    expect(args.session_data.frames).toEqual([]);
    expect(args.session_data.config).toEqual({ speed: 2, name: 'Test' });
    create.mockRestore();
  });

  test('cleanupOldSessions destroys each unsaved old session and reports count', async () => {
    const old = [
      { destroy: jest.fn().mockResolvedValue(undefined) },
      { destroy: jest.fn().mockResolvedValue(undefined) },
      { destroy: jest.fn().mockResolvedValue(undefined) },
    ];
    const findAll = jest.spyOn(SimulationSession, 'findAll').mockResolvedValue(old);

    const n = await SimulationSession.cleanupOldSessions(30);
    expect(n).toBe(3);
    old.forEach((s) => expect(s.destroy).toHaveBeenCalled());
    findAll.mockRestore();
  });
});
