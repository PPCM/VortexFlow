import type { Mock } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Build the mocked adminService inside the jest.mock factory to avoid the
// "Cannot access ... before initialization" TDZ issue with const variables
// referenced from a hoisted jest.mock call.
vi.mock('../../services/adminService', () => {
  const mk = () => vi.fn().mockResolvedValue({
    data: [], total: 0, page: 1, totalPages: 1,
  });
  const adminService = {
    getStats: vi.fn().mockResolvedValue({
      overview: {
        totalUsers: 0, totalGraphs: 0, totalSimulations: 0,
        activeSimulations: 0, recentUsers: 0, todayActivity: 0,
      },
      breakdown: { usersByRole: {}, graphsByStatus: {}, simulationsByStatus: {} },
    }),
    getUsers: mk(),
    getGraphs: mk(),
    getSimulations: mk(),
    getActivityLog: mk(),
    getSystemInfo: vi.fn().mockResolvedValue({
      server: {}, database: {}, redis: {}, email: {}, features: {}, limits: {},
    }),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    permanentDeleteUser: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockResolvedValue(undefined),
    resetUserPassword: vi.fn().mockResolvedValue(undefined),
    bulkUserAction: vi.fn().mockResolvedValue({ affected_count: 0 }),
  };
  return { __esModule: true, adminService };
});

import { adminService as mockAdminService } from '../../services/adminService';

// Stub the CSS import.
vi.mock('./AdminPanel.css', () => ({}));

// Stub the dialog children to keep render light.
vi.mock('./UserManagementDialog', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('./BulkActionsBar', () => ({
  __esModule: true,
  default: () => <div data-testid="bulk-bar" />,
}));
vi.mock('./PasswordResetDialog', () => ({
  __esModule: true,
  default: () => null,
}));

import AdminPanel from './AdminPanel';

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

beforeEach(() => {
  // Reset mocks between tests.
  Object.values(mockAdminService).forEach((fn) => (fn as Mock).mockClear());
});

describe('AdminPanel', () => {
  test('renders the panel header and tab labels', async () => {
    render(<AdminPanel />);
    expect(screen.getByText(/Panneau d'Administration/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Utilisateurs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Graphiques$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Simulations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Activité/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Système/i })).toBeInTheDocument();
  });

  test('triggers stats load on mount', async () => {
    render(<AdminPanel />);
    await waitFor(() =>
      expect(mockAdminService.getStats as Mock).toHaveBeenCalled(),
    );
  });
});
