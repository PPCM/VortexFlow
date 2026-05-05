import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard' }),
}), { virtual: true });

const mockLogout = jest.fn();
const mockState: any = { user: null };
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: mockState, logout: mockLogout }),
}));

// NotificationButton imports useNotifications; stub it so we don't need the
// provider tree just to render the AppBar.
jest.mock('../common/NotificationButton', () => ({
  __esModule: true,
  default: () => <div data-testid="notif-button" />,
}));

import Navigation from './Navigation';

const renderNav = () => render(<Navigation />);

beforeEach(() => {
  mockNavigate.mockReset();
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockState.user = { id: 'u1', username: 'alice', role: 'editor' };
});

describe('Navigation — menu visibility by role', () => {
  test('editor sees dashboard, graphs, new graph but NOT admin', () => {
    renderNav();
    expect(screen.getAllByText('Tableau de bord').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Graphiques').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nouveau graphique').length).toBeGreaterThan(0);
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  test('admin also sees the Administration entry', () => {
    mockState.user = { id: 'u1', username: 'admin', role: 'admin' };
    renderNav();
    expect(screen.getAllByText('Administration').length).toBeGreaterThan(0);
  });

  test('viewer is treated like editor (no admin entry)', () => {
    mockState.user = { id: 'u1', username: 'bob', role: 'viewer' };
    renderNav();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });
});

describe('Navigation — interactions', () => {
  test('clicking a sidebar item navigates to its path', async () => {
    renderNav();
    // Two drawers (mobile + desktop) render the same items, click the first.
    userEvent.click(screen.getAllByText('Graphiques')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/graphs');
  });

  test('opening the profile menu reveals "Mon profil" and "Déconnexion"', async () => {
    renderNav();
    userEvent.click(screen.getByLabelText(/account of current user/i));
    expect(await screen.findByText('Mon profil')).toBeInTheDocument();
    expect(screen.getByText('Déconnexion')).toBeInTheDocument();
  });

  test('"Mon profil" navigates to /profile', async () => {
    renderNav();
    userEvent.click(screen.getByLabelText(/account of current user/i));
    userEvent.click(await screen.findByText('Mon profil'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  test('"Déconnexion" calls logout and then navigates to /login', async () => {
    renderNav();
    userEvent.click(screen.getByLabelText(/account of current user/i));
    userEvent.click(await screen.findByText('Déconnexion'));

    expect(mockLogout).toHaveBeenCalled();
    // The handler awaits logout() then calls navigate('/login'); flush microtasks.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

describe('Navigation — avatar', () => {
  test('avatar shows the first letter of username (uppercased)', () => {
    mockState.user = { id: 'u1', username: 'alice', role: 'editor' };
    const { container } = renderNav();
    // Avatar text content is the first letter, uppercased.
    const avatar = container.querySelector('.MuiAvatar-root');
    expect(avatar?.textContent).toBe('A');
  });
});
