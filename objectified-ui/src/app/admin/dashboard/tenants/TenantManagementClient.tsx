'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  UserPlus,
  Shield,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Plus,
  X,
  Mail,
  UserCheck,
  UserX,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import {
  getAllTenants,
  getTenantStats,
  getTenantUsers,
  createTenant,
  updateTenant,
  deleteTenant,
  addUserToTenant,
  removeUserFromTenant,
  addTenantAdministrator,
  removeTenantAdministrator,
  getUsersNotInTenant,
  getAllUsers,
} from '../../../../../lib/db/admin-helper';

interface Tenant {
  id: string;
  name: string;
  description: string;
  slug: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  user_count?: number;
  admin_count?: number;
  project_count?: number;
}

interface TenantUser {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  enabled: boolean;
  added_at: string;
  is_admin: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  enabled: boolean;
}

export default function TenantManagementClient() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', description: '', slug: '' });

  useEffect(() => {
    loadTenants();
    loadAllUsers();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const result = await getTenantStats();
      const data = JSON.parse(result);
      if (data.success) {
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
      showMessage('error', 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const result = await getAllUsers();
      const data = JSON.parse(result);
      if (data.success) {
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTenantUsers = async (tenantId: string) => {
    try {
      const [usersResult, availableResult] = await Promise.all([
        getTenantUsers(tenantId),
        getUsersNotInTenant(tenantId),
      ]);

      const usersData = JSON.parse(usersResult);
      const availableData = JSON.parse(availableResult);

      if (usersData.success) {
        setTenantUsers(usersData.users);
      }
      if (availableData.success) {
        setAvailableUsers(availableData.users);
      }
    } catch (error) {
      console.error('Error loading tenant users:', error);
    }
  };

  const handleSelectTenant = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    await loadTenantUsers(tenant.id);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createTenant(
        newTenant.name,
        newTenant.description,
        newTenant.slug,
        true
      );
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', 'Tenant created successfully');
        setShowCreateDialog(false);
        setNewTenant({ name: '', description: '', slug: '' });
        await loadTenants();
      } else {
        showMessage('error', data.error || 'Failed to create tenant');
      }
    } catch (error) {
      console.error('Error creating tenant:', error);
      showMessage('error', 'Failed to create tenant');
    }
  };

  const handleToggleTenantEnabled = async (tenant: Tenant) => {
    try {
      const result = await updateTenant(tenant.id, { enabled: !tenant.enabled });
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', `Tenant ${tenant.enabled ? 'disabled' : 'enabled'} successfully`);
        await loadTenants();
        if (selectedTenant?.id === tenant.id) {
          setSelectedTenant({ ...selectedTenant, enabled: !tenant.enabled });
        }
      } else {
        showMessage('error', data.error || 'Failed to update tenant');
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
      showMessage('error', 'Failed to update tenant');
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!confirm(`Delete tenant "${tenant.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteTenant(tenant.id);
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', 'Tenant deleted successfully');
        await loadTenants();
        if (selectedTenant?.id === tenant.id) {
          setSelectedTenant(null);
          setTenantUsers([]);
        }
      } else {
        showMessage('error', data.error || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      showMessage('error', 'Failed to delete tenant');
    }
  };

  const handleAddUser = async (userId: string) => {
    if (!selectedTenant) return;

    try {
      const result = await addUserToTenant(selectedTenant.id, userId);
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', 'User added to tenant successfully');
        setShowAddUserDialog(false);
        await loadTenantUsers(selectedTenant.id);
        await loadTenants();
      } else {
        showMessage('error', data.error || 'Failed to add user');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      showMessage('error', 'Failed to add user');
    }
  };

  const handleRemoveUser = async (user: TenantUser) => {
    if (!selectedTenant) return;

    if (!confirm(`Remove ${user.name} from this tenant?`)) {
      return;
    }

    try {
      const result = await removeUserFromTenant(selectedTenant.id, user.id);
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', 'User removed successfully');
        await loadTenantUsers(selectedTenant.id);
        await loadTenants();
      } else {
        showMessage('error', data.error || 'Failed to remove user');
      }
    } catch (error) {
      console.error('Error removing user:', error);
      showMessage('error', 'Failed to remove user');
    }
  };

  const handleToggleAdmin = async (user: TenantUser) => {
    if (!selectedTenant) return;

    try {
      const result = user.is_admin
        ? await removeTenantAdministrator(selectedTenant.id, user.id)
        : await addTenantAdministrator(selectedTenant.id, user.id);
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', `Admin status updated successfully`);
        await loadTenantUsers(selectedTenant.id);
        await loadTenants();
      } else {
        showMessage('error', data.error || 'Failed to update admin status');
      }
    } catch (error) {
      console.error('Error updating admin status:', error);
      showMessage('error', 'Failed to update admin status');
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Tenant Management</h2>
              <p className="text-gray-400 text-sm mt-1">Manage tenants and assign users</p>
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Tenant
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Message Banner */}
          {message && (
            <div
              className={`p-4 rounded-lg border flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-900/20 border-green-700 text-green-400'
                  : 'bg-red-900/20 border-red-700 text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Total Tenants</p>
                  <p className="text-white text-xl font-bold">{tenants.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Total Users</p>
                  <p className="text-white text-xl font-bold">
                    {tenants.reduce((sum, t) => sum + (t.user_count || 0), 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-600/20 rounded-lg">
                  <Shield className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Total Admins</p>
                  <p className="text-white text-xl font-bold">
                    {tenants.reduce((sum, t) => sum + (t.admin_count || 0), 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-600/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Active Tenants</p>
                  <p className="text-white text-xl font-bold">
                    {tenants.filter((t) => t.enabled).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex justify-end">
            <button
              onClick={loadTenants}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tenants List */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Tenants</h3>
              </div>
              <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-12 text-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                  </div>
                ) : tenants.length === 0 ? (
                  <div className="p-12 text-center">
                    <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">No tenants found</p>
                  </div>
                ) : (
                  tenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className={`p-4 hover:bg-gray-750 transition-colors cursor-pointer ${
                        selectedTenant?.id === tenant.id ? 'bg-gray-750 border-l-4 border-red-600' : ''
                      }`}
                      onClick={() => handleSelectTenant(tenant)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{tenant.name}</h4>
                          <p className="text-gray-400 text-sm mt-1">{tenant.slug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTenantEnabled(tenant);
                            }}
                            className={`p-1 rounded transition-colors ${
                              tenant.enabled
                                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                            }`}
                            title={tenant.enabled ? 'Disable' : 'Enable'}
                          >
                            {tenant.enabled ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTenant(tenant);
                            }}
                            className="p-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                            title="Delete Tenant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {tenant.user_count || 0} users
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {tenant.admin_count || 0} admins
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tenant Users */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {selectedTenant ? `Users in ${selectedTenant.name}` : 'Select a Tenant'}
                </h3>
                {selectedTenant && (
                  <button
                    onClick={() => setShowAddUserDialog(true)}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add User
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
                {!selectedTenant ? (
                  <div className="p-12 text-center">
                    <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Select a tenant to view users</p>
                  </div>
                ) : tenantUsers.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">No users in this tenant</p>
                  </div>
                ) : (
                  tenantUsers.map((user) => (
                    <div key={user.id} className="p-4 hover:bg-gray-750">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-400 text-sm font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-white font-medium truncate">{user.name}</h4>
                              {user.is_admin && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-600/20 text-orange-400 text-xs rounded">
                                  <Shield className="w-3 h-3" />
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleToggleAdmin(user)}
                            className={`p-1 rounded transition-colors ${
                              user.is_admin
                                ? 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/30'
                                : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                            }`}
                            title={user.is_admin ? 'Remove Admin' : 'Make Admin'}
                          >
                            {user.is_admin ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleRemoveUser(user)}
                            className="p-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                            title="Remove User"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Tenant Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Create New Tenant</h3>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTenant} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tenant Name *
                </label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => {
                    setNewTenant({
                      ...newTenant,
                      name: e.target.value,
                      slug: newTenant.slug || generateSlug(e.target.value),
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="Acme Corporation"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Slug *
                </label>
                <input
                  type="text"
                  value={newTenant.slug}
                  onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="acme-corporation"
                  required
                  pattern="[a-z0-9-]+"
                  title="Only lowercase letters, numbers, and hyphens"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newTenant.description}
                  onChange={(e) => setNewTenant({ ...newTenant, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[80px]"
                  placeholder="Description of the tenant..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDialog(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Dialog */}
      {showAddUserDialog && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add User to Tenant</h3>
              <button
                onClick={() => setShowAddUserDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">No available users to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAddUser(user.id)}
                      className="w-full p-3 bg-gray-900 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center">
                          <span className="text-blue-400 text-sm font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

