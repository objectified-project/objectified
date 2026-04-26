'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Lock,
  Globe,
  QrCode,
  Share2,
  PencilLine,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import {
  publishedHeaderShellClass,
  publishedRowStateChipClass,
  publishedRowStateChipLabel,
  publishedVisibilityPillClass,
  projectAvatarGradientClasses,
  type PublishedRowState,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { relativeAgo } from './fixtures';
import type { PublishedVersionRow, PublishedRowDecoration, PublishedVersionSchemaSummary } from './types';

export interface PublishedDetailHeaderProps {
  row: PublishedVersionRow;
  decoration?: PublishedRowDecoration;
  schema?: PublishedVersionSchemaSummary;
  /** Click handlers — host page wires these into real actions or toasts. */
  onShowQr?: () => void;
  onShare?: () => void;
  onEditNotes?: () => void;
  onToggleVisibility?: () => void;
  onOpenSpec?: () => void;
  onMore?: () => void;
}

/**
 * Sub-page header for the per-version detail screen. Mirrors the listing
 * page's header chrome (gradient shell + project header tile) but adds:
 *   - back link to the listing
 *   - large project initials tile
 *   - title row: project name · semver pill · visibility pill · state chip
 *   - description (release blurb)
 *   - mono meta line (publisher · published rel · paths/ops/schemas)
 *   - actions row (QR, Share, Edit notes, visibility toggle, Open spec, ⋯)
 */
export function PublishedDetailHeader({
  row,
  decoration,
  schema,
  onShowQr,
  onShare,
  onEditNotes,
  onToggleVisibility,
  onOpenSpec,
  onMore,
}: PublishedDetailHeaderProps) {
  const initials = deriveInitials(row.project_name);
  const gradient = pickAvatarGradient(row.project_id);
  const state: PublishedRowState = decoration?.state ?? 'ok';
  const stateChip = decoration?.chipLabel ?? publishedRowStateChipLabel[state];

  return (
    <header className={`${publishedHeaderShellClass} border-b border-gray-200 dark:border-gray-700`}>
      <div className="px-6 py-4">
        <Link
          href="/ade/dashboard/published"
          className="text-[11px] font-mono text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-300 inline-flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> All published versions
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold font-mono text-xl shadow-md shrink-0`}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight text-gray-900 dark:text-white">
                  {row.project_name}
                </h1>
                <span className="font-mono text-sm px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> v{row.version_id}
                </span>
                <span className={publishedVisibilityPillClass[row.visibility]}>
                  {row.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {row.visibility === 'public' ? 'Public' : 'Private'}
                </span>
                {stateChip ? (
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${publishedRowStateChipClass[state]}`}
                  >
                    {stateChip}
                  </span>
                ) : null}
              </div>
              {row.description ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 max-w-2xl">{row.description}</p>
              ) : null}
              <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1.5">
                published {relativeAgo(row.published_at)}
                {row.creator_name ? (
                  <>
                    {' '}by <span className="text-gray-700 dark:text-gray-300">{row.creator_name}</span>
                  </>
                ) : null}{' '}
                · locked
                {schema ? (
                  <>
                    {' · '}
                    {schema.paths} paths · {schema.operations} ops · {schema.schemas} schemas
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onShowQr ? (
              <HeaderButton onClick={onShowQr} icon={<QrCode className="w-3.5 h-3.5" />} label="QR" />
            ) : null}
            {onShare ? (
              <HeaderButton onClick={onShare} icon={<Share2 className="w-3.5 h-3.5" />} label="Share" />
            ) : null}
            {onEditNotes ? (
              <HeaderButton onClick={onEditNotes} icon={<PencilLine className="w-3.5 h-3.5" />} label="Edit notes" />
            ) : null}
            {onToggleVisibility ? (
              <HeaderButton
                onClick={onToggleVisibility}
                icon={row.visibility === 'public' ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                label={row.visibility === 'public' ? 'Make private' : 'Make public'}
              />
            ) : null}
            {onOpenSpec ? (
              <button
                type="button"
                onClick={onOpenSpec}
                className="h-8 px-2.5 rounded-md text-xs bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open spec
              </button>
            ) : null}
            {onMore ? (
              <button
                type="button"
                onClick={onMore}
                title="More actions"
                className="h-8 w-8 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center justify-center transition-colors"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-2.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs inline-flex items-center gap-1.5 transition-colors"
    >
      {icon} {label}
    </button>
  );
}

function deriveInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '··';
  const parts = trimmed.split(/[-_\s]+/u).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function pickAvatarGradient(projectId: string): string {
  let h = 0;
  for (let i = 0; i < projectId.length; i += 1) {
    h = (h * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return projectAvatarGradientClasses[h % projectAvatarGradientClasses.length];
}
