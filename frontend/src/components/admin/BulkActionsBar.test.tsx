import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkActionsBar from './BulkActionsBar';

const handlers = () => ({
  onActivate: vi.fn(),
  onDeactivate: vi.fn(),
  onDelete: vi.fn(),
  onClear: vi.fn(),
});

describe('BulkActionsBar — selection counter', () => {
  test('hides the counter when nothing is selected', () => {
    render(<BulkActionsBar selectedCount={0} {...handlers()} />);
    expect(screen.queryByText(/utilisateur/i)).not.toBeInTheDocument();
  });

  test('singular counter for 1 selection', () => {
    render(<BulkActionsBar selectedCount={1} {...handlers()} />);
    expect(screen.getByText('1 utilisateur sélectionné')).toBeInTheDocument();
  });

  test('plural counter for multiple selections', () => {
    render(<BulkActionsBar selectedCount={4} {...handlers()} />);
    expect(screen.getByText('4 utilisateurs sélectionnés')).toBeInTheDocument();
  });
});

describe('BulkActionsBar — disabled state', () => {
  test('all action buttons disabled with no selection', () => {
    render(<BulkActionsBar selectedCount={0} {...handlers()} />);
    expect(screen.getByRole('button', { name: /^Activer$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Désactiver$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Supprimer$/i })).toBeDisabled();
  });

  test('all action buttons disabled while loading even with selection', () => {
    render(<BulkActionsBar selectedCount={3} loading {...handlers()} />);
    expect(screen.getByRole('button', { name: /^Activer$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Désactiver$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Supprimer$/i })).toBeDisabled();
  });

  test('action buttons enabled with selection and not loading', () => {
    render(<BulkActionsBar selectedCount={1} {...handlers()} />);
    expect(screen.getByRole('button', { name: /^Activer$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Désactiver$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Supprimer$/i })).toBeEnabled();
  });
});

describe('BulkActionsBar — callbacks', () => {
  test('onActivate fires on click', () => {
    const h = handlers();
    render(<BulkActionsBar selectedCount={2} {...h} />);
    userEvent.click(screen.getByRole('button', { name: /^Activer$/i }));
    expect(h.onActivate).toHaveBeenCalled();
  });

  test('onDeactivate fires on click', () => {
    const h = handlers();
    render(<BulkActionsBar selectedCount={2} {...h} />);
    userEvent.click(screen.getByRole('button', { name: /^Désactiver$/i }));
    expect(h.onDeactivate).toHaveBeenCalled();
  });

  test('onDelete fires on click', () => {
    const h = handlers();
    render(<BulkActionsBar selectedCount={2} {...h} />);
    userEvent.click(screen.getByRole('button', { name: /^Supprimer$/i }));
    expect(h.onDelete).toHaveBeenCalled();
  });

  test('onClear fires from the close icon when there is a selection', () => {
    const h = handlers();
    render(<BulkActionsBar selectedCount={2} {...h} />);
    userEvent.click(screen.getByLabelText(/Annuler la sélection/i));
    expect(h.onClear).toHaveBeenCalled();
  });
});
