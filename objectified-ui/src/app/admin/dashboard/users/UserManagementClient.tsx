'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  Shield,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  getAllUsers,
  getAllSignups,
  createUserFromSignup,
  deleteSignup,
  updateUser,
  deleteUser,
  getUserStats,
  getSignupStats,
} from '../../../../../lib/db/admin-helper';

interface User {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
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

export default function UserManagementClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [signupStats, setSignupStats] = useState<SignupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'signups'>('signups');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, signupsRes, userStatsRes, signupStatsRes] = await Promise.all([
        getAllUsers(),
        getAllSignups(),
        getUserStats(),
        getSignupStats(),
      ]);

      const usersData = JSON.parse(usersRes);
      const signupsData = JSON.parse(signupsRes);
      const userStatsData = JSON.parse(userStatsRes);
      const signupStatsData = JSON.parse(signupStatsRes);

      if (usersData.success) setUsers(usersData.users);
      if (signupsData.success) setSignups(signupsData.signups);
      if (userStatsData.success) setUserStats(userStatsData.stats);
      if (signupStatsData.success) setSignupStats(signupStatsData.stats);
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('error', 'Failed to load data');
    } finally {
      setLoading(false);
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
      <header className="bg-gray-800/50 border-b border-gray-700 backdrop-blur-sm">
        <div className="px-6 py-4">
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-gray-400 text-sm mt-1">Manage user accounts and approve signups</p>
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
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Total Users</p>
              <p className="text-white text-xl font-bold">{userStats?.total_users || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            {userStats?.new_users_7_days || 0} new this week
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-600/20 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Verified Users</p>
              <p className="text-white text-xl font-bold">{userStats?.verified_users || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            {userStats?.enabled_users || 0} enabled
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <UserPlus className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Pending Signups</p>
              <p className="text-white text-xl font-bold">{signupStats?.total_signups || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            {signupStats?.signups_today || 0} today
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-600/20 rounded-lg">
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Recent Signups</p>
              <p className="text-white text-xl font-bold">{signupStats?.signups_7_days || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">Last 7 days</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('signups')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'signups'
              ? 'text-red-400'
              : 'text-gray-400 hover:text-gray-300'
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
              : 'text-gray-400 hover:text-gray-300'
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
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
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
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          {signups.length === 0 ? (
            <div className="p-12 text-center">
              <UserPlus className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">No pending signups</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {signups.map((signup) => (
                    <tr key={signup.email_address} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{signup.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">{signup.email_address}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-400">
                          {signup.signup_source || 'Direct'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-400">
                          {formatDate(signup.signup_date)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleCreateUserFromSignup(signup)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors mr-2"
                        >
                          <UserCheck className="w-4 h-4" />
                          Create User
                        </button>
                        <button
                          onClick={() => handleDeleteSignup(signup.email_address)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
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
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          {users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-600/20 rounded-full flex items-center justify-center">
                            <span className="text-red-400 text-sm font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-white">{user.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">{user.email}</span>
                        </div>
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
                        <span className="text-sm text-gray-400">
                          {formatDate(user.created_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleUserVerified(user)}
                            className={`p-2 rounded transition-colors ${
                              user.verified
                                ? 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400'
                                : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                            }`}
                            title={user.verified ? 'Unverify' : 'Verify'}
                          >
                            {user.verified ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleToggleUserEnabled(user)}
                            className={`p-2 rounded transition-colors ${
                              user.enabled
                                ? 'bg-gray-600/20 hover:bg-gray-600/30 text-gray-400'
                                : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                            }`}
                            title={user.enabled ? 'Disable' : 'Enable'}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </>
  );
}

