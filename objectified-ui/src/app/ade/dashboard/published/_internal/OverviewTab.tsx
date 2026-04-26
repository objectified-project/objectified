'use client';

import {
  FileCode2,
  LayoutTemplate,
  GitMerge,
  Braces,
  Link as LinkIcon,
  FileText,
  ExternalLink,
  Copy,
  QrCode,
  Layers,
  AlertOctagon,
  Globe,
  Lock,
  Map as MapIcon,
  ChevronDown,
} from 'lucide-react';
import {
  publishedMethodChipClass,
  type PublishedMethod,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { Sparkline } from './Sparkline';
import { formatRequestsShort } from './fixtures';
import type {
  PublishedReleaseNotes,
  PublishedVersionRow,
  PublishedVersionSchemaSummary,
  PublishedVersionTopOperation,
} from './types';

export type ViewKind = 'open' | 'arazzo' | 'json' | 'swagger';

export interface OverviewTabProps {
  row: PublishedVersionRow;
  schema: PublishedVersionSchemaSummary;
  topOperations: PublishedVersionTopOperation[];
  releaseNotes: PublishedReleaseNotes;
  /** Map a row + view kind to a fully qualified URL. */
  urlForKind: (row: PublishedVersionRow, kind: ViewKind) => string;
  /** Click to open a particular spec view. */
  onOpenView: (kind: ViewKind) => void;
  /** Click to copy a particular spec URL. */
  onCopyUrl: (kind: ViewKind) => void;
  /** Click to surface the QR card / dialog. */
  onShowQr?: (kind: ViewKind) => void;
}

interface AccessRow {
  kind: ViewKind;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgClass: string;
}

const ACCESS_ROWS: AccessRow[] = [
  {
    kind: 'open',
    title: 'OpenAPI spec',
    subtitle: 'YAML · JSON',
    icon: <FileCode2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    iconBgClass: 'bg-blue-50 dark:bg-blue-900/30',
  },
  {
    kind: 'swagger',
    title: 'Swagger UI',
    icon: <LayoutTemplate className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />,
    iconBgClass: 'bg-fuchsia-50 dark:bg-fuchsia-900/30',
  },
  {
    kind: 'arazzo',
    title: 'Arazzo workflows',
    icon: <GitMerge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    iconBgClass: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  {
    kind: 'json',
    title: 'JSON Schema bundle',
    icon: <Braces className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
    iconBgClass: 'bg-violet-50 dark:bg-violet-900/30',
  },
];

/**
 * Overview tab body. Three sections:
 *
 *   1. Access endpoints — one row per spec format with copy / QR / open.
 *   2. Two-column: Release notes + Schema & usage (with top ops).
 *   3. Swagger preview — first N operations, click-through to full UI.
 *
 * Top-ops sparklines mirror the listing's row sparklines (indigo by
 * default, rose for the lowest-volume tail). All click handlers are
 * wired through props so the host page owns side effects.
 */
export function OverviewTab({
  row,
  schema,
  topOperations,
  releaseNotes,
  urlForKind,
  onOpenView,
  onCopyUrl,
  onShowQr,
}: OverviewTabProps) {
  const isPublic = row.visibility === 'public';

  return (
    <div className="space-y-6">
      <Panel
        icon={<LinkIcon className="w-4 h-4 text-indigo-500" />}
        title="Access endpoints"
        rightSlot={
          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
            {isPublic ? (
              <>
                <Globe className="w-3 h-3 text-emerald-500" /> Public · no API key required
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-slate-500" /> Private · API key required
              </>
            )}
          </span>
        }
      >
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {ACCESS_ROWS.map((item) => (
            <AccessEndpointRow
              key={item.kind}
              item={item}
              url={urlForKind(row, item.kind)}
              onOpen={() => onOpenView(item.kind)}
              onCopy={() => onCopyUrl(item.kind)}
              onShowQr={onShowQr ? () => onShowQr(item.kind) : undefined}
            />
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          icon={<FileText className="w-4 h-4 text-indigo-500" />}
          title="Release notes"
          rightSlot={
            releaseNotes.migrationGuideUrl ? (
              <a
                href={releaseNotes.migrationGuideUrl}
                className="text-[11px] font-mono text-indigo-500 hover:underline inline-flex items-center gap-1"
              >
                View commit <ExternalLink className="w-3 h-3" />
              </a>
            ) : null
          }
        >
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{releaseNotes.title}</p>
              <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                released {releaseNotes.publishedRel}
                {releaseNotes.supersedes ? (
                  <>
                    {' · supersedes '}
                    <span className="text-indigo-500 dark:text-indigo-300">{releaseNotes.supersedes}</span>
                  </>
                ) : null}
              </p>
            </div>

            {releaseNotes.breaking.length > 0 ? (
              <div className="rounded-md border border-rose-200 dark:border-rose-700/50 bg-rose-50/60 dark:bg-rose-900/20 p-3">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-rose-700 dark:text-rose-300 inline-flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5" /> Breaking changes
                </p>
                <ul className="mt-1.5 space-y-1 text-[13px]">
                  {releaseNotes.breaking.map((entry, idx) => (
                    <li key={idx} className="leading-snug">
                      · <SafeMarkdownLite text={entry} tone="rose" />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {releaseNotes.added.length > 0 ? (
              <ReleaseSection title="Added" tone="emerald" entries={releaseNotes.added} />
            ) : null}
            {releaseNotes.improved.length > 0 ? (
              <ReleaseSection title="Improved" tone="default" entries={releaseNotes.improved} />
            ) : null}

            {releaseNotes.migrationGuideUrl ? (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <a
                  href={releaseNotes.migrationGuideUrl}
                  className="text-[11px] font-mono text-indigo-500 hover:underline inline-flex items-center gap-1"
                >
                  <MapIcon className="w-3 h-3" /> Migration guide
                </a>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          icon={<Layers className="w-4 h-4 text-indigo-500" />}
          title="Schema & usage"
          rightSlot={<span className="text-[10px] font-mono text-gray-400">last 7 d</span>}
        >
          <div className="grid grid-cols-4 gap-2 p-4 text-center font-mono">
            <SchemaCell label="Paths" value={schema.paths.toLocaleString()} />
            <SchemaCell label="Operations" value={schema.operations.toLocaleString()} />
            <SchemaCell label="Schemas" value={schema.schemas.toLocaleString()} />
            <SchemaCell label="Webhooks" value={schema.webhooks.toLocaleString()} />
          </div>
          <div className="px-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-2">
              Top operations by request volume
            </p>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {topOperations.map((op, idx) => (
                <TopOperationRow key={`${op.method}-${op.path}-${idx}`} op={op} />
              ))}
              {topOperations.length === 0 ? (
                <li className="py-2 text-[12px] text-gray-500 dark:text-gray-400">No traffic recorded.</li>
              ) : null}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel
        icon={<LayoutTemplate className="w-4 h-4 text-fuchsia-500" />}
        title="Swagger preview"
        rightSlot={
          <button
            type="button"
            onClick={() => onOpenView('swagger')}
            className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-[11px] inline-flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Open full Swagger UI
          </button>
        }
        titleSuffix={
          <span className="text-[10px] font-mono text-gray-400">
            first {Math.min(topOperations.length, 5)} of {schema.operations}
          </span>
        }
      >
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {topOperations.slice(0, 5).map((op, idx) => (
            <button
              type="button"
              key={`swagger-${op.method}-${op.path}-${idx}`}
              onClick={() => onOpenView('swagger')}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer text-left transition-colors"
            >
              <MethodChip method={op.method} fixedWidth />
              <code className="font-mono text-[12px] text-gray-700 dark:text-gray-300 flex-1 truncate">
                {op.path}
              </code>
              {op.note ? (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate hidden md:inline">
                  {op.note}
                </span>
              ) : null}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </button>
          ))}
          {topOperations.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400">
              No operations to preview yet.
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

interface PanelProps {
  icon: React.ReactNode;
  title: string;
  rightSlot?: React.ReactNode;
  titleSuffix?: React.ReactNode;
  children: React.ReactNode;
}

function Panel({ icon, title, rightSlot, titleSuffix, children }: PanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {titleSuffix}
        </div>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

interface AccessEndpointRowProps {
  item: AccessRow;
  url: string;
  onOpen: () => void;
  onCopy: () => void;
  onShowQr?: () => void;
}

function AccessEndpointRow({ item, url, onOpen, onCopy, onShowQr }: AccessEndpointRowProps) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${item.iconBgClass}`}>
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          {item.title}
          {item.subtitle ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {item.subtitle}
            </span>
          ) : null}
        </p>
        <code className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate block">{url}</code>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-[11px] inline-flex items-center gap-1 transition-colors"
      >
        <Copy className="w-3 h-3" /> Copy
      </button>
      {onShowQr ? (
        <button
          type="button"
          onClick={onShowQr}
          className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-[11px] inline-flex items-center gap-1 transition-colors"
        >
          <QrCode className="w-3 h-3" /> QR
        </button>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="h-7 px-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] inline-flex items-center gap-1 transition-colors"
      >
        <ExternalLink className="w-3 h-3" /> Open
      </button>
    </div>
  );
}

interface ReleaseSectionProps {
  title: string;
  tone: 'emerald' | 'default';
  entries: string[];
}

function ReleaseSection({ title, tone, entries }: ReleaseSectionProps) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1 text-[13px]">
        {entries.map((entry, idx) => (
          <li key={idx} className="leading-snug">
            · <SafeMarkdownLite text={entry} tone={tone} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SchemaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 py-2">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

interface TopOperationRowProps {
  op: PublishedVersionTopOperation;
}

function TopOperationRow({ op }: TopOperationRowProps) {
  return (
    <li className="py-1.5 flex items-center gap-2 text-[12px]">
      <MethodChip method={op.method} />
      <code className="font-mono text-gray-700 dark:text-gray-300 truncate min-w-0 flex-shrink">
        {op.path}
      </code>
      <span className="flex-1 min-w-0">
        <Sparkline points={op.sparkline} tone="indigo" className="w-full h-3" />
      </span>
      <span className="font-mono text-gray-700 dark:text-gray-300 w-14 text-right shrink-0">
        {formatRequestsShort(op.requests)}
      </span>
    </li>
  );
}

interface MethodChipProps {
  method: PublishedMethod;
  fixedWidth?: boolean;
}

function MethodChip({ method, fixedWidth = false }: MethodChipProps) {
  return (
    <span
      className={`font-mono text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
        publishedMethodChipClass[method]
      } ${fixedWidth ? 'w-12 text-center shrink-0' : 'shrink-0'}`}
    >
      {method === 'DELETE' ? 'DEL' : method}
    </span>
  );
}

/**
 * Tiny inline-code recogniser. Renders text as a sequence of plain
 * text spans and `<code>` spans (recognising `` `text` `` markdown).
 * Not a full markdown parser — fixtures only emit this single
 * pattern, so anything more elaborate is overkill.
 */
function SafeMarkdownLite({ text, tone }: { text: string; tone: 'rose' | 'emerald' | 'default' }) {
  const codeClass =
    tone === 'rose'
      ? 'font-mono text-rose-700 dark:text-rose-300'
      : tone === 'emerald'
      ? 'font-mono text-emerald-600 dark:text-emerald-400'
      : 'font-mono';
  const segments = text.split(/(`[^`]+`)/g);
  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.startsWith('`') && segment.endsWith('`')) {
          return (
            <code key={idx} className={codeClass}>
              {segment.slice(1, -1)}
            </code>
          );
        }
        return <span key={idx}>{segment}</span>;
      })}
    </>
  );
}
