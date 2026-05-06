import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
// LoginPage uses Link as RouterLink + useNavigate. Full-mock the module so
// Jest doesn't try to resolve react-router-dom v7's ESM exports.
vi.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...rest }: any) => <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>,
}));

const mockLogin = vi.fn();
const mockState: { user: any; isAuthenticated: boolean; loading: boolean; error: string | null } = {
  user: null, isAuthenticated: false, loading: false, error: null,
};
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, state: mockState }),
}));

import LoginPage from './LoginPage';

const renderPage = () => render(<LoginPage />);

beforeEach(() => {
  mockNavigate.mockReset();
  mockLogin.mockReset();
  mockState.user = null;
  mockState.isAuthenticated = false;
  mockState.loading = false;
  mockState.error = null;
  sessionStorage.clear();
});

describe('LoginPage — rendering', () => {
  test('renders email and password inputs and a submit button', () => {
    renderPage();
    expect(screen.getByLabelText(/Adresse email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });

  test('renders the global error banner when state.error is set', () => {
    mockState.error = 'Identifiants invalides';
    renderPage();
    expect(screen.getByText('Identifiants invalides')).toBeInTheDocument();
  });

  test('button shows loading label when state.loading is true', () => {
    mockState.loading = true;
    renderPage();
    expect(screen.getByRole('button', { name: /connexion\.\.\./i })).toBeDisabled();
  });
});

describe('LoginPage — validation', () => {
  test('shows email validation errors on empty submit', async () => {
    renderPage();
    userEvent.click(screen.getByRole('button', { name: /se connecter/i }));
    expect(await screen.findByText("L'email est requis")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('rejects malformed email', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/Adresse email/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/i), { target: { value: 'longenough' } });
    // userEvent.click on a submit button triggers a click event, but not the
    // form's native submit event under jsdom + vitest. Fire submit directly.
    const form = screen.getByRole('button', { name: /se connecter/i }).closest('form');
    fireEvent.submit(form!);
    expect(await screen.findByText(/Format d'email invalide/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('rejects password shorter than 6 chars', async () => {
    renderPage();
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/Mot de passe/i), '123');
    userEvent.click(screen.getByRole('button', { name: /se connecter/i }));
    expect(await screen.findByText(/au moins 6 caractères/i)).toBeInTheDocument();
  });
});

describe('LoginPage — submission', () => {
  test('calls login() with credentials and navigates to /dashboard on success', async () => {
    mockLogin.mockResolvedValue(true);

    renderPage();
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/Mot de passe/i), 'password1');
    userEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({
      email: 'a@b.com', password: 'password1',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('respects vortexflow_redirect_after_login when set', async () => {
    mockLogin.mockResolvedValue(true);
    sessionStorage.setItem('vortexflow_redirect_after_login', '/graphs/42/edit');

    renderPage();
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/Mot de passe/i), 'password1');
    userEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/graphs/42/edit'));
    expect(sessionStorage.getItem('vortexflow_redirect_after_login')).toBeNull();
  });

  test('does not navigate when login() returns false', async () => {
    mockLogin.mockResolvedValue(false);

    renderPage();
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/Mot de passe/i), 'password1');
    userEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('typing clears the validation error for that field', async () => {
    renderPage();
    userEvent.click(screen.getByRole('button', { name: /se connecter/i }));
    expect(await screen.findByText("L'email est requis")).toBeInTheDocument();

    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    await waitFor(() =>
      expect(screen.queryByText("L'email est requis")).not.toBeInTheDocument(),
    );
  });
});

describe('LoginPage — demo button', () => {
  test('clicking the demo button calls login with admin credentials', async () => {
    mockLogin.mockResolvedValue(true);

    renderPage();
    userEvent.click(screen.getByRole('button', { name: /connexion démo/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({
      email: 'admin@admin.com', password: 'VortexFlow2024!',
    }));
  });
});
