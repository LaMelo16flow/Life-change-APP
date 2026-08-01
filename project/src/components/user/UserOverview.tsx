import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase, Rank } from '../../lib/supabase';
import { Award, TrendingUp, ArrowUp } from 'lucide-react';
import { AnimatedCounter } from '../AnimatedCounter';

const REFRESH_INTERVAL = 30_000;

export function UserOverview() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [rank, setRank] = useState<Rank | null>(null);
  const [nextRank, setNextRank] = useState<Rank | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const [rankRes, ranksRes] = await Promise.all([
      supabase
        .from('ranks')
        .select('*')
        .eq('id', profile.current_rank_id || '')
        .maybeSingle(),
      supabase
        .from('ranks')
        .select('*')
        .order('display_order', { ascending: true }),
    ]);

    if (rankRes.data) setRank(rankRes.data);

    if (rankRes.data && ranksRes.data) {
      const currentOrder = rankRes.data.display_order;
      const next = ranksRes.data.find((r) => r.display_order === currentOrder + 1);
      setNextRank(next || null);
    }

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

  const progressToNextRank = nextRank
    ? Math.min((profile!.total_pv / nextRank.required_pv) * 100, 100)
    : 100;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('user.welcome')}, {profile?.full_name}!</h2>
        <p className="text-sm sm:text-base text-gray-500 mt-1">{t('user.overviewSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="p-2 sm:p-3 rounded-xl flex-shrink-0"
              style={{ backgroundColor: rank?.color ? `${rank.color}20` : '#E5E7EB' }}
            >
              <Award className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: rank?.color || '#6B7280' }} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-500 text-xs sm:text-sm">{t('user.currentRank')}</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{rank?.name || t('common.na')}</p>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
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

      {nextRank && (
        <div className="card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">{t('user.progressTo')} {nextRank.name}</h3>
              <p className="text-gray-500 text-sm">
                <AnimatedCounter value={profile?.total_pv || 0} /> / {nextRank.required_pv} PV
              </p>
            </div>
            <div className="flex items-center gap-2 text-brand-600">
              <ArrowUp className="w-5 h-5" />
              <span className="font-semibold text-lg">
                <AnimatedCounter
                  value={Math.round(progressToNextRank)}
                  formatFn={(n) => `${n}%`}
                />
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-brand-500 to-brand-600 h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressToNextRank}%` }}
            />
          </div>
          <div className="mt-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs sm:text-sm">{t('user.requiredPV')}</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{nextRank.required_pv}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
