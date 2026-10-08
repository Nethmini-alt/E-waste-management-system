import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react';
import { notificationsApi, type AppNotification, type NotificationType } from './notificationsApi';
import { LoadingState } from '../../components/ui/LoadingState';

/** Matches the mint/glass styling of the header buttons in Layout.jsx. */
const triggerClass =
  'relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-800 transition-colors hover:bg-mint-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500';

const typeDot: Record<NotificationType, string> = {
  info: 'bg-mint-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

/** "just now" / "5m ago" / "3d ago" — the bell only needs coarse recency. */
const timeAgo = (iso: string): string => {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  const then = new Date(hasZone ? iso : `${iso}Z`).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

/**
 * Header bell: unread badge + dropdown of the signed-in user's notifications.
 * Polls the unread count while mounted, marks rows read on click and follows
 * the notification's link through the router.
 */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Badge poll — 60s is frequent enough for a bell and cheap on the API.
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      notificationsApi
        .unreadCount()
        .then((count) => !cancelled && setUnread(count))
        .catch(() => {
          /* poll failures stay silent; the badge just doesn't change */
        });
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Close when clicking outside the bell or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await notificationsApi.list());
    } catch {
      setError('Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  const handleOpenItem = async (n: AppNotification) => {
    // Optimistically drop the badge, then persist the read state.
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      await notificationsApi.markRead(n.id);
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    await notificationsApi.markAllRead();
  };

  const badge = unread > 99 ? '99+' : unread;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={triggerClass}
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        title="Notifications"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 font-mono text-[10px] font-bold leading-none text-white shadow-md shadow-red-500/40"
            aria-hidden
          >
            {badge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-xl shadow-ink-900/10 backdrop-blur-xl"
            role="menu"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-mint-100 px-4 py-3">
              <span className="font-display text-sm font-bold text-ink-900">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-mint-700 hover:text-mint-800"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && <LoadingState label="Loading notifications…" />}

              {!loading && error && (
                <p className="px-4 py-6 text-center text-sm text-ink-600" role="alert">
                  {error}
                </p>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-50 text-mint-600">
                    <Inbox size={22} />
                  </div>
                  <p className="font-display text-sm font-bold text-ink-900">All caught up</p>
                  <p className="text-xs text-ink-600">You have no notifications right now.</p>
                </div>
              )}

              {!loading &&
                !error &&
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void handleOpenItem(n)}
                    className={[
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-mint-50/70',
                      n.isRead ? '' : 'bg-mint-50/50',
                    ].join(' ')}
                    role="menuitem"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${typeDot[n.type]}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink-900">{n.title}</span>
                        {!n.isRead && (
                          <Check size={12} className="flex-shrink-0 text-mint-600" aria-label="Unread" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">{n.message}</span>
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-ink-600/70">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
