import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PermissionType } from '../../lib/supabase';
import { UserPlus, Shield, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface ManagerProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  region: string | null;
  is_master: boolean;
}

interface PermissionRow {
  id: string;
  user_id: string;
  permission: PermissionType;
  regions: string[] | null;
  granted_by: string | null;
  created_at: string;
}

const ALL_PERMISSIONS: { key: PermissionType; label: string; description: string }[] = [
  { key: 'manage_orders', label: 'Manage Orders', description: 'View, approve, reject, and update order statuses' },
  { key: 'manage_inventory', label: 'Manage Inventory', description: 'View and update stock levels' },
  { key: 'manage_users', label: 'Manage Users', description: 'View and edit user profiles' },
  { key: 'manage_accounts', label: 'Manage Accounts', description: 'Approve or reject new account registrations' },
  { key: 'manage_products', label: 'Manage Products', description: 'Add, edit, and deactivate products' },
  { key: 'manage_promotions', label: 'Manage Promotions', description: 'Review and approve rank promotions' },
  { key: 'manage_codes', label: 'Manage Codes', description: 'Manage Life Changer referral codes' },
];

export default function ManagerManagement() {
  const { isMaster } = useAuth();
  const toast = useToast();
  const [managers, setManagers] = useState<(ManagerProfile & { permissions: PermissionRow[] })[]>([]);
  const [allUsers, setAllUsers] = useState<ManagerProfile[]>([]);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<(ManagerProfile & { permissions: PermissionRow[] }) | null>(null);
  const [expandedManager, setExpandedManager] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    user_id: '',
    selectedPermissions: [] as PermissionType[],
    regions: [] as string[],
    allRegions: true,
  });

  const [editForm, setEditForm] = useState({
    selectedPermissions: [] as PermissionType[],
    regions: [] as string[],
    allRegions: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadManagers(), loadUsers(), loadCountries()]);
    setLoading(false);
  };

  const loadManagers = async () => {
    const { data: managerProfiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, region, is_master')
      .in('role', ['admin', 'manager'])
      .order('is_master', { ascending: false });

    if (error) {
      console.error('Error loading managers:', error);
      return;
    }

    const managersWithPerms = await Promise.all(
      (managerProfiles || []).map(async (m) => {
        const { data: perms } = await supabase
          .from('manager_permissions')
          .select('*')
          .eq('user_id', m.id);
        return { ...m, permissions: perms || [] };
      })
    );

    setManagers(managersWithPerms);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, region, is_master')
      .eq('role', 'user')
      .eq('account_status', 'approved')
      .order('full_name');

    if (error) {
      console.error('Error loading users:', error);
      return;
    }
    setAllUsers(data || []);
  };

  const loadCountries = async () => {
    const { data, error } = await supabase
      .from('countries')
      .select('code, name')
      .order('name');

    if (error) {
      console.error('Error loading countries:', error);
      return;
    }
    setCountries(data || []);
  };

  const handleAddManager = async () => {
    if (!addForm.user_id || addForm.selectedPermissions.length === 0) {
      toast.warning('Please select a user and at least one permission.');
      return;
    }

    try {
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'manager' })
        .eq('id', addForm.user_id);

      if (roleError) throw roleError;

      const { data: userData } = await supabase.auth.getUser();
      const regions = addForm.allRegions ? null : addForm.regions;

      const permInserts = addForm.selectedPermissions.map(perm => ({
        user_id: addForm.user_id,
        permission: perm,
        regions,
        granted_by: userData.user?.id,
      }));

      const { error: permError } = await supabase
        .from('manager_permissions')
        .insert(permInserts);

      if (permError) throw permError;

      setShowAddModal(false);
      setAddForm({ user_id: '', selectedPermissions: [], regions: [], allRegions: true });
      loadData();
    } catch (error) {
      console.error('Error adding manager:', error);
      toast.error('Failed to add manager');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedManager) return;

    try {
      const { data: existing } = await supabase
        .from('manager_permissions')
        .select('id')
        .eq('user_id', selectedManager.id);

      if (existing && existing.length > 0) {
        const { error: delError } = await supabase
          .from('manager_permissions')
          .delete()
          .eq('user_id', selectedManager.id);
        if (delError) throw delError;
      }

      if (editForm.selectedPermissions.length === 0) {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: 'user' })
          .eq('id', selectedManager.id);
        if (roleError) throw roleError;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const regions = editForm.allRegions ? null : editForm.regions;

        const permInserts = editForm.selectedPermissions.map(perm => ({
          user_id: selectedManager.id,
          permission: perm,
          regions,
          granted_by: userData.user?.id,
        }));

        const { error: permError } = await supabase
          .from('manager_permissions')
          .insert(permInserts);

        if (permError) throw permError;
      }

      setShowEditModal(false);
      setSelectedManager(null);
      toast.success('Permissions updated successfully');
      loadData();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const handleRemoveManager = async (managerId: string) => {

    try {
      const { data: existing } = await supabase
        .from('manager_permissions')
        .select('id')
        .eq('user_id', managerId);

      if (existing && existing.length > 0) {
        const { error: delError } = await supabase
          .from('manager_permissions')
          .delete()
          .eq('user_id', managerId);
        if (delError) throw delError;
      }

      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'user' })
        .eq('id', managerId);

      if (roleError) throw roleError;

      toast.success('Manager removed successfully');
      loadData();
    } catch (error) {
      console.error('Error removing manager:', error);
      toast.error('Failed to remove manager');
    }
  };

  const handlePromoteToAdmin = async (managerId: string) => {

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', managerId);

      if (error) throw error;
      toast.success('User promoted to admin');
      loadData();
    } catch (error) {
      console.error('Error promoting to admin:', error);
      toast.error('Failed to promote to admin');
    }
  };

  const handleDemoteFromAdmin = async (managerId: string) => {

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'manager' })
        .eq('id', managerId);

      if (error) throw error;
      toast.success('Admin demoted to manager');
      loadData();
    } catch (error) {
      console.error('Error demoting admin:', error);
      toast.error('Failed to demote admin');
    }
  };

  const openEditModal = (manager: ManagerProfile & { permissions: PermissionRow[] }) => {
    setSelectedManager(manager);
    const existingPerms = manager.permissions.map(p => p.permission);
    const existingRegions = manager.permissions[0]?.regions;
    setEditForm({
      selectedPermissions: existingPerms,
      regions: existingRegions || [],
      allRegions: existingRegions === null,
    });
    setShowEditModal(true);
  };

  const togglePermission = (
    perm: PermissionType,
    form: 'add' | 'edit'
  ) => {
    if (form === 'add') {
      setAddForm(prev => ({
        ...prev,
        selectedPermissions: prev.selectedPermissions.includes(perm)
          ? prev.selectedPermissions.filter(p => p !== perm)
          : [...prev.selectedPermissions, perm],
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        selectedPermissions: prev.selectedPermissions.includes(perm)
          ? prev.selectedPermissions.filter(p => p !== perm)
          : [...prev.selectedPermissions, perm],
      }));
    }
  };

  const toggleRegion = (code: string, form: 'add' | 'edit') => {
    if (form === 'add') {
      setAddForm(prev => ({
        ...prev,
        regions: prev.regions.includes(code)
          ? prev.regions.filter(r => r !== code)
          : [...prev.regions, code],
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        regions: prev.regions.includes(code)
          ? prev.regions.filter(r => r !== code)
          : [...prev.regions, code],
      }));
    }
  };

  const filteredManagers = managers.filter(m =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isMaster) {
    return (
      <div className="text-center py-16">
        <Shield size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700">Access Restricted</h3>
        <p className="text-gray-500 mt-2">Only the master account can manage team permissions.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading team management...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
          <p className="text-gray-600">Assign people to manage orders, inventory, and more by country</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg hover:bg-brand-800"
        >
          <UserPlus size={20} />
          Add Manager
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search managers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      <div className="space-y-3">
        {filteredManagers.map((manager) => {
          const isExpanded = expandedManager === manager.id;
          return (
            <div key={manager.id} className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedManager(isExpanded ? null : manager.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
                    {manager.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{manager.full_name}</span>
                      {manager.is_master && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">MASTER</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        manager.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {manager.role === 'admin' ? 'Admin' : 'Manager'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{manager.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {manager.role === 'admin' ? 'Full Access' : `${manager.permissions.length} permissions`}
                  </span>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  {manager.role === 'admin' ? (
                    <div className="bg-blue-50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-blue-800">
                        <strong>Full Admin</strong> - Has access to all features across all countries.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</p>
                      <div className="flex flex-wrap gap-2">
                        {manager.permissions.length === 0 ? (
                          <span className="text-sm text-gray-400 italic">No permissions assigned</span>
                        ) : (
                          manager.permissions.map(p => {
                            const permInfo = ALL_PERMISSIONS.find(ap => ap.key === p.permission);
                            return (
                              <span key={p.id} className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                                {permInfo?.label || p.permission}
                              </span>
                            );
                          })
                        )}
                      </div>
                      {manager.permissions[0]?.regions && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Countries</p>
                          <div className="flex flex-wrap gap-1">
                            {manager.permissions[0].regions.map(r => {
                              const countryName = countries.find(c => c.code === r)?.name || r;
                              return (
                                <span key={r} className="text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">{countryName}</span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {!manager.permissions[0]?.regions && manager.permissions.length > 0 && (
                        <p className="text-xs text-gray-500">Countries: All countries</p>
                      )}
                    </div>
                  )}

                  {!manager.is_master && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      {manager.role === 'manager' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(manager); }}
                            className="text-sm px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium"
                          >
                            Edit Permissions
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePromoteToAdmin(manager.id); }}
                            className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                          >
                            Promote to Admin
                          </button>
                        </>
                      )}
                      {manager.role === 'admin' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDemoteFromAdmin(manager.id); }}
                          className="text-sm px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium"
                        >
                          Demote to Manager
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveManager(manager.id); }}
                        className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredManagers.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Shield size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No managers found</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Manager</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                <select
                  value={addForm.user_id}
                  onChange={(e) => setAddForm({ ...addForm, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Choose a user...</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map(perm => (
                    <label key={perm.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addForm.selectedPermissions.includes(perm.key)}
                        onChange={() => togglePermission(perm.key, 'add')}
                        className="mt-0.5 w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{perm.label}</span>
                        <p className="text-xs text-gray-500">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country Access</label>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.allRegions}
                    onChange={(e) => setAddForm({ ...addForm, allRegions: e.target.checked, regions: [] })}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700">All countries</span>
                </label>
                {!addForm.allRegions && (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 grid grid-cols-3 gap-1">
                    {countries.map(c => (
                      <label key={c.code} className="flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={addForm.regions.includes(c.code)}
                          onChange={() => toggleRegion(c.code, 'add')}
                          className="w-3.5 h-3.5 text-brand-600 rounded focus:ring-brand-500"
                        />
                        <span>{c.code}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddManager}
                  className="flex-1 bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium"
                >
                  Add Manager
                </button>
                <button
                  onClick={() => { setShowAddModal(false); setAddForm({ user_id: '', selectedPermissions: [], regions: [], allRegions: true }); }}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">Edit Permissions</h3>
            <p className="text-sm text-gray-600 mb-4">{selectedManager.full_name} ({selectedManager.email})</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map(perm => (
                    <label key={perm.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.selectedPermissions.includes(perm.key)}
                        onChange={() => togglePermission(perm.key, 'edit')}
                        className="mt-0.5 w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{perm.label}</span>
                        <p className="text-xs text-gray-500">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country Access</label>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.allRegions}
                    onChange={(e) => setEditForm({ ...editForm, allRegions: e.target.checked, regions: [] })}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700">All countries</span>
                </label>
                {!editForm.allRegions && (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 grid grid-cols-3 gap-1">
                    {countries.map(c => (
                      <label key={c.code} className="flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={editForm.regions.includes(c.code)}
                          onChange={() => toggleRegion(c.code, 'edit')}
                          className="w-3.5 h-3.5 text-brand-600 rounded focus:ring-brand-500"
                        />
                        <span>{c.code}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {editForm.selectedPermissions.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> Removing all permissions will demote this person back to a regular user.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdatePermissions}
                  className="flex-1 bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => { setShowEditModal(false); setSelectedManager(null); }}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
