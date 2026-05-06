import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/dashboard' };
vi.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

const mockLogout = vi.fn();
const mockUseAuth = vi.fn();
const mockUsePermissions = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  usePermissions: () => mockUsePermissions(),
}));

import Layout from './Layout';

beforeEach(() => {
  mockNavigate.mockReset();
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockLocation.pathname = '/dashboard';
  mockUseAuth.mockReturnValue({ logout: mockLogout });
  mockUsePermissions.mockReturnValue({
    user: { id: 1, username: 'alice', role: 'editor', email: 'a@b.com' },
    hasRole: (r: string) => r === 'viewer' || r === 'editor',
  });
});

describe('Layout', () => {
  test('renders children inside the main content area', () => {
    render(
      <Layout>
        <div data-testid="content">page body</div>
      </Layout>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  test('shows non-admin nav items for an editor', () => {
    render(<Layout><div /></Layout>);
    expect(screen.getAllByText('Tableau de bord').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Graphiques').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profil').length).toBeGreaterThan(0);
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  test('shows the Administration entry when user has admin role', () => {
    mockUsePermissions.mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', email: 'admin@b.com' },
      hasRole: () => true,
    });
    render(<Layout><div /></Layout>);
    expect(screen.getAllByText('Administration').length).toBeGreaterThan(0);
  });

  test('clicking a nav item triggers navigate', () => {
    render(<Layout><div /></Layout>);
    userEvent.click(screen.getAllByText('Graphiques')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/graphs');
  });
});
