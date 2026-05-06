import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

const mockUseGraph = vi.fn();
vi.mock('../../context/GraphContext', () => ({
  useGraph: () => mockUseGraph(),
}));

const mockUsePermissions = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock('../common/LoadingPage', () => ({
  __esModule: true,
  default: ({ message }: any) => <div data-testid="loading">{message}</div>,
}));

import GraphList from './GraphList';

const fakeGraph = (overrides: any = {}) => ({
  id: 1,
  name: 'My Graph',
  description: 'desc',
  is_public: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
  ...overrides,
});

const baseGraphCtx = (overrides: any = {}) => ({
  state: {
    graphs: [],
    error: null,
    loading: false,
    ...overrides.state,
  },
  loadGraphs: vi.fn(),
  deleteGraph: vi.fn().mockResolvedValue(true),
  duplicateGraph: vi.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => {
  mockNavigate.mockReset();
  mockUseGraph.mockReset().mockReturnValue(baseGraphCtx());
  mockUsePermissions.mockReset().mockReturnValue({
    canEdit: () => true,
    canAdmin: () => false,
  });
});

describe('GraphList', () => {
  test('shows the loading page while state.loading is true', () => {
    mockUseGraph.mockReturnValue(baseGraphCtx({ state: { graphs: [], loading: true } }));
    render(<GraphList />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  test('renders the empty state when there are no graphs', () => {
    render(<GraphList />);
    expect(screen.getByText('Aucun graphique trouvé')).toBeInTheDocument();
  });

  test('shows error banner when state.error is set', () => {
    mockUseGraph.mockReturnValue(baseGraphCtx({ state: { graphs: [], error: 'boom' } }));
    render(<GraphList />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  test('renders one card per graph', () => {
    mockUseGraph.mockReturnValue(baseGraphCtx({
      state: { graphs: [fakeGraph({ id: 1, name: 'Alpha' }), fakeGraph({ id: 2, name: 'Beta' })] },
    }));
    render(<GraphList />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  test('hides "Nouveau Graphique" for users without edit permission', () => {
    mockUsePermissions.mockReturnValue({
      canEdit: () => false,
      canAdmin: () => false,
    });
    render(<GraphList />);
    expect(screen.queryByRole('button', { name: /Nouveau Graphique/i })).not.toBeInTheDocument();
  });

  test('clicking "Nouveau Graphique" navigates to /graphs/create', () => {
    render(<GraphList />);
    userEvent.click(screen.getByRole('button', { name: /Nouveau Graphique/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/graphs/create');
  });

  test('triggers loadGraphs on mount with current filters', async () => {
    const ctx = baseGraphCtx();
    mockUseGraph.mockReturnValue(ctx);
    render(<GraphList />);
    await waitFor(() => expect(ctx.loadGraphs).toHaveBeenCalled());
  });
});
