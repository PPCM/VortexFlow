import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordResetDialog from './PasswordResetDialog';

// Helper: userEvent v13's `type` interacts poorly with React 19 controlled inputs
// in this Dialog. Drive the input directly with fireEvent.change.
const fillField = (label: RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const FAKE_USER = {
  id: 1,
  email: 'b@b.com',
  first_name: 'Bob',
  last_name: 'Builder',
  role: 'editor',
  is_active: true,
} as any;

const baseProps = (overrides = {}) => ({
  open: true,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
  user: FAKE_USER,
  ...overrides,
});

describe('PasswordResetDialog — rendering', () => {
  test('renders nothing when no user is provided', () => {
    const { container } = render(
      <PasswordResetDialog
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        user={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders the user info banner and password fields when open', () => {
    render(<PasswordResetDialog {...baseProps()} />);
    expect(screen.getByText(/Bob.*Builder.*b@b\.com/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nouveau mot de passe/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmer le mot de passe/)).toBeInTheDocument();
  });

  test('Réinitialiser is disabled until both password fields are filled', () => {
    render(<PasswordResetDialog {...baseProps()} />);
    expect(screen.getByRole('button', { name: /^Réinitialiser$/ })).toBeDisabled();
  });
});

describe('PasswordResetDialog — validation', () => {
  test('rejects mismatched passwords', async () => {
    const props = baseProps();
    render(<PasswordResetDialog {...props} />);

    fillField(/Nouveau mot de passe/,'abcd1234');
    fillField(/Confirmer le mot de passe/,'wxyz9876');
    userEvent.click(screen.getByRole('button', { name: /^Réinitialiser$/ }));

    expect(await screen.findByText(/ne correspondent pas/i)).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  test('requires both letters and digits', async () => {
    const props = baseProps();
    render(<PasswordResetDialog {...props} />);

    // Letters only — no digits.
    fillField(/Nouveau mot de passe/,'abcdefgh');
    fillField(/Confirmer le mot de passe/,'abcdefgh');
    userEvent.click(screen.getByRole('button', { name: /^Réinitialiser$/ }));

    expect(await screen.findByText(/au moins une lettre et un chiffre/i)).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

describe('PasswordResetDialog — happy path', () => {
  test('submits and then closes on success', async () => {
    const props = baseProps();
    render(<PasswordResetDialog {...props} />);

    fillField(/Nouveau mot de passe/,'abcd1234');
    fillField(/Confirmer le mot de passe/,'abcd1234');
    userEvent.click(screen.getByRole('button', { name: /^Réinitialiser$/ }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith('abcd1234'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  test('reports an error and stays open if onSubmit throws', async () => {
    const props = baseProps({
      onSubmit: vi.fn().mockRejectedValue(new Error('server')),
    });
    render(<PasswordResetDialog {...props} />);

    fillField(/Nouveau mot de passe/,'abcd1234');
    fillField(/Confirmer le mot de passe/,'abcd1234');
    userEvent.click(screen.getByRole('button', { name: /^Réinitialiser$/ }));

    expect(await screen.findByText(/Erreur lors de la réinitialisation/i)).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

describe('PasswordResetDialog — random password helper', () => {
  test('clicking "Générer un mot de passe aléatoire" fills both fields and enables submit', () => {
    render(<PasswordResetDialog {...baseProps()} />);
    userEvent.click(screen.getByRole('button', { name: /Générer un mot de passe aléatoire/i }));

    const newField = screen.getByLabelText(/Nouveau mot de passe/) as HTMLInputElement;
    const confirmField = screen.getByLabelText(/Confirmer le mot de passe/) as HTMLInputElement;
    expect(newField.value.length).toBe(12);
    expect(confirmField.value).toBe(newField.value);
    expect(screen.getByRole('button', { name: /^Réinitialiser$/ })).toBeEnabled();
  });
});

describe('PasswordResetDialog — close behaviour', () => {
  test('Annuler calls onClose when not submitting', () => {
    const props = baseProps();
    render(<PasswordResetDialog {...props} />);
    userEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  test('shuts down the action buttons while loading', () => {
    render(<PasswordResetDialog {...baseProps({ loading: true })} />);
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeDisabled();
    // Submit reads "En cours..." while loading.
    expect(screen.getByRole('button', { name: /En cours/i })).toBeDisabled();
  });
});
