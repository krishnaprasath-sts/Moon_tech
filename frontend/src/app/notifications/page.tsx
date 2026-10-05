"use client";

import React, { useCallback, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { api, AppNotification, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/components/layout/Navbar';
import {
  Alert,
  cardClass,
  chipClass,
  EmptyState,
  ErrorState,
  FullPageMessage,
  LoadingRows,
  PageHeader,
  PageShell,
  Pagination,
  secondaryButtonClass,
  Spinner,
} from '@/components/ui/primitives';

const PAGE_SIZE = 15;

/** Tells the navbar bell to refetch its unread count. */
function notifyBadge() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export default function NotificationsPage() {
  const { token, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Ids marked as read in this session, applied on top of the loaded page
  const [readIds, setReadIds] = useState<ReadonlySet<number>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetcher = useCallback(
    () => api.getNotifications(token as string, { page, limit: PAGE_SIZE, unreadOnly }),
    [token, page, unreadOnly]
  );
  const notifications = useAsyncData(token ? fetcher : null);

  if (authLoading || !token) return <FullPageMessage>Loading notifications...</FullPageMessage>;

  const isRead = (item: AppNotification) => item.isRead || readIds.has(item.id);

  const items = notifications.data?.items || [];
  const unreadOnPage = items.filter((item) => !isRead(item)).length;
  const serverUnread = notifications.data?.meta.unreadCount;
  const hasUnread = unreadOnPage > 0 || (serverUnread ?? 0) > 0;

  const markRead = async (item: AppNotification) => {
    if (isRead(item)) return;
    setActionError('');
    // Optimistic: show as read immediately, roll back if the request fails
    setReadIds((current) => new Set(current).add(item.id));
    try {
      await api.markNotificationRead(token, item.id);
      notifyBadge();
    } catch (err: unknown) {
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      setActionError(getErrorMessage(err, 'Unable to mark the notification as read.'));
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    setActionError('');
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead(token);
      // Reflect immediately on the loaded page, then refresh from the server
      setReadIds((current) => new Set([...current, ...items.map((item) => item.id)]));
      notifyBadge();
      if (unreadOnly && page !== 1) setPage(1);
      else notifications.reload();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Unable to mark notifications as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <PageShell width="max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle="Payment verification, investment, maturity and withdrawal updates, plus announcements."
        actions={
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll || !hasUnread}
            className={secondaryButtonClass}
          >
            {markingAll ? <Spinner /> : <CheckCheck className="w-3.5 h-3.5" />}
            <span>{markingAll ? 'Marking...' : 'Mark all as read'}</span>
          </button>
        }
      />

      <div className="flex items-center gap-2" role="tablist" aria-label="Notification filters">
        {[
          { label: 'All', value: false },
          { label: 'Unread', value: true },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            role="tab"
            aria-selected={unreadOnly === option.value}
            onClick={() => {
              setUnreadOnly(option.value);
              setPage(1);
            }}
            className={chipClass(unreadOnly === option.value)}
          >
            {option.label}
            {option.value && serverUnread !== undefined && serverUnread > 0 && (
              <span className="ml-1.5 font-mono text-[10px] opacity-80">({serverUnread})</span>
            )}
          </button>
        ))}
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      <div className={`${cardClass} overflow-hidden`}>
        {notifications.error && !notifications.data ? (
          <ErrorState message={notifications.error} onRetry={notifications.reload} />
        ) : !notifications.data ? (
          <LoadingRows rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-4 h-4" />}
            title={unreadOnly ? 'You are all caught up' : 'No notifications yet'}
            description={
              unreadOnly
                ? 'There are no unread notifications.'
                : 'Updates about your payments, investments and withdrawals will appear here.'
            }
          />
        ) : (
          <>
            {notifications.error && <Alert className="m-4">{notifications.error}</Alert>}
            <ul
              className={`divide-y divide-zinc-100 dark:divide-white/[0.06] transition-opacity ${notifications.loading ? 'opacity-60' : ''}`}
              aria-busy={notifications.loading}
            >
              {items.map((item) => {
                const read = isRead(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => markRead(item)}
                      aria-label={read ? item.title : `${item.title} (unread, select to mark as read)`}
                      className={`w-full text-left p-4 px-5 flex items-start gap-3 transition ${
                        read
                          ? 'hover:bg-zinc-50 dark:hover:bg-white/[0.02] cursor-default'
                          : 'bg-blue-600/[0.04] dark:bg-blue-500/[0.06] hover:bg-blue-600/[0.08] dark:hover:bg-blue-500/[0.1]'
                      }`}
                    >
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${read ? 'bg-transparent' : 'bg-blue-600'}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span
                            className={`text-xs ${
                              read
                                ? 'font-medium text-zinc-700 dark:text-zinc-300'
                                : 'font-bold text-zinc-950 dark:text-white'
                            }`}
                          >
                            {item.title}
                          </span>
                          <span
                            className="text-[10px] text-zinc-500 whitespace-nowrap shrink-0"
                            title={formatDateTime(item.createdAt)}
                          >
                            {formatRelativeTime(item.createdAt) || formatDateTime(item.createdAt)}
                          </span>
                        </span>
                        <span className="block text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed whitespace-pre-line break-words">
                          {item.message}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination meta={notifications.data.meta} onPageChange={setPage} disabled={notifications.loading} />
          </>
        )}
      </div>
    </PageShell>
  );
}
