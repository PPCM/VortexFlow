// Unit tests for the GraphShare model logic (no DB).

const GraphShare = require('../../../src/models/GraphShare');

const buildShare = (overrides = {}) =>
  GraphShare.build({
    graph_id: 'g1',
    shared_with_user_id: 'u2',
    permission_level: 'view',
    is_active: true,
    access_count: 0,
    ...overrides,
  });

describe('GraphShare.prototype.isExpired', () => {
  test('false when expires_at is null', () => {
    expect(buildShare({ expires_at: null }).isExpired()).toBe(false);
  });

  test('false when expires_at is in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(buildShare({ expires_at: future }).isExpired()).toBe(false);
  });

  test('true when expires_at is in the past', () => {
    const past = new Date(Date.now() - 60_000);
    expect(buildShare({ expires_at: past }).isExpired()).toBe(true);
  });
});

describe('GraphShare.prototype.isValid', () => {
  test('true when active and not expired', () => {
    expect(buildShare().isValid()).toBe(true);
  });

  test('false when revoked (is_active=false)', () => {
    expect(buildShare({ is_active: false }).isValid()).toBe(false);
  });

  test('false when expired even if active', () => {
    expect(
      buildShare({ expires_at: new Date(Date.now() - 1000) }).isValid(),
    ).toBe(false);
  });
});

describe('GraphShare.prototype.incrementAccessCount', () => {
  test('bumps access_count, sets last_accessed, and saves only those fields', async () => {
    const s = buildShare({ access_count: 4 });
    s.save = jest.fn().mockResolvedValue(s);

    await s.incrementAccessCount();
    expect(s.access_count).toBe(5);
    expect(s.last_accessed).toBeInstanceOf(Date);
    expect(s.save).toHaveBeenCalledWith({
      fields: ['access_count', 'last_accessed'],
    });
  });
});

describe('GraphShare.prototype.revoke', () => {
  test('flips is_active to false and saves', async () => {
    const s = buildShare();
    s.save = jest.fn().mockResolvedValue(s);

    await s.revoke();
    expect(s.is_active).toBe(false);
    expect(s.save).toHaveBeenCalledWith({ fields: ['is_active'] });
  });
});

describe('GraphShare.prototype.extend', () => {
  test('extends expires_at by 24 hours by default', async () => {
    const s = buildShare({ expires_at: new Date('2026-01-01T00:00:00Z') });
    s.save = jest.fn().mockResolvedValue(s);

    const before = Date.now();
    await s.extend();
    const after = Date.now();

    expect(s.expires_at).toBeInstanceOf(Date);
    const delta = s.expires_at.getTime() - before;
    expect(delta).toBeGreaterThanOrEqual(24 * 3600 * 1000 - 100);
    expect(delta).toBeLessThanOrEqual(24 * 3600 * 1000 + (after - before) + 100);
    expect(s.save).toHaveBeenCalledWith({ fields: ['expires_at'] });
  });

  test('honours custom number of hours', async () => {
    const s = buildShare();
    s.save = jest.fn().mockResolvedValue(s);

    const before = Date.now();
    await s.extend(2);
    const delta = s.expires_at.getTime() - before;
    expect(delta).toBeGreaterThanOrEqual(2 * 3600 * 1000 - 100);
  });
});

describe('GraphShare class helpers', () => {
  test('findByGraph filters on graph_id and is_active=true', () => {
    const findAll = jest.spyOn(GraphShare, 'findAll').mockResolvedValue([]);
    GraphShare.findByGraph('g1');
    expect(findAll).toHaveBeenCalledWith({
      where: { graph_id: 'g1', is_active: true },
    });
    findAll.mockRestore();
  });

  test('findByUser filters on shared_with_user_id and is_active=true', () => {
    const findAll = jest.spyOn(GraphShare, 'findAll').mockResolvedValue([]);
    GraphShare.findByUser('u2');
    expect(findAll).toHaveBeenCalledWith({
      where: { shared_with_user_id: 'u2', is_active: true },
    });
    findAll.mockRestore();
  });

  test('findByToken matches active token', () => {
    const findOne = jest.spyOn(GraphShare, 'findOne').mockResolvedValue(null);
    GraphShare.findByToken('tok-abc');
    expect(findOne).toHaveBeenCalledWith({
      where: { share_token: 'tok-abc', is_active: true },
    });
    findOne.mockRestore();
  });

  test('createShare with no expiresIn produces null expires_at', async () => {
    const create = jest.spyOn(GraphShare, 'create').mockResolvedValue({});
    await GraphShare.createShare('g1', 'u2', 'view', { sharedByUserId: 'u1' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      graph_id: 'g1',
      shared_with_user_id: 'u2',
      shared_by_user_id: 'u1',
      permission_level: 'view',
      expires_at: null,
      notes: null,
    }));
    create.mockRestore();
  });

  test('createShare with expiresIn computes the right future date', async () => {
    const create = jest.spyOn(GraphShare, 'create').mockResolvedValue({});
    const before = Date.now();
    await GraphShare.createShare('g1', 'u2', 'edit', {
      expiresIn: 3,
      notes: 'temp',
    });
    const args = create.mock.calls[0][0];
    expect(args.permission_level).toBe('edit');
    expect(args.notes).toBe('temp');
    expect(args.expires_at).toBeInstanceOf(Date);
    const delta = args.expires_at.getTime() - before;
    // 3 hours ± a small delta for test execution time.
    expect(delta).toBeGreaterThanOrEqual(3 * 3600 * 1000 - 100);
    expect(delta).toBeLessThanOrEqual(3 * 3600 * 1000 + 1000);
    create.mockRestore();
  });

  test('cleanupExpired revokes each expired active share and reports count', async () => {
    const expired = [
      { revoke: jest.fn().mockResolvedValue(undefined) },
      { revoke: jest.fn().mockResolvedValue(undefined) },
    ];
    const findAll = jest.spyOn(GraphShare, 'findAll').mockResolvedValue(expired);

    const count = await GraphShare.cleanupExpired();
    expect(count).toBe(2);
    expect(expired[0].revoke).toHaveBeenCalled();
    expect(expired[1].revoke).toHaveBeenCalled();
    findAll.mockRestore();
  });
});
