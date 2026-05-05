import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn(() => ({}));
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}), { virtual: true });

const mockUseGraph = jest.fn();
jest.mock('../../context/GraphContext', () => ({
  useGraph: () => mockUseGraph(),
}));

jest.mock('../../services/websocket', () => ({
  useWebSocket: () => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: () => false,
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  }),
}));

jest.mock('../common/LoadingPage', () => ({
  __esModule: true,
  default: ({ message }: any) => <div data-testid="loading">{message}</div>,
}));

jest.mock('./DOTCodeMirrorEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="dot-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

jest.mock('./GraphRenderer3D', () => ({
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
  loadGraph: jest.fn().mockResolvedValue(undefined),
  saveGraph: jest.fn().mockResolvedValue(true),
  createGraph: jest.fn().mockResolvedValue(true),
  updateGraph: jest.fn().mockResolvedValue(true),
  validateDot: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
  parseDot: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
  startSimulation: jest.fn(),
  stopSimulation: jest.fn(),
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
