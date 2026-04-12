'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../ui/Dialog';
import {
  formatMergeConflictKinds,
  type MergeConflictResolutionChoice,
} from '../../../../../lib/version-merge';
import { cn } from '../../../../../lib/utils';

export interface VersionMergeConflictListProps {
  conflicts: Array<{ path: string; kinds: string[] }>;
  targetBranchName: string;
  sourceBranchName: string;
  resolutions: Record<string, MergeConflictResolutionChoice | null>;
  onResolve: (path: string, choice: MergeConflictResolutionChoice) => void;
  className?: string;
}

function resolutionLabel(choice: MergeConflictResolutionChoice | null | undefined): string {
  if (choice === 'mine') return 'Target (mine)';
  if (choice === 'theirs') return 'Source (theirs)';
  if (choice === 'manual') return 'Manual';
  return 'Unresolved';
}

export function VersionMergeConflictList({
  conflicts,
  targetBranchName,
  sourceBranchName,
  resolutions,
  onResolve,
  className = '',
}: VersionMergeConflictListProps) {
  const [manualPath, setManualPath] = useState<string | null>(null);

  if (conflicts.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          'rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 overflow-hidden',
          className
        )}
      >
        <div className="flex items-start gap-3 p-4 border-b border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Merge conflicts</h3>
            <p className="mt-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
              {conflicts.length} path{conflicts.length !== 1 ? 's' : ''} need a resolution before apply can succeed on the
              server. Choices are stored in this session for the upcoming merge-resolution API.
            </p>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-800 dark:text-gray-200">Mine</span> = target branch{' '}
              <span className="font-mono">{targetBranchName || '—'}</span>
              {' · '}
              <span className="font-medium text-gray-800 dark:text-gray-200">Theirs</span> = source branch{' '}
              <span className="font-mono">{sourceBranchName || '—'}</span>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th scope="col" className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300">Path</th>
                <th scope="col" className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Type
                </th>
                <th scope="col" className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Resolution
                </th>
                <th scope="col" className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[220px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((row) => {
                const choice = resolutions[row.path] ?? null;
                const unresolved = choice === null || choice === undefined;
                return (
                  <tr
                    key={row.path}
                    className={cn(
                      'border-b border-gray-100 dark:border-gray-800 last:border-0',
                      unresolved && 'bg-amber-50/90 dark:bg-amber-950/30'
                    )}
                  >
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-900 dark:text-gray-100 break-all align-top">
                      {row.path}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 align-top whitespace-nowrap">
                      {formatMergeConflictKinds(row.kinds)}
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                          unresolved
                            ? 'bg-amber-200 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100'
                            : 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                        )}
                      >
                        {resolutionLabel(choice)}
                      </span>
                    </td>
                    <td className="py-2 px-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={choice === 'mine' ? 'default' : 'outline'}
                          className="text-xs"
                          onClick={() => onResolve(row.path, 'mine')}
                          title={`Keep target (${targetBranchName}) at this path`}
                        >
                          Mine
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={choice === 'theirs' ? 'default' : 'outline'}
                          className="text-xs"
                          onClick={() => onResolve(row.path, 'theirs')}
                          title={`Take source (${sourceBranchName}) at this path`}
                        >
                          Theirs
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={choice === 'manual' ? 'secondary' : 'outline'}
                          className="text-xs"
                          onClick={() => {
                            onResolve(row.path, 'manual');
                            setManualPath(row.path);
                          }}
                        >
                          Manual
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={manualPath !== null} onOpenChange={(o) => !o && setManualPath(null)}>
        <DialogContent className="max-w-lg" aria-describedby="merge-manual-desc">
          <DialogHeader>
            <DialogTitle>Manual resolution</DialogTitle>
            <DialogDescription id="merge-manual-desc">
              Path <span className="font-mono text-gray-900 dark:text-gray-100">{manualPath}</span> is marked for manual
              merge. A future release will open a side-by-side diff and let you submit the merged fragment to the merge
              session API.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setManualPath(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
