import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserManagementDialog from './UserManagementDialog';

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const fillField = (label: RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const fakeUser = {
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
  ...overrides,
});

describe('UserManagementDialog — create mode', () => {
  test('renders the "Nouvel utilisateur" title and Créer button', () => {
    render(<UserManagementDialog {...baseProps()} />);
    expect(screen.getByText('Nouvel utilisateur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Créer$/i })).toBeInTheDocument();
  });

  test('flags every required field on empty submit', async () => {
    const props = baseProps();
    render(<UserManagementDialog {...props} />);
    userEvent.click(screen.getByRole('button', { name: /^Créer$/i }));
    expect(await screen.findByText('Email requis')).toBeInTheDocument();
    expect(screen.getByText('Mot de passe requis')).toBeInTheDocument();
    expect(screen.getByText('Prénom requis')).toBeInTheDocument();
    expect(screen.getByText('Nom requis')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  test('rejects invalid email format', async () => {
    const props = baseProps();
    render(<UserManagementDialog {...props} />);
    fillField(/^Email/, 'not-email');
    fillField(/^Prénom/, 'A');
    fillField(/^Nom$/, 'B');
    fillField(/^Mot de passe$/, 'pwd123');
    userEvent.click(screen.getByRole('button', { name: /^Créer$/i }));
    expect(await screen.findByText('Format email invalide')).toBeInTheDocument();
  });

  test('rejects password shorter than 6 chars', async () => {
    const props = baseProps();
    render(<UserManagementDialog {...props} />);
    fillField(/^Email/, 'a@b.com');
    fillField(/^Prénom/, 'A');
    fillField(/^Nom$/, 'B');
    fillField(/^Mot de passe$/, 'abc');
    userEvent.click(screen.getByRole('button', { name: /^Créer$/i }));
    expect(await screen.findByText('Minimum 6 caractères requis')).toBeInTheDocument();
  });

  test('submits with full payload and closes on success', async () => {
    const props = baseProps();
    render(<UserManagementDialog {...props} />);
    fillField(/^Email/, 'a@b.com');
    fillField(/^Prénom/, 'Alice');
    fillField(/^Nom$/, 'Smith');
    fillField(/^Mot de passe$/, 'pwd123');
    userEvent.click(screen.getByRole('button', { name: /^Créer$/i }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    expect(props.onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({
      email: 'a@b.com',
      first_name: 'Alice',
      last_name: 'Smith',
      password: 'pwd123',
      role: 'viewer',
      is_active: true,
    }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });
});

describe('UserManagementDialog — edit mode', () => {
  test('renders the edit title and pre-fills fields from the user prop', () => {
    render(<UserManagementDialog {...baseProps({ user: fakeUser })} />);
    expect(screen.getByText('Modifier utilisateur')).toBeInTheDocument();
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe('b@b.com');
    expect((screen.getByLabelText(/^Prénom/) as HTMLInputElement).value).toBe('Bob');
    expect((screen.getByLabelText(/^Nom$/) as HTMLInputElement).value).toBe('Builder');
    // Password is intentionally left empty in edit mode.
    expect((screen.getByLabelText(/Nouveau mot de passe/) as HTMLInputElement).value).toBe('');
  });

  test('Modifier button label appears instead of Créer', () => {
    render(<UserManagementDialog {...baseProps({ user: fakeUser })} />);
    expect(screen.getByRole('button', { name: /^Modifier$/i })).toBeInTheDocument();
  });

  test('shows the active-account switch only in edit mode', () => {
    render(<UserManagementDialog {...baseProps({ user: fakeUser })} />);
    expect(screen.getByLabelText(/Compte actif/i)).toBeInTheDocument();
  });

  test('admin role selection shows the warning alert', async () => {
    render(<UserManagementDialog {...baseProps({ user: { ...fakeUser, role: 'admin' } })} />);
    // The phrase appears both in the menu option and in the warning alert.
    expect(screen.getAllByText(/accès complet au système/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Assurez-vous de faire confiance/i)).toBeInTheDocument();
  });

  test('Supprimer button only renders when onDelete is provided', () => {
    const { rerender } = render(<UserManagementDialog {...baseProps({ user: fakeUser })} />);
    expect(screen.queryByRole('button', { name: /^Supprimer$/i })).not.toBeInTheDocument();

    rerender(
      <UserManagementDialog
        {...baseProps({ user: fakeUser, onDelete: vi.fn() })}
      />,
    );
    expect(screen.getByRole('button', { name: /^Supprimer$/i })).toBeInTheDocument();
  });

  test('Supprimer asks for confirmation before calling onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <UserManagementDialog
        {...baseProps({ user: fakeUser, onDelete, onClose })}
      />,
    );
    userEvent.click(screen.getByRole('button', { name: /^Supprimer$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(fakeUser.id));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  test('does not delete when the user cancels the confirm dialog', () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<UserManagementDialog {...baseProps({ user: fakeUser, onDelete })} />);
    userEvent.click(screen.getByRole('button', { name: /^Supprimer$/i }));

    expect(onDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('UserManagementDialog — close behaviour', () => {
  test('Annuler calls onClose when not loading', () => {
    const props = baseProps();
    render(<UserManagementDialog {...props} />);
    userEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  test('all controls disabled while loading', () => {
    render(<UserManagementDialog {...baseProps({ loading: true })} />);
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeDisabled();
    // Submit shows "En cours..." instead of "Créer"/"Modifier".
    expect(screen.getByRole('button', { name: /En cours/i })).toBeDisabled();
  });
});
