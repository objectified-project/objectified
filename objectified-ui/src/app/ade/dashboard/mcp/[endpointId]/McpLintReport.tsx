"use client";

import * as Progress from "@radix-ui/react-progress";
import { ArrowUpRight, CheckCircle2, ClipboardList, Gauge, ShieldCheck } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { LoadingState } from "@/app/components/ui/LoadingState";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { dashboardPanelPaddedClass } from "@/app/components/ade/dashboard/dashboardScreenClasses";
import { getNumericScoreTier } from "@/app/utils/numeric-score-tier";
import {
  mcpLintCategoryBars,
  mcpLintFindingTarget,
  mcpLintGroupByTier,
  mcpLintTierCounts,
  type McpLintFinding,
  type McpLintReport,
} from "@/app/components/ade/dashboard/mcp/mcpLintUi";

/** Invoked when a finding links to its offending capability item (deep-link to the Capabilities tab). */
export type NavigateToItem = (itemType: string, name: string) => void;

/**
 * The headline grade gauge: the A-F letter over a circular 0-100 ring whose sweep and color follow
 * the score band. Used at the top of the Lint & Score tab.
 */
function GradeGauge({ score, grade }: { score: number; grade: string }) {
  const tier = getNumericScoreTier(score);
  // SVG ring: a faint track plus a foreground arc dashed to `score`% of the circumference.
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={`${tier.gaugeStrokeClass} transition-all duration-500`}
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - dash)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold leading-none ${tier.textClass}`}>{grade}</span>
          <span className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
            {score} / 100
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className={`text-lg font-semibold ${tier.textClass}`}>
          {tier.shortLabel} — {tier.detailLabel}
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Deterministic quality score for this version&apos;s capability surface. {tier.rangeLabel} band.
        </p>
      </div>
    </div>
  );
}

/** A compact grade chip + MUST/SHOULD tallies, surfaced on the Overview section. */
export function McpGradeSummary({
  score,
  grade,
  mustCount,
  shouldCount,
}: {
  score: number | null;
  grade: string | null;
  mustCount: number;
  shouldCount: number;
}) {
  if (score === null) {
    return (
      <Badge variant="secondary" title="This version has not been scored yet">
        Unscored
      </Badge>
    );
  }
  const tier = getNumericScoreTier(score);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-2xl font-bold leading-none ${tier.textClass}`}>{grade ?? "—"}</span>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums">
        {score} / 100
      </span>
      <Badge variant={mustCount > 0 ? "error" : "success"} title="MUST findings (hard requirements)">
        {mustCount} MUST
      </Badge>
      <Badge variant={shouldCount > 0 ? "warning" : "secondary"} title="SHOULD findings (recommendations)">
        {shouldCount} SHOULD
      </Badge>
    </div>
  );
}

/** The per-category count bars (naming / structure / annotations / …), tinted by worst severity. */
function CategoryBars({ findings }: { findings: McpLintFinding[] }) {
  const bars = mcpLintCategoryBars(findings);
  if (bars.length === 0) return null;
  return (
    <section className={dashboardPanelPaddedClass}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <Gauge className="h-4 w-4 text-indigo-500" aria-hidden />
        Findings by category
      </h3>
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.category}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-gray-700 dark:text-gray-300">{bar.label}</span>
              <span className="text-gray-500 dark:text-gray-400 tabular-nums">{bar.count}</span>
            </div>
            <Progress.Root
              className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              value={bar.percent}
            >
              <Progress.Indicator
                className={`h-full ${bar.barClass} transition-transform duration-300`}
                style={{ transform: `translateX(-${100 - bar.percent}%)` }}
              />
            </Progress.Root>
          </div>
        ))}
      </div>
    </section>
  );
}

/** One color-coded finding row, linking to its offending capability item when resolvable. */
function FindingRow({
  finding,
  rowClass,
  onNavigateToItem,
}: {
  finding: McpLintFinding;
  rowClass: string;
  onNavigateToItem?: NavigateToItem;
}) {
  const target = mcpLintFindingTarget(finding.path);
  return (
    <div className={`rounded-md p-3 ${rowClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{finding.rule}</span>
        {target && onNavigateToItem ? (
          <button
            type="button"
            onClick={() => onNavigateToItem(target.item_type, target.name)}
            className="inline-flex items-center gap-1 font-mono text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            title={`Jump to ${finding.path} in Capabilities`}
          >
            {finding.path}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </button>
        ) : (
          <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{finding.path}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{finding.message}</p>
    </div>
  );
}

/** One requirement-tier section (MUST / SHOULD / advisory) with its findings. */
function TierSection({
  label,
  description,
  badgeVariant,
  rowClass,
  findings,
  onNavigateToItem,
}: {
  label: string;
  description: string;
  badgeVariant: React.ComponentProps<typeof Badge>["variant"];
  rowClass: string;
  findings: McpLintFinding[];
  onNavigateToItem?: NavigateToItem;
}) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <Badge variant={badgeVariant}>{label}</Badge>
        <span className="text-gray-500 dark:text-gray-400 tabular-nums">{findings.length}</span>
      </h3>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      <div className="space-y-2">
        {findings.map((finding) => (
          <FindingRow
            key={finding.id}
            finding={finding}
            rowClass={rowClass}
            onNavigateToItem={onNavigateToItem}
          />
        ))}
      </div>
    </section>
  );
}

interface Props {
  report: McpLintReport | null;
  loading: boolean;
  error: string | null;
  /** Deep-link a finding to its offending capability item on the Capabilities tab. */
  onNavigateToItem?: NavigateToItem;
}

/**
 * The "Lint & Score" tab: a grade gauge, per-category count bars, and findings split into MUST /
 * SHOULD / advisory sections, each finding linking to the capability item it flags. Presentational
 * — the report is fetched by the parent so the same data drives the Overview grade summary.
 */
export default function McpLintReport({ report, loading, error, onNavigateToItem }: Props) {
  if (loading) {
    return <LoadingState minHeightClassName="min-h-[220px]" message="Loading lint report…" />;
  }
  if (error || !report) {
    return (
      <EmptyState
        variant="compact"
        icon={<ShieldCheck className="h-8 w-8 text-white" aria-hidden />}
        title="Lint report unavailable"
        description={
          error ??
          "This endpoint has no scored version yet. Run discovery to capture a quality report."
        }
      />
    );
  }

  const tierGroups = mcpLintGroupByTier(report.findings);
  const counts = mcpLintTierCounts(report.findings);
  const clean = report.findings.length === 0;

  return (
    <div className="space-y-6">
      <section className={dashboardPanelPaddedClass}>
        <GradeGauge score={report.score} grade={report.grade} />
      </section>

      <CategoryBars findings={report.findings} />

      <section className={dashboardPanelPaddedClass}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <ClipboardList className="h-4 w-4 text-indigo-500" aria-hidden />
          Findings
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400 tabular-nums">
            {counts.must} MUST · {counts.should} SHOULD · {counts.advisory} advisory
          </span>
        </h3>
        {clean ? (
          <EmptyState
            variant="compact"
            icon={<CheckCircle2 className="h-8 w-8 text-white" aria-hidden />}
            title="No findings"
            description="This version's surface passes every lint rule — a clean bill of health."
          />
        ) : (
          <div className="space-y-6">
            {tierGroups
              .filter((group) => group.findings.length > 0)
              .map((group) => (
                <TierSection
                  key={group.meta.key}
                  label={group.meta.label}
                  description={group.meta.description}
                  badgeVariant={group.meta.badgeVariant}
                  rowClass={group.meta.rowClass}
                  findings={group.findings}
                  onNavigateToItem={onNavigateToItem}
                />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
