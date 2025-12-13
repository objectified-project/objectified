'use client';

import { useSession } from 'next-auth/react';
import { User, Mail, Hash, Clock, Building2, Edit2, Key } from 'lucide-react';
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import { updateUserName, updateUserPassword } from '../../../../../lib/db/helper';

const Profile = () => {
  const { data: session, update } = useSession();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleEditClick = () => {
    setEditedName(session?.user?.name || '');
    setErrorMessage('');
    setShowEditDialog(true);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      setErrorMessage('Name cannot be empty');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const userId = (session?.user as any)?.user_id;
      const result = await updateUserName(userId, editedName.trim());
      const response = JSON.parse(result);

      if (response.success) {
        // Update the session with the new name
        await update({
          ...session,
          user: {
            ...session?.user,
            name: editedName.trim()
          }
        });
        setShowEditDialog(false);
      } else {
        setErrorMessage(response.error || 'Failed to update name');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeClick = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswordDialog(true);
  };

  const handleSavePassword = async () => {
    // Validate inputs
    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    if (!newPassword) {
      setPasswordError('Please enter a new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    setPasswordError('');

    try {
      const userId = (session?.user as any)?.user_id;
      const result = await updateUserPassword(userId, currentPassword, newPassword);
      const response = JSON.parse(result);

      if (response.success) {
        setShowPasswordDialog(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage('Password changed successfully!');
      } else {
        setPasswordError(response.error || 'Failed to update password');
      }
    } catch (error: any) {
      setPasswordError(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-gray-500 dark:text-gray-400">Loading profile...</p>
      </div>
    );
  }

  const { user, expires } = session;
  const expiryDate = new Date(expires);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <User className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Profile</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              View and manage your account information
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'success.light',
          }}
          onClose={() => setSuccessMessage('')}
        >
          {successMessage}
        </Alert>
      )}

      {/* Profile Details Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-8 py-8 space-y-6">
          {/* Name */}
          <div className="flex items-start space-x-5 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-200 -mx-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-3.5 shadow-sm">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Full Name
              </label>
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user?.name || 'Not provided'}
                </p>
                <button
                  onClick={handleEditClick}
                  className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-all duration-200 group"
                  title="Edit name"
                >
                  <Edit2 className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700/50"></div>

          {/* Email */}
          <div className="flex items-start space-x-5 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-200 -mx-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-xl p-3.5 shadow-sm">
              <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Email Address
              </label>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1.5">
                {user?.email || 'Not provided'}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700/50"></div>

          {/* User ID */}
          <div className="flex items-start space-x-5 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-200 -mx-4">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-3.5 shadow-sm">
              <Hash className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                User ID
              </label>
              <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1.5 break-all bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded-lg">
                {(user as any)?.user_id || 'Not available'}
              </p>
            </div>
          </div>

          {/* Current Tenant ID */}
          {(user as any)?.current_tenant_id && (
            <>
              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-gray-700/50"></div>

              <div className="flex items-start space-x-5 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-200 -mx-4">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-xl p-3.5 shadow-sm">
                  <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Current Tenant ID
                  </label>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1.5 break-all bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded-lg">
                    {(user as any)?.current_tenant_id}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700/50"></div>

          {/* Session Expiry */}
          <div className="flex items-start space-x-5 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-200 -mx-4">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-xl p-3.5 shadow-sm">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Session Expiration
              </label>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1.5">
                {expiryDate.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {expiryDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-gray-800/50 px-8 py-5 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleEditClick}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 rounded-xl cursor-pointer transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
            >
              <Edit2 className="h-4 w-4" />
              Edit Name
            </button>
            <button
              onClick={handlePasswordChangeClick}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl cursor-pointer transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
            >
              <Key className="h-4 w-4" />
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Edit Name Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => !isLoading && setShowEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Name</DialogTitle>
        <DialogContent>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Full Name"
            type="text"
            fullWidth
            variant="outlined"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSaveName()}
            disabled={isLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSaveName} variant="contained" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={showPasswordDialog}
        onClose={() => !isLoading && setShowPasswordDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}
          <Alert severity="info" sx={{ mb: 2 }}>
            Password must contain:
            <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
              <li>At least 8 characters</li>
              <li>One uppercase letter</li>
              <li>One lowercase letter</li>
              <li>One number or special character</li>
            </ul>
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="Current Password"
            type="password"
            fullWidth
            variant="outlined"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isLoading}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isLoading}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Confirm New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSavePassword()}
            disabled={isLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordDialog(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSavePassword} variant="contained" disabled={isLoading}>
            {isLoading ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Profile;