import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Notification } from '../../lib/supabase';
import { Bell, Calendar, Award, DollarSign, Users, Settings, Check, CheckCheck } from 'lucide-react';

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationsList() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!profile) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (data) setNotifications(data);
      setLoading(false);
    };

    fetchNotifications();
  }, [profile]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    window.dispatchEvent(new CustomEvent('notification-read'));
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
    window.dispatchEvent(new CustomEvent('notification-read'));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications),
    [filter, notifications]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <Calendar className="w-5 h-5" />;
      case 'promotion':
        return <Award className="w-5 h-5" />;
      case 'payment':
        return <DollarSign className="w-5 h-5" />;
      case 'group':
        return <Users className="w-5 h-5" />;
      case 'approval':
        return <Check className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-brand-100 text-brand-600';
      case 'promotion':
        return 'bg-green-100 text-green-600';
      case 'payment':
        return 'bg-emerald-100 text-emerald-600';
      case 'group':
        return 'bg-orange-100 text-orange-600';
      case 'approval':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
          <p className="text-slate-600 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-semibold shadow-sm"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 px-4 pt-4">
          {(['all', 'unread'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
                filter === tab
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab === 'all' ? 'All' : 'Unread'}
              {tab === 'unread' && unreadCount > 0 && (
                <span className={`ml-1.5 ${filter === 'unread' ? 'text-brand-100' : 'text-slate-400'}`}>
                  ({unreadCount})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="h-px bg-slate-100 mt-4" />

        {visibleNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </h3>
            <p className="text-slate-600">
              You'll receive notifications about meetings, promotions, and more
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`group relative p-5 sm:p-6 hover:bg-slate-50 transition cursor-pointer ${
                  !notification.is_read ? 'bg-brand-50/60' : ''
                }`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                {!notification.is_read && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600" />
                )}
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 p-3 rounded-xl ${getColor(notification.type)}`}>
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h4 className={`text-slate-900 ${!notification.is_read ? 'font-bold' : 'font-semibold'}`}>
                        {notification.title}
                      </h4>
                      {!notification.is_read && (
                        <span className="flex-shrink-0 mt-1.5 w-2 h-2 bg-brand-600 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2 leading-relaxed">{notification.message}</p>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-medium text-slate-400">
                        {timeAgo(notification.created_at)}
                      </span>
                      {notification.action_url && (
                        <a
                          href={notification.action_url}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                        >
                          View Details →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
