'use client';

import * as React from 'react';
import { cn } from '../../../../lib/utils';

export interface FormFieldProps {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, helperText, error, required, className, children }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-1.5', className)}>
        {label && (
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {children}
        {(helperText || error) && (
          <p className={cn(
            'text-xs',
            error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

