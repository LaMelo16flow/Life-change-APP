import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Gift, Plus, CreditCard as Edit2, Trash2, Search } from 'lucide-react';

interface LifeChangerCode {
  id: string;
  code: string;
  owner_id: string;
  description: string | null;
  bonus_pv: number;
  commission_rate: number;
  usage_limit: number | null;
  times_used: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  owner: {
    full_name: string;
    email: string;
  };
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export default function LifeChangerCodes() {
  const toast = useToast();
  const [codes, setCodes] = useState<LifeChangerCode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState<LifeChangerCode | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    owner_id: '',
    description: '',
    bonus_pv: 0,
    commission_rate: 0,
    usage_limit: null as number | null,
    expires_at: '',
    is_active: true,
  });

  useEffect(() => {
    loadCodes();
    loadUsers();
  }, []);

  const loadCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('life_changer_codes')
        .select(`
          *,
          owner:profiles!life_changer_codes_owner_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error('Error loading codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'LC-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleAddCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('life_changer_codes')
        .insert([{
          ...formData,
          expires_at: formData.expires_at || null,
          created_by: userData.user?.id,
        }]);

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        code: '',
        owner_id: '',
        description: '',
        bonus_pv: 0,
        commission_rate: 0,
        usage_limit: null,
        expires_at: '',
        is_active: true,
      });
      loadCodes();
    } catch (error) {
      console.error('Error adding code:', error);
      toast.error('Failed to add code. Code might already exist.');
    }
  };

  const handleUpdateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCode) return;

    try {
      const { error } = await supabase
        .from('life_changer_codes')
        .update({
          description: formData.description,
          bonus_pv: formData.bonus_pv,
          commission_rate: formData.commission_rate,
          usage_limit: formData.usage_limit,
          expires_at: formData.expires_at || null,
          is_active: formData.is_active,
        })
        .eq('id', selectedCode.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedCode(null);
      toast.success('Code updated successfully');
      loadCodes();
    } catch (error) {
      console.error('Error updating code:', error);
      toast.error('Failed to update code');
    }
  };

  const handleDeleteCode = async (id: string) => {

    try {
      const { error } = await supabase
        .from('life_changer_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Code deleted successfully');
      loadCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast.error('Failed to delete code');
    }
  };

  const openEditModal = (code: LifeChangerCode) => {
    setSelectedCode(code);
    setFormData({
      code: code.code,
      owner_id: code.owner_id,
      description: code.description || '',
      bonus_pv: code.bonus_pv,
      commission_rate: code.commission_rate,
      usage_limit: code.usage_limit,
      expires_at: code.expires_at ? code.expires_at.split('T')[0] : '',
      is_active: code.is_active,
    });
    setShowEditModal(true);
  };

  const filteredCodes = codes.filter(code =>
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.owner.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (code.description && code.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isUsageLimitReached = (code: LifeChangerCode) => {
    if (!code.usage_limit) return false;
    return code.times_used >= code.usage_limit;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading codes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Life Changer Codes</h2>
          <p className="text-gray-600">Manage referral and promotional codes</p>
        </div>
        <button
          onClick={() => {
            generateCode();
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg hover:bg-brand-800"
        >
          <Plus size={20} />
          Create New Code
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search codes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {filteredCodes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Gift size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No codes found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bonus PV
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCodes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono font-bold text-brand-600">{code.code}</div>
                    {code.description && (
                      <div className="text-xs text-gray-500 mt-1">{code.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{code.owner.full_name}</div>
                    <div className="text-xs text-gray-500">{code.owner.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{code.bonus_pv} PV</div>
                    {code.commission_rate > 0 && (
                      <div className="text-xs text-gray-500">{code.commission_rate}% commission</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {code.times_used} / {code.usage_limit || '∞'}
                    </div>
                    {isUsageLimitReached(code) && (
                      <span className="text-xs text-red-600">Limit reached</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {code.is_active && !isExpired(code.expires_at) && !isUsageLimitReached(code) ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {code.expires_at ? (
                      <div>
                        {new Date(code.expires_at).toLocaleDateString()}
                        {isExpired(code.expires_at) && (
                          <div className="text-xs text-red-600">Expired</div>
                        )}
                      </div>
                    ) : (
                      'Never'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(code)}
                      className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                    >
                      <Edit2 size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCode(code.id)}
                      className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Life Changer Code</h3>
            <form onSubmit={handleAddCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code Owner</label>
                <select
                  value={formData.owner_id}
                  onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Select owner</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bonus PV</label>
                <input
                  type="number"
                  value={formData.bonus_pv}
                  onChange={(e) => setFormData({ ...formData, bonus_pv: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
                <input
                  type="number"
                  value={formData.usage_limit || ''}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                  min="1"
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium"
                >
                  Create Code
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Edit Life Changer Code</h3>
            <form onSubmit={handleUpdateCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                <input
                  type="text"
                  value={selectedCode.owner.full_name}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bonus PV</label>
                <input
                  type="number"
                  value={formData.bonus_pv}
                  onChange={(e) => setFormData({ ...formData, bonus_pv: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
                <input
                  type="number"
                  value={formData.usage_limit || ''}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                  min="1"
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Times Used</label>
                <input
                  type="number"
                  value={selectedCode.times_used}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active_edit"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                />
                <label htmlFor="is_active_edit" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
