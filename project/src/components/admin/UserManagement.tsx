import { Fragment, useCallback, useEffect, useState } from 'react';
import { supabase, Profile } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { loadCountryNames, getCountryName } from '../../utils/countries';
import { Users, Search, Shield, ShieldCheck, Briefcase, UserX, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { SectionSkeleton } from '../SectionSkeleton';

interface UserRow extends Profile {
  profile_image_url?: string;
}

function initials(name: string | null | undefined): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((n) => n[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

export function UserManagement() {
  const toast = useToast();
  const { t } = useLanguage();
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [countryMap, setCountryMap] = useState<Record<string, string>>({});
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading users:', error);
      toast.error(t('um.failedLoadUsers'));
    }
    setUsers(profiles || []);
    setLoading(false);
  }, [toast, t]);

  useEffect(() => {
    const loadData = async () => {
      const countries = await loadCountryNames();
      setCountryMap(countries);
      await fetchUsers();
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The super admin (is_master) can never be demoted or deleted, and an admin
  // cannot change their own role (that would lock them out of this screen).
  const canChangeRole = (user: UserRow) => !user.is_master && user.id !== currentProfile?.id;

  const toggleUserRole = async (user: UserRow) => {
    if (user.is_master) {
      toast.error(t('um.cannotChangeMaster'));
      return;
    }
    if (user.id === currentProfile?.id) {
      toast.error(t('um.cannotChangeSelf'));
      return;
    }

    // admin -> user, user/manager -> admin
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setRoleUpdating(user.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating role:', error);
        toast.error(error.message?.includes('super admin') ? t('um.cannotChangeMaster') : t('um.failedUpdateRole'));
        return;
      }

      // A manager promoted to admin no longer needs scoped permissions.
      if (user.role === 'manager' && newRole === 'admin') {
        await supabase.from('manager_permissions').delete().eq('user_id', user.id);
      }

      toast.success(newRole === 'admin' ? t('um.userPromoted') : t('um.userDemoted'));
      fetchUsers();
    } finally {
      setRoleUpdating(null);
    }
  };

  const handleDeleteUser = async (user: UserRow) => {
    if (user.is_master) {
      toast.error(t('um.cannotChangeMaster'));
      return;
    }
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('profile.notAuthenticated'));
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ targetUserId: user.id }),
        }
      );

      // The function may return a non-JSON body (e.g. a gateway error page).
      const result = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) throw new Error(result.error || t('um.failedDeleteUser'));

      toast.success(t('um.userDeleted'));
      setDeletingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t('um.failedDeleteUser'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter(
    (user) =>
      (user.full_name || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q)
  );

  const RoleBadge = ({ user }: { user: UserRow }) => {
    if (user.is_master) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 bg-yellow-100 text-yellow-800">
          <ShieldCheck className="w-3 h-3" />
          {t('mgr.masterBadge')}
        </span>
      );
    }
    const styles =
      user.role === 'admin'
        ? 'bg-purple-100 text-purple-700'
        : user.role === 'manager'
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-700';
    const Icon = user.role === 'admin' ? Shield : user.role === 'manager' ? Briefcase : UserX;
    const label =
      user.role === 'admin' ? t('common.admin') : user.role === 'manager' ? t('common.manager') : t('common.user');
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${styles}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const RoleButton = ({ user }: { user: UserRow }) => {
    if (!canChangeRole(user)) return null;
    const isAdmin = user.role === 'admin';
    return (
      <button
        onClick={() => toggleUserRole(user)}
        disabled={roleUpdating === user.id}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-sm font-medium disabled:opacity-50 ${
          isAdmin ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-purple-600 text-white hover:bg-purple-700'
        }`}
      >
        {roleUpdating === user.id ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isAdmin ? (
          <UserX className="w-4 h-4" />
        ) : (
          <Shield className="w-4 h-4" />
        )}
        {isAdmin ? t('um.demote') : t('um.promote')}
      </button>
    );
  };

  const DeleteButton = ({ user }: { user: UserRow }) => {
    if (user.is_master || user.id === currentProfile?.id) return null;
    return (
      <button
        onClick={() => setDeletingUser(deletingUser === user.id ? null : user.id)}
        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
      >
        <Trash2 className="w-4 h-4" />
        {t('admin.delete')}
      </button>
    );
  };

  const Avatar = ({ user, extra = '' }: { user: UserRow; extra?: string }) =>
    user.profile_image_url ? (
      <img loading="lazy" decoding="async"
        src={user.profile_image_url}
        alt={user.full_name || ''}
        className={`w-10 h-10 rounded-full object-cover border-2 border-slate-200 ${extra}`}
      />
    ) : (
      <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold ${extra}`}>
        {initials(user.full_name)}
      </div>
    );

  if (loading) {
    return <SectionSkeleton variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('admin.userManagement')}</h2>
          <p className="text-slate-600 mt-1">{t('admin.manageUsers')}</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm self-start sm:self-auto">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-600" />
            <div>
              <p className="text-sm text-slate-600">{t('admin.totalUsers')}</p>
              <p className="text-xl font-bold text-slate-900">{users.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchUsers')}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {t('common.user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {t('common.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {t('profile.country')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {t('common.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <Fragment key={user.id}>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar user={user} />
                        <div>
                          <p className="font-semibold text-slate-900">{user.full_name}</p>
                          <p className="text-sm text-slate-600">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge user={user} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-900">{getCountryName(user.country_code, countryMap)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.is_active ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <RoleButton user={user} />
                        <DeleteButton user={user} />
                      </div>
                    </td>
                  </tr>
                  {deletingUser === user.id && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-red-50 border-t border-red-100">
                        <div className="flex items-center gap-4">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <p className="text-sm text-red-800 flex-1">
                            {t('um.deleteConfirmPrefix')} <strong>{user.full_name}</strong>{t('um.deleteConfirmSuffix')}
                          </p>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={deleteLoading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium flex items-center gap-2 disabled:opacity-50 flex-shrink-0"
                          >
                            {deleteLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('um.deleting')}
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                {t('um.confirmDelete')}
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setDeletingUser(null)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium flex-shrink-0"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-200">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar user={user} extra="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">{user.full_name}</p>
                  <p className="text-sm text-slate-600 truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <RoleBadge user={user} />
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {user.is_active ? t('common.active') : t('common.inactive')}
                </span>
                <span className="text-sm text-slate-600">{getCountryName(user.country_code, countryMap)}</span>
              </div>

              {(canChangeRole(user) || (!user.is_master && user.id !== currentProfile?.id)) && (
                <div className="flex gap-2 flex-wrap border-t border-slate-100 pt-3">
                  <RoleButton user={user} />
                  <DeleteButton user={user} />
                </div>
              )}

              {deletingUser === user.id && (
                <div className="bg-red-50 border-t border-red-100 pt-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-800">
                      {t('um.deleteConfirmPrefix')} <strong>{user.full_name}</strong>{t('um.deleteConfirmSuffix')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={deleteLoading}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {deleteLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('um.deleting')}
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          {t('um.confirmDelete')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setDeletingUser(null)}
                      className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
