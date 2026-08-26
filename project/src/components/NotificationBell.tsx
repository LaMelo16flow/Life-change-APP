import { useEffect, useRef, useState } from 'react';
import { Bell, Calendar, Award, DollarSign, Users, Settings, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, Notification } from '../lib/supabase';
import { resolveNotificationText } from '../utils/notificationText';

interface NotificationBellProps {
  unreadCount: number;
  onViewAll: () => void;
  onNavigate: (actionUrl: string | null | undefined) => void;
}

const ICONS: Record<string, typeof Calendar> = {
  meeting: Calendar,
  promotion: Award,
  payment: DollarSign,
  group: Users,
  approval: Check,
};

const COLORS: Record<string, string> = {
  meeting: 'bg-brand-100 text-brand-600',
  promotion: 'bg-green-100 text-green-600',
  payment: 'bg-emerald-100 text-emerald-600',
  group: 'bg-orange-100 text-orange-600',
  approval: 'bg-yellow-100 text-yellow-600',
};

export function NotificationBell({ unreadCount, onViewAll, onNavigate }: NotificationBellProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();

  function timeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return t('common.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('common.minutesAgo', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('common.hoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('common.daysAgo', { n: days });
    return new Date(dateStr).toLocaleDateString();
  }
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !profile) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setItems(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, profile]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    window.dispatchEvent(new CustomEvent('notification-read'));
  };

  const handleSelect = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    setOpen(false);
    if (notification.action_url) {
      onNavigate(notification.action_url);
    } else {
      onViewAll();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-xl transition ${open ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 border border-slate-100 overflow-hidden z-50 animate-dropdown-in origin-top-right">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <h3 className="text-sm font-semibold text-slate-900">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-semibold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">
                {t('notifications.newBadge', { n: unreadCount })}
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto main-scrollbar">
            {loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center">
                <Bell className="w-9 h-9 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-500">{t('notifications.youreAllCaughtUp')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((notification) => {
                  const Icon = ICONS[notification.type] || Settings;
                  const color = COLORS[notification.type] || 'bg-slate-100 text-slate-600';
                  const { title, message } = resolveNotificationText(notification, t);
                  return (
                    <li key={notification.id}>
                      <button
                        onClick={() => handleSelect(notification)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition ${
                          !notification.is_read ? 'bg-brand-50/70' : ''
                        }`}
                      >
                        <span className={`flex-shrink-0 mt-0.5 p-2 rounded-lg ${color}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm truncate ${
                                !notification.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                              }`}
                            >
                              {title}
                            </span>
                            {!notification.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-600 flex-shrink-0" />
                            )}
                          </span>
                          <span className="block text-xs text-slate-500 line-clamp-2 mt-0.5">
                            {message}
                          </span>
                          <span className="block text-[11px] text-slate-400 mt-1">
                            {timeAgo(notification.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onViewAll();
            }}
            className="w-full text-center text-sm font-semibold text-brand-700 hover:bg-brand-50 py-3 border-t border-slate-100 transition"
          >
            {t('notifications.viewAll')}
          </button>
        </div>
      )}
    </div>
  );
}
