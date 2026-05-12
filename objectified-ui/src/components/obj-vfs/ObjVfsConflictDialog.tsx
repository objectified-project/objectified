'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/AlertDialog';

export type ObjVfsConflictDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  localContent: string;
  serverContent: string | null;
  onReload: () => void;
  onOverwrite: () => void;
};

export function ObjVfsConflictDialog({
  open,
  onOpenChange,
  title = 'Revision changed on the server',
  localContent,
  serverContent,
  onReload,
  onOverwrite,
}: ObjVfsConflictDialogProps) {
  const [showDiff, setShowDiff] = React.useState(false);

  React.useEffect(() => {
    if (!open) setShowDiff(false);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[min(90vh,40rem)] max-w-2xl overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <p>
                Another session updated this revision. You can load the server copy, review a
                side-by-side diff of the JSON file, or save again using the latest server revision
                (overwrite).
              </p>
              {showDiff && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Your draft
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                      {localContent}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Server copy
                    </p>
                    <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                      {serverContent ?? '(could not load server copy)'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setShowDiff((v) => !v)}
          >
            {showDiff ? 'Hide diff' : 'Diff'}
          </button>
          <AlertDialogAction
            type="button"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            onClick={() => {
              onReload();
              onOpenChange(false);
            }}
          >
            Reload from server
          </AlertDialogAction>
          <AlertDialogAction
            type="button"
            onClick={() => {
              onOverwrite();
              onOpenChange(false);
            }}
          >
            Overwrite with my draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
