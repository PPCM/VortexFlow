import React from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { NotificationProvider, useNotifications } from './NotificationProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('useNotifications', () => {
  test('throws when called outside a NotificationProvider', () => {
    expect(() => renderHook(() => useNotifications())).toThrow(/NotificationProvider/);
  });

  test('starts with no notifications and unreadCount=0', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  test('showSuccess appends a success notification (read=false)', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => result.current.showSuccess('Saved!', 'OK'));

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toEqual(expect.objectContaining({
      type: 'success',
      message: 'Saved!',
      title: 'OK',
      read: false,
    }));
    expect(result.current.unreadCount).toBe(1);
  });

  test('showError marks notifications persistent (suppresses snackbar but keeps in list)', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => result.current.showError('Server down'));
    expect(result.current.notifications[0]).toEqual(expect.objectContaining({
      type: 'error',
      persistent: true,
    }));
  });

  test('showWarning and showInfo emit non-persistent entries', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.showWarning('careful');
      result.current.showInfo('fyi');
    });
    expect(result.current.notifications.map((n) => n.type)).toEqual(['info', 'warning']);
  });

  test('newest notifications appear first', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.showInfo('first');
      result.current.showInfo('second');
      result.current.showInfo('third');
    });
    expect(result.current.notifications.map((n) => n.message))
      .toEqual(['third', 'second', 'first']);
  });

  test('markAsRead flips read=true and decreases unreadCount', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.showInfo('a');
      result.current.showInfo('b');
    });
    expect(result.current.unreadCount).toBe(2);

    const idToMark = result.current.notifications[0].id;
    act(() => result.current.markAsRead(idToMark));
    expect(result.current.unreadCount).toBe(1);
  });

  test('markAllAsRead zeroes the unread counter', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.showInfo('a');
      result.current.showError('b');
      result.current.showWarning('c');
    });
    expect(result.current.unreadCount).toBe(3);

    act(() => result.current.markAllAsRead());
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  test('removeNotification drops the matching entry', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.showInfo('keep');
      result.current.showInfo('drop');
    });
    const dropId = result.current.notifications[0].id;
    act(() => result.current.removeNotification(dropId));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('keep');
  });

  test('clearAll empties the list and resets unread to 0', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.showInfo('a');
      result.current.showInfo('b');
    });
    act(() => result.current.clearAll());
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  test('showNotification accepts a custom action and stores it', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.showNotification({
        type: 'info',
        message: 'click me',
        action: { label: 'Undo', onClick: handler },
      });
    });
    expect(result.current.notifications[0].action?.label).toBe('Undo');
  });
});

describe('NotificationProvider rendering', () => {
  test('renders children unchanged', () => {
    const { getByText } = render(
      <NotificationProvider>
        <div>app content</div>
      </NotificationProvider>,
    );
    expect(getByText('app content')).toBeInTheDocument();
  });
});
