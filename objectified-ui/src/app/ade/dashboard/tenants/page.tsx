'use client';

import { useSession } from 'next-auth/react';
import { getTenantsForUser, getTenantsAdministratedByUser, getTenantUsers } from '../../../../../lib/db/helper';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Shield, ChevronDown, ChevronUp, X } from 'lucide-react';

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
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [isAdminsExpanded, setIsAdminsExpanded] = useState(false);
  const [isUsersExpanded, setIsUsersExpanded] = useState(false);
  const [adminFilter, setAdminFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
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
    if (currentTenantId && isCurrentUserAdmin(currentTenantId)) {
      getTenantUsers(currentTenantId)
        .then(x => {
          setTenantUsers(JSON.parse(x));
        });
    }
  }, [currentTenantId, adminTenants]);

  const handleSelectTenant = async (tenant: Tenant) => {
    const tenantId = tenant.id;

    await update({
      current_tenant_id: tenantId,
    });
  };

  const handleAddAdmin = (tenantId: string) => {
    // TODO: Implement add admin functionality
    console.log('Add admin for tenant:', tenantId);
  };

  const handleRemoveAdmin = (adminId: string) => {
    // TODO: Implement remove admin functionality
    console.log('Remove admin:', adminId);
  };

  const handleAddUser = (tenantId: string) => {
    // TODO: Implement add user functionality
    console.log('Add user for tenant:', tenantId);
  };

  const handleRemoveUser = (userId: string) => {
    // TODO: Implement remove user functionality
    console.log('Remove user:', userId);
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
    const users = tenantUsers.filter((user: TenantUser) => user.tenant_id === tenantId);
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
      <h1 className="text-2xl font-bold mb-4">Tenants</h1>
      {tenants.length === 0 ? (
        <p>No tenants available.</p>
      ) : (
        <ul className="space-y-4">
          {tenants.map(tenant => (
            <li
              key={tenant.id}
              className="border rounded-lg p-4"
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{tenant.name} ({tenant.slug})</h3>
                    {tenant.id === currentTenantId && (
                      <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded">
                        current
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">{tenant.description}</p>
                </div>
                <button
                  onClick={() => handleSelectTenant(tenant)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
                >
                  Select
                </button>
              </div>

              {/* Administration Section */}
              {tenant.id === currentTenantId && isCurrentUserAdmin(tenant.id) && (
                <div className="mt-4 pt-4 border-t space-y-6">
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
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Tenants;