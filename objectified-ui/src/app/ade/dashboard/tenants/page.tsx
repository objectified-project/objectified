'use client';

import { useSession } from 'next-auth/react';
import { getTenantsForUser, getTenantsAdministratedByUser, getTenantUsers, addTenantAdministrator, addTenantUser, removeTenantAdministrator, removeTenantUser } from '../../../../../lib/db/helper';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Shield, ChevronDown, ChevronUp, X, Building2 } from 'lucide-react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';

interface Tenant {
  id: string;
  name: string;
  description: string;
  slug: string;
  enabled: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminUser {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  email: string;
}

interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  email: string;
}

const Tenants = () => {
  const { data: session, update } = useSession();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [adminTenants, setAdminTenants] = useState<AdminUser[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Record<string, TenantUser[]>>({});
  const [isAdminsExpanded, setIsAdminsExpanded] = useState(false);
  const [isUsersExpanded, setIsUsersExpanded] = useState(false);
  const [adminFilter, setAdminFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const currentUserId = (session?.user as any)?.user_id;

  useEffect(() => {
    if (session) {
      const userId: string = (session.user as any)?.user_id;

      getTenantsForUser(userId)
        .then(x => {
          setTenants(JSON.parse(x));
        });

      getTenantsAdministratedByUser(userId)
        .then(x => {
          setAdminTenants(JSON.parse(x));
        });
    }
  }, [session]);

  useEffect(() => {
    // Load tenant users for all tenants where current user is an admin
    if (adminTenants.length > 0) {
      const adminTenantIds = [...new Set(adminTenants.map(admin => admin.tenant_id))];

      adminTenantIds.forEach(tenantId => {
        getTenantUsers(tenantId).then(x => {
          const users = JSON.parse(x);
          setTenantUsers(prev => ({
            ...prev,
            [tenantId]: users
          }));
        });
      });
    }
  }, [adminTenants]);

  const refreshData = async () => {
    if (session) {
      const userId: string = (session.user as any)?.user_id;

      const [tenantsData, adminTenantsData] = await Promise.all([
        getTenantsForUser(userId),
        getTenantsAdministratedByUser(userId)
      ]);

      setTenants(JSON.parse(tenantsData));
      const admins = JSON.parse(adminTenantsData);
      setAdminTenants(admins);

      // Refresh tenant users for all admin tenants
      const adminTenantIds = [...new Set(admins.map((admin: AdminUser) => admin.tenant_id))];
      const usersMap: Record<string, TenantUser[]> = {};

      await Promise.all(
        adminTenantIds.map(async (tenantId: any) => {
          const users = await getTenantUsers(tenantId);
          usersMap[tenantId] = JSON.parse(users);
        })
      );

      setTenantUsers(usersMap);
    }
  };

  const handleSelectTenant = async (tenant: Tenant) => {
    const tenantId = tenant.id;

    await update({
      current_tenant_id: tenantId,
    });
  };

  const handleAddAdmin = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setAdminEmail('');
    setErrorMessage('');
    setShowAddAdminModal(true);
  };

  const handleAddAdminSubmit = async () => {
    if (!adminEmail.trim()) {
      setErrorMessage('Please enter an email address');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await addTenantAdministrator(selectedTenantId, adminEmail.trim());
      const response = JSON.parse(result);

      if (response.success) {
        setShowAddAdminModal(false);
        setAdminEmail('');
        await refreshData();
      } else {
        setErrorMessage(response.error || 'Failed to add administrator');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to remove this administrator?')) {
      return;
    }

    try {
      const result = await removeTenantAdministrator(adminId);
      const response = JSON.parse(result);

      if (response.success) {
        await refreshData();
      } else {
        alert(response.error || 'Failed to remove administrator');
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    }
  };

  const handleAddUser = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setUserEmail('');
    setErrorMessage('');
    setShowAddUserModal(true);
  };

  const handleAddUserSubmit = async () => {
    if (!userEmail.trim()) {
      setErrorMessage('Please enter an email address');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await addTenantUser(selectedTenantId, userEmail.trim());
      const response = JSON.parse(result);

      if (response.success) {
        setShowAddUserModal(false);
        setUserEmail('');
        await refreshData();
      } else {
        setErrorMessage(response.error || 'Failed to add user');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUser = async (userRecordId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) {
      return;
    }

    try {
      const result = await removeTenantUser(userRecordId);
      const response = JSON.parse(result);

      if (response.success) {
        await refreshData();
      } else {
        alert(response.error || 'Failed to remove user');
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    }
  };

  const getAdminsForTenant = (tenantId: string) => {
    const admins = adminTenants.filter((admin: AdminUser) => admin.tenant_id === tenantId);
    if (!adminFilter) return admins;

    const filterLower = adminFilter.toLowerCase();
    return admins.filter((admin: AdminUser) =>
      admin.name.toLowerCase().includes(filterLower) ||
      admin.email.toLowerCase().includes(filterLower)
    );
  };

  const getUsersForTenant = (tenantId: string) => {
    const users = tenantUsers[tenantId] || [];
    if (!userFilter) return users;

    const filterLower = userFilter.toLowerCase();
    return users.filter((user: TenantUser) =>
      user.name.toLowerCase().includes(filterLower) ||
      user.email.toLowerCase().includes(filterLower)
    );
  };

  const isCurrentUserAdmin = (tenantId: string) => {
    return adminTenants.some((admin: AdminUser) => admin.tenant_id === tenantId && admin.user_id === currentUserId);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Tenants</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage tenants and switch between them
          </p>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
          <Building2 className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Tenants Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            You are not a member of any tenants yet
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tenant Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {tenants.map(tenant => (
                  <tr
                    key={tenant.id}
                    className={`transition-colors ${
                      tenant.id === currentTenantId 
                        ? 'bg-blue-50 dark:bg-blue-900/20' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {tenant.name}
                        </div>
                        {tenant.id === currentTenantId && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {tenant.slug}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {tenant.description || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tenant.enabled ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {tenant.id !== currentTenantId && (
                          <button
                            onClick={() => handleSelectTenant(tenant)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer transition-colors text-sm font-medium"
                          >
                            Select
                          </button>
                        )}
                        {isCurrentUserAdmin(tenant.id) && (
                          <button
                            onClick={() => {
                              // Toggle expanded state for this specific tenant
                              const expandedTenant = document.getElementById(`tenant-${tenant.id}`);
                              if (expandedTenant) {
                                expandedTenant.classList.toggle('hidden');
                              }
                            }}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded cursor-pointer transition-colors text-sm font-medium"
                          >
                            Manage
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Admin sections for each tenant */}
          {tenants.map(tenant => (
            isCurrentUserAdmin(tenant.id) && (
              <div
                key={`admin-${tenant.id}`}
                id={`tenant-${tenant.id}`}
                className="hidden bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {tenant.name} - Administration
                </h2>

                <div className="space-y-6">
                  {/* Administrators */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={() => setIsAdminsExpanded(!isAdminsExpanded)}
                        className="text-lg font-semibold flex items-center gap-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        <Shield className="h-5 w-5" />
                        Administrators
                        {isAdminsExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleAddAdmin(tenant.id)}
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded cursor-pointer text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Add Admin
                      </button>
                    </div>
                    {isAdminsExpanded && (
                      <>
                        <div className="relative mb-3">
                          <input
                            type="text"
                            placeholder="Filter by name or email..."
                            value={adminFilter}
                            onChange={(e) => setAdminFilter(e.target.value)}
                            className="w-full p-2 pr-8 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {adminFilter && (
                            <button
                              onClick={() => setAdminFilter('')}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <ul className="space-y-2">
                          {getAdminsForTenant(tenant.id).length === 0 ? (
                            <li className="text-gray-500 text-sm italic p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              No administrators match the filter
                            </li>
                          ) : (
                            getAdminsForTenant(tenant.id).map((admin: AdminUser) => (
                          <li
                            key={admin.id}
                            className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded"
                          >
                            <div>
                              <p className="font-medium">{admin.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{admin.email}</p>
                            </div>
                            {admin.user_id !== currentUserId && (
                              <button
                                onClick={() => handleRemoveAdmin(admin.id)}
                                className="flex items-center gap-1 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded cursor-pointer text-sm"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            )}
                            </li>
                            ))
                          )}
                        </ul>
                      </>
                    )}
                  </div>

                  {/* Tenant Users */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={() => setIsUsersExpanded(!isUsersExpanded)}
                        className="text-lg font-semibold flex items-center gap-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        <Users className="h-5 w-5" />
                        Tenant Users
                        {isUsersExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleAddUser(tenant.id)}
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded cursor-pointer text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Add User
                      </button>
                    </div>
                    {isUsersExpanded && (
                      <>
                        <div className="relative mb-3">
                          <input
                            type="text"
                            placeholder="Filter by name or email..."
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            className="w-full p-2 pr-8 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {userFilter && (
                            <button
                              onClick={() => setUserFilter('')}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <ul className="space-y-2">
                          {getUsersForTenant(tenant.id).length === 0 ? (
                            <li className="text-gray-500 text-sm italic p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              No users match the filter
                            </li>
                          ) : (
                            getUsersForTenant(tenant.id).map((user: TenantUser) => (
                            <li
                              key={user.id}
                              className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded"
                            >
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                              </div>
                              {user.user_id !== currentUserId && (
                                <button
                                  onClick={() => handleRemoveUser(user.id)}
                                  className="flex items-center gap-1 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded cursor-pointer text-sm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </button>
                              )}
                              </li>
                            ))
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Add Admin Modal */}
      <Dialog
        open={showAddAdminModal}
        onClose={() => !isLoading && setShowAddAdminModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Administrator</DialogTitle>
        <DialogContent>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAddAdminSubmit()}
            placeholder="user@example.com"
            disabled={isLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddAdminModal(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAddAdminSubmit} variant="contained" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Administrator'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add User Modal */}
      <Dialog
        open={showAddUserModal}
        onClose={() => !isLoading && setShowAddUserModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAddUserSubmit()}
            placeholder="user@example.com"
            disabled={isLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddUserModal(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAddUserSubmit} variant="contained" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Tenants;