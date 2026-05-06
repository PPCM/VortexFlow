import type { Mock } from 'vitest';
// Unit tests for the ApiService.
//
// We mock axios so the service doesn't make real HTTP calls. Each test
// verifies that the right URL and payload are sent, and that response
// shape adaptation (e.g. login → ApiResponse) is correct.

// jest.mock is hoisted; reference inside the factory so the closure capture
// happens at mock-init time, not at TypeScript const-init time.
vi.mock('axios', () => {
  const client = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      response: { use: vi.fn() },
      request: { use: vi.fn() },
    },
  };
  return {
    __esModule: true,
    default: { create: vi.fn(() => client) },
    create: vi.fn(() => client),
  };
});

import axios from 'axios';
import apiService from './api';

// Recover the singleton client created at api.ts import time.
const mockAxiosClient = ((axios as any).default?.create ?? axios.create).mock.results[0].value;

beforeEach(() => {
  Object.values(mockAxiosClient)
    .filter((v) => typeof v === 'function')
    .forEach((fn) => (fn as Mock).mockReset());
});

describe('Auth methods', () => {
  test('login adapts backend payload to ApiResponse on success', async () => {
    mockAxiosClient.post.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' }, message: 'ok' },
    });

    const r = await apiService.login({ email: 'a@b.com', password: 'p' } as any);
    expect(mockAxiosClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com', password: 'p',
    });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  test('login returns success=false when backend omits user', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: { message: 'bad creds' } });
    const r = await apiService.login({ email: 'x@x.com', password: 'p' } as any);
    expect(r.success).toBe(false);
    expect(r.message).toBe('bad creds');
  });

  test('register adapts payload similarly', async () => {
    mockAxiosClient.post.mockResolvedValue({
      data: { user: { id: 'u2', email: 'new@x.com' }, message: 'created' },
    });
    const r = await apiService.register({
      email: 'new@x.com', password: 'p',
    } as any);
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('new@x.com');
  });

  test('logout passes through backend response', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: { success: true, message: 'bye' } });
    const r = await apiService.logout();
    expect(mockAxiosClient.post).toHaveBeenCalledWith('/auth/logout');
    expect(r).toEqual({ success: true, message: 'bye' });
  });

  test('getCurrentUser returns success=true when authenticated=true', async () => {
    mockAxiosClient.get.mockResolvedValue({
      data: { authenticated: true, user: { id: 'u1' } },
    });
    const r = await apiService.getCurrentUser();
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: 'u1' });
  });

  test('getCurrentUser returns success=false when authenticated=false', async () => {
    mockAxiosClient.get.mockResolvedValue({ data: { authenticated: false } });
    const r = await apiService.getCurrentUser();
    expect(r.success).toBe(false);
  });
});

describe('Graph methods', () => {
  test('getGraphs forwards filters as query params and unwraps {graphs, pagination}', async () => {
    mockAxiosClient.get.mockResolvedValue({
      data: {
        graphs: [{ id: 1 }, { id: 2 }],
        pagination: { page: 2, limit: 10, total: 2, pages: 1 },
      },
    });
    const r = await apiService.getGraphs({ page: 2, limit: 10 } as any);
    expect(mockAxiosClient.get).toHaveBeenCalledWith('/graphs', {
      params: { page: 2, limit: 10 },
    });
    expect(r.success).toBe(true);
    expect(r.data.data).toHaveLength(2);
    expect(r.data.total).toBe(2);
  });

  test('getGraph hits /graphs/:id', async () => {
    mockAxiosClient.get.mockResolvedValue({ data: { success: true } });
    await apiService.getGraph(42);
    expect(mockAxiosClient.get).toHaveBeenCalledWith('/graphs/42');
  });

  test('createGraph posts the body to /graphs', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: { success: true } });
    await apiService.createGraph({ title: 'X' } as any);
    expect(mockAxiosClient.post).toHaveBeenCalledWith('/graphs', { title: 'X' });
  });

  test('updateGraph puts to /graphs/:id', async () => {
    mockAxiosClient.put.mockResolvedValue({ data: { success: true } });
    await apiService.updateGraph(7, { title: 'Renamed' } as any);
    expect(mockAxiosClient.put).toHaveBeenCalledWith('/graphs/7', { title: 'Renamed' });
  });

  test('deleteGraph deletes /graphs/:id', async () => {
    mockAxiosClient.delete.mockResolvedValue({ data: { success: true } });
    await apiService.deleteGraph(99);
    expect(mockAxiosClient.delete).toHaveBeenCalledWith('/graphs/99');
  });

  test('duplicateGraph posts the new name to /:id/duplicate', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: { success: true } });
    await apiService.duplicateGraph(3, 'Copy');
    expect(mockAxiosClient.post).toHaveBeenCalledWith('/graphs/3/duplicate', { title: 'Copy' });
  });
});

describe('DOT validation methods', () => {
  test('validateDot uses /public/validate-dot with dotCode field name', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: { success: true, data: {} } });
    await apiService.validateDot('digraph G { A -> B }');
    expect(mockAxiosClient.post).toHaveBeenCalledWith('/public/validate-dot', {
      dotCode: 'digraph G { A -> B }',
    });
  });

  test('parseDot also targets the public validation endpoint', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: { success: true } });
    await apiService.parseDot('digraph G { A -> B }');
    expect(mockAxiosClient.post).toHaveBeenCalledWith('/public/validate-dot', {
      dotCode: 'digraph G { A -> B }',
    });
  });
});

describe('Import/export methods', () => {
  test('exportGraph requests blob response type', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: new Blob([]) });
    await apiService.exportGraph(5, { format: 'json' } as any);
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      '/import-export/export/5',
      { format: 'json' },
      { responseType: 'blob' },
    );
  });

  test('exportMultipleGraphs spreads options and ids', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: new Blob([]) });
    await apiService.exportMultipleGraphs([1, 2, 3], { format: 'dot' } as any);
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      '/import-export/export-multiple',
      { graph_ids: [1, 2, 3], format: 'dot' },
      { responseType: 'blob' },
    );
  });

  test('importGraph builds a multipart form', async () => {
    mockAxiosClient.post.mockResolvedValue({ data: { success: true } });
    const file = new Blob(['x'], { type: 'text/plain' });
    Object.defineProperty(file, 'name', { value: 'g.dot' });
    await apiService.importGraph(file as any);
    const args = mockAxiosClient.post.mock.calls[0];
    expect(args[0]).toBe('/import-export/import');
    expect(args[2].headers['Content-Type']).toBe('multipart/form-data');
  });
});

describe('User management methods', () => {
  test('getUsers passes page/limit params', async () => {
    mockAxiosClient.get.mockResolvedValue({ data: { success: true } });
    await apiService.getUsers(3, 50);
    expect(mockAxiosClient.get).toHaveBeenCalledWith('/users', {
      params: { page: 3, limit: 50 },
    });
  });
});
