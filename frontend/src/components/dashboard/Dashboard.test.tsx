import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

const mockGetDashboardStats = vi.fn();
vi.mock('../../services/api', () => ({
  apiService: {
    getDashboardStats: (...a: any[]) => mockGetDashboardStats(...a),
  },
}));

const mockUseAuth = vi.fn();
const mockUsePermissions = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  usePermissions: () => mockUsePermissions(),
}));

const mockUseGraph = vi.fn();
vi.mock('../../context/GraphContext', () => ({
  useGraph: () => mockUseGraph(),
}));

const mockUseSimulation = vi.fn();
vi.mock('../../context/SimulationContext', () => ({
  useSimulation: () => mockUseSimulation(),
}));

vi.mock('../common/LoadingPage', () => ({
  __esModule: true,
  default: ({ message }: { message?: string }) => (
    <div data-testid="loading">{message ?? 'Loading'}</div>
  ),
}));

import Dashboard from './Dashboard';

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

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
    loadGraphs: vi.fn().mockResolvedValue(undefined),
  });
  mockUseSimulation.mockReset().mockReturnValue({
    state: { sessions: [] },
    actions: { loadSessions: vi.fn().mockResolvedValue(undefined) },
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
      loadGraphs: vi.fn().mockResolvedValue(undefined),
    });
    mockUseSimulation.mockReturnValue({
      state: {
        sessions: [
          { id: 's1', status: 'running' },
          { id: 's2', status: 'completed' },
        ],
      },
      actions: { loadSessions: vi.fn().mockResolvedValue(undefined) },
    });

    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
    // 2 graphs, 1 active simulation, totalUsers fallback = 1, activity = graphs.length.
    expect(screen.getByText(/Bonjour/i)).toBeInTheDocument();
  });
});
