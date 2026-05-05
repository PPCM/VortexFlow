import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

// Suppress React's error logging for the deliberate throws below.
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

const Boom: React.FC<{ message?: string }> = ({ message = 'kaboom' }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  test('renders children normally when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  test('renders the default error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Oups !/)).toBeInTheDocument();
  });

  test('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
  });

  test('calls the onError callback with the error and errorInfo', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom message="specific" />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [err, info] = onError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('specific');
    expect(info).toHaveProperty('componentStack');
  });

  test('handleRetry resets the boundary so children can re-render', () => {
    // First render: child throws and we show the default UI.
    let shouldThrow = true;
    const Maybe: React.FC = () => {
      if (shouldThrow) throw new Error('first');
      return <div>recovered</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Oups !/)).toBeInTheDocument();

    // Click "Réessayer" — boundary clears its error state. After that, when
    // we re-render with a non-throwing child, the recovered content shows.
    shouldThrow = false;
    userEvent.click(screen.getByRole('button', { name: /réessayer/i }));
    rerender(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});
