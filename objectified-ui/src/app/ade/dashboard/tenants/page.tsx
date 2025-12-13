'use client';

import { useSession } from 'next-auth/react';
import { getTenantsForUser, getTenantsAdministratedByUser, getTenantUsers, addTenantAdministrator, addTenantUser, removeTenantAdministrator, removeTenantUser, updateTenant } from '../../../../../lib/db/helper';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Shield, ChevronDown, ChevronUp, X, Building2, Edit2, AlertTriangle } from 'lucide-react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import { useDialog } from '../../../components/providers/DialogProvider';

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
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [adminTenants, setAdminTenants] = useState<AdminUser[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Record<string, TenantUser[]>>({});
  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [memberFilter, setMemberFilter] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showEditTenantModal, setShowEditTenantModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [memberEmail, setMemberEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingMember, setEditingMember] = useState<{ userId: string; name: string; email: string; isAdmin: boolean } | null>(null);
  const [editingTenant, setEditingTenant] = useState<{ id: string; name: string; description: string; slug: string } | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantDescription, setTenantDescription] = useState('');
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

  const handleAddMember = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setMemberEmail('');
    setIsAdmin(false);
    setErrorMessage('');
    setShowAddMemberModal(true);
  };

  const handleAddMemberSubmit = async () => {
    if (!memberEmail.trim()) {
      setErrorMessage('Please enter an email address');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Add as tenant user first
      const userResult = await addTenantUser(selectedTenantId, memberEmail.trim());
      const userResponse = JSON.parse(userResult);

      if (!userResponse.success) {
        setErrorMessage(userResponse.error || 'Failed to add member');
        setIsLoading(false);
        return;
      }

      // If admin role is selected, also add as administrator
      if (isAdmin) {
        const adminResult = await addTenantAdministrator(selectedTenantId, memberEmail.trim());
        const adminResponse = JSON.parse(adminResult);

        if (!adminResponse.success) {
          setErrorMessage(adminResponse.error || 'Failed to add administrator role');
          setIsLoading(false);
          return;
        }
      }

      setShowAddMemberModal(false);
      setMemberEmail('');
      setIsAdmin(false);
      await refreshData();
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMember = (member: { userId: string; name: string; email: string; isAdmin: boolean }) => {
    setEditingMember(member);
    setIsAdmin(member.isAdmin);
    setErrorMessage('');
    setShowEditMemberModal(true);
  };

  const handleEditMemberSubmit = async () => {
    if (!editingMember) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const members = getMembersForTenant(selectedTenantId);
      const member = members.find((m: any) => m.userId === editingMember.userId);

      if (!member) {
        setErrorMessage('Member not found');
        setIsLoading(false);
        return;
      }

      // Handle admin role changes
      if (isAdmin && !member.isAdmin) {
        // Add admin role
        const result = await addTenantAdministrator(selectedTenantId, member.email);
        const response = JSON.parse(result);
        if (!response.success) {
          setErrorMessage(response.error || 'Failed to add administrator role');
          setIsLoading(false);
          return;
        }
      } else if (!isAdmin && member.isAdmin && member.adminRecordId) {
        // Remove admin role
        const result = await removeTenantAdministrator(member.adminRecordId);
        const response = JSON.parse(result);
        if (!response.success) {
          setErrorMessage(response.error || 'Failed to remove administrator role');
          setIsLoading(false);
          return;
        }
      }

      setShowEditMemberModal(false);
      setEditingMember(null);
      await refreshData();
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (member: { userId: string; name: string; isAdmin: boolean; adminRecordId?: string; userRecordId?: string }) => {
    // Enhanced warning for administrators
    const warningMessage = member.isAdmin
      ? `Are you sure you want to remove ${member.name} from the tenant?\n\n⚠️ WARNING: This user is also an ADMINISTRATOR and will lose all administrative privileges.`
      : `Are you sure you want to remove ${member.name} from the tenant?`;

    const confirmed = await confirmDialog({
      title: 'Remove Member',
      message: warningMessage,
      variant: member.isAdmin ? 'danger' : 'warning',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    try {
      // Remove admin role if exists
      if (member.adminRecordId) {
        const adminResult = await removeTenantAdministrator(member.adminRecordId);
        const adminResponse = JSON.parse(adminResult);
        if (!adminResponse.success) {
          await alertDialog({
            message: adminResponse.error || 'Failed to remove administrator role',
            variant: 'error',
          });
          return;
        }
      }

      // Remove user role if exists
      if (member.userRecordId) {
        const userResult = await removeTenantUser(member.userRecordId);
        const userResponse = JSON.parse(userResult);
        if (!userResponse.success) {
          await alertDialog({
            message: userResponse.error || 'Failed to remove member',
            variant: 'error',
          });
          return;
        }
      }

      await refreshData();
    } catch (error: any) {
      await alertDialog({
        message: error.message || 'An error occurred',
        variant: 'error',
      });
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTenantName(tenant.name);
    setTenantSlug(tenant.slug);
    setTenantDescription(tenant.description || '');
    setErrorMessage('');
    setShowEditTenantModal(true);
  };

  const handleEditTenantSubmit = async () => {
    if (!editingTenant) return;

    if (!tenantName.trim()) {
      setErrorMessage('Tenant name is required');
      return;
    }

    if (!tenantSlug.trim()) {
      setErrorMessage('Tenant slug is required');
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(tenantSlug.trim())) {
      setErrorMessage('Slug must contain only lowercase letters, numbers, and dashes');
      return;
    }

    // Check if the slug has changed
    const nameChanged = tenantName.trim() !== editingTenant.name;
    const slugChanged = tenantSlug.trim() !== editingTenant.slug;

    // Only show warning if the slug changed (name changes without slug changes are fine)
    if (slugChanged) {
      const changes = [];
      if (nameChanged) {
        changes.push(<p key="name">Name: <strong>"{editingTenant.name}"</strong> → <strong>"{tenantName.trim()}"</strong></p>);
      }
      changes.push(<p key="slug">Slug: <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 py-0.5 rounded">{editingTenant.slug}</code> → <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 py-0.5 rounded">{tenantSlug.trim()}</code></p>);

      const confirmed = await confirmDialog({
        title: 'Change Tenant Slug?',
        message: (
          <div className="space-y-3">
            <p>You are about to make the following changes:</p>
            <div className="pl-4 space-y-1 text-sm">
              {changes}
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-1">Warning: Changing the slug will affect URLs</p>
                  <p>
                    This change will affect any published OpenAPI specs that reference this tenant's slug in their URLs.
                    Make sure to update any external references or documentation that use the old slug.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to proceed?
            </p>
          </div>
        ),
        variant: 'warning',
        confirmLabel: 'Change Slug',
        cancelLabel: 'Cancel',
      });

      if (!confirmed) {
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await updateTenant(editingTenant.id, tenantName.trim(), tenantDescription.trim(), tenantSlug.trim());
      const response = JSON.parse(result);

      if (!response.success) {
        setErrorMessage(response.error || 'Failed to update tenant');
        setIsLoading(false);
        return;
      }

      setShowEditTenantModal(false);
      setEditingTenant(null);
      await refreshData();

      // Show success message with new slug only if slug changed
      if (slugChanged && response.slug) {
        await alertDialog({
          message: `Tenant updated successfully. New slug: ${response.slug}`,
          variant: 'success',
        });
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getMembersForTenant = (tenantId: string) => {
    const users = tenantUsers[tenantId] || [];
    const admins = adminTenants.filter((admin: AdminUser) => admin.tenant_id === tenantId);

    // Create a map of all members with their roles
    const memberMap = new Map<string, { userId: string; name: string; email: string; isAdmin: boolean; isMember: boolean; adminRecordId?: string; userRecordId?: string }>();

    // Add all users
    users.forEach((user: TenantUser) => {
      memberMap.set(user.user_id, {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        isAdmin: false,
        isMember: true,
        userRecordId: user.id
      });
    });

    // Add admin role to existing members or create new entries for admins
    admins.forEach((admin: AdminUser) => {
      if (memberMap.has(admin.user_id)) {
        const member = memberMap.get(admin.user_id)!;
        member.isAdmin = true;
        member.adminRecordId = admin.id;
      } else {
        memberMap.set(admin.user_id, {
          userId: admin.user_id,
          name: admin.name,
          email: admin.email,
          isAdmin: true,
          isMember: false,
          adminRecordId: admin.id
        });
      }
    });

    let members = Array.from(memberMap.values());

    // Apply filter
    if (memberFilter) {
      const filterLower = memberFilter.toLowerCase();
      members = members.filter(member =>
        member.name.toLowerCase().includes(filterLower) ||
        member.email.toLowerCase().includes(filterLower)
      );
    }

    // Sort: admins first, then alphabetically by name
    return members.sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const isCurrentUserAdmin = (tenantId: string) => {
    return adminTenants.some((admin: AdminUser) => admin.tenant_id === tenantId && admin.user_id === currentUserId);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Tenants</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage tenants and switch between them
            </p>
          </div>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="relative">
          {/* Decorative background */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-full blur-3xl opacity-60" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-cyan-100 to-teal-100 dark:from-cyan-900/20 dark:to-teal-900/20 rounded-full blur-3xl opacity-60" />

          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-16 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Building2 className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              No Tenants Available
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              You are not a member of any tenants yet
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tenant Name
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {tenants.map(tenant => (
                  <tr
                    key={tenant.id}
                    className={`transition-all duration-200 ${
                      tenant.id === currentTenantId 
                        ? 'bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20' 
                        : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {tenant.name}
                        </div>
                        {tenant.id === currentTenantId && (
                          <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-sm">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {isCurrentUserAdmin(tenant.id) && (
                          <>
                          <button
                            onClick={() => handleEditTenant(tenant)}
                            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-all duration-200 group"
                            title="Edit tenant"
                            style={{ textTransform: 'none' }}
                          >
                            <Edit2 className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                          </button>
                        </>)}
                        {tenant.id !== currentTenantId && (
                          <button
                            onClick={() => handleSelectTenant(tenant)}
                            className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-lg cursor-pointer transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md"
                            style={{ textTransform: 'none' }}
                          >
                            Select
                          </button>
                        )}
                        {isCurrentUserAdmin(tenant.id) && (
                          <>
                            <button
                              onClick={() => {
                                // Toggle expanded state for this specific tenant
                                const expandedTenant = document.getElementById(`tenant-${tenant.id}`);
                                if (expandedTenant) {
                                  expandedTenant.classList.toggle('hidden');
                                }
                              }}
                              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer transition-all duration-200 text-sm font-semibold"
                            >
                              Manage
                            </button>
                          </>
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
                className="hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mt-4"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {tenant.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Administration Panel</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Members (Users and Administrators Combined) */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <button
                        onClick={() => setIsMembersExpanded(!isMembersExpanded)}
                        className="text-base font-semibold flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                          <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        Members
                        {isMembersExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTenantId(tenant.id);
                          handleAddMember(tenant.id);
                        }}
                        className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2 px-4 rounded-xl cursor-pointer text-sm transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                      >
                        <Plus className="h-4 w-4" />
                        Add Member
                      </button>
                    </div>
                    {isMembersExpanded && (
                      <>
                        <div className="relative mb-4">
                          <input
                            type="text"
                            placeholder="Filter by name or email..."
                            value={memberFilter}
                            onChange={(e) => setMemberFilter(e.target.value)}
                            className="w-full p-3 pr-10 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-gray-50/50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:bg-white focus:bg-white transition-all duration-200"
                          />
                          {memberFilter && (
                            <button
                              onClick={() => setMemberFilter('')}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                            <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-gray-800">
                              <tr>
                                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Name
                                </th>
                                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Email
                                </th>
                                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Role
                                </th>
                                <th scope="col" className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                              {getMembersForTenant(tenant.id).length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-6 py-8 text-center">
                                    <div className="flex flex-col items-center">
                                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                                        <Users className="h-6 w-6 text-gray-400" />
                                      </div>
                                      <p className="text-gray-500 dark:text-gray-400 text-sm">No members match the filter</p>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                getMembersForTenant(tenant.id).map((member) => (
                                  <tr key={member.userId} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-200">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {member.name}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {member.email}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex gap-2">
                                        {member.isAdmin && (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                                            <Shield className="h-3 w-3" />
                                            Admin
                                          </span>
                                        )}
                                        {member.isMember && (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                            <Users className="h-3 w-3" />
                                            Member
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <div className="flex justify-end gap-1">
                                        {member.userId !== currentUserId && (
                                          <>
                                            <button
                                              onClick={() => {
                                                setSelectedTenantId(tenant.id);
                                                handleEditMember({
                                                  userId: member.userId,
                                                  name: member.name,
                                                  email: member.email,
                                                  isAdmin: member.isAdmin
                                                });
                                              }}
                                              className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-all duration-200 group"
                                              title="Edit roles"
                                            >
                                              <Edit2 className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                                            </button>
                                            <button
                                              onClick={() => handleRemoveMember({
                                                userId: member.userId,
                                                name: member.name,
                                                isAdmin: member.isAdmin,
                                                adminRecordId: member.adminRecordId,
                                                userRecordId: member.userRecordId
                                              })}
                                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg cursor-pointer transition-all duration-200 group"
                                              title="Remove member"
                                            >
                                              <Trash2 className="h-4 w-4 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      <Dialog
        open={showAddMemberModal}
        onClose={() => !isLoading && setShowAddMemberModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <DialogTitle sx={{
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'rgba(99, 102, 241, 0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Plus size={20} color="#10b981" />
            </Box>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Add Member</span>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
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
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAddMemberSubmit()}
            placeholder="user@example.com"
            disabled={isLoading}
            sx={{
              mb: 2,
              mt: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#10b981',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#10b981',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#10b981',
              },
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                disabled={isLoading}
                sx={{
                  color: 'rgba(156, 163, 175, 1)',
                  '&.Mui-checked': {
                    color: '#8b5cf6',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  },
                }}
              />
            }
            label={
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-purple-500" />
                Administrator
              </span>
            }
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-8">
            Administrators can manage tenant members and settings. All members have access to the tenant.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'rgba(0, 0, 0, 0.06)' }}>
          <Button
            onClick={() => setShowAddMemberModal(false)}
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#64748b',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddMemberSubmit}
            variant="contained"
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.35)',
              },
            }}
          >
            {isLoading ? 'Adding...' : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Member Modal */}
      <Dialog
        open={showEditMemberModal}
        onClose={() => !isLoading && setShowEditMemberModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <DialogTitle sx={{
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'rgba(99, 102, 241, 0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Edit2 size={20} color="#6366f1" />
            </Box>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Edit Member Roles</span>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errorMessage}
            </Alert>
          )}
          {editingMember && (
            <>
              <div className="mb-4 mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {editingMember.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {editingMember.email}
                </p>
              </div>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    disabled={isLoading}
                    sx={{
                      color: 'rgba(156, 163, 175, 1)',
                      '&.Mui-checked': {
                        color: '#8b5cf6',
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      },
                    }}
                  />
                }
                label={
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-purple-500" />
                    Administrator
                  </span>
                }
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-8">
                Toggle administrator privileges for this member.
              </p>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'rgba(0, 0, 0, 0.06)' }}>
          <Button
            onClick={() => setShowEditMemberModal(false)}
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#64748b',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditMemberSubmit}
            variant="contained"
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: '0 6px 16px rgba(99, 102, 241, 0.35)',
              },
            }}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Tenant Modal */}
      <Dialog
        open={showEditTenantModal}
        onClose={() => !isLoading && setShowEditTenantModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <DialogTitle sx={{
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'rgba(99, 102, 241, 0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Building2 size={20} color="#3b82f6" />
            </Box>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Edit Tenant</span>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errorMessage}
            </Alert>
          )}
          {editingTenant && (
            <>
              <TextField
                autoFocus
                margin="dense"
                label="Tenant Name"
                type="text"
                fullWidth
                variant="outlined"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                disabled={isLoading}
                sx={{
                  mb: 2,
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3b82f6',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3b82f6',
                    },
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#3b82f6',
                  },
                }}
              />
              <TextField
                margin="dense"
                label="Tenant Slug"
                type="text"
                fullWidth
                variant="outlined"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                disabled={isLoading}
                helperText="Lowercase letters, numbers, and dashes only"
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    fontFamily: 'monospace',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3b82f6',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3b82f6',
                    },
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#3b82f6',
                  },
                }}
              />
              <TextField
                margin="dense"
                label="Description"
                type="text"
                fullWidth
                variant="outlined"
                multiline
                rows={3}
                value={tenantDescription}
                onChange={(e) => setTenantDescription(e.target.value)}
                disabled={isLoading}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3b82f6',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3b82f6',
                    },
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#3b82f6',
                  },
                }}
              />
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> The slug is used in OpenAPI specification URLs. Changing it will affect any published specs.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'rgba(0, 0, 0, 0.06)' }}>
          <Button
            onClick={() => setShowEditTenantModal(false)}
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#64748b',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditTenantSubmit}
            variant="contained"
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
                boxShadow: '0 6px 16px rgba(59, 130, 246, 0.35)',
              },
            }}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Tenants;


