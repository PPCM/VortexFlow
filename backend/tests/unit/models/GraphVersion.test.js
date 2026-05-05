// Unit tests for the GraphVersion model logic (no DB).

const GraphVersion = require('../../../src/models/GraphVersion');
const Graph = require('../../../src/models/Graph');

describe('GraphVersion class helpers', () => {
  test('findByGraph filters on graph_id and orders by version_number DESC', () => {
    const findAll = jest.spyOn(GraphVersion, 'findAll').mockResolvedValue([]);
    GraphVersion.findByGraph('g1', { limit: 5 });
    expect(findAll).toHaveBeenCalledWith({
      where: { graph_id: 'g1' },
      order: [['version_number', 'DESC']],
      limit: 5,
    });
    findAll.mockRestore();
  });

  test('findLatestByGraph returns the topmost version', () => {
    const findOne = jest.spyOn(GraphVersion, 'findOne').mockResolvedValue(null);
    GraphVersion.findLatestByGraph('g1');
    expect(findOne).toHaveBeenCalledWith({
      where: { graph_id: 'g1' },
      order: [['version_number', 'DESC']],
    });
    findOne.mockRestore();
  });

  test('findMajorVersions filters on is_major_version=true', () => {
    const findAll = jest.spyOn(GraphVersion, 'findAll').mockResolvedValue([]);
    GraphVersion.findMajorVersions('g1');
    expect(findAll).toHaveBeenCalledWith({
      where: { graph_id: 'g1', is_major_version: true },
      order: [['version_number', 'DESC']],
    });
    findAll.mockRestore();
  });

  test('createFromGraph builds a snapshot from the current graph state', async () => {
    const create = jest.spyOn(GraphVersion, 'create').mockResolvedValue({});
    const graph = {
      id: 'g1', version: 4,
      dot_code: 'digraph G { A -> B }',
      simulation_config: { speed: 1 },
      visual_settings: { theme: 'dark' },
    };

    await GraphVersion.createFromGraph(graph, 'big change');
    expect(create).toHaveBeenCalledWith({
      graph_id: 'g1',
      version_number: 4,
      dot_code: 'digraph G { A -> B }',
      simulation_config: { speed: 1 },
      visual_settings: { theme: 'dark' },
      notes: 'big change',
      changes_summary: 'big change',
    });
    create.mockRestore();
  });

  test('createFromGraph defaults the changes_summary when no notes given', async () => {
    const create = jest.spyOn(GraphVersion, 'create').mockResolvedValue({});
    await GraphVersion.createFromGraph({ id: 'g1', version: 1, dot_code: 'd' });
    expect(create.mock.calls[0][0].changes_summary).toBe('Version created');
    create.mockRestore();
  });
});

describe('GraphVersion.prototype.restore', () => {
  test('updates the graph and creates a new restore-marker version', async () => {
    const v = GraphVersion.build({
      id: 'v1',
      graph_id: 'g1',
      version_number: 2,
      dot_code: 'digraph G { A -> X }',
      simulation_config: { speed: 2 },
      visual_settings: { theme: 'light' },
    });

    const update = jest.fn().mockResolvedValue(undefined);
    const fakeGraph = {
      id: 'g1',
      version: 5,
      simulation_config: {},
      visual_settings: {},
      update,
    };
    const findByPk = jest.spyOn(Graph, 'findByPk').mockResolvedValue(fakeGraph);
    const create = jest.spyOn(GraphVersion, 'create').mockResolvedValue({});

    const result = await v.restore();

    expect(result).toBe(fakeGraph);
    expect(findByPk).toHaveBeenCalledWith('g1');
    expect(update).toHaveBeenCalledWith({
      dot_code: 'digraph G { A -> X }',
      simulation_config: { speed: 2 },
      visual_settings: { theme: 'light' },
      version: 6,
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      graph_id: 'g1',
      notes: 'Restored from version 2',
      changes_summary: 'Restored from version 2',
    }));

    findByPk.mockRestore();
    create.mockRestore();
  });

  test('throws when target graph cannot be found', async () => {
    const v = GraphVersion.build({ graph_id: 'missing', version_number: 1, dot_code: 'd' });
    const findByPk = jest.spyOn(Graph, 'findByPk').mockResolvedValue(null);

    await expect(v.restore()).rejects.toThrow('Graph not found');
    findByPk.mockRestore();
  });
});
