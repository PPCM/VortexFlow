import React from 'react';
import { render, screen } from '@testing-library/react';

const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseGraph = jest.fn();
jest.mock('../../context/GraphContext', () => ({
  useGraph: () => mockUseGraph(),
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    updateProfile: jest.fn().mockResolvedValue({ success: true }),
    changePassword: jest.fn().mockResolvedValue({ success: true }),
  },
  apiService: {
    updateProfile: jest.fn().mockResolvedValue({ success: true }),
    changePassword: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import UserProfile from './UserProfile';

const FAKE_USER = {
  id: 1,
  username: 'alice',
  email: 'a@b.com',
  first_name: 'Alice',
  last_name: 'Smith',
  role: 'editor',
  is_active: true,
  preferences: { theme: 'dark', language: 'fr' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
} as any;

beforeEach(() => {
  mockUseAuth.mockReset().mockReturnValue({
    state: { user: FAKE_USER, isAuthenticated: true },
    refreshUser: jest.fn().mockResolvedValue(undefined),
  });
  mockUseGraph.mockReset().mockReturnValue({
    state: { graphs: [{ id: 1 }, { id: 2 }] },
    loadGraphs: jest.fn().mockResolvedValue(undefined),
  });
});

describe('UserProfile', () => {
  test('renders the page title and tabs', () => {
    render(<UserProfile />);
    expect(screen.getByText('Mon Profil')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Informations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Préférences/i })).toBeInTheDocument();
  });

  test('displays the current user details from auth state', () => {
    const { container } = render(<UserProfile />);
    // Email may be the value of a controlled TextField rather than text in
    // the document — search the rendered HTML for it.
    expect(container.innerHTML).toMatch(/a@b\.com/);
  });

  test('renders without crashing when auth user is null (edge case)', () => {
    mockUseAuth.mockReturnValue({
      state: { user: null, isAuthenticated: false },
      refreshUser: jest.fn(),
    });
    expect(() => render(<UserProfile />)).not.toThrow();
  });
});
