import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();
// Full mock of react-router-dom; v7's ESM exports don't resolve cleanly
// through Jest, so we shim only what NotFoundPage uses.
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}), { virtual: true });

import NotFoundPage from './NotFoundPage';

beforeEach(() => {
  mockNavigate.mockReset();
});

const renderInRouter = () => render(<NotFoundPage />);

describe('NotFoundPage', () => {
  test('shows the 404 code and the explanatory message', () => {
    renderInRouter();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page non trouvée')).toBeInTheDocument();
  });

  test('clicking "Accueil" navigates to /dashboard', () => {
    renderInRouter();
    userEvent.click(screen.getByRole('button', { name: /accueil/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('clicking "Retour" navigates back (-1)', () => {
    renderInRouter();
    userEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
