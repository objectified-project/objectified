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
    <div className="p-6">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Profile</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your account information
          </p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {/* Profile Details Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-6 space-y-6">
          {/* Name */}
          <div className="flex items-start space-x-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Full Name
              </label>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-lg text-gray-900 dark:text-white">
                  {user?.name || 'Not provided'}
                </p>
                <button
                  onClick={handleEditClick}
                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded cursor-pointer transition-colors"
                  title="Edit name"
                >
                  <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* Email */}
          <div className="flex items-start space-x-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email Address
              </label>
              <p className="text-lg text-gray-900 dark:text-white mt-1">
                {user?.email || 'Not provided'}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* User ID */}
          <div className="flex items-start space-x-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <Hash className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                User ID
              </label>
              <p className="text-lg font-mono text-gray-900 dark:text-white mt-1 break-all">
                {(user as any)?.user_id || 'Not available'}
              </p>
            </div>
          </div>

          {/* Current Tenant ID */}
          {(user as any)?.current_tenant_id && (
            <>
              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700"></div>

              <div className="flex items-start space-x-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                  <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Current Tenant ID
                  </label>
                  <p className="text-lg font-mono text-gray-900 dark:text-white mt-1 break-all">
                    {(user as any)?.current_tenant_id}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* Session Expiry */}
          <div className="flex items-start space-x-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Session Expiration
              </label>
              <p className="text-lg text-gray-900 dark:text-white mt-1">
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
        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleEditClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg cursor-pointer transition-colors"
            >
              <Edit2 className="h-4 w-4" />
              Edit Name
            </button>
            <button
              onClick={handlePasswordChangeClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-lg cursor-pointer transition-colors"
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