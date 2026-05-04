// Integration tests for /api/import-export.
//
// Strategy:
//   - Mock src/utils/fileUpload entirely. The multer middlewares become
//     pass-throughs that surface a controllable `req.file`. The read* helpers
//     return whatever the test sets up. cleanupFile is a spy.
//   - Mock src/middleware/auth so requireEditor is a passthrough; req.user is
//     injected via buildTestApp.
//   - Mock the models (Graph, GraphVersion, User).
//
// Multer + archiver are not exercised end-to-end here. We assert what the
// route does with the file upload result, not how multer parses multipart.

let mockFileToInject = null;
let mockUploadShouldError = null;

const mockReadDotFile = jest.fn();
const mockReadJsonFile = jest.fn();
const mockCleanupFile = jest.fn();

jest.mock('../../../src/utils/fileUpload', () => ({
  // multer middleware shim — set req.file from the test-controlled value
  // (or call back with the queued error).
  uploadGraphFile: (req, res, cb) => {
    if (mockUploadShouldError) return cb(mockUploadShouldError);
    if (mockFileToInject) req.file = mockFileToInject;
    cb();
  },
  uploadExportFile: (req, res, cb) => {
    if (mockUploadShouldError) return cb(mockUploadShouldError);
    if (mockFileToInject) req.file = mockFileToInject;
    cb();
  },
  handleUploadError: (err, req, res) => {
    res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
  },
  readDotFile: (...a) => mockReadDotFile(...a),
  readJsonFile: (...a) => mockReadJsonFile(...a),
  cleanupFile: (...a) => mockCleanupFile(...a),
}));

const mockGraphCreate = jest.fn();
const mockGraphFindOne = jest.fn();
const mockGraphFindAll = jest.fn();
const mockGraphVersionCreate = jest.fn();
const mockGraphVersionFindAll = jest.fn();

jest.mock('../../../src/models', () => ({
  Graph: {
    create: (...a) => mockGraphCreate(...a),
    findOne: (...a) => mockGraphFindOne(...a),
    findAll: (...a) => mockGraphFindAll(...a),
  },
  GraphVersion: {
    create: (...a) => mockGraphVersionCreate(...a),
    findAll: (...a) => mockGraphVersionFindAll(...a),
  },
  User: {},
  GraphShare: {},
  SimulationSession: {},
}));

jest.mock('../../../src/middleware/auth', () => ({
  validateSession: (req, res, next) => next(),
  requireEditor: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requireGraphAccess: () => (req, res, next) => next(),
  authRateLimit: (req, res, next) => next(),
  logActivity: () => (req, res, next) => next(),
}));

const request = require('supertest');
const importExportRoutes = require('../../../src/routes/import-export');
const { buildTestApp } = require('../helpers/buildTestApp');

const TEST_USER = { id: 'user-1', role: 'editor', email: 'a@b.com' };
const buildApp = (user = TEST_USER) =>
  buildTestApp(importExportRoutes, '/api/import-export', { user });

const fakeFile = (overrides = {}) => ({
  fieldname: 'graphFile',
  originalname: 'mygraph.dot',
  encoding: '7bit',
  mimetype: 'text/plain',
  destination: '/tmp',
  filename: 'uuid.dot',
  path: '/tmp/uuid.dot',
  size: 42,
  ...overrides,
});

beforeEach(() => {
  mockFileToInject = null;
  mockUploadShouldError = null;
  mockReadDotFile.mockReset();
  mockReadJsonFile.mockReset();
  mockCleanupFile.mockReset();
  mockGraphCreate.mockReset();
  mockGraphFindOne.mockReset();
  mockGraphFindAll.mockReset();
  mockGraphVersionCreate.mockReset();
  mockGraphVersionFindAll.mockReset();
});

// ----------------------------------------------------------------------------
// POST /api/import-export/import-dot
// ----------------------------------------------------------------------------
describe('POST /api/import-export/import-dot', () => {
  test('400 when no file uploaded', async () => {
    const res = await request(buildApp()).post('/api/import-export/import-dot');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_FILE');
  });

  test('400 + cleanup when uploaded file is not a DOT file', async () => {
    mockFileToInject = fakeFile();
    mockReadDotFile.mockReturnValue({ success: false, error: 'not a graph' });

    const res = await request(buildApp())
      .post('/api/import-export/import-dot')
      .field('title', 'Hello');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DOT_FILE');
    expect(mockCleanupFile).toHaveBeenCalledWith('/tmp/uuid.dot');
    expect(mockGraphCreate).not.toHaveBeenCalled();
  });

  test('400 + cleanup when DOT syntax is invalid', async () => {
    mockFileToInject = fakeFile();
    mockReadDotFile.mockReturnValue({
      success: true,
      content: 'this is not DOT',
      size: 16,
    });

    const res = await request(buildApp())
      .post('/api/import-export/import-dot');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DOT_VALIDATION_ERROR');
    expect(mockCleanupFile).toHaveBeenCalled();
  });

  test('201 imports a valid DOT, creates Graph + initial GraphVersion + cleans up', async () => {
    mockFileToInject = fakeFile({ originalname: 'awesome.dot' });
    mockReadDotFile.mockReturnValue({
      success: true,
      content: 'digraph G { A -> B }',
      size: 21,
    });
    mockGraphCreate.mockResolvedValue({
      id: 'g1',
      title: 'awesome',
      description: 'Imported from awesome.dot',
      category: 'imported',
      is_public: false,
      created_at: new Date('2026-01-01').toISOString(),
    });
    mockGraphVersionCreate.mockResolvedValue(undefined);

    // Note: in tests we send JSON instead of multipart; multer is mocked so
    // it doesn't parse multipart fields anyway. The route still reads req.body
    // and req.file the same way.
    const res = await request(buildApp())
      .post('/api/import-export/import-dot')
      .send({ description: 'A test', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.graph).toEqual(expect.objectContaining({
      id: 'g1',
      title: 'awesome',
    }));
    // Graph.create called with derived title from filename and isPublic=true.
    expect(mockGraphCreate).toHaveBeenCalledWith(expect.objectContaining({
      user_id: TEST_USER.id,
      title: 'awesome',
      is_public: true,
      dot_code: 'digraph G { A -> B }',
    }));
    expect(mockGraphVersionCreate).toHaveBeenCalledWith(expect.objectContaining({
      graph_id: 'g1',
      version_number: 1,
    }));
    expect(mockCleanupFile).toHaveBeenCalledWith('/tmp/uuid.dot');
  });

  test('uses provided title when set (not the filename)', async () => {
    mockFileToInject = fakeFile({ originalname: 'irrelevant.dot' });
    mockReadDotFile.mockReturnValue({
      success: true,
      content: 'digraph G { A -> B }',
      size: 21,
    });
    mockGraphCreate.mockResolvedValue({
      id: 'g1',
      title: 'My Custom Title',
      created_at: new Date().toISOString(),
    });
    mockGraphVersionCreate.mockResolvedValue(undefined);

    await request(buildApp())
      .post('/api/import-export/import-dot')
      .send({ title: 'My Custom Title' });

    expect(mockGraphCreate.mock.calls[0][0].title).toBe('My Custom Title');
  });
});

// ----------------------------------------------------------------------------
// POST /api/import-export/import-json
// ----------------------------------------------------------------------------
describe('POST /api/import-export/import-json', () => {
  test('400 when no file uploaded', async () => {
    const res = await request(buildApp()).post('/api/import-export/import-json');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_FILE');
  });

  test('400 when JSON file is unparseable', async () => {
    mockFileToInject = fakeFile({ originalname: 'bad.json' });
    mockReadJsonFile.mockReturnValue({ success: false, error: 'parse error' });
    const res = await request(buildApp()).post('/api/import-export/import-json');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON_FILE');
    expect(mockCleanupFile).toHaveBeenCalled();
  });

  test('400 when JSON has no graph.dot_code', async () => {
    mockFileToInject = fakeFile({ originalname: 'incomplete.json' });
    mockReadJsonFile.mockReturnValue({
      success: true,
      data: { exportInfo: {}, graph: { title: 'no dot' } },
    });
    const res = await request(buildApp()).post('/api/import-export/import-json');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_EXPORT_FORMAT');
    expect(mockCleanupFile).toHaveBeenCalled();
  });

  test('400 when embedded DOT is invalid', async () => {
    mockFileToInject = fakeFile();
    mockReadJsonFile.mockReturnValue({
      success: true,
      data: { graph: { dot_code: 'this is not DOT' } },
    });
    const res = await request(buildApp()).post('/api/import-export/import-json');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DOT_VALIDATION_ERROR');
    expect(mockCleanupFile).toHaveBeenCalled();
  });

  test('201 imports JSON without versions and seeds a v1 GraphVersion', async () => {
    mockFileToInject = fakeFile({ originalname: 'export.json' });
    mockReadJsonFile.mockReturnValue({
      success: true,
      data: {
        exportInfo: { exportedBy: 'someone@x.com' },
        graph: {
          title: 'X',
          dot_code: 'digraph G { A -> B }',
          category: 'demo',
        },
      },
    });
    mockGraphCreate.mockResolvedValue({
      id: 'g1', title: 'X', is_public: false,
      created_at: new Date().toISOString(),
    });
    mockGraphVersionCreate.mockResolvedValue(undefined);

    const res = await request(buildApp()).post('/api/import-export/import-json');
    expect(res.status).toBe(201);
    expect(res.body.importInfo.versionsImported).toBe(1);
    // Imported graphs always start private.
    expect(mockGraphCreate.mock.calls[0][0].is_public).toBe(false);
    expect(mockGraphVersionCreate).toHaveBeenCalledTimes(1);
  });

  test('201 imports JSON WITH versions and creates each (capped at 10)', async () => {
    mockFileToInject = fakeFile({ originalname: 'export.json' });
    const fifteenVersions = Array.from({ length: 15 }, (_, i) => ({
      dot_code: 'digraph G { A -> B }',
      change_description: `v${i + 1}`,
    }));
    mockReadJsonFile.mockReturnValue({
      success: true,
      data: {
        graph: { title: 'X', dot_code: 'digraph G { A -> B }' },
        versions: fifteenVersions,
      },
    });
    mockGraphCreate.mockResolvedValue({
      id: 'g1', title: 'X', is_public: false,
      created_at: new Date().toISOString(),
    });
    mockGraphVersionCreate.mockResolvedValue(undefined);

    const res = await request(buildApp()).post('/api/import-export/import-json');
    expect(res.status).toBe(201);
    // The route slices to 10.
    expect(mockGraphVersionCreate).toHaveBeenCalledTimes(10);
    expect(res.body.importInfo.versionsImported).toBe(15);
  });
});

// ----------------------------------------------------------------------------
// GET /api/import-export/export/:id
// ----------------------------------------------------------------------------
describe('GET /api/import-export/export/:id', () => {
  const baseGraph = {
    id: 'g1',
    title: 'My Graph',
    description: 'd',
    category: 'cat',
    is_public: true,
    dot_code: 'digraph G { A -> B }',
    simulation_config: {},
    visual_settings: {},
    metadata: {},
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-01-01').toISOString(),
    user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B' },
  };

  test('404 when graph not accessible', async () => {
    mockGraphFindOne.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/import-export/export/g1');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('GRAPH_NOT_FOUND');
  });

  test('200 JSON export with proper headers and exportInfo block', async () => {
    mockGraphFindOne.mockResolvedValue(baseGraph);
    const res = await request(buildApp()).get('/api/import-export/export/g1');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment.*\.json/);
    expect(res.body.exportInfo).toEqual(expect.objectContaining({
      exportedBy: TEST_USER.email,
      exportVersion: '1.0',
    }));
    expect(res.body.graph.dot_code).toBe('digraph G { A -> B }');
  });

  test('200 DOT export returns raw DOT content', async () => {
    mockGraphFindOne.mockResolvedValue(baseGraph);
    const res = await request(buildApp())
      .get('/api/import-export/export/g1?format=dot');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-disposition']).toMatch(/attachment.*\.dot/);
    expect(res.text).toBe('digraph G { A -> B }');
  });

  test('200 includeVersions=true embeds versions array', async () => {
    mockGraphFindOne.mockResolvedValue(baseGraph);
    mockGraphVersionFindAll.mockResolvedValue([
      {
        version_number: 1,
        dot_code: 'digraph G { A -> B }',
        simulation_config: {},
        visual_settings: {},
        change_description: 'v1',
        created_at: new Date().toISOString(),
        creator: { email: 'c@b.com', first_name: 'Cee', last_name: 'Dee' },
      },
    ]);

    const res = await request(buildApp())
      .get('/api/import-export/export/g1?includeVersions=true');

    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(1);
    expect(res.body.versions[0]).toEqual(expect.objectContaining({
      version_number: 1,
      change_description: 'v1',
    }));
  });
});

// ----------------------------------------------------------------------------
// POST /api/import-export/export-multiple
// ----------------------------------------------------------------------------
describe('POST /api/import-export/export-multiple', () => {
  const VALID_UUID = '11111111-1111-1111-1111-111111111111';

  test('400 when graphIds is empty', async () => {
    const res = await request(buildApp())
      .post('/api/import-export/export-multiple')
      .send({ graphIds: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 when a graphId is not a UUID', async () => {
    const res = await request(buildApp())
      .post('/api/import-export/export-multiple')
      .send({ graphIds: ['nope'] });
    expect(res.status).toBe(400);
  });

  test('400 on unsupported format', async () => {
    const res = await request(buildApp())
      .post('/api/import-export/export-multiple')
      .send({ graphIds: [VALID_UUID], format: 'pdf' });
    expect(res.status).toBe(400);
  });

  test('404 when no accessible graphs match', async () => {
    mockGraphFindAll.mockResolvedValue([]);
    const res = await request(buildApp())
      .post('/api/import-export/export-multiple')
      .send({ graphIds: [VALID_UUID] });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_GRAPHS_FOUND');
  });

  test('200 streams a ZIP with proper headers when graphs are found', async () => {
    mockGraphFindAll.mockResolvedValue([
      {
        id: VALID_UUID,
        title: 'Graph 1',
        description: 'd',
        category: 'cat',
        is_public: false,
        dot_code: 'digraph G { A -> B }',
        simulation_config: {},
        visual_settings: {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B' },
      },
    ]);

    const res = await request(buildApp())
      .post('/api/import-export/export-multiple')
      .send({ graphIds: [VALID_UUID], format: 'both' })
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/zip/);
    expect(res.headers['content-disposition']).toMatch(/vortexflow_graphs_/);
    // ZIP files start with the local file header signature 'PK\x03\x04'.
    expect(res.body.slice(0, 2).toString()).toBe('PK');
  });
});
