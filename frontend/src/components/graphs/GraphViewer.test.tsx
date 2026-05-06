import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
vi.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

const mockUseGraph = vi.fn();
vi.mock('../../context/GraphContext', () => ({
  useGraph: () => mockUseGraph(),
}));

const mockUsePermissions = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock('../../services/websocket', () => ({
  useWebSocket: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: () => false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  }),
}));

vi.mock('../common/LoadingPage', () => ({
  __esModule: true,
  default: ({ message }: any) => <div data-testid="loading">{message}</div>,
}));

// GraphRenderer3D pulls 3d-force-graph + three.js (ESM, requires Canvas/WebGL).
// Stub it so the Viewer test stays hermetic.
vi.mock('./GraphRenderer3D', () => ({
  __esModule: true,
  default: () => <div data-testid="renderer-3d" />,
}));

import GraphViewer from './GraphViewer';

const baseCtx = (overrides: any = {}) => ({
  state: {
    currentGraph: null,
    graphData: null,
    loading: false,
    error: null,
    ...overrides.state,
  },
  loadGraph: vi.fn().mockResolvedValue(undefined),
  startSimulation: vi.fn(),
  stopSimulation: vi.fn(),
  pauseSimulation: vi.fn(),
  simulationState: null,
  ...overrides,
});

beforeEach(() => {
  mockNavigate.mockReset();
  mockUseParams.mockReset().mockReturnValue({ id: '5' });
  mockUseGraph.mockReset().mockReturnValue(baseCtx());
  mockUsePermissions.mockReset().mockReturnValue({ canEdit: () => true });
});

describe('GraphViewer', () => {
  test('shows the loading page while state.loading is true', () => {
    mockUseGraph.mockReturnValue(baseCtx({ state: { loading: true } }));
    render(<GraphViewer />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  test('renders "Graphique non trouvé" when no current graph', () => {
    render(<GraphViewer />);
    expect(screen.getByText('Graphique non trouvé')).toBeInTheDocument();
  });

  test('renders the graph title once a current graph is loaded', () => {
    mockUseGraph.mockReturnValue(baseCtx({
      state: {
        currentGraph: { id: 5, name: 'My Graph', dot_content: 'digraph G {}' },
        graphData: { nodes: [], edges: [] },
      },
    }));
    render(<GraphViewer />);
    expect(screen.getByText('My Graph')).toBeInTheDocument();
  });

  test('calls loadGraph for the route id on mount', async () => {
    const ctx = baseCtx();
    mockUseGraph.mockReturnValue(ctx);
    render(<GraphViewer />);
    // IDs are passed as strings (UUIDs in production) — no Number coercion.
    await waitFor(() => expect(ctx.loadGraph).toHaveBeenCalledWith('5'));
  });
});
