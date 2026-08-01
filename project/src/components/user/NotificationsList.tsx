import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Notification } from '../../lib/supabase';
import { Bell, Calendar, Award, DollarSign, Users, Settings, Check } from 'lucide-react';

export function NotificationsList() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
          <p className="text-slate-600 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No notifications</h3>
            <p className="text-slate-600">
              You'll receive notifications about meetings, promotions, and more
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 hover:bg-slate-50 transition cursor-pointer ${
                  !notification.is_read ? 'bg-brand-50' : ''
                }`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${getColor(notification.type)}`}>
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-slate-900">{notification.title}</h4>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-brand-700 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                      {notification.action_url && (
                        <a
                          href={notification.action_url}
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
