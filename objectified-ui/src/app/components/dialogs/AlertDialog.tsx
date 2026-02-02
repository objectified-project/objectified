'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

export type AlertDialogVariant = 'error' | 'warning' | 'info' | 'success';

interface AlertDialogProps {
  open: boolean;
  title?: string;
  message: string | React.ReactNode;
  variant?: AlertDialogVariant;
  confirmLabel?: string;
  onClose: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  title,
  message,
  variant = 'info',
  confirmLabel = 'OK',
  onClose,
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'error':
        return <XCircle className="h-6 w-6 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      case 'info':
        return <Info className="h-6 w-6 text-blue-600" />;
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (variant) {
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Information';
      case 'success':
        return 'Success';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        root: {
          sx: { zIndex: 10002 },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle>
        <div className="flex items-center gap-3">
          {getIcon()}
          <span className="text-xl font-semibold">
            {getTitle()}
          </span>
        </div>
      </DialogTitle>
      <DialogContent>
        {typeof message === 'string' ? (
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {message}
          </p>
        ) : (
          <div className="text-gray-700 dark:text-gray-300">
            {message}
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: '16px 24px' }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="primary"
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlertDialog;

