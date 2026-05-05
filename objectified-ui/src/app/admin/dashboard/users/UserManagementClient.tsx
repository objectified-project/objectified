'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  Mail,
  Calendar,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  MoreVertical,
  Power,
  Award,
  Flag,
  ShieldCheck,
  ShieldOff,
  RotateCcw,
} from 'lucide-react';
import {
  getAllSignups,
  createUserFromSignup,
  deleteSignup,
  updateUser,
  deleteUser,
  getUserStats,
  getSignupStats,
  getAllUsersWithLicenses,
  getAllLicenses,
  assignLicenseToUser,
  removeUserLicense,
  getAllFeatureFlags,
  getUserLicense,
  setUserFeatureFlag,
  removeUserFeatureFlag,
} from '../../../../../lib/db/admin-helper';

interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  license_id: string | null;
  license_name: string | null;
  license_type: string | null;
}

interface Signup {
  name: string;
  email_address: string;
  signup_source: string;
  signup_date: string;
  password: string;
}

interface UserStats {
  total_users: number;
  enabled_users: number;
  verified_users: number;
  new_users_30_days: number;
  new_users_7_days: number;
}

interface SignupStats {
  total_signups: number;
  signups_30_days: number;
  signups_7_days: number;
  signups_today: number;
}

interface License {
  id: string;
  name: string;
  license_type: string;
  enabled: boolean;
}

interface FeatureFlag {
  id: string;
  name: string;
  label: string;
  description: string | null;
  is_preview: boolean;
  enabled: boolean;
}

/** 'grant' | 'revoke' | 'default' — 'default' means no user-level override */
type FlagOverride = 'grant' | 'revoke' | 'default';

interface FlagsModalState {
  user: User;
  allFlags: FeatureFlag[];
  /** flags bundled with the user's current license */
  licenseFlags: Set<string>;
  /** user-level overrides: flagId -> enabled */
  overrides: Record<string, boolean>;
  saving: Set<string>;
}

const LICENSE_TYPE_COLORS: Record<string, string> = {
  free:    'bg-slate-700 text-slate-200',
  paid:    'bg-indigo-700 text-indigo-100',
  sponsor: 'bg-amber-700 text-amber-100',
};

export default function UserManagementClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [signupStats, setSignupStats] = useState<SignupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'signups'>('signups');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openSignupDropdown, setOpenSignupDropdown] = useState<string | null>(null);
  const [openUserDropdown, setOpenUserDropdown] = useState<string | null>(null);
  const [signupDropdownPos, setSignupDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [userDropdownPos, setUserDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [licenseSubMenu, setLicenseSubMenu] = useState<string | null>(null);
  const [flagsModal, setFlagsModal] = useState<FlagsModalState | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, signupsRes, userStatsRes, signupStatsRes, licensesRes] = await Promise.all([
        getAllUsersWithLicenses(),
        getAllSignups(),
        getUserStats(),
        getSignupStats(),
        getAllLicenses(),
      ]);

      const usersData = JSON.parse(usersRes);
      const signupsData = JSON.parse(signupsRes);
      const userStatsData = JSON.parse(userStatsRes);
      const signupStatsData = JSON.parse(signupStatsRes);
      const licensesData = JSON.parse(licensesRes);

      if (usersData.success) setUsers(usersData.users);
      if (signupsData.success) setSignups(signupsData.signups);
      if (userStatsData.success) setUserStats(userStatsData.stats);
      if (signupStatsData.success) setSignupStats(signupStatsData.stats);
      if (licensesData.success) setLicenses(licensesData.licenses.filter((l: License) => l.enabled));
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignLicense = async (userId: string, licenseId: string) => {
    try {
      const result = await assignLicenseToUser(userId, licenseId);
      const data = JSON.parse(result);
      if (data.success) {
        showMessage('success', 'License assigned successfully');
        await loadData();
      } else {
        showMessage('error', data.error || 'Failed to assign license');
      }
    } catch {
      showMessage('error', 'Failed to assign license');
    } finally {
      setLicenseSubMenu(null);
      setOpenUserDropdown(null);
    }
  };

  const handleRemoveLicense = async (userId: string) => {
    try {
      const result = await removeUserLicense(userId);
      const data = JSON.parse(result);
      if (data.success) {
        showMessage('success', 'License removed');
        await loadData();
      } else {
        showMessage('error', data.error || 'Failed to remove license');
      }
    } catch {
      showMessage('error', 'Failed to remove license');
    } finally {
      setOpenUserDropdown(null);
    }
  };

  const handleOpenFlagsModal = async (user: User) => {
    setOpenUserDropdown(null);
    try {
      const [flagsRes, licenseRes] = await Promise.all([
        getAllFeatureFlags(),
        getUserLicense(user.id),
      ]);
      const flagsData = JSON.parse(flagsRes);
      const licenseData = JSON.parse(licenseRes);

      const allFlags: FeatureFlag[] = flagsData.success ? flagsData.featureFlags : [];
      const licenseInfo = licenseData.success ? licenseData.license : null;

      const licenseFlags = new Set<string>(
        (licenseInfo?.license_feature_flags ?? []).map((f: { id: string }) => f.id)
      );
      const overrides: Record<string, boolean> = {};
      for (const ov of (licenseInfo?.user_overrides ?? [])) {
        overrides[ov.id] = ov.enabled;
      }

      setFlagsModal({ user, allFlags, licenseFlags, overrides, saving: new Set() });
    } catch {
      showMessage('error', 'Failed to load feature flags');
    }
  };

  const handleSetFlagOverride = async (flagId: string, enabled: boolean) => {
    if (!flagsModal) return;
    setFlagsModal(prev => prev ? { ...prev, saving: new Set([...prev.saving, flagId]) } : prev);
    try {
      const result = await setUserFeatureFlag(flagsModal.user.id, flagId, enabled);
      const data = JSON.parse(result);
      if (data.success) {
        setFlagsModal(prev => {
          if (!prev) return prev;
          const overrides = { ...prev.overrides, [flagId]: enabled };
          const saving = new Set(prev.saving);
          saving.delete(flagId);
          return { ...prev, overrides, saving };
        });
      } else {
        showMessage('error', data.error || 'Failed to update flag');
        setFlagsModal(prev => {
          if (!prev) return prev;
          const saving = new Set(prev.saving);
          saving.delete(flagId);
          return { ...prev, saving };
        });
      }
    } catch {
      showMessage('error', 'Failed to update flag');
      setFlagsModal(prev => {
        if (!prev) return prev;
        const saving = new Set(prev.saving);
        saving.delete(flagId);
        return { ...prev, saving };
      });
    }
  };

  const handleClearFlagOverride = async (flagId: string) => {
    if (!flagsModal) return;
    setFlagsModal(prev => prev ? { ...prev, saving: new Set([...prev.saving, flagId]) } : prev);
    try {
      const result = await removeUserFeatureFlag(flagsModal.user.id, flagId);
      const data = JSON.parse(result);
      if (data.success) {
        setFlagsModal(prev => {
          if (!prev) return prev;
          const overrides = { ...prev.overrides };
          delete overrides[flagId];
          const saving = new Set(prev.saving);
          saving.delete(flagId);
          return { ...prev, overrides, saving };
        });
      } else {
        showMessage('error', data.error || 'Failed to clear override');
        setFlagsModal(prev => {
          if (!prev) return prev;
          const saving = new Set(prev.saving);
          saving.delete(flagId);
          return { ...prev, saving };
        });
      }
    } catch {
      showMessage('error', 'Failed to clear override');
      setFlagsModal(prev => {
        if (!prev) return prev;
        const saving = new Set(prev.saving);
        saving.delete(flagId);
        return { ...prev, saving };
      });
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateUserFromSignup = async (signup: Signup) => {
    if (!confirm(`Create user account for ${signup.name} (${signup.email_address})?`)) {
      return;
    }

    try {
      const result = await createUserFromSignup(signup.email_address, true, true);
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', `User created successfully for ${signup.name}`);
        await loadData();
      } else {
        showMessage('error', data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user from signup:', error);
      showMessage('error', 'Failed to create user');
    }
  };

  const handleDeleteSignup = async (email: string) => {
    if (!confirm(`Delete signup request for ${email}?`)) {
      return;
    }

    try {
      const result = await deleteSignup(email);
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', 'Signup deleted successfully');
        await loadData();
      } else {
        showMessage('error', data.error || 'Failed to delete signup');
      }
    } catch (error) {
      console.error('Error deleting signup:', error);
      showMessage('error', 'Failed to delete signup');
    }
  };

  const handleToggleUserEnabled = async (user: User) => {
    try {
      const result = await updateUser(user.id, { enabled: !user.enabled });
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', `User ${user.enabled ? 'disabled' : 'enabled'} successfully`);
        await loadData();
      } else {
        showMessage('error', data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showMessage('error', 'Failed to update user');
    }
  };

  const handleToggleUserVerified = async (user: User) => {
    try {
      const result = await updateUser(user.id, { verified: !user.verified });
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', `User ${user.verified ? 'unverified' : 'verified'} successfully`);
        await loadData();
      } else {
        showMessage('error', data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showMessage('error', 'Failed to update user');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Delete user ${user.name} (${user.email})? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteUser(user.id);
      const data = JSON.parse(result);

      if (data.success) {
        showMessage('success', 'User deleted successfully');
        await loadData();
      } else {
        showMessage('error', data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showMessage('error', 'Failed to delete user');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-700 backdrop-blur-sm">
        <div className="px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage user accounts and approve signups</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Total Users</p>
              <p className="text-gray-900 dark:text-white text-xl font-bold">{userStats?.total_users || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            {userStats?.new_users_7_days || 0} new this week
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-600/20 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Verified Users</p>
              <p className="text-gray-900 dark:text-white text-xl font-bold">{userStats?.verified_users || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            {userStats?.enabled_users || 0} enabled
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <UserPlus className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Pending Signups</p>
              <p className="text-gray-900 dark:text-white text-xl font-bold">{signupStats?.total_signups || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            {signupStats?.signups_today || 0} today
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-600/20 rounded-lg">
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Recent Signups</p>
              <p className="text-gray-900 dark:text-white text-xl font-bold">{signupStats?.signups_7_days || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">Last 7 days</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('signups')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'signups'
              ? 'text-red-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Pending Signups
          {signups.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-600 text-white rounded-full">
              {signups.length}
            </span>
          )}
          {activeTab === 'signups' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'users'
              ? 'text-red-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Active Users
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
          )}
        </button>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : activeTab === 'signups' ? (
        // Signups Table
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {signups.length === 0 ? (
            <div className="p-12 text-center">
              <UserPlus className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">No pending signups</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {signups.map((signup) => (
                    <tr key={signup.email_address} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{signup.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{signup.email_address}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {signup.signup_source || 'Direct'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(signup.signup_date)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setSignupDropdownPos({
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right
                              });
                              setOpenSignupDropdown(openSignupDropdown === signup.email_address ? null : signup.email_address);
                            }}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-gray-700 dark:hover:text-white"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openSignupDropdown === signup.email_address && signupDropdownPos && (
                            <>
                              <div
                                className="fixed inset-0 z-[100]"
                                onClick={() => setOpenSignupDropdown(null)}
                              />
                              <div
                                className="fixed w-44 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg z-[101]"
                                style={{
                                  top: `${signupDropdownPos.top}px`,
                                  right: `${signupDropdownPos.right}px`
                                }}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      setOpenSignupDropdown(null);
                                      handleCreateUserFromSignup(signup);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-3 text-green-400 hover:text-green-300 transition-colors"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                    Create User
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenSignupDropdown(null);
                                      handleDeleteSignup(signup.email_address);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Signup
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // Users Table
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      License
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-600/20 rounded-full flex items-center justify-center">
                            <span className="text-red-400 text-sm font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.license_name && user.license_type ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${LICENSE_TYPE_COLORS[user.license_type] ?? 'bg-gray-700 text-gray-200'}`}>
                            <Award className="w-3 h-3" />
                            {user.license_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-600 italic">No license</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {user.verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
                              <CheckCircle className="w-3 h-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded">
                              <AlertCircle className="w-3 h-3" />
                              Unverified
                            </span>
                          )}
                          {user.enabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                              Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(user.created_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setUserDropdownPos({
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right
                              });
                              setOpenUserDropdown(openUserDropdown === user.id ? null : user.id);
                            }}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-gray-700 dark:hover:text-white"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openUserDropdown === user.id && userDropdownPos && (
                            <>
                              <div
                                className="fixed inset-0 z-[100]"
                                onClick={() => setOpenUserDropdown(null)}
                              />
                              <div
                                className="fixed w-52 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg z-[101]"
                                style={{
                                  top: `${userDropdownPos.top}px`,
                                  right: `${userDropdownPos.right}px`
                                }}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      setOpenUserDropdown(null);
                                      handleToggleUserVerified(user);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                  >
                                    {user.verified ? (
                                      <>
                                        <XCircle className="w-4 h-4 text-yellow-400" />
                                        Mark Unverified
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                        Mark Verified
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenUserDropdown(null);
                                      handleToggleUserEnabled(user);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                  >
                                    {user.enabled ? (
                                      <>
                                        <Power className="w-4 h-4 text-orange-400" />
                                        Disable User
                                      </>
                                    ) : (
                                      <>
                                        <Power className="w-4 h-4 text-blue-400" />
                                        Enable User
                                      </>
                                    )}
                                  </button>

                                  <div className="border-t border-slate-200 dark:border-gray-700 mt-1 pt-1">
                                    <div className="relative">
                                      <button
                                        onClick={() => setLicenseSubMenu(licenseSubMenu === user.id ? null : user.id)}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-3 text-indigo-300 hover:text-indigo-200 transition-colors"
                                      >
                                        <Award className="w-4 h-4" />
                                        Assign License…
                                      </button>
                                      {licenseSubMenu === user.id && (
                                        <div className="pl-4 pb-1">
                                          {licenses.map(lic => (
                                            <button
                                              key={lic.id}
                                              onClick={() => handleAssignLicense(user.id, lic.id)}
                                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded"
                                            >
                                              <span className={`w-2 h-2 rounded-full ${lic.license_type === 'free' ? 'bg-slate-400' : lic.license_type === 'paid' ? 'bg-indigo-400' : 'bg-amber-400'}`} />
                                              {lic.name}
                                              {lic.id === user.license_id && <CheckCircle className="w-3 h-3 text-green-400 ml-auto" />}
                                            </button>
                                          ))}
                                          {user.license_id && (
                                            <button
                                              onClick={() => handleRemoveLicense(user.id)}
                                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors rounded"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              Remove License
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-200 dark:border-gray-700 mt-1 pt-1">
                                    <button
                                      onClick={() => handleOpenFlagsModal(user)}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-3 text-emerald-300 hover:text-emerald-200 transition-colors"
                                    >
                                      <Flag className="w-4 h-4" />
                                      Manage Feature Flags…
                                    </button>
                                  </div>

                                  <div className="border-t border-slate-200 dark:border-gray-700 mt-1 pt-1">
                                    <button
                                      onClick={() => {
                                        setOpenUserDropdown(null);
                                        handleDeleteUser(user);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete User
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </div>
      </main>

      {/* Feature Flags Modal */}
      {flagsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFlagsModal(null)} />
          <div className="relative bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-gray-700">
              <div className="p-2 bg-emerald-600/20 rounded-lg">
                <Flag className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Feature Flags</h3>
                <p className="text-gray-400 text-xs truncate">{flagsModal.user.name} — {flagsModal.user.email}</p>
              </div>
              <button onClick={() => setFlagsModal(null)} className="text-gray-400 hover:text-white p-1 rounded transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="px-6 pt-3 pb-2 flex items-center gap-4 text-xs text-gray-500 border-b border-slate-200 dark:border-gray-800">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Included in license</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Preview flag</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> User override active</span>
            </div>

            {/* Flag list */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-200 dark:divide-gray-800">
              {flagsModal.allFlags.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">No feature flags defined.</p>
              ) : flagsModal.allFlags.map(flag => {
                const inLicense = flagsModal.licenseFlags.has(flag.id);
                const override = flagsModal.overrides[flag.id]; // boolean | undefined
                const hasOverride = override !== undefined;
                const isSaving = flagsModal.saving.has(flag.id);

                return (
                  <div key={flag.id} className={`px-6 py-4 ${isSaving ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-900 dark:text-white text-sm font-medium">{flag.label}</span>
                          <span className="text-gray-500 text-xs font-mono">{flag.name}</span>
                          {inLicense && (
                            <span className="px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 text-xs rounded border border-emerald-800">license</span>
                          )}
                          {flag.is_preview && (
                            <span className="px-1.5 py-0.5 bg-amber-900/50 text-amber-400 text-xs rounded border border-amber-800">preview</span>
                          )}
                          {hasOverride && (
                            <span className={`px-1.5 py-0.5 text-xs rounded border ${override ? 'bg-blue-900/50 text-blue-400 border-blue-800' : 'bg-red-900/50 text-red-400 border-red-800'}`}>
                              {override ? 'granted' : 'revoked'}
                            </span>
                          )}
                        </div>
                        {flag.description && (
                          <p className="text-gray-500 text-xs mt-1">{flag.description}</p>
                        )}
                      </div>

                      {/* Override controls */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          title="Grant (force enabled for this user)"
                          disabled={isSaving}
                          onClick={() => handleSetFlagOverride(flag.id, true)}
                          className={`p-1.5 rounded transition-colors ${
                            hasOverride && override === true
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 dark:text-gray-500 hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                        <button
                          title="Revoke (force disabled for this user)"
                          disabled={isSaving}
                          onClick={() => handleSetFlagOverride(flag.id, false)}
                          className={`p-1.5 rounded transition-colors ${
                            hasOverride && override === false
                              ? 'bg-red-600 text-white'
                              : 'text-gray-400 dark:text-gray-500 hover:text-red-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <ShieldOff className="w-4 h-4" />
                        </button>
                        <button
                          title="Use license default (clear override)"
                          disabled={isSaving || !hasOverride}
                          onClick={() => handleClearFlagOverride(flag.id)}
                          className={`p-1.5 rounded transition-colors ${
                            !hasOverride
                              ? 'text-gray-700 cursor-default'
                              : 'text-gray-400 dark:text-gray-500 hover:text-yellow-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setFlagsModal(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-sm rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

