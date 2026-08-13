import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { TrendingUp } from 'lucide-react';
import { AnimatedCounter } from '../AnimatedCounter';

const REFRESH_INTERVAL = 10_000;

export function UserOverview() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (loading) return;

    const interval = setInterval(() => {
      refreshProfile();
      fetchData();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [loading, refreshProfile, fetchData]);

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
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('user.welcome')}, {profile?.full_name}!</h2>
        <p className="text-sm sm:text-base text-gray-500 mt-1">{t('user.overviewSubtitle')}</p>
      </div>

      <div className="card p-4 sm:p-6 max-w-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl bg-brand-100 flex-shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-500 text-xs sm:text-sm">{t('user.totalPV')}</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900">
              <AnimatedCounter value={profile?.total_pv || 0} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
