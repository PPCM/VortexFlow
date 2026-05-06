import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockOpenDrawer = vi.fn();
const mockUseNotifications: { unreadCount: number } = { unreadCount: 0 };

vi.mock('./NotificationProvider', () => ({
  useNotifications: () => ({
    unreadCount: mockUseNotifications.unreadCount,
    openDrawer: mockOpenDrawer,
  }),
}));

import NotificationButton from './NotificationButton';

beforeEach(() => {
  mockOpenDrawer.mockReset();
  mockUseNotifications.unreadCount = 0;
});

describe('NotificationButton', () => {
  test('renders the bell icon', () => {
    const { container } = render(<NotificationButton />);
    expect(container.querySelector('[data-testid="NotificationsIcon"]')).toBeTruthy();
  });

  test('shows the unread count badge when there are unread notifications', () => {
    mockUseNotifications.unreadCount = 3;
    render(<NotificationButton />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('opens the drawer on click', () => {
    render(<NotificationButton />);
    userEvent.click(screen.getByRole('button'));
    expect(mockOpenDrawer).toHaveBeenCalled();
  });
});
