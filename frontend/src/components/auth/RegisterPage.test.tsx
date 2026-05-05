import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}), { virtual: true });

const mockRegister = jest.fn();
const mockState: { user: any; isAuthenticated: boolean; loading: boolean; error: string | null } = {
  user: null, isAuthenticated: false, loading: false, error: null,
};
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister, state: mockState }),
}));

import RegisterPage from './RegisterPage';

beforeEach(() => {
  mockNavigate.mockReset();
  mockRegister.mockReset();
  mockState.user = null;
  mockState.isAuthenticated = false;
  mockState.loading = false;
  mockState.error = null;
});

describe('RegisterPage — rendering', () => {
  test('renders all form fields', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/Nom d'utilisateur/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresse email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mot de passe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmer le mot de passe/i)).toBeInTheDocument();
  });

  test('shows the global error banner from auth state', () => {
    mockState.error = 'Email déjà utilisé';
    render(<RegisterPage />);
    expect(screen.getByText('Email déjà utilisé')).toBeInTheDocument();
  });

  test('disables the submit button while loading', () => {
    mockState.loading = true;
    render(<RegisterPage />);
    expect(screen.getByRole('button', { name: /Création du compte/i })).toBeDisabled();
  });
});

describe('RegisterPage — validation', () => {
  test('flags every required field on empty submit', async () => {
    render(<RegisterPage />);
    userEvent.click(screen.getByRole('button', { name: /^Créer le compte$/i }));

    expect(await screen.findByText("Le nom d'utilisateur est requis")).toBeInTheDocument();
    expect(screen.getByText("L'email est requis")).toBeInTheDocument();
    expect(screen.getByText('Le mot de passe est requis')).toBeInTheDocument();
    expect(screen.getByText('La confirmation du mot de passe est requise')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('rejects username shorter than 3 chars', async () => {
    render(<RegisterPage />);
    userEvent.type(screen.getByLabelText(/Nom d'utilisateur/i), 'ab');
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/^Mot de passe/i), 'password1');
    userEvent.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'password1');
    userEvent.click(screen.getByRole('button', { name: /^Créer le compte$/i }));

    expect(await screen.findByText(/au moins 3 caractères/i)).toBeInTheDocument();
  });

  test('rejects malformed email', async () => {
    render(<RegisterPage />);
    userEvent.type(screen.getByLabelText(/Nom d'utilisateur/i), 'alice');
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'not-an-email');
    userEvent.type(screen.getByLabelText(/^Mot de passe/i), 'password1');
    userEvent.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'password1');
    userEvent.click(screen.getByRole('button', { name: /^Créer le compte$/i }));

    expect(await screen.findByText(/Format d'email invalide/i)).toBeInTheDocument();
  });

  test('rejects mismatched passwords', async () => {
    render(<RegisterPage />);
    userEvent.type(screen.getByLabelText(/Nom d'utilisateur/i), 'alice');
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/^Mot de passe/i), 'password1');
    userEvent.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'different1');
    userEvent.click(screen.getByRole('button', { name: /^Créer le compte$/i }));

    expect(await screen.findByText(/ne correspondent pas/i)).toBeInTheDocument();
  });

  test('typing clears the field-specific error', async () => {
    render(<RegisterPage />);
    userEvent.click(screen.getByRole('button', { name: /^Créer le compte$/i }));
    expect(await screen.findByText("L'email est requis")).toBeInTheDocument();

    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    await waitFor(() =>
      expect(screen.queryByText("L'email est requis")).not.toBeInTheDocument(),
    );
  });
});

describe('RegisterPage — submission', () => {
  test('calls register and navigates to /dashboard on success', async () => {
    mockRegister.mockResolvedValue(true);
    render(<RegisterPage />);

    userEvent.type(screen.getByLabelText(/Nom d'utilisateur/i), 'alice');
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/^Mot de passe/i), 'password1');
    userEvent.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'password1');
    userEvent.click(screen.getByRole('button', { name: /^Créer le compte$/i }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    const arg = mockRegister.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({
      username: 'alice',
      email: 'a@b.com',
      password: 'password1',
      role: 'viewer',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('does not navigate when register returns false', async () => {
    mockRegister.mockResolvedValue(false);
    render(<RegisterPage />);

    userEvent.type(screen.getByLabelText(/Nom d'utilisateur/i), 'alice');
    userEvent.type(screen.getByLabelText(/Adresse email/i), 'a@b.com');
    userEvent.type(screen.getByLabelText(/^Mot de passe/i), 'password1');
    userEvent.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'password1');
    userEvent.click(screen.getByRole('button', { name: /^Créer le compte$/i }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
