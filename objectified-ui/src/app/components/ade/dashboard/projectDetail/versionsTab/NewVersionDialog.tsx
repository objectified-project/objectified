'use client';

/**
 * Non-git-like "New version" dialog used by the Versions tab.
 *
 * Posts to `/api/versions` (which forwards to FastAPI
 * `POST /v1/versions/{tenant}/{project}`). Three things make this dialog
 * different from the legacy `CommitRevisionDialog`:
 *
 *   - No branch picker. With FEATURE_GITLIKE off the head is linear, so
 *     `branchName` is irrelevant.
 *   - The selected source revision feeds *both* `baseRevisionId` (the
 *     optimistic-lock token the API requires) and `source_version_id` (so
 *     classes carry forward by default). One picker, two fields.
 *   - Empty project = "first revision" path: `baseRevisionId` must be an
 *     empty string and there is no source to copy from.
 *
 * On 409 STALE_HEAD the dialog stays open with an inline error so the user
 * can refresh the picker without losing what they typed; the parent re-fetches
 * the versions list when the user dismisses + reopens.
 */

import { useEffect, useMemo, useState } from 'react';
import { GitBranchPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/Dialog';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Label } from '@/app/components/ui/Label';
import { Textarea } from '@/app/components/ui/Textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/Select';
import { Alert } from '@/app/components/ui/Alert';
import type { VersionRow } from './versionLifecycle';

export type BumpStrategy = 'patch' | 'minor' | 'custom';

export interface NewVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /**
   * The current versions list, ordered by the parent. Used to populate the
   * source picker without a second fetch and to pick a sensible default.
   */
  versions: VersionRow[];
  /** Fired after a successful create with the freshly-returned VersionSchema. */
  onCreated: (version: VersionRow) => void;
}

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

/**
 * Pure semver bump used only for the preview hint. The server is the source
 * of truth — if the user accepts auto-bump, we send `bump_strategy` and let
 * the API decide. Returns `null` when the input doesn't parse.
 */
function previewBump(versionId: string, strategy: 'patch' | 'minor'): string | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(versionId);
  if (!m) return null;
  const [, major, minor, patch] = m;
  if (strategy === 'minor') return `${major}.${Number(minor) + 1}.0`;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

/**
 * Latest revision by `updated_at` — same heuristic the parent tab uses to
 * auto-select. We pick this as the default source so "click → submit" gives
 * the user the most likely outcome (next patch off the most recent work).
 */
function pickDefaultSource(versions: VersionRow[]): VersionRow | null {
  if (versions.length === 0) return null;
  const sorted = [...versions].sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
  );
  return sorted[0];
}

export function NewVersionDialog({
  open,
  onOpenChange,
  projectId,
  versions,
  onCreated,
}: NewVersionDialogProps) {
  const isFirstRevision = versions.length === 0;

  /* Picker options, ordered most-recent-first to match the table. */
  const sourceOptions = useMemo(
    () =>
      [...versions].sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
      ),
    [versions]
  );

  const [sourceId, setSourceId] = useState<string>('');
  const [cleanSlate, setCleanSlate] = useState(false);
  const [bump, setBump] = useState<BumpStrategy>('patch');
  const [customVersionId, setCustomVersionId] = useState('');
  const [shortMessage, setShortMessage] = useState('');
  const [changelog, setChangelog] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  /* Reset whenever the dialog opens so reopening after an error gives a
   * clean slate but preserves the selected source defaulting behavior. */
  useEffect(() => {
    if (!open) return;
    const def = pickDefaultSource(versions);
    setSourceId(def?.id ?? '');
    setCleanSlate(false);
    setBump('patch');
    setCustomVersionId('');
    setShortMessage('');
    setChangelog('');
    setError(null);
    setErrorCode(null);
    setSubmitting(false);
  }, [open, versions]);

  const sourceRow = useMemo(
    () => sourceOptions.find((v) => v.id === sourceId) ?? null,
    [sourceOptions, sourceId]
  );

  const previewVersionId = useMemo(() => {
    if (isFirstRevision) {
      return bump === 'custom' ? customVersionId.trim() || '0.1.0' : '0.1.0';
    }
    if (!sourceRow) return null;
    if (bump === 'custom') return customVersionId.trim() || null;
    return previewBump(sourceRow.version_id, bump);
  }, [bump, customVersionId, isFirstRevision, sourceRow]);

  const customSemverError =
    bump === 'custom' && customVersionId.trim() && !SEMVER_RE.test(customVersionId.trim())
      ? 'Use semver — e.g. 1.2.3 or 1.2.3-beta.1'
      : null;

  const canSubmit =
    !submitting &&
    (isFirstRevision || sourceRow !== null) &&
    (bump !== 'custom' || (customVersionId.trim().length > 0 && !customSemverError));

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setErrorCode(null);

    /* The API expects an empty `baseRevisionId` for the first-revision case
     * (it returns a 400 INVALID_BASE otherwise) and the head revision id for
     * every other push. Field naming is mixed because `VersionCreateRequest`
     * only carries `AliasChoices` on a subset of fields — `version_id`,
     * `bump_strategy`, and `source_version_id` only accept snake_case, while
     * `baseRevisionId`/`shortMessage`/`changelog` go through aliases. The
     * legacy git-like dialog uses the same split, so we mirror it. */
    const payload: Record<string, unknown> = {
      projectId,
      baseRevisionId: isFirstRevision ? '' : sourceRow!.id,
    };
    /* `source_version_id` is what tells the API to copy classes forward.
     * Omitting it on the clean-slate path lets us reuse the same picker
     * for the optimistic lock without dragging the prior schema along. */
    if (!isFirstRevision && sourceRow && !cleanSlate) {
      payload.source_version_id = sourceRow.version_id;
    }
    if (bump === 'custom') {
      payload.version_id = customVersionId.trim();
    } else {
      payload.bump_strategy = bump;
    }
    const sm = shortMessage.trim();
    if (sm) payload.shortMessage = sm;
    const cl = changelog.trim();
    if (cl) payload.changelog = cl;

    try {
      const resp = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        version?: VersionRow;
        error?: string;
        code?: string;
      };

      if (!resp.ok || !data.success || !data.version) {
        setErrorCode(data.code ?? null);
        if (data.code === 'STALE_HEAD') {
          setError(
            'Another revision was pushed while you were typing. Close this dialog, reopen it, and the source picker will refresh.'
          );
        } else if (data.code === 'INVALID_BASE') {
          setError(
            'The selected source revision no longer matches the project head. Close this dialog and reopen it to refresh the list.'
          );
        } else {
          setError(data.error || `Failed to create version (HTTP ${resp.status}).`);
        }
        return;
      }

      onCreated(data.version);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create version');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <GitBranchPlus className="w-5 h-5 text-indigo-500" aria-hidden="true" />
            New version
          </DialogTitle>
          <DialogDescription>
            {isFirstRevision
              ? 'Create the first revision of this project. Classes will start empty.'
              : 'Bump the version and carry classes forward from the chosen source revision.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source / base revision picker — hidden when the project is empty. */}
          {!isFirstRevision && (
            <div className="space-y-1.5">
              <Label htmlFor="nv-source">Source revision</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger id="nv-source">
                  <SelectValue placeholder="Pick a source revision" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="font-mono">{v.version_id}</span>
                      {v.shortMessage ? (
                        <span className="text-slate-500 dark:text-slate-400">
                          {' '}
                          — {v.shortMessage}
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {cleanSlate
                  ? 'Used as the optimistic-lock base only — no classes will be copied.'
                  : 'Used as both the optimistic-lock base and the source of classes to copy forward.'}
              </p>

              {/* Clean-slate escape hatch. The selected source row is still the
                  optimistic-lock token (otherwise the API rejects the push), but
                  we drop `source_version_id` so the new revision starts empty. */}
              <label className="mt-2 flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cleanSlate}
                  onChange={(e) => setCleanSlate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  Start from a clean slate
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Don&apos;t copy classes from the source revision.
                  </span>
                </span>
              </label>

              {cleanSlate && (
                <Alert variant="warning" className="mt-2">
                  <span className="text-sm">
                    Not recommended. The new revision will have no classes, and
                    diffs against the source will show every prior class as removed.
                    Use this only when you intend to rebuild the schema from
                    scratch.
                  </span>
                </Alert>
              )}
            </div>
          )}

          {/* Bump strategy. */}
          <div className="space-y-1.5">
            <Label>Bump strategy</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['patch', 'minor', 'custom'] as BumpStrategy[]).map((opt) => {
                const active = bump === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setBump(opt)}
                    className={
                      'rounded-md border px-3 py-2 text-sm transition-colors ' +
                      (active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700')
                    }
                  >
                    <div className="font-medium capitalize">{opt}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {opt === 'patch' && 'x.y.Z+1'}
                      {opt === 'minor' && 'x.Y+1.0'}
                      {opt === 'custom' && 'Pick semver'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom version ID — only visible for the custom path. */}
          {bump === 'custom' && (
            <div className="space-y-1.5">
              <Label htmlFor="nv-custom">Version ID</Label>
              <Input
                id="nv-custom"
                placeholder={
                  sourceRow ? previewBump(sourceRow.version_id, 'patch') ?? '1.0.0' : '0.1.0'
                }
                value={customVersionId}
                onChange={(e) => setCustomVersionId(e.target.value)}
                className="font-mono"
              />
              {customSemverError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{customSemverError}</p>
              )}
            </div>
          )}

          {/* Preview line — quick "this will become X" cue. */}
          {previewVersionId && bump !== 'custom' && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Will create{' '}
              <span className="font-mono text-slate-700 dark:text-slate-200">
                {previewVersionId}
              </span>
              {sourceRow && (
                <>
                  {' '}from{' '}
                  <span className="font-mono text-slate-700 dark:text-slate-200">
                    {sourceRow.version_id}
                  </span>
                </>
              )}
              .
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nv-short">Short message <span className="text-slate-400">(optional)</span></Label>
            <Input
              id="nv-short"
              placeholder="e.g. Add invoice line items"
              value={shortMessage}
              onChange={(e) => setShortMessage(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nv-changelog">
              Changelog <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="nv-changelog"
              rows={4}
              placeholder="What changed in this revision?"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant={errorCode === 'STALE_HEAD' ? 'warning' : 'error'}>
              {error}
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Creating…
              </>
            ) : (
              <>
                <GitBranchPlus className="w-4 h-4" aria-hidden="true" />
                Create version
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
