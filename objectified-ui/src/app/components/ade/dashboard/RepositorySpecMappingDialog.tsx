'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/Dialog';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';

export type MappingConflictKind =
  | 'PROJECT_SLUG_TAKEN'
  | 'VERSION_STRATEGY_MISMATCH'
  | 'MANIFEST_PROJECT_AMBIGUOUS'
  | 'RBAC_NO_PROJECT_CREATE';

const CONFLICT_MESSAGES: Record<string, string> = {
  PROJECT_SLUG_TAKEN:
    'The manifest project slug is already used by another project in this tenant. Map this spec to an existing project or create one with a different slug.',
  VERSION_STRATEGY_MISMATCH:
    'The manifest version strategy disagrees with the existing project default. Choose a matching strategy or map to another project.',
  MANIFEST_PROJECT_AMBIGUOUS:
    'The manifest lists duplicate spec paths or conflicting mappings. Fix the manifest, or choose how to map this spec manually.',
  RBAC_NO_PROJECT_CREATE:
    'Automatic project creation from the manifest is disabled. Map to an existing project or create one explicitly.',
};

type ProjectOption = { id: string; slug: string; name?: string };

export interface RepositorySpecMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositoryId: string;
  fileId: string;
  branch: string;
  conflictKind: MappingConflictKind | string | null | undefined;
  initialProjectSlug?: string | null;
  initialVersionStrategy?: string | null;
  onMapped: () => void | Promise<void>;
}

export function RepositorySpecMappingDialog({
  open,
  onOpenChange,
  repositoryId,
  fileId,
  branch,
  conflictKind,
  initialProjectSlug,
  initialVersionStrategy,
  onMapped,
}: RepositorySpecMappingDialogProps) {
  const announceId = useId();
  const [mode, setMode] = useState<'map' | 'create' | 'defer'>('map');
  const [projectSlug, setProjectSlug] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [versionStrategy, setVersionStrategy] = useState('commit-sha');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const conflictMessage = useMemo(() => {
    const k = conflictKind ? String(conflictKind) : '';
    return CONFLICT_MESSAGES[k] ?? 'This spec needs an explicit project mapping before auto-import can continue.';
  }, [conflictKind]);

  useEffect(() => {
    if (!open) return;
    setMode('map');
    setProjectSlug((initialProjectSlug || '').trim());
    setNewSlug('');
    setVersionStrategy((initialVersionStrategy || 'commit-sha').trim() || 'commit-sha');
    setError('');
  }, [open, initialProjectSlug, initialVersionStrategy]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const r = await fetch('/api/projects', { cache: 'no-store' });
      const j = (await r.json()) as { success?: boolean; projects?: unknown };
      if (!r.ok || j.success === false) {
        setProjects([]);
        return;
      }
      const raw = j.projects;
      const list = Array.isArray(raw) ? raw : [];
      const mapped: ProjectOption[] = [];
      for (const row of list) {
        if (!row || typeof row !== 'object') continue;
        const rec = row as Record<string, unknown>;
        const id = typeof rec.id === 'string' ? rec.id : '';
        const slug = typeof rec.slug === 'string' ? rec.slug : '';
        const name = typeof rec.name === 'string' ? rec.name : undefined;
        if (id && slug) mapped.push({ id, slug, name });
      }
      setProjects(mapped);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadProjects();
  }, [open, loadProjects]);

  const filteredProjects = useMemo(() => {
    const q = projectSlug.trim().toLowerCase();
    if (!q) return projects.slice(0, 50);
    return projects.filter((p) => p.slug.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)).slice(0, 50);
  }, [projects, projectSlug]);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      let body: Record<string, unknown>;
      if (mode === 'defer') {
        body = { decision: 'defer', branch };
      } else if (mode === 'create') {
        body = {
          decision: 'create_new',
          projectSlug: newSlug.trim(),
          versionStrategy: versionStrategy.trim(),
          branch,
        };
      } else {
        body = {
          decision: 'map_existing',
          projectSlug: projectSlug.trim(),
          versionStrategy: versionStrategy.trim(),
          branch,
        };
      }

      const r = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}/specs/${encodeURIComponent(fileId)}/mapping`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { success?: boolean; error?: string };
      if (!r.ok || j.success === false) {
        setError(j.error || 'Mapping failed');
        return;
      }
      await onMapped();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mapping failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Map to project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            id={announceId}
            role="status"
            aria-live="polite"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            {conflictMessage}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={mode === 'map' ? 'default' : 'outline'} onClick={() => setMode('map')}>
              Map existing
            </Button>
            <Button type="button" size="sm" variant={mode === 'create' ? 'default' : 'outline'} onClick={() => setMode('create')}>
              Create new
            </Button>
            <Button type="button" size="sm" variant={mode === 'defer' ? 'default' : 'outline'} onClick={() => setMode('defer')}>
              Defer
            </Button>
          </div>

          {mode === 'map' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100" htmlFor="map-project-slug">
                Project slug
              </label>
              <Input
                id="map-project-slug"
                value={projectSlug}
                onChange={(e) => setProjectSlug(e.target.value)}
                placeholder="filter or type slug"
                autoComplete="off"
              />
              {loadingProjects ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Loading projects…</p>
              ) : (
                <ul className="max-h-40 overflow-auto rounded border border-gray-200 dark:border-gray-700 text-sm">
                  {filteredProjects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => setProjectSlug(p.slug)}
                      >
                        <span className="font-mono">{p.slug}</span>
                        {p.name ? <span className="ml-2 text-gray-500">{p.name}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100" htmlFor="map-vs">
                Version strategy
              </label>
              <select
                id="map-vs"
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                value={versionStrategy}
                onChange={(e) => setVersionStrategy(e.target.value)}
              >
                <option value="commit-sha">commit-sha</option>
                <option value="semver">semver</option>
              </select>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100" htmlFor="new-slug">
                New project slug
              </label>
              <Input id="new-slug" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="my-service" />
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100" htmlFor="create-vs">
                Version strategy
              </label>
              <select
                id="create-vs"
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                value={versionStrategy}
                onChange={(e) => setVersionStrategy(e.target.value)}
              >
                <option value="commit-sha">commit-sha</option>
                <option value="semver">semver</option>
              </select>
            </div>
          )}

          {mode === 'defer' && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Defer keeps this spec in the mapping-required state so you can decide later.
            </p>
          )}

          {error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? 'Saving…' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
