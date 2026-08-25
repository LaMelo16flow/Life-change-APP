import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase, Profile } from '../../lib/supabase';
import { Users, TrendingUp, UserPlus } from 'lucide-react';

type TeamMember = Profile;

export function MyTeam() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!profile) return;

      const { data: branches } = await supabase
        .from('branches')
        .select('child_id')
        .eq('parent_id', profile.id)
        .eq('is_active', true);

      if (!branches || branches.length === 0) {
        setLoading(false);
        return;
      }

      const childIds = branches.map((b) => b.child_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', childIds);

      if (!profiles) {
        setLoading(false);
        return;
      }

      setTeam(profiles);
      setLoading(false);
    };

    fetchTeam();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t('team.title')}</h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1">{t('team.subtitle')}</p>
        </div>
        <div className="bg-white px-4 sm:px-6 py-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-600 flex-shrink-0" />
            <div>
              <p className="text-xs sm:text-sm text-slate-600">{t('common.totalMembers')}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">{team.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">{t('team.referralLink')}</h3>
          <UserPlus className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={profile?.id || ''}
            readOnly
            className="flex-1 px-3 sm:px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono"
          />
          <button
            onClick={() => navigator.clipboard.writeText(profile?.id || '')}
            className="px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium flex-shrink-0"
          >
            {t('common.copyId')}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {t('team.shareIdInfo')}
        </p>
      </div>

      {team.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm text-center">
          <Users className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">{t('team.noMembers')}</h3>
          <p className="text-sm sm:text-base text-slate-600">
            {t('team.noMembersSubtitle')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {team.map((member) => (
            <div
              key={member.id}
              className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0">
                    {member.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm sm:text-base truncate">{member.full_name}</p>
                    <p className="text-xs sm:text-sm text-slate-600 truncate">{member.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{t('pv.total')}</span>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-slate-900">
                      {member.total_pv}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{t('common.status')}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        member.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {member.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
