// Unit tests for the Graph model logic (no DB).

const Graph = require('../../../src/models/Graph');

const OWNER_ID = 'user-1';
const buildGraph = (overrides = {}) =>
  Graph.build({
    user_id: OWNER_ID,
    title: 'Demo',
    dot_code: 'digraph G { A -> B }',
    is_public: false,
    version: 1,
    view_count: 0,
    ...overrides,
  });

describe('Graph.prototype.canBeAccessedBy', () => {
  test('public graphs are accessible to everyone (including anonymous)', () => {
    const g = buildGraph({ is_public: true });
    expect(g.canBeAccessedBy(null)).toBe(true);
    expect(g.canBeAccessedBy({ id: 'someone-else', role: 'viewer' })).toBe(true);
  });

  test('private graphs are only accessible to owner or admin', () => {
    const g = buildGraph();
    expect(g.canBeAccessedBy(null)).toBe(false);
    expect(g.canBeAccessedBy({ id: OWNER_ID, role: 'viewer' })).toBe(true);
    expect(g.canBeAccessedBy({ id: 'other', role: 'admin' })).toBe(true);
    expect(g.canBeAccessedBy({ id: 'other', role: 'editor' })).toBe(false);
  });
});

describe('Graph.prototype.canBeEditedBy', () => {
  test('always false for anonymous', () => {
    expect(buildGraph({ is_public: true }).canBeEditedBy(null)).toBe(false);
  });

  test('owner can edit their own graph', () => {
    expect(buildGraph().canBeEditedBy({ id: OWNER_ID, role: 'viewer' })).toBe(true);
  });

  test('admin can edit any graph', () => {
    expect(buildGraph().canBeEditedBy({ id: 'other', role: 'admin' })).toBe(true);
  });

  test('non-owner non-admin cannot edit, even on public graph', () => {
    const g = buildGraph({ is_public: true });
    expect(g.canBeEditedBy({ id: 'other', role: 'editor' })).toBe(false);
  });
});

describe('Graph.prototype.incrementViewCount', () => {
  test('bumps view_count by 1 and saves only that field', async () => {
    const g = buildGraph({ view_count: 5 });
    g.save = jest.fn().mockResolvedValue(g);

    await g.incrementViewCount();
    expect(g.view_count).toBe(6);
    expect(g.save).toHaveBeenCalledWith({ fields: ['view_count'] });
  });
});

describe('Graph.prototype.updateLastSimulation', () => {
  test('sets last_simulation to now and saves', async () => {
    const g = buildGraph();
    g.save = jest.fn().mockResolvedValue(g);

    const before = Date.now();
    await g.updateLastSimulation();
    const after = Date.now();

    expect(g.last_simulation).toBeInstanceOf(Date);
    const t = g.last_simulation.getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
    expect(g.save).toHaveBeenCalledWith({ fields: ['last_simulation'] });
  });
});

describe('Graph class helpers', () => {
  // Spy on Sequelize methods to confirm the where clauses without DB.

  test('findPublic filters on is_public=true and merges options', () => {
    const findAll = jest.spyOn(Graph, 'findAll').mockResolvedValue([]);
    Graph.findPublic({ limit: 5 });
    expect(findAll).toHaveBeenCalledWith({ where: { is_public: true }, limit: 5 });
    findAll.mockRestore();
  });

  test('findByUser filters on user_id', () => {
    const findAll = jest.spyOn(Graph, 'findAll').mockResolvedValue([]);
    Graph.findByUser('u-9');
    expect(findAll).toHaveBeenCalledWith({ where: { user_id: 'u-9' } });
    findAll.mockRestore();
  });

  test('findTemplates without category filters on is_template=true only', () => {
    const findAll = jest.spyOn(Graph, 'findAll').mockResolvedValue([]);
    Graph.findTemplates();
    expect(findAll).toHaveBeenCalledWith({ where: { is_template: true } });
    findAll.mockRestore();
  });

  test('findTemplates with category adds template_category to the where clause', () => {
    const findAll = jest.spyOn(Graph, 'findAll').mockResolvedValue([]);
    Graph.findTemplates('Network Topology');
    expect(findAll).toHaveBeenCalledWith({
      where: { is_template: true, template_category: 'Network Topology' },
    });
    findAll.mockRestore();
  });
});
