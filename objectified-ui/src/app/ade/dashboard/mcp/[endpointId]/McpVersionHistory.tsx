"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitCompareArrows, History, Loader2 } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { LoadingState } from "@/app/components/ui/LoadingState";
import { EmptyState } from "@/app/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/Select";
import { dashboardPanelPaddedClass } from "@/app/components/ade/dashboard/dashboardScreenClasses";
import { mcpScoreLabel, mcpScoreVariant } from "@/app/components/ade/dashboard/mcp/mcpBrowseUi";
import {
  mcpChangeBeforeAfter,
  mcpChangeCountParts,
  mcpChangeItemPath,
  mcpChangeStyle,
  mcpCompareHeader,
  mcpOrderedPair,
  mcpToggleSelection,
  mcpVersionDateTag,
  mcpVersionListFromPayload,
  mcpVersionCompareFromPayload,
  mcpVersionSeqLabel,
  type McpVersionChange,
  type McpVersionCompare,
  type McpVersionSummary,
} from "@/app/components/ade/dashboard/mcp/mcpVersionsUi";

interface Props {
  endpointId: string;
}

/** Default selection: the two newest snapshots (so the diff opens on the latest change). */
function defaultSelection(versions: McpVersionSummary[]): string[] {
  if (versions.length >= 2) return [versions[0].id, versions[1].id];
  if (versions.length === 1) return [versions[0].id];
  return [];
}

/** A collapsible JSON block (a change's before/after surface) rendered under a change row. */
function ChangeJsonBlock({ label, json }: { label: string; json: string }) {
  return (
    <details className="rounded-md border border-gray-200 bg-white/70 dark:border-gray-700 dark:bg-gray-900/40">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </summary>
      <pre className="overflow-x-auto px-3 pb-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
        <code>{json}</code>
      </pre>
    </details>
  );
}

/** One color-coded change row (added=green / removed=red / modified=blue). */
function ChangeRow({ change }: { change: McpVersionChange }) {
  const style = mcpChangeStyle(change.change_type);
  const { before, after } = mcpChangeBeforeAfter(change);
  const fields = change.change_type === "modified" ? change.detail.fields ?? [] : [];
  return (
    <div className={`rounded-md p-3 ${style.rowClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={style.badgeVariant} title={style.label}>
          <span aria-hidden>{style.sign}</span> {style.label}
        </Badge>
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {mcpChangeItemPath(change)}
        </span>
      </div>
      {fields.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {fields.map((field) => (
            <li
              key={field.field}
              className="text-xs text-gray-600 dark:text-gray-300"
            >
              <span className="font-medium text-gray-700 dark:text-gray-200">{field.field}</span>{" "}
              changed
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 space-y-2">
        {before !== null ? <ChangeJsonBlock label="Before" json={before} /> : null}
        {after !== null ? <ChangeJsonBlock label="After" json={after} /> : null}
      </div>
    </div>
  );
}

/** One row of the version timeline with a checkbox to tick it into the compare selection. */
function TimelineRow({
  version,
  checked,
  onToggle,
}: {
  version: McpVersionSummary;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const checkboxId = `mcp-version-${version.id}`;
  return (
    <label
      htmlFor={checkboxId}
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
        checked
          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/20"
          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
      }`}
    >
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={() => onToggle(version.id)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">
            {mcpVersionSeqLabel(version.version_seq)}
          </span>
          {version.is_current ? <Badge variant="success">Current</Badge> : null}
          <Badge variant={mcpScoreVariant(version.score)}>
            {mcpScoreLabel(version.score, version.grade)}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {mcpVersionDateTag(version)}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
          <span className="text-green-600 dark:text-green-400">
            +{version.change_counts.added}
          </span>
          <span className="text-red-600 dark:text-red-400">
            −{version.change_counts.removed}
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            ~{version.change_counts.modified}
          </span>
        </div>
      </div>
    </label>
  );
}

/** The compare-bar selectors (base / target) wired to the same selection model as the timeline. */
function CompareBar({
  versions,
  baseId,
  targetId,
  onPick,
}: {
  versions: McpVersionSummary[];
  baseId: string | null;
  targetId: string | null;
  onPick: (slot: 0 | 1, id: string) => void;
}) {
  const optionLabel = (version: McpVersionSummary) =>
    `${mcpVersionSeqLabel(version.version_seq)} · ${mcpVersionDateTag(version)}`;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Base version
        </label>
        <Select value={baseId ?? undefined} onValueChange={(value) => onPick(0, value)}>
          <SelectTrigger aria-label="Base version">
            <SelectValue placeholder="Select base…" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((version) => (
              <SelectItem key={version.id} value={version.id}>
                {optionLabel(version)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="hidden pb-2 text-gray-400 sm:block" aria-hidden>
        <GitCompareArrows className="h-5 w-5" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Target version
        </label>
        <Select value={targetId ?? undefined} onValueChange={(value) => onPick(1, value)}>
          <SelectTrigger aria-label="Target version">
            <SelectValue placeholder="Select target…" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((version) => (
              <SelectItem key={version.id} value={version.id}>
                {optionLabel(version)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** The rendered diff for the selected pair: header, change counts, and color-coded rows. */
function DiffPanel({
  compare,
  comparing,
  error,
  hasSelection,
}: {
  compare: McpVersionCompare | null;
  comparing: boolean;
  error: string | null;
  hasSelection: boolean;
}) {
  if (!hasSelection) {
    return (
      <EmptyState
        variant="compact"
        icon={<GitCompareArrows className="h-8 w-8 text-white" aria-hidden />}
        title="Pick two versions"
        description="Choose a base and a target — from the selectors or by ticking two versions in the timeline — to see exactly what changed."
      />
    );
  }
  if (comparing && !compare) {
    return <LoadingState minHeightClassName="min-h-[160px]" message="Computing diff…" />;
  }
  if (error) {
    return (
      <EmptyState
        variant="compact"
        icon={<GitCompareArrows className="h-8 w-8 text-white" aria-hidden />}
        title="Diff unavailable"
        description={error}
      />
    );
  }
  if (!compare) return null;

  const identical = !compare.fingerprint_changed && compare.changes.length === 0;
  return (
    <div className="space-y-3" aria-busy={comparing}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
          {mcpCompareHeader(compare)}
        </h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {mcpChangeCountParts(compare).map((part) => (
            <span key={part.key} className={part.colorClass}>
              {part.label}
            </span>
          ))}
        </div>
      </div>
      {identical ? (
        <EmptyState
          variant="compact"
          icon={<GitCompareArrows className="h-8 w-8 text-white" aria-hidden />}
          title="Identical surface"
          description="These two versions expose the same capabilities and metadata — nothing changed between them."
        />
      ) : (
        <div className="space-y-2">
          {compare.changes.map((change) => (
            <ChangeRow key={`${change.item_type}:${change.item_name}`} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function McpVersionHistory({ endpointId }: Props) {
  const [versions, setVersions] = useState<McpVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Up to two ticked version ids, in pick order (chronological order is derived for the diff). */
  const [selection, setSelection] = useState<string[]>([]);
  const [compare, setCompare] = useState<McpVersionCompare | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/mcp/endpoints/${endpointId}/versions`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : res.statusText);
        }
        const list = mcpVersionListFromPayload(data);
        if (!active) return;
        setVersions(list);
        setSelection(defaultSelection(list));
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not load version history.");
        setVersions([]);
        setSelection([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [endpointId]);

  /** Chronologically ordered base→target for the current selection (auto-swaps older→newer). */
  const pair = useMemo(() => mcpOrderedPair(selection, versions), [selection, versions]);
  const baseId = pair?.base.id ?? null;
  const targetId = pair?.target.id ?? null;

  const runCompare = useCallback(
    async (base: string, target: string) => {
      setComparing(true);
      setCompareError(null);
      try {
        const res = await fetch(
          `/api/mcp/endpoints/${endpointId}/versions/compare?base=${encodeURIComponent(
            base,
          )}&target=${encodeURIComponent(target)}`,
          { credentials: "include", cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : res.statusText);
        }
        const parsed = mcpVersionCompareFromPayload(data);
        if (!mountedRef.current) return;
        if (!parsed) throw new Error("Malformed compare response.");
        setCompare(parsed);
      } catch (e) {
        if (!mountedRef.current) return;
        setCompare(null);
        setCompareError(e instanceof Error ? e.message : "Could not compare versions.");
      } finally {
        if (mountedRef.current) setComparing(false);
      }
    },
    [endpointId],
  );

  useEffect(() => {
    if (!baseId || !targetId) {
      setCompare(null);
      setCompareError(null);
      return;
    }
    void runCompare(baseId, targetId);
  }, [baseId, targetId, runCompare]);

  const toggleVersion = useCallback((id: string) => {
    setSelection((prev) => mcpToggleSelection(prev, id));
  }, []);

  /** Set one selector slot (0 = base, 1 = target), preserving the other slot's pick. */
  const pickSlot = useCallback((slot: 0 | 1, id: string) => {
    setSelection((prev) => {
      const slots: [string | null, string | null] = [prev[0] ?? null, prev[1] ?? null];
      slots[slot] = id;
      return slots.filter((value): value is string => Boolean(value));
    });
  }, []);

  if (loading) {
    return <LoadingState minHeightClassName="min-h-[220px]" message="Loading version history…" />;
  }
  if (error || versions.length === 0) {
    return (
      <EmptyState
        variant="compact"
        icon={<History className="h-8 w-8 text-white" aria-hidden />}
        title="No version history"
        description={
          error ?? "This endpoint has no recorded version snapshots yet. Run discovery to create one."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className={dashboardPanelPaddedClass}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <GitCompareArrows className="h-4 w-4 text-indigo-500" aria-hidden />
          Compare versions
        </h3>
        <CompareBar versions={versions} baseId={baseId} targetId={targetId} onPick={pickSlot} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <History className="h-4 w-4 text-indigo-500" aria-hidden />
            Timeline
            <Badge variant="secondary">{versions.length}</Badge>
          </h3>
          <div className="space-y-2">
            {versions.map((version) => (
              <TimelineRow
                key={version.id}
                version={version}
                checked={selection.includes(version.id)}
                onToggle={toggleVersion}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            {comparing ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" aria-hidden />
            ) : (
              <GitCompareArrows className="h-4 w-4 text-indigo-500" aria-hidden />
            )}
            Diff
          </h3>
          <div className={dashboardPanelPaddedClass}>
            <DiffPanel
              compare={compare}
              comparing={comparing}
              error={compareError}
              hasSelection={selection.length > 0}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
