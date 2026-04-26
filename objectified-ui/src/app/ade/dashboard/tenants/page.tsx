'use client';

import { useSession } from 'next-auth/react';
import { getTenantsForUser, getTenantsAdministratedByUser, getTenantUsers, addTenantAdministrator, addTenantUser, removeTenantAdministrator, removeTenantUser, updateTenant } from '../../../../../lib/db/helper';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Users, Shield, X, Building2, Edit2, AlertTriangle, UserCheck, CheckCircle2, Copy, Activity, ChevronRight, Search, UserPlus } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Textarea } from '../../../components/ui/Textarea';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useDialog } from '../../../components/providers/DialogProvider';
import { toast } from 'sonner';
import {
  dashboardPanelClass,
  dashboardTableWrapClass,
  dashboardTableTheadClass,
  dashboardThClass,
  dashboardThRightClass,
  dashboardTbodyClass,
  dashboardTrHoverClass,
  repositoryKpiCardClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';

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

type TenantMemberRow = {
  userId: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isMember: boolean;
  adminRecordId?: string;
  userRecordId?: string;
};

type DashboardSessionUser = {
  user_id?: string;
  current_tenant_id?: string;
};

const Tenants = () => {
  const { data: session, update } = useSession();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [adminTenants, setAdminTenants] = useState<AdminUser[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Record<string, TenantUser[]>>({});
  const [listQuery, setListQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'admin' | 'member'>('all');
  const [detailTab, setDetailTab] = useState<'overview' | 'members' | 'activity' | 'danger'>('overview');
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
  const sessionUser = session?.user as DashboardSessionUser | undefined;
  const currentTenantId = sessionUser?.current_tenant_id;
  const currentUserId = sessionUser?.user_id;

  useEffect(() => {
    if (session) {
      const userId = (session.user as DashboardSessionUser)?.user_id;
      if (!userId) return;

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
      const userId = (session.user as DashboardSessionUser)?.user_id;
      if (!userId) return;

      const [tenantsData, adminTenantsData] = await Promise.all([
        getTenantsForUser(userId),
        getTenantsAdministratedByUser(userId)
      ]);

      setTenants(JSON.parse(tenantsData));
      const admins = JSON.parse(adminTenantsData) as AdminUser[];
      setAdminTenants(admins);

      const adminTenantIds: string[] = [...new Set(admins.map(admin => admin.tenant_id))];
      const usersMap: Record<string, TenantUser[]> = {};

      await Promise.all(
        adminTenantIds.map(async (tenantId: string) => {
          const users = await getTenantUsers(tenantId);
          usersMap[tenantId] = JSON.parse(users);
        })
      );

      setTenantUsers(usersMap);
    }
  };

  const handleSelectTenant = async (tenant: Tenant) => {
    await update({
      current_tenant_id: tenant.id,
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
      const userResult = await addTenantUser(selectedTenantId, memberEmail.trim());
      const userResponse = JSON.parse(userResult);

      if (!userResponse.success) {
        setErrorMessage(userResponse.error || 'Failed to add member');
        setIsLoading(false);
        return;
      }

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
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
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
      const member = members.find((m: TenantMemberRow) => m.userId === editingMember.userId);

      if (!member) {
        setErrorMessage('Member not found');
        setIsLoading(false);
        return;
      }

      if (isAdmin && !member.isAdmin) {
        const result = await addTenantAdministrator(selectedTenantId, member.email);
        const response = JSON.parse(result);
        if (!response.success) {
          setErrorMessage(response.error || 'Failed to add administrator role');
          setIsLoading(false);
          return;
        }
      } else if (!isAdmin && member.isAdmin && member.adminRecordId) {
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
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (member: { userId: string; name: string; isAdmin: boolean; adminRecordId?: string; userRecordId?: string }) => {
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

    if (!confirmed) return;

    try {
      if (member.adminRecordId) {
        const adminResult = await removeTenantAdministrator(member.adminRecordId);
        const adminResponse = JSON.parse(adminResult);
        if (!adminResponse.success) {
          await alertDialog({ message: adminResponse.error || 'Failed to remove administrator role', variant: 'error' });
          return;
        }
      }

      if (member.userRecordId) {
        const userResult = await removeTenantUser(member.userRecordId);
        const userResponse = JSON.parse(userResult);
        if (!userResponse.success) {
          await alertDialog({ message: userResponse.error || 'Failed to remove member', variant: 'error' });
          return;
        }
      }

      await refreshData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      await alertDialog({ message, variant: 'error' });
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

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(tenantSlug.trim())) {
      setErrorMessage('Slug must contain only lowercase letters, numbers, and dashes');
      return;
    }

    const nameChanged = tenantName.trim() !== editingTenant.name;
    const slugChanged = tenantSlug.trim() !== editingTenant.slug;

    if (slugChanged) {
      const changes = [];
      if (nameChanged) {
        changes.push(
          <p key="name">
            Name: <strong className="font-mono">{'\u201C'}{editingTenant.name}{'\u201D'}</strong> &rarr; <strong className="font-mono">{'\u201C'}{tenantName.trim()}{'\u201D'}</strong>
          </p>
        );
      }
      changes.push(<p key="slug">Slug: <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 py-0.5 rounded">{editingTenant.slug}</code> → <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 py-0.5 rounded">{tenantSlug.trim()}</code></p>);

      const confirmed = await confirmDialog({
        title: 'Change Tenant Slug?',
        message: (
          <div className="space-y-3">
            <p>You are about to make the following changes:</p>
            <div className="pl-4 space-y-1 text-sm">{changes}</div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-1">Warning: Changing the slug will affect URLs</p>
                  <p>This change will affect any published OpenAPI specs that reference this tenant&apos;s slug in their URLs.</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to proceed?</p>
          </div>
        ),
        variant: 'warning',
        confirmLabel: 'Change Slug',
        cancelLabel: 'Cancel',
      });

      if (!confirmed) return;
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

      if (slugChanged && response.slug) {
        toast.success(`Tenant updated successfully. New slug: ${response.slug}`);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getMembersForTenant = useCallback(
    (tenantId: string, nameEmailFilter?: string) => {
      const effFilter = nameEmailFilter === undefined ? memberFilter : nameEmailFilter;
      const users = tenantUsers[tenantId] || [];
      const admins = adminTenants.filter((admin: AdminUser) => admin.tenant_id === tenantId);

      const memberMap = new Map<string, { userId: string; name: string; email: string; isAdmin: boolean; isMember: boolean; adminRecordId?: string; userRecordId?: string }>();

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

      if (effFilter) {
        const filterLower = effFilter.toLowerCase();
        members = members.filter(member =>
          member.name.toLowerCase().includes(filterLower) ||
          member.email.toLowerCase().includes(filterLower)
        );
      }

      return members.sort((a, b) => {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    [memberFilter, tenantUsers, adminTenants]
  );

  const isUserAdminInTenant = useCallback(
    (tenantId: string) =>
      adminTenants.some((a: AdminUser) => a.tenant_id === tenantId && a.user_id === currentUserId),
    [adminTenants, currentUserId]
  );

  useEffect(() => {
    if (tenants.length === 0) return;
    setSelectedTenantId(prev => {
      if (prev && tenants.some(t => t.id === prev)) return prev;
      if (currentTenantId && tenants.some(t => t.id === currentTenantId)) return currentTenantId as string;
      return tenants[0]!.id;
    });
  }, [tenants, currentTenantId]);

  const filteredDirectoryTenants = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return tenants.filter(t => {
      if (listFilter === 'admin' && !isUserAdminInTenant(t.id)) return false;
      if (listFilter === 'member' && isUserAdminInTenant(t.id)) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    });
  }, [tenants, listQuery, listFilter, isUserAdminInTenant]);

  const { adminTenantCount, totalMembersInAdministered, adminHeadcount } = useMemo(() => {
    const administered = tenants.filter(t => isUserAdminInTenant(t.id));
    const totalMembers = administered.reduce((s, t) => s + getMembersForTenant(t.id, '').length, 0);
    const headcount = administered.reduce(
      (s, t) => s + getMembersForTenant(t.id, '').filter(m => m.isAdmin).length,
      0
    );
    return {
      adminTenantCount: administered.length,
      totalMembersInAdministered: totalMembers,
      adminHeadcount: headcount
    };
  }, [tenants, isUserAdminInTenant, getMembersForTenant]);

  const copyTenantId = (id: string) => {
    void navigator.clipboard.writeText(id);
    toast.success('Tenant id copied');
  };

  const copyTenantSlug = (slug: string) => {
    void navigator.clipboard.writeText(slug);
    toast.success('Slug copied');
  };

  const selectedTenant = useMemo(
    () => tenants.find(t => t.id === selectedTenantId) ?? null,
    [tenants, selectedTenantId]
  );
  const isSelectedAdmin = selectedTenant ? isUserAdminInTenant(selectedTenant.id) : false;
  const selectedUnfilteredMemberCount = selectedTenant ? getMembersForTenant(selectedTenant.id, '').length : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50/80 dark:bg-gray-900/20">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                  <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                Tenants
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Switch your active workspace and manage people on tenants you administer.</p>
              {tenants.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-1.5">
                  {tenants.length} workspace{tenants.length === 1 ? '' : 's'}
                  {adminTenantCount > 0 ? ` · you administer ${adminTenantCount}` : ''}
                  {adminTenantCount > 0
                    ? ` · ${totalMembersInAdministered} member${totalMembersInAdministered === 1 ? '' : 's'}${adminHeadcount > 0 ? ` (${adminHeadcount} admin${adminHeadcount === 1 ? '' : 's'})` : ''}`
                    : ''}
                </p>
              )}
            </div>
            {tenants.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/80 text-xs w-full sm:w-auto sm:min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    className="bg-transparent outline-none flex-1 min-w-0 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                    value={listQuery}
                    onChange={e => setListQuery(e.target.value)}
                    placeholder="Search by name or slug…"
                    aria-label="Filter tenants by name or slug"
                  />
                </div>
                <div className="flex items-center gap-0.5 border border-gray-200 dark:border-gray-600 rounded-lg p-0.5 bg-white dark:bg-gray-900/50">
                  {(
                    [
                      ['all', 'All'] as const,
                      ['admin', 'I administer'] as const,
                      ['member', 'Member only'] as const,
                    ]
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setListFilter(k)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                        listFilter === k
                          ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {tenants.length === 0 ? (
        <div className="flex flex-1 min-h-0 flex-col p-6">
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No Tenants Available"
            description="You are not a member of any tenants yet"
            iconContainerClassName="from-blue-500 to-cyan-600 shadow-blue-500/30"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside
              className="w-full lg:w-[min(100%,24rem)] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col min-h-0 lg:max-w-[40vw]"
              aria-label="Workspaces you belong to"
            >
              <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800">
                <div className={cn(repositoryKpiCardClass, '!p-3')}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Workspaces</p>
                  <p className="text-lg font-bold font-mono mt-0.5">{tenants.length}</p>
                </div>
                <div className={cn(repositoryKpiCardClass, '!p-3')}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">You administer</p>
                  <p className="text-lg font-bold font-mono mt-0.5">{adminTenantCount}</p>
                </div>
                {adminTenantCount > 0 && (
                  <div className={cn(repositoryKpiCardClass, '!p-3 col-span-2')}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Members in tenants you run</p>
                    <p className="text-lg font-bold font-mono mt-0.5">
                      {totalMembersInAdministered}
                      {adminHeadcount > 0 && (
                        <span className="text-xs font-normal text-gray-500"> · {adminHeadcount} admin{adminHeadcount === 1 ? '' : 's'}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Directory</span>
                <span className="text-[11px] text-gray-400">{filteredDirectoryTenants.length} of {tenants.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredDirectoryTenants.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-10 px-3">No tenants match the current search or filter.</div>
                ) : (
                  filteredDirectoryTenants.map(tenant => {
                    const isSel = selectedTenantId === tenant.id;
                    const isAdminT = isUserAdminInTenant(tenant.id);
                    return (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => {
                          setSelectedTenantId(tenant.id);
                        }}
                        className={cn(
                          'w-full text-left rounded-xl border px-3 py-3 transition-shadow',
                          isSel
                            ? 'border-2 border-indigo-500 dark:border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/50 shadow-sm'
                            : 'border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50/80 dark:hover:bg-gray-800/80',
                          tenant.id === currentTenantId && 'ring-1 ring-indigo-200/50 dark:ring-indigo-800/50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg text-white text-sm font-bold flex items-center justify-center shrink-0 bg-gradient-to-br',
                              directoryAvatarClass(tenant.name)
                            )}
                          >
                            {tenantDisplayInitials(tenant.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900 dark:text-white">{tenant.name}</span>
                              {tenant.id === currentTenantId && (
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white">Active</span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{tenant.slug}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {tenant.enabled ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Enabled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-500/15 text-red-800 dark:text-red-200 border border-red-200/80 dark:border-red-900">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  Disabled
                                </span>
                              )}
                              <span
                                className={cn(
                                  'text-[10px] font-medium px-2 py-0.5 rounded-md border',
                                  isAdminT
                                    ? 'bg-violet-500/10 text-violet-800 dark:text-violet-200 border-violet-200/80 dark:border-violet-800'
                                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                                )}
                              >
                                {isAdminT ? 'Admin' : 'Member'}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className={cn('w-4 h-4 mt-0.5 shrink-0', isSel ? 'text-indigo-500' : 'text-gray-300')} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {selectedTenant && (
              <section
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-gray-50/90 dark:bg-gray-900/40"
                aria-label={`${selectedTenant.name} details`}
              >
                <div className="bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl text-base font-bold text-white flex items-center justify-center shadow-lg bg-gradient-to-br',
                          directoryAvatarClass(selectedTenant.name)
                        )}
                      >
                        {tenantDisplayInitials(selectedTenant.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{selectedTenant.name}</h2>
                          {selectedTenant.id === currentTenantId && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-blue-500 text-white">
                              Your active workspace
                            </span>
                          )}
                        </div>
                        <div className="flex items-center flex-wrap gap-2 mt-2 text-xs">
                          <code className="font-mono px-2 py-1 rounded-md bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 max-w-full truncate">
                            {selectedTenant.slug}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-indigo-600 dark:text-indigo-400 px-1.5"
                            onClick={() => copyTenantSlug(selectedTenant.slug)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copy
                          </Button>
                          {selectedTenant.enabled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-500/15 text-red-800 dark:text-red-200 border border-red-200/80 dark:border-red-900">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Disabled
                            </span>
                          )}
                        </div>
                        {selectedTenant.description ? (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 max-w-2xl">{selectedTenant.description}</p>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 italic">No description</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isSelectedAdmin && (
                        <>
                          <Button variant="success" size="sm" onClick={() => handleAddMember(selectedTenant.id)}>
                            <UserPlus className="h-4 w-4" />
                            Invite member
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTenant(selectedTenant)}
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit tenant
                          </Button>
                        </>
                      )}
                      {selectedTenant.id !== currentTenantId ? (
                        <Button type="button" size="sm" onClick={() => void handleSelectTenant(selectedTenant)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          <UserCheck className="h-4 w-4" />
                          Switch to this workspace
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="pointer-events-none border-emerald-500/30 text-emerald-800 dark:text-emerald-200 bg-emerald-500/5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Active workspace
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-0 border-b border-gray-200/80 dark:border-gray-800 -mb-px" role="tablist" aria-label="Workspace sections">
                    {(
                      [
                        ['overview', 'Overview'] as const,
                        ['members', 'Members', selectedUnfilteredMemberCount] as const,
                        ['activity', 'Activity'] as const,
                        ['danger', 'Danger zone'] as const,
                      ]
                    ).map(([t, label, count]) => (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={detailTab === t}
                        onClick={() => setDetailTab(t)}
                        className={cn(
                          'px-3 py-2 text-sm -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-t-md',
                          detailTab === t
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        )}
                      >
                        {label}
                        {typeof count === 'number' && t === 'members' && <span className="ml-1.5 text-xs text-gray-400 font-mono">{count}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6">
                  {detailTab === 'overview' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className={cn(dashboardPanelClass, 'p-4')}>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Tenant ID</p>
                          <p className="font-mono text-xs break-all text-gray-700 dark:text-gray-300 mt-2">{selectedTenant.id}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 mt-2 text-xs text-indigo-600 dark:text-indigo-400 px-0"
                            onClick={() => copyTenantId(selectedTenant.id)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <div className={cn(dashboardPanelClass, 'p-4')}>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Created · updated</p>
                          <p className="text-sm text-gray-700 dark:text-gray-200 mt-2">
                            {new Date(selectedTenant.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                            <span className="text-gray-500 text-xs">
                              {new Date(selectedTenant.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </p>
                        </div>
                        <div className={cn(dashboardPanelClass, 'p-4 sm:col-span-2 lg:col-span-1')}>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Your role</p>
                          {isSelectedAdmin ? (
                            <p className="text-sm font-semibold text-violet-800 dark:text-violet-200 mt-2 flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Tenant administrator
                            </p>
                          ) : (
                            <p className="text-sm text-gray-700 dark:text-gray-200 mt-2">Member (no tenant admin access)</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5">
                            {isSelectedAdmin
                              ? 'You can invite people, manage roles, and change tenant details.'
                              : 'Member lists and management actions are only shown to tenant administrators.'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/90 dark:bg-amber-950/30 p-4 flex gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-amber-800 dark:text-amber-200" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-amber-900 dark:text-amber-200">Changing the slug affects URLs</p>
                          <p className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1.5">
                            OpenAPI and integration links that include this tenant&rsquo;s slug in their paths will need a coordinated update. You will
                            be asked to confirm if you change the slug in Edit tenant.
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {detailTab === 'members' && (
                    <>
                      {!isSelectedAdmin ? (
                        <div className={cn(dashboardPanelClass, 'p-6 text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mx-auto')}>
                          <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p>Member directory is only visible to tenant administrators.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <Users className="h-4 w-4 text-indigo-500" />
                              Members
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-xs">
                                <Input
                                  type="search"
                                  placeholder="Filter by name or email…"
                                  value={memberFilter}
                                  onChange={e => setMemberFilter(e.target.value)}
                                  className="pr-9"
                                />
                                {memberFilter ? (
                                  <button
                                    type="button"
                                    onClick={() => setMemberFilter('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded"
                                    aria-label="Clear filter"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                              <Button variant="success" size="sm" onClick={() => handleAddMember(selectedTenant.id)}>
                                <Plus className="h-4 w-4" />
                                Add member
                              </Button>
                            </div>
                          </div>
                          <div className={dashboardTableWrapClass}>
                            <div className="overflow-x-auto">
                              <table className="min-w-full">
                                <thead className={dashboardTableTheadClass}>
                                  <tr>
                                    <th scope="col" className={dashboardThClass}>
                                      Name
                                    </th>
                                    <th scope="col" className={dashboardThClass}>
                                      Email
                                    </th>
                                    <th scope="col" className={dashboardThClass}>
                                      Role
                                    </th>
                                    <th scope="col" className={dashboardThRightClass}>
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className={dashboardTbodyClass}>
                                  {getMembersForTenant(selectedTenant.id).length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="px-6 py-8 text-center">
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">No members match the filter.</p>
                                      </td>
                                    </tr>
                                  ) : (
                                    getMembersForTenant(selectedTenant.id).map(member => (
                                      <tr key={member.userId} className={dashboardTrHoverClass}>
                                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <div
                                              className={cn(
                                                'w-7 h-7 rounded-full text-[10px] font-semibold text-white flex items-center justify-center bg-gradient-to-br',
                                                directoryAvatarClass(member.name)
                                              )}
                                            >
                                              {memberRowInitials(member.name)}
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{member.name}</div>
                                          </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{member.email}</td>
                                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                          <div className="flex flex-wrap gap-1.5">
                                            {member.isAdmin && (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-violet-500/15 text-violet-800 dark:text-violet-200 border border-violet-200/80 dark:border-violet-800">
                                                <Shield className="h-3 w-3" />
                                                Admin
                                              </span>
                                            )}
                                            {member.isMember && (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                <Users className="h-3 w-3" />
                                                Member
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-right text-sm">
                                          <div className="flex justify-end gap-1">
                                            {member.userId !== currentUserId && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedTenantId(selectedTenant.id);
                                                    handleEditMember({ userId: member.userId, name: member.name, email: member.email, isAdmin: member.isAdmin });
                                                  }}
                                                  className="p-2 rounded-lg text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600"
                                                  title="Edit roles"
                                                >
                                                  <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    void handleRemoveMember({
                                                      userId: member.userId,
                                                      name: member.name,
                                                      isAdmin: member.isAdmin,
                                                      adminRecordId: member.adminRecordId,
                                                      userRecordId: member.userRecordId
                                                    })
                                                  }
                                                  className="p-2 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                                                  title="Remove member"
                                                >
                                                  <Trash2 className="h-4 w-4" />
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
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {detailTab === 'activity' && (
                    <EmptyState
                      icon={<Activity className="h-10 w-10" />}
                      title="No workspace activity yet"
                      description="Audit events and team actions will show here when the feature is available."
                      iconContainerClassName="from-indigo-500 to-cyan-600 shadow-indigo-500/20"
                    />
                  )}

                  {detailTab === 'danger' && (
                    <div className="space-y-4 max-w-xl">
                      <Alert variant="warning">
                        <p className="text-sm">Changing the slug rewrites public URLs. Coordinate with your team before saving.</p>
                      </Alert>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Disabling or leaving a workspace is not exposed from this screen. Use <strong className="font-medium text-gray-800 dark:text-gray-200">Edit tenant</strong> to update
                        name and slug, and contact an organization owner for higher-impact changes.
                      </p>
                      {isSelectedAdmin && (
                        <Button type="button" variant="outline" onClick={() => setDetailTab('members')}>
                          Manage members
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {!selectedTenant && (
              <div className="flex-1 flex items-center justify-center text-gray-500 p-6">Select a workspace from the list.</div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <Dialog open={showAddMemberModal} onOpenChange={(open) => !isLoading && setShowAddMemberModal(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30">
                <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Add Member
            </DialogTitle>
            <DialogDescription>Add a new member to this tenant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
            <div className="space-y-2">
              <Label htmlFor="memberEmail">Email Address</Label>
              <Input id="memberEmail" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAddMemberSubmit()} placeholder="user@example.com" disabled={isLoading} autoFocus />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="isAdmin" checked={isAdmin} onCheckedChange={(checked) => setIsAdmin(checked === true)} disabled={isLoading} />
              <Label htmlFor="isAdmin" className="flex items-center gap-1.5 cursor-pointer">
                <Shield className="h-4 w-4 text-purple-500" />
                Administrator
              </Label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">Administrators can manage tenant members and settings.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberModal(false)} disabled={isLoading}>Cancel</Button>
            <Button variant="success" onClick={handleAddMemberSubmit} disabled={isLoading}>{isLoading ? 'Adding...' : 'Add Member'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Modal */}
      <Dialog open={showEditMemberModal} onOpenChange={(open) => !isLoading && setShowEditMemberModal(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
                <Edit2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Edit Member Roles
            </DialogTitle>
            <DialogDescription>Update roles for {editingMember?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
            {editingMember && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{editingMember.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{editingMember.email}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Checkbox id="editIsAdmin" checked={isAdmin} onCheckedChange={(checked) => setIsAdmin(checked === true)} disabled={isLoading} />
              <Label htmlFor="editIsAdmin" className="flex items-center gap-1.5 cursor-pointer">
                <Shield className="h-4 w-4 text-purple-500" />
                Administrator
              </Label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">Administrators can manage tenant members and settings.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditMemberModal(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleEditMemberSubmit} disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Modal */}
      <Dialog open={showEditTenantModal} onOpenChange={(open) => !isLoading && setShowEditTenantModal(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Edit Tenant
            </DialogTitle>
            <DialogDescription>Update tenant details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
            {editingTenant && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tenantName">Tenant Name</Label>
                  <Input id="tenantName" value={tenantName} onChange={(e) => setTenantName(e.target.value)} disabled={isLoading} autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantSlug">Tenant Slug</Label>
                  <Input id="tenantSlug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value.toLowerCase())} disabled={isLoading} className="font-mono" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lowercase letters, numbers, and dashes only</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantDescription">Description</Label>
                  <Textarea id="tenantDescription" value={tenantDescription} onChange={(e) => setTenantDescription(e.target.value)} disabled={isLoading} rows={3} />
                </div>
                <Alert variant="warning">
                  <p className="text-sm"><strong>Note:</strong> The slug is used in OpenAPI specification URLs. Changing it will affect any published specs.</p>
                </Alert>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTenantModal(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleEditTenantSubmit} disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function tenantDisplayInitials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) {
    return p[0]!.length >= 2 ? p[0]!.slice(0, 2).toUpperCase() : (p[0]![0] ?? '?').toUpperCase();
  }
  return (p[0]![0]! + p[1]![0]!).toUpperCase();
}

function memberRowInitials(name: string) {
  return tenantDisplayInitials(name);
}

function directoryAvatarClass(name: string) {
  const h = name.split('').reduce((a, c) => a + c.charCodeAt(0) * 19, 0) % 4;
  return [
    'from-emerald-500 to-cyan-600',
    'from-amber-500 to-orange-600',
    'from-indigo-500 to-fuchsia-600',
    'from-rose-500 to-pink-600',
  ][h]!;
}

export default Tenants;

