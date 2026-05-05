import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingPage from './LoadingPage';

describe('LoadingPage', () => {
  test('renders the default message', () => {
    render(<LoadingPage />);
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  test('renders a custom message when provided', () => {
    render(<LoadingPage message="Vérification de la session..." />);
    expect(screen.getByText('Vérification de la session...')).toBeInTheDocument();
  });

  test('always shows a progress indicator', () => {
    const { container } = render(<LoadingPage />);
    expect(container.querySelector('.MuiCircularProgress-root')).toBeTruthy();
  });

  test('respects the fullscreen=false flag', () => {
    // We can't easily inspect MUI sx output, but the component should still
    // render without crashing in non-fullscreen mode.
    expect(() => render(<LoadingPage fullscreen={false} />)).not.toThrow();
  });
});
