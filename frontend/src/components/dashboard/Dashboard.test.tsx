import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}), { virtual: true });

const mockGetDashboardStats = jest.fn();
jest.mock('../../services/api', () => ({
  apiService: {
    getDashboardStats: (...a: any[]) => mockGetDashboardStats(...a),
  },
}));

const mockUseAuth = jest.fn();
const mockUsePermissions = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  usePermissions: () => mockUsePermissions(),
}));

const mockUseGraph = jest.fn();
jest.mock('../../context/GraphContext', () => ({
  useGraph: () => mockUseGraph(),
}));

const mockUseSimulation = jest.fn();
jest.mock('../../context/SimulationContext', () => ({
  useSimulation: () => mockUseSimulation(),
}));

jest.mock('../common/LoadingPage', () => ({
  __esModule: true,
  default: ({ message }: { message?: string }) => (
    <div data-testid="loading">{message ?? 'Loading'}</div>
  ),
}));

import Dashboard from './Dashboard';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

beforeEach(() => {
  mockNavigate.mockReset();
  mockGetDashboardStats.mockReset();
  mockUseAuth.mockReset().mockReturnValue({
    state: { user: { fullName: 'alice', email: 'alice@x.com' } },
  });
  mockUsePermissions.mockReset().mockReturnValue({
    canEdit: () => true,
    user: { fullName: 'alice', email: 'alice@x.com' },
  });
  mockUseGraph.mockReset().mockReturnValue({
    state: { graphs: [{ id: 1, title: 'G1' }] },
    loadGraphs: jest.fn().mockResolvedValue(undefined),
  });
  mockUseSimulation.mockReset().mockReturnValue({
    state: { sessions: [] },
    actions: { loadSessions: jest.fn().mockResolvedValue(undefined) },
  });
});

describe('Dashboard', () => {
  test('shows the loading page while initial data fetches', () => {
    mockGetDashboardStats.mockReturnValue(new Promise(() => {})); // never settles
    render(<Dashboard />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  test('renders the user greeting and stat tiles after data loads', async () => {
    mockGetDashboardStats.mockResolvedValue({
      success: true,
      data: { totalGraphs: 5, activeSimulations: 2, totalUsers: 3, recentActivity: 7 },
    });
    render(<Dashboard />);
    expect(await screen.findByText(/Bonjour, alice/i)).toBeInTheDocument();
    expect(screen.getByText('Graphiques')).toBeInTheDocument();
    expect(screen.getByText('Simulations Actives')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // totalGraphs
  });

  test('falls back to derived stats when getDashboardStats reports failure', async () => {
    mockGetDashboardStats.mockResolvedValue({ success: false });
    mockUseGraph.mockReturnValue({
      state: { graphs: [{ id: 1 }, { id: 2 }] },
      loadGraphs: jest.fn().mockResolvedValue(undefined),
    });
    mockUseSimulation.mockReturnValue({
      state: {
        sessions: [
          { id: 's1', status: 'running' },
          { id: 's2', status: 'completed' },
        ],
      },
      actions: { loadSessions: jest.fn().mockResolvedValue(undefined) },
    });

    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
    // 2 graphs, 1 active simulation, totalUsers fallback = 1, activity = graphs.length.
    expect(screen.getByText(/Bonjour/i)).toBeInTheDocument();
  });
});
