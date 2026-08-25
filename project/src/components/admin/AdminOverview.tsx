import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { Users, TrendingUp, DollarSign, CheckCircle, ShoppingBag } from 'lucide-react';
import { AnimatedCounter } from '../AnimatedCounter';

const REFRESH_INTERVAL = 10_000;

export function AdminOverview() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalPV: 0,
    pendingOrders: 0,
    recentPayments: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const [
      usersRes,
      activeUsersRes,
      pvRes,
      ordersRes,
      paymentsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('profiles').select('total_pv'),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('payment_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const totalPV = pvRes.data?.reduce((sum, p) => sum + Number(p.total_pv), 0) || 0;

    setStats({
      totalUsers: usersRes.count || 0,
      activeUsers: activeUsersRes.count || 0,
      totalPV,
      pendingOrders: ordersRes.count || 0,
      recentPayments: paymentsRes.count || 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (loading) return;

    const interval = setInterval(fetchStats, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loading, fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('admin.dashboard')}</h2>
        <p className="text-sm sm:text-base text-gray-500 mt-1">{t('admin.platformOverview')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-brand-100 flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-500 text-xs sm:text-sm">{t('admin.totalUsers')}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                <AnimatedCounter value={stats.totalUsers} />
              </p>
              <p className="text-xs text-brand-600 mt-1">
                <AnimatedCounter value={stats.activeUsers} /> {t('admin.active')}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-emerald-100 flex-shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-500 text-xs sm:text-sm">{t('admin.totalPV')}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                <AnimatedCounter value={stats.totalPV} />
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-amber-100 flex-shrink-0">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-500 text-xs sm:text-sm">{t('admin.pendingOrders')}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                <AnimatedCounter value={stats.pendingOrders} />
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-green-100 flex-shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-500 text-xs sm:text-sm">{t('admin.payments')}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                <AnimatedCounter value={stats.recentPayments} />
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-brand-100 flex-shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-500 text-xs sm:text-sm">{t('admin.systemStatus')}</p>
              <p className="text-base sm:text-lg font-bold text-brand-600">{t('admin.operational')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-brand-800 to-brand-900 rounded-2xl p-6 sm:p-8 text-white">
        <h3 className="text-xl sm:text-2xl font-bold mb-2">{t('admin.welcome')}</h3>
        <p className="text-sm sm:text-base text-brand-200 mb-6">
          {t('admin.welcomeDesc')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div>
            <p className="text-brand-300 mb-1">{t('admin.quickActions')}</p>
            <ul className="space-y-1 text-brand-100">
              <li>- {t('admin.manageAccountsAction')}</li>
              <li>- {t('admin.uploadProductsAction')}</li>
            </ul>
          </div>
          <div>
            <p className="text-brand-300 mb-1">{t('admin.approvals')}</p>
            <ul className="space-y-1 text-brand-100">
              <li>- {t('admin.approvePendingOrdersAction')}</li>
              <li>- {t('admin.verifyPaymentProofsAction')}</li>
            </ul>
          </div>
          <div>
            <p className="text-brand-300 mb-1">{t('admin.settings')}</p>
            <ul className="space-y-1 text-brand-100">
              <li>- {t('admin.configurePaymentMethodsAction')}</li>
              <li>- {t('admin.adjustSystemSettingsAction')}</li>
              <li>- {t('admin.monitorActivityLogsAction')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
