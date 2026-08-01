import { useEffect, useState } from 'react';
import { supabase, Rank } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Award, Save, X, CreditCard as Edit2, Users, TrendingUp, CheckCircle, XCircle, Zap, Star, Crown, Trophy, Medal, User, Shield, Plus, Trash2 } from 'lucide-react';

const ICON_OPTIONS = [
  { value: 'user', label: 'User', Icon: User },
  { value: 'medal', label: 'Medal', Icon: Medal },
  { value: 'star', label: 'Star', Icon: Star },
  { value: 'crown', label: 'Crown', Icon: Crown },
  { value: 'trophy', label: 'Trophy', Icon: Trophy },
  { value: 'shield', label: 'Shield', Icon: Shield },
  { value: 'award', label: 'Award', Icon: Award },
  { value: 'zap', label: 'Zap', Icon: Zap },
];

const COLOR_PRESETS = [
  '#9CA3AF', '#C0C0C0', '#FFD700', '#3B82F6',
  '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444',
  '#10B981', '#6366F1', '#0EA5E9', '#F97316',
];

function getRankIcon(icon: string, className: string) {
  const found = ICON_OPTIONS.find(o => o.value === icon);
  const Icon = found ? found.Icon : Award;
  return <Icon className={className} />;
}

export function RankManagement() {
  const toast = useToast();
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Rank>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newRank, setNewRank] = useState({
    name: '',
    display_order: 11,
    required_pv: 0,
    required_branches: 0,
    requires_approval: true,
    color: '#3B82F6',
    icon: 'star',
    is_active: true,
  });

  useEffect(() => {
    fetchRanks();
  }, []);

  const fetchRanks = async () => {
    const { data } = await supabase
      .from('ranks')
      .select('*')
      .order('display_order', { ascending: true });
    if (data) setRanks(data);
    setLoading(false);
  };

  const startEdit = (rank: Rank) => {
    setEditing(rank.id);
    setEditData({ ...rank });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);

    const { error } = await supabase
      .from('ranks')
      .update({
        name: editData.name,
        display_order: editData.display_order,
        required_pv: editData.required_pv,
        required_branches: editData.required_branches,
        requires_approval: editData.requires_approval,
        color: editData.color,
        icon: editData.icon,
        is_active: editData.is_active,
      })
      .eq('id', editing);

    setSaving(false);

    if (error) {
      toast.error('Failed to update rank');
      return;
    }

    toast.success('Rank updated successfully');
    setEditing(null);
    setEditData({});
    fetchRanks();
  };

  const handleAddRank = async () => {
    if (!newRank.name.trim()) {
      toast.warning('Rank name is required');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('ranks').insert({
      name: newRank.name.trim(),
      display_order: newRank.display_order,
      required_pv: newRank.required_pv,
      required_branches: newRank.required_branches,
      requires_approval: newRank.requires_approval,
      color: newRank.color,
      icon: newRank.icon,
      is_active: newRank.is_active,
    });
    setSaving(false);

    if (error) {
      toast.error('Failed to create rank');
      return;
    }

    toast.success('Rank created successfully');
    setShowAddModal(false);
    setNewRank({
      name: '',
      display_order: 11,
      required_pv: 0,
      required_branches: 0,
      requires_approval: true,
      color: '#3B82F6',
      icon: 'star',
      is_active: true,
    });
    fetchRanks();
  };

  const handleDelete = async (rankId: string) => {
    const { error } = await supabase.from('ranks').delete().eq('id', rankId);
    if (error) {
      toast.error('Cannot delete rank — it may be in use by users or other records');
      setDeleteConfirm(null);
      return;
    }
    toast.success('Rank deleted');
    setDeleteConfirm(null);
    fetchRanks();
  };

  const toggleActive = async (rank: Rank) => {
    const { error } = await supabase
      .from('ranks')
      .update({ is_active: !rank.is_active })
      .eq('id', rank.id);
    if (error) {
      toast.error('Failed to update rank status');
      return;
    }
    toast.success(`Rank ${rank.is_active ? 'deactivated' : 'activated'}`);
    fetchRanks();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rank Management</h2>
          <p className="text-slate-600 mt-1">Configure rank tiers, PV requirements, and promotion settings</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Rank
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ranks.map((rank) => (
          <div
            key={rank.id}
            className={`bg-white rounded-xl border shadow-sm transition-all ${
              editing === rank.id ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200'
            } ${!rank.is_active ? 'opacity-60' : ''}`}
          >
            {editing === rank.id ? (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-slate-800">Editing: {editData.name}</h3>
                  <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rank Name</label>
                    <input
                      type="text"
                      value={editData.name || ''}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Order</label>
                    <input
                      type="number"
                      value={editData.display_order || 0}
                      onChange={(e) => setEditData({ ...editData, display_order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Required PV</label>
                    <input
                      type="number"
                      value={editData.required_pv || 0}
                      onChange={(e) => setEditData({ ...editData, required_pv: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Required Branches</label>
                    <input
                      type="number"
                      value={editData.required_branches || 0}
                      onChange={(e) => setEditData({ ...editData, required_branches: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Icon</label>
                    <select
                      value={editData.icon || 'star'}
                      onChange={(e) => setEditData({ ...editData, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    >
                      {ICON_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editData.color || '#3B82F6'}
                        onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                        className="w-10 h-9 border border-slate-300 rounded-lg cursor-pointer"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_PRESETS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditData({ ...editData, color: c })}
                            className={`w-6 h-6 rounded-full border-2 transition ${
                              editData.color === c ? 'border-slate-700 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editData.requires_approval ?? true}
                      onChange={(e) => setEditData({ ...editData, requires_approval: e.target.checked })}
                      className="w-4 h-4 rounded accent-brand-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Requires approval</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editData.is_active ?? true}
                      onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded accent-brand-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Active</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 flex items-center gap-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${rank.color}20`, color: rank.color }}
                >
                  {getRankIcon(rank.icon, 'w-6 h-6')}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-base">{rank.name}</span>
                    <span className="text-xs text-slate-400 font-medium">#{rank.display_order}</span>
                    {!rank.is_active && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-1.5">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      <span><span className="font-semibold text-slate-800">{rank.required_pv.toLocaleString()}</span> PV required</span>
                    </div>
                    {rank.required_branches > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span><span className="font-semibold text-slate-800">{rank.required_branches}</span> branches</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-sm">
                      {rank.requires_approval ? (
                        <>
                          <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-amber-500 block" />
                          </span>
                          <span className="text-amber-700 font-medium">Requires approval</span>
                        </>
                      ) : (
                        <>
                          <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-green-500 block" />
                          </span>
                          <span className="text-green-700 font-medium">Auto promotion</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(rank)}
                    title={rank.is_active ? 'Deactivate' : 'Activate'}
                    className={`p-2 rounded-lg transition text-sm ${
                      rank.is_active
                        ? 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {rank.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => startEdit(rank)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {deleteConfirm === rank.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(rank.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-xs font-semibold"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(rank.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete rank"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add New Rank</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rank Name *</label>
                  <input
                    type="text"
                    value={newRank.name}
                    onChange={(e) => setNewRank({ ...newRank, name: e.target.value })}
                    placeholder="e.g. Diamond"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Order</label>
                  <input
                    type="number"
                    value={newRank.display_order}
                    onChange={(e) => setNewRank({ ...newRank, display_order: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Required PV</label>
                  <input
                    type="number"
                    value={newRank.required_pv}
                    onChange={(e) => setNewRank({ ...newRank, required_pv: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Required Branches</label>
                  <input
                    type="number"
                    value={newRank.required_branches}
                    onChange={(e) => setNewRank({ ...newRank, required_branches: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Icon</label>
                  <select
                    value={newRank.icon}
                    onChange={(e) => setNewRank({ ...newRank, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newRank.color}
                    onChange={(e) => setNewRank({ ...newRank, color: e.target.value })}
                    className="w-10 h-9 border border-slate-300 rounded-lg cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewRank({ ...newRank, color: c })}
                        className={`w-6 h-6 rounded-full border-2 transition ${
                          newRank.color === c ? 'border-slate-700 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRank.requires_approval}
                    onChange={(e) => setNewRank({ ...newRank, requires_approval: e.target.checked })}
                    className="w-4 h-4 rounded accent-brand-600"
                  />
                  <span className="text-sm font-medium text-slate-700">Requires approval</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRank.is_active}
                    onChange={(e) => setNewRank({ ...newRank, is_active: e.target.checked })}
                    className="w-4 h-4 rounded accent-brand-600"
                  />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>
              </div>

              <div className="pt-1">
                <div
                  className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{ borderColor: `${newRank.color}40`, backgroundColor: `${newRank.color}10` }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ color: newRank.color }}
                  >
                    {getRankIcon(newRank.icon, 'w-5 h-5')}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: newRank.color }}>
                      {newRank.name || 'New Rank'}
                    </p>
                    <p className="text-xs text-slate-500">{newRank.required_pv.toLocaleString()} PV required</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-6 border-t border-slate-100">
              <button
                onClick={handleAddRank}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-semibold disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Creating...' : 'Create Rank'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
