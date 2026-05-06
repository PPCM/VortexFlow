import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
const mockUseParams = vi.fn(() => ({}));
vi.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

const mockUseGraph = vi.fn();
vi.mock('../../context/GraphContext', () => ({
  useGraph: () => mockUseGraph(),
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

vi.mock('./DOTCodeMirrorEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="dot-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('./GraphRenderer3D', () => ({
  __esModule: true,
  default: () => <div data-testid="renderer-3d" />,
}));

import GraphEditor from './GraphEditor';

const baseCtx = (overrides: any = {}) => ({
  state: {
    currentGraph: null,
    graphData: null,
    loading: false,
    error: null,
    ...overrides.state,
  },
  loadGraph: vi.fn().mockResolvedValue(undefined),
  saveGraph: vi.fn().mockResolvedValue(true),
  createGraph: vi.fn().mockResolvedValue(true),
  updateGraph: vi.fn().mockResolvedValue(true),
  validateDot: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
  parseDot: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  startSimulation: vi.fn(),
  stopSimulation: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  mockNavigate.mockReset();
  mockUseParams.mockReset().mockReturnValue({});
  mockUseGraph.mockReset().mockReturnValue(baseCtx());
});

describe('GraphEditor', () => {
  test('shows the loading page while graph is loading and id is set', () => {
    mockUseParams.mockReturnValue({ id: '5' });
    mockUseGraph.mockReturnValue(baseCtx({ state: { loading: true } }));
    render(<GraphEditor />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  test('renders the DOT editor and the 3D renderer for a new graph', () => {
    render(<GraphEditor />);
    expect(screen.getByTestId('dot-editor')).toBeInTheDocument();
    // Header includes "Nouveau Graphique" placeholder
    expect(screen.getByText(/Nouveau Graphique/i)).toBeInTheDocument();
  });

  test('calls loadGraph when an :id route param is present', async () => {
    const ctx = baseCtx();
    mockUseGraph.mockReturnValue(ctx);
    mockUseParams.mockReturnValue({ id: '7' });
    render(<GraphEditor />);
    await waitFor(() => expect(ctx.loadGraph).toHaveBeenCalledWith('7'));
  });

  test('does not call loadGraph for new-graph route', async () => {
    const ctx = baseCtx();
    mockUseGraph.mockReturnValue(ctx);
    mockUseParams.mockReturnValue({});
    render(<GraphEditor />);
    // Wait a tick to ensure no async call happened.
    await new Promise((r) => setTimeout(r, 0));
    expect(ctx.loadGraph).not.toHaveBeenCalled();
  });
});
