import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { loadCountryNames, getCountryName } from '../../utils/countries';
import { UserCheck, UserX, CheckCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PendingProfile {
  id: string;
  full_name: string;
  email: string;
  country_code: string;
  referred_by: string | null;
  created_at: string;
  account_status: string;
  rejection_reason: string | null;
  profile_image_url: string | null;
}

export default function AccountApprovals() {
  const toast = useToast();
  const { t } = useLanguage();
  const { isMaster } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<PendingProfile | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [countryMap, setCountryMap] = useState<Record<string, string>>({});
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [togglingApproval, setTogglingApproval] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const countries = await loadCountryNames();
      setCountryMap(countries);
      await Promise.all([loadPendingUsers(), loadApprovalSetting()]);
    };
    loadData();
  }, []);

  const loadApprovalSetting = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'require_account_approval')
      .maybeSingle();
    if (data) {
      setApprovalRequired(data.value?.enabled !== false);
    }
  };

  const toggleApprovalRequirement = async () => {
    setTogglingApproval(true);
    try {
      const newValue = !approvalRequired;
      const { error } = await supabase
        .from('admin_settings')
        .update({ value: { enabled: newValue }, updated_at: new Date().toISOString() })
        .eq('key', 'require_account_approval');

      if (error) throw error;
      setApprovalRequired(newValue);
      toast.success(newValue
        ? t('accounts.approvalEnabledToast')
        : t('accounts.approvalDisabledToast')
      );
    } catch (error) {
      console.error('Error toggling approval setting:', error);
      toast.error(t('accounts.failedUpdateApprovalSetting'));
    } finally {
      setTogglingApproval(false);
    }
  };

  const loadPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingUsers(data || []);
    } catch (error) {
      console.error('Error loading pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('profiles')
        .update({
          account_status: 'approved',
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      const user = pendingUsers.find(u => u.id === userId);
      if (user) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'approval',
          title: t('accounts.accountApprovedTitle'),
          message: t('accounts.accountApprovedMsg'),
          title_key: 'accounts.accountApprovedTitle',
          message_key: 'accounts.accountApprovedMsg',
          action_url: '/',
        });
      }

      toast.success(t('accounts.accountApprovedToast'));
      loadPendingUsers();
    } catch (error) {
      console.error('Error approving account:', error);
      toast.error(t('accounts.failedApproveAccount'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser || !rejectionReason.trim()) return;

    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('profiles')
        .update({
          account_status: 'rejected',
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedUser.id,
        type: 'approval',
        title: t('accounts.registrationNotApprovedTitle'),
        message: t('accounts.registrationNotApprovedMsg', { reason: rejectionReason }),
        title_key: 'accounts.registrationNotApprovedTitle',
        message_key: 'accounts.registrationNotApprovedMsg',
        message_params: { reason: rejectionReason },
        action_url: '/',
      });

      toast.success(t('accounts.accountRejectedToast'));
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedUser(null);
      loadPendingUsers();
    } catch (error) {
      console.error('Error rejecting account:', error);
      toast.error(t('accounts.failedRejectAccount'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">{t('admin.loadingPending')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('accounts.title')}</h2>
          <p className="text-gray-600">{t('accounts.subtitle')}</p>
        </div>

        {isMaster && (
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t('accounts.requireApproval')}</p>
              <p className="text-xs text-gray-500">
                {approvalRequired
                  ? t('accounts.requireApprovalOnDesc')
                  : t('accounts.requireApprovalOffDesc')}
              </p>
            </div>
            <button
              onClick={toggleApprovalRequirement}
              disabled={togglingApproval}
              className="flex-shrink-0 transition-all duration-200 disabled:opacity-50"
            >
              {approvalRequired ? (
                <ToggleRight size={36} className="text-brand-600" />
              ) : (
                <ToggleLeft size={36} className="text-gray-400" />
              )}
            </button>
          </div>
        )}
      </div>

      {pendingUsers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CheckCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">{t('accounts.noPendingAccounts')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('profile.country')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('accounts.referredBy')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('accounts.registrationDate')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {user.profile_image_url ? (
                        <img
                          src={user.profile_image_url}
                          alt={user.full_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 mr-3"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold mr-3">
                          {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getCountryName(user.country_code, countryMap)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.referred_by || t('accounts.none')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={processing}
                      className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <UserCheck size={16} />
                      {t('accounts.approve')}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowRejectModal(true);
                      }}
                      disabled={processing}
                      className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <UserX size={16} />
                      {t('accounts.reject')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingUsers.length > 0 && (
        <div className="md:hidden space-y-3">
          {pendingUsers.map((user) => (
            <div key={user.id} className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="flex items-center gap-3">
                {user.profile_image_url ? (
                  <img
                    src={user.profile_image_url}
                    alt={user.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{user.full_name}</div>
                  <div className="text-sm text-gray-500 truncate">{user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-100 pt-3">
                <div>
                  <div className="text-xs text-gray-500">{t('profile.country')}</div>
                  <div className="text-gray-900">{getCountryName(user.country_code, countryMap)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('accounts.referredBy')}</div>
                  <div className="text-gray-900">{user.referred_by || t('accounts.none')}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500">{t('accounts.registrationDate')}</div>
                  <div className="text-gray-900">{new Date(user.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-gray-100 pt-3 text-sm font-medium">
                <button
                  onClick={() => handleApprove(user.id)}
                  disabled={processing}
                  className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <UserCheck size={16} />
                  Approve
                </button>
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    setShowRejectModal(true);
                  }}
                  disabled={processing}
                  className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <UserX size={16} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRejectModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{t('accounts.rejectAccountTitle')}</h3>
            <p className="text-gray-600 mb-4">
              {t('accounts.rejectReasonPrefix')} <strong>{selectedUser.full_name}</strong>{t('accounts.rejectReasonSuffix')}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('accounts.rejectionReasonLabel')}</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder={t('accounts.rejectionPlaceholder')}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {processing ? t('common.processing') : t('admin.confirmRejection')}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedUser(null);
                }}
                disabled={processing}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
