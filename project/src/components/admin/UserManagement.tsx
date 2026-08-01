import { useEffect, useState } from 'react';
import { supabase, Profile, Rank } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { loadCountryNames, getCountryName } from '../../utils/countries';
import { Users, Search, Award, TrendingUp, CreditCard as Edit, Shield, UserX, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { autoCreatePromotionRequest } from '../../utils/pv';

interface UserWithRank extends Profile {
  rank: Rank | null;
  profile_image_url?: string;
}

export function UserManagement() {
  const toast = useToast();
  const [users, setUsers] = useState<UserWithRank[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingPV, setEditingPV] = useState<string | null>(null);
  const [pvAmount, setPVAmount] = useState('');
  const [pvDescription, setPVDescription] = useState('');
  const [countryMap, setCountryMap] = useState<Record<string, string>>({});
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const countries = await loadCountryNames();
      setCountryMap(countries);
      await fetchUsers();
    };
    loadData();
  }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!profiles) {
      setLoading(false);
      return;
    }

    const rankIds = profiles
      .map((p) => p.current_rank_id)
      .filter((id): id is string => id !== null);

    const { data: ranks } = await supabase
      .from('ranks')
      .select('*')
      .in('id', rankIds);

    const usersWithRanks = profiles.map((profile) => ({
      ...profile,
      rank: ranks?.find((r) => r.id === profile.current_rank_id) || null,
    }));

    setUsers(usersWithRanks);
    setLoading(false);
  };

  const adjustPV = async (userId: string) => {
    const amount = parseFloat(pvAmount);
    if (isNaN(amount) || amount === 0) {
      toast.warning('Please enter a valid PV amount');
      return;
    }

    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const newTotal = Number(user.total_pv) + amount;

    const [pvResult, profileResult] = await Promise.all([
      supabase.from('pv_transactions').insert({
        user_id: userId,
        amount,
        transaction_type: 'adjustment',
        reference_type: 'admin',
        description: pvDescription || 'Admin adjustment',
      }),
      supabase
        .from('profiles')
        .update({ total_pv: newTotal })
        .eq('id', userId),
    ]);

    if (pvResult.error || profileResult.error) {
      toast.error('Failed to adjust PV');
      return;
    }

    await autoCreatePromotionRequest(userId, newTotal);

    toast.success('PV adjusted successfully');
    setEditingPV(null);
    setPVAmount('');
    setPVDescription('');
    fetchUsers();
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update user role');
      return;
    }

    toast.success(`User ${newRole === 'admin' ? 'promoted' : 'demoted'} successfully`);
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
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
          body: JSON.stringify({ targetUserId: userId }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user');

      toast.success('User account deleted successfully');
      setDeletingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600 mt-1">Manage all platform users</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-600" />
            <div>
              <p className="text-sm text-slate-600">Total Users</p>
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
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  PV
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <>
                  <tr key={user.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.profile_image_url ? (
                          <img
                            src={user.profile_image_url}
                            alt={user.full_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold">
                            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{user.full_name}</p>
                          <p className="text-sm text-slate-600">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Award
                          className="w-4 h-4"
                          style={{ color: user.rank?.color || '#6B7280' }}
                        />
                        <span className="text-sm font-semibold text-slate-900">
                          {user.rank?.name || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-semibold text-slate-900">
                          {user.total_pv}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-900">{getCountryName(user.country_code, countryMap)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingPV(user.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium"
                        >
                          <Edit className="w-4 h-4" />
                          PV
                        </button>
                        <button
                          onClick={() => toggleUserRole(user.id, user.role)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-sm font-medium ${
                            user.role === 'admin'
                              ? 'bg-slate-600 text-white hover:bg-slate-700'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <>
                              <UserX className="w-4 h-4" />
                              Demote
                            </>
                          ) : (
                            <>
                              <Shield className="w-4 h-4" />
                              Promote
                            </>
                          )}
                        </button>
                        {!user.is_master && (
                          <button
                            onClick={() => setDeletingUser(deletingUser === user.id ? null : user.id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingPV === user.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-brand-50">
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            value={pvAmount}
                            onChange={(e) => setPVAmount(e.target.value)}
                            placeholder="PV Amount (+ or -)"
                            className="px-4 py-2 border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={pvDescription}
                            onChange={(e) => setPVDescription(e.target.value)}
                            placeholder="Description"
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                          />
                          <button
                            onClick={() => adjustPV(user.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => {
                              setEditingPV(null);
                              setPVAmount('');
                              setPVDescription('');
                            }}
                            className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {deletingUser === user.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-red-50 border-t border-red-100">
                        <div className="flex items-center gap-4">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <p className="text-sm text-red-800 flex-1">
                            Are you sure you want to permanently delete <strong>{user.full_name}</strong>'s account? This will remove all their data and cannot be undone.
                          </p>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleteLoading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium flex items-center gap-2 disabled:opacity-50 flex-shrink-0"
                          >
                            {deleteLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Confirm Delete
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setDeletingUser(null)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium flex-shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
