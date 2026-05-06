// Tests for AuthContext: reducer-driven auth state, login/register/logout
// flows, and the usePermissions/ProtectedRoute helpers exported from the same
// module. apiService is mocked so no network calls happen.

import React from 'react';
import { render, renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth, usePermissions, ProtectedRoute } from './AuthContext';

const mockGetCurrentUser = vi.fn();
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLogout = vi.fn();
const mockHandleApiError = vi.fn((...args: any[]) => args[0]?.message ?? 'unknown');

vi.mock('../services/api', () => ({
  __esModule: true,
  apiService: {
    getCurrentUser: (...a: any[]) => mockGetCurrentUser(...a),
    login: (...a: any[]) => mockLogin(...a),
    register: (...a: any[]) => mockRegister(...a),
    logout: (...a: any[]) => mockLogout(...a),
    handleApiError: (...a: any[]) => mockHandleApiError(...a),
  },
  default: {
    getCurrentUser: (...a: any[]) => mockGetCurrentUser(...a),
    login: (...a: any[]) => mockLogin(...a),
    register: (...a: any[]) => mockRegister(...a),
    logout: (...a: any[]) => mockLogout(...a),
    handleApiError: (...a: any[]) => mockHandleApiError(...a),
  },
}));

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  mockGetCurrentUser.mockReset().mockResolvedValue({ success: false, data: null });
  mockLogin.mockReset();
  mockRegister.mockReset();
  mockLogout.mockReset();
  mockHandleApiError.mockClear();
  localStorage.clear();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const FAKE_USER = { id: 'u1', email: 'a@b.com', role: 'editor' as const };

// ----------------------------------------------------------------------------
// Initial mount behaviour
// ----------------------------------------------------------------------------
describe('AuthProvider — initial mount', () => {
  test('starts with loading=true then transitions to LOGOUT when no session', async () => {
    mockGetCurrentUser.mockResolvedValue({ success: false, data: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.state.loading).toBe(true);
    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.isAuthenticated).toBe(false);
    expect(result.current.state.user).toBeNull();
  });

  test('hydrates the user when getCurrentUser succeeds on mount', async () => {
    mockGetCurrentUser.mockResolvedValue({ success: true, data: FAKE_USER });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.state.user).toEqual(FAKE_USER));
    expect(result.current.state.isAuthenticated).toBe(true);
  });

  test('treats a network error during the boot probe as logged-out', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.isAuthenticated).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// login()
// ----------------------------------------------------------------------------
describe('AuthProvider — login', () => {
  test('returns true and dispatches SET_USER on success', async () => {
    mockLogin.mockResolvedValue({ success: true, data: FAKE_USER });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.loading).toBe(false));

    let outcome = false;
    await act(async () => {
      outcome = await result.current.login({ email: 'a@b.com', password: 'p' } as any);
    });

    expect(outcome).toBe(true);
    expect(result.current.state.user).toEqual(FAKE_USER);
    expect(result.current.state.isAuthenticated).toBe(true);
    expect(localStorage.getItem('vortexflow_last_login')).toBeTruthy();
  });

  test('returns false and dispatches SET_ERROR on failed login', async () => {
    mockLogin.mockResolvedValue({ success: false, message: 'bad creds' });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.loading).toBe(false));

    let outcome = true;
    await act(async () => {
      outcome = await result.current.login({ email: 'x', password: 'y' } as any);
    });

    expect(outcome).toBe(false);
    expect(result.current.state.error).toBe('bad creds');
    expect(result.current.state.user).toBeNull();
  });

  test('thrown errors are caught and surfaced via handleApiError', async () => {
    mockLogin.mockRejectedValue(new Error('boom'));
    // Pin the impl explicitly so the assertion is unambiguous.
    mockHandleApiError.mockImplementation(() => 'mapped error');
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.loading).toBe(false));

    let outcome = true;
    await act(async () => {
      outcome = await result.current.login({ email: 'x', password: 'y' } as any);
    });

    expect(outcome).toBe(false);
    expect(mockHandleApiError).toHaveBeenCalled();
    await waitFor(() => expect(result.current.state.error).toBe('mapped error'));
  });
});

// ----------------------------------------------------------------------------
// register()
// ----------------------------------------------------------------------------
describe('AuthProvider — register', () => {
  test('logs in the new user on success', async () => {
    mockRegister.mockResolvedValue({ success: true, data: FAKE_USER });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.loading).toBe(false));

    let outcome = false;
    await act(async () => {
      outcome = await result.current.register({ email: 'a@b.com', password: 'p' } as any);
    });

    expect(outcome).toBe(true);
    expect(result.current.state.user).toEqual(FAKE_USER);
  });

  test('reports backend message on failure', async () => {
    mockRegister.mockResolvedValue({ success: false, message: 'email taken' });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.loading).toBe(false));

    await act(async () => {
      await result.current.register({ email: 'x', password: 'y' } as any);
    });

    expect(result.current.state.error).toBe('email taken');
  });
});

// ----------------------------------------------------------------------------
// logout(), refreshUser(), clearError()
// ----------------------------------------------------------------------------
describe('AuthProvider — logout / refreshUser / clearError', () => {
  // Replace window.location to make the redirect inert in jsdom.
  const originalLocation = window.location;
  beforeEach(() => {
    delete (window as any).location;
    (window as any).location = { ...originalLocation, href: '/' };
  });
  afterAll(() => {
    (window as any).location = originalLocation;
  });

  test('logout clears user and removes last-login marker even if API errors', async () => {
    mockGetCurrentUser.mockResolvedValue({ success: true, data: FAKE_USER });
    mockLogout.mockRejectedValue(new Error('network'));
    localStorage.setItem('vortexflow_last_login', 'old');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.user).toEqual(FAKE_USER));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.state.user).toBeNull();
    expect(result.current.state.isAuthenticated).toBe(false);
    expect(localStorage.getItem('vortexflow_last_login')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  test('refreshUser hydrates the user when API responds with one', async () => {
    mockGetCurrentUser.mockResolvedValue({ success: false, data: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.loading).toBe(false));

    mockGetCurrentUser.mockResolvedValueOnce({ success: true, data: FAKE_USER });
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.state.user).toEqual(FAKE_USER);
  });

  test('refreshUser logs out when API reports no session', async () => {
    mockGetCurrentUser.mockResolvedValue({ success: true, data: FAKE_USER });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.user).toEqual(FAKE_USER));

    mockGetCurrentUser.mockResolvedValueOnce({ success: false, data: null });
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.state.user).toBeNull();
  });

  test('clearError dispatches CLEAR_ERROR', async () => {
    mockLogin.mockResolvedValue({ success: false, message: 'oops' });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.loading).toBe(false));

    await act(async () => {
      await result.current.login({ email: 'x', password: 'y' } as any);
    });
    expect(result.current.state.error).toBe('oops');

    act(() => result.current.clearError());
    expect(result.current.state.error).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// useAuth outside provider
// ----------------------------------------------------------------------------
describe('useAuth', () => {
  test('throws when called outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});

// ----------------------------------------------------------------------------
// usePermissions
// ----------------------------------------------------------------------------
describe('usePermissions', () => {
  const renderWithUser = (user: any) => {
    mockGetCurrentUser.mockResolvedValue({ success: true, data: user });
    return renderHook(() => usePermissions(), { wrapper });
  };

  test('viewer cannot edit, cannot admin, can view', async () => {
    const { result } = renderWithUser({ id: 'u', role: 'viewer' });
    await waitFor(() => expect(result.current.user?.role).toBe('viewer'));
    expect(result.current.canView()).toBe(true);
    expect(result.current.canEdit()).toBe(false);
    expect(result.current.canAdmin()).toBe(false);
  });

  test('editor can edit but not admin', async () => {
    const { result } = renderWithUser({ id: 'u', role: 'editor' });
    await waitFor(() => expect(result.current.user?.role).toBe('editor'));
    expect(result.current.canEdit()).toBe(true);
    expect(result.current.canAdmin()).toBe(false);
  });

  test('admin can do everything', async () => {
    const { result } = renderWithUser({ id: 'u', role: 'admin' });
    await waitFor(() => expect(result.current.user?.role).toBe('admin'));
    expect(result.current.canView()).toBe(true);
    expect(result.current.canEdit()).toBe(true);
    expect(result.current.canAdmin()).toBe(true);
  });

  test('unauthenticated user has no roles', async () => {
    mockGetCurrentUser.mockResolvedValue({ success: false, data: null });
    const { result } = renderHook(() => usePermissions(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.canView()).toBe(false);
    expect(result.current.hasRole('admin')).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// ProtectedRoute
// ----------------------------------------------------------------------------
describe('ProtectedRoute', () => {
  test('shows a loading placeholder during the boot probe', () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {})); // never resolves
    const { getByText } = render(
      <AuthProvider>
        <ProtectedRoute>
          <div>secret</div>
        </ProtectedRoute>
      </AuthProvider>,
    );
    expect(getByText('Chargement...')).toBeInTheDocument();
  });

  test('shows fallback when user is unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue({ success: false, data: null });
    const { findByText, queryByText } = render(
      <AuthProvider>
        <ProtectedRoute fallback={<div>denied</div>}>
          <div>secret</div>
        </ProtectedRoute>
      </AuthProvider>,
    );
    expect(await findByText('denied')).toBeInTheDocument();
    expect(queryByText('secret')).not.toBeInTheDocument();
  });

  test('renders children for authenticated user without role requirement', async () => {
    mockGetCurrentUser.mockResolvedValue({
      success: true, data: { id: 'u', role: 'viewer' },
    });
    const { findByText } = render(
      <AuthProvider>
        <ProtectedRoute>
          <div>secret</div>
        </ProtectedRoute>
      </AuthProvider>,
    );
    expect(await findByText('secret')).toBeInTheDocument();
  });

  test('blocks viewer from admin-only route', async () => {
    mockGetCurrentUser.mockResolvedValue({
      success: true, data: { id: 'u', role: 'viewer' },
    });
    const { findByText, queryByText } = render(
      <AuthProvider>
        <ProtectedRoute requiredRole="admin" fallback={<div>denied</div>}>
          <div>secret</div>
        </ProtectedRoute>
      </AuthProvider>,
    );
    expect(await findByText('denied')).toBeInTheDocument();
    expect(queryByText('secret')).not.toBeInTheDocument();
  });

  test('admin can access editor-only route', async () => {
    mockGetCurrentUser.mockResolvedValue({
      success: true, data: { id: 'u', role: 'admin' },
    });
    const { findByText } = render(
      <AuthProvider>
        <ProtectedRoute requiredRole="editor">
          <div>secret</div>
        </ProtectedRoute>
      </AuthProvider>,
    );
    expect(await findByText('secret')).toBeInTheDocument();
  });
});
