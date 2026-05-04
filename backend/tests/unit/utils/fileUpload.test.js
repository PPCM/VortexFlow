// Use fake timers BEFORE requiring fileUpload so its module-level setInterval
// (hourly temp cleanup) is captured and doesn't keep Jest's event loop alive.
jest.useFakeTimers();

const fs = require('fs');
const os = require('os');
const path = require('path');

const fileUpload = require('../../../src/utils/fileUpload');

const {
  cleanupFile,
  cleanupOldTempFiles,
  readDotFile,
  readJsonFile,
  getFileInfo,
  moveFile,
  FILE_SIZE_LIMITS,
  ALLOWED_EXTENSIONS,
  uploadDirs,
} = fileUpload;

let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-fileupload-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

afterAll(() => {
  // Clear any pending fake timers (the module installed a 1h setInterval).
  jest.clearAllTimers();
  jest.useRealTimers();
});

const writeTmp = (name, content) => {
  const p = path.join(tmpRoot, name);
  fs.writeFileSync(p, content);
  return p;
};

describe('fileUpload — exported constants', () => {
  test('FILE_SIZE_LIMITS exposes expected keys', () => {
    expect(FILE_SIZE_LIMITS).toEqual(expect.objectContaining({
      dot: expect.any(Number),
      json: expect.any(Number),
      image: expect.any(Number),
      default: expect.any(Number),
    }));
  });

  test('ALLOWED_EXTENSIONS includes DOT for graphs', () => {
    expect(ALLOWED_EXTENSIONS.graphs).toEqual(expect.arrayContaining(['.dot', '.gv', '.json']));
  });

  test('uploadDirs map contains the three categories', () => {
    expect(uploadDirs).toEqual(expect.objectContaining({
      graphs: expect.any(String),
      exports: expect.any(String),
      temp: expect.any(String),
    }));
  });
});

describe('cleanupFile', () => {
  test('returns true and removes an existing file', () => {
    const p = writeTmp('a.txt', 'hi');
    expect(fs.existsSync(p)).toBe(true);
    expect(cleanupFile(p)).toBe(true);
    expect(fs.existsSync(p)).toBe(false);
  });

  test('returns false when the file does not exist', () => {
    const p = path.join(tmpRoot, 'missing.txt');
    expect(cleanupFile(p)).toBe(false);
  });
});

describe('readDotFile', () => {
  test('reads a valid DOT file', () => {
    const p = writeTmp('g.dot', 'digraph G { A -> B }');
    const r = readDotFile(p);
    expect(r.success).toBe(true);
    expect(r.content).toContain('digraph');
    expect(r.size).toBeGreaterThan(0);
  });

  test('rejects an empty file', () => {
    const p = writeTmp('empty.dot', '');
    const r = readDotFile(p);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/empty/i);
  });

  test('rejects content that is not DOT', () => {
    const p = writeTmp('bad.dot', 'this is just text');
    const r = readDotFile(p);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/DOT syntax/);
  });

  test('returns error when file is missing', () => {
    const r = readDotFile(path.join(tmpRoot, 'missing.dot'));
    expect(r.success).toBe(false);
  });
});

describe('readJsonFile', () => {
  test('reads valid JSON', () => {
    const p = writeTmp('data.json', '{"a":1,"b":[2,3]}');
    const r = readJsonFile(p);
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ a: 1, b: [2, 3] });
  });

  test('reports parse errors', () => {
    const p = writeTmp('bad.json', '{not valid');
    const r = readJsonFile(p);
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  test('returns error when file missing', () => {
    const r = readJsonFile(path.join(tmpRoot, 'missing.json'));
    expect(r.success).toBe(false);
  });
});

describe('getFileInfo', () => {
  test('returns metadata for an existing file', () => {
    const p = writeTmp('data.json', '{"a":1}');
    const info = getFileInfo(p);
    expect(info.exists).toBe(true);
    expect(info.isFile).toBe(true);
    expect(info.isDirectory).toBe(false);
    expect(info.extension).toBe('.json');
    expect(info.size).toBeGreaterThan(0);
    // Avoid `instanceof Date` here: jest.useFakeTimers() shims Date globally,
    // so the fs-returned dates aren't instances of the test-scope Date.
    expect(typeof info.created.getTime).toBe('function');
    expect(typeof info.modified.getTime).toBe('function');
  });

  test('returns exists=false when file missing', () => {
    const info = getFileInfo(path.join(tmpRoot, 'missing.x'));
    expect(info.exists).toBe(false);
    expect(info.error).toBeTruthy();
  });
});

describe('moveFile', () => {
  test('moves file to a new location', () => {
    const src = writeTmp('src.dot', 'digraph G { A -> B }');
    const dest = path.join(tmpRoot, 'subdir', 'dest.dot');

    const r = moveFile(src, dest);
    expect(r.success).toBe(true);
    expect(r.newPath).toBe(dest);
    expect(fs.existsSync(src)).toBe(false);
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('creates intermediate directories', () => {
    const src = writeTmp('src2.txt', 'x');
    const dest = path.join(tmpRoot, 'a', 'b', 'c', 'dest.txt');
    const r = moveFile(src, dest);
    expect(r.success).toBe(true);
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('returns error when source missing', () => {
    const r = moveFile(
      path.join(tmpRoot, 'missing.txt'),
      path.join(tmpRoot, 'dest.txt'),
    );
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe('cleanupOldTempFiles', () => {
  test('removes files older than maxAge from the temp upload dir', () => {
    // We cannot easily relocate the module's hard-coded 'uploads/temp' dir,
    // so seed a file there and back-date it. Use a unique name to avoid
    // colliding with anything else under that dir.
    const tempDir = uploadDirs.temp;
    fs.mkdirSync(tempDir, { recursive: true });
    const oldFile = path.join(tempDir, `vf-test-old-${Date.now()}.tmp`);
    fs.writeFileSync(oldFile, 'old');
    // Backdate mtime by 48h
    const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, past, past);

    const cleaned = cleanupOldTempFiles(24 * 60 * 60 * 1000); // 24h threshold
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(oldFile)).toBe(false);
  });

  test('keeps recent files', () => {
    const tempDir = uploadDirs.temp;
    fs.mkdirSync(tempDir, { recursive: true });
    const recent = path.join(tempDir, `vf-test-recent-${Date.now()}.tmp`);
    fs.writeFileSync(recent, 'recent');

    cleanupOldTempFiles(24 * 60 * 60 * 1000);
    expect(fs.existsSync(recent)).toBe(true);

    fs.unlinkSync(recent); // cleanup
  });
});
