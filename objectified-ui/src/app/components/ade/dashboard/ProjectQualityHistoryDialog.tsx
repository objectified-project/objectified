'use client';

import { useId } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/Dialog';
import { buildQualityTrendPoints, type ProjectQualitySnapshot } from '../../../utils/project-quality-score-history';
import { getNumericScoreTier } from '../../../utils/numeric-score-tier';

interface ProjectQualityHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  history: ProjectQualitySnapshot[];
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ProjectQualityHistoryDialog({
  open,
  onOpenChange,
  projectName,
  history,
}: ProjectQualityHistoryDialogProps) {
  const gradId = `pqhist-${useId().replace(/\W/g, '')}`;
  const overalls = history.map((h) => h.overall);
  const pts = buildQualityTrendPoints(overalls);
  const w = 400;
  const h = 160;
  const pad = 36;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const lineD =
    pts.length === 0
      ? ''
      : pts
          .map((p, i) => {
            const x = pad + (p.x / 100) * innerW;
            const y = pad + (p.y / 100) * innerH;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ');

  const areaD =
    lineD && pts.length > 0
      ? `${lineD} L ${pad + innerW} ${pad + innerH} L ${pad} ${pad + innerH} Z`
      : '';

  const first = history[0];
  const last = history[history.length - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Quality score trend — {projectName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          OpenAPI quality scores (0–100) recorded in this browser when an import finishes successfully. History is stored locally and is not synced across devices.
        </p>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-500 py-8 text-center">No snapshots yet. Import a specification to record the first score.</p>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
              <svg
                viewBox={`0 0 ${w} ${h}`}
                className="w-full h-40 text-indigo-500 dark:text-indigo-400"
                role="img"
                aria-label={`Quality trend from ${first ? formatShortDate(first.recordedAt) : ''} to ${last ? formatShortDate(last.recordedAt) : ''}`}
              >
                <title>
                  Overall quality {overalls.join(', ')}
                </title>
                {/* grid */}
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = pad + ((100 - tick) / 100) * innerH;
                  return (
                    <g key={tick}>
                      <line
                        x1={pad}
                        y1={y}
                        x2={pad + innerW}
                        y2={y}
                        className="stroke-gray-200 dark:stroke-gray-700"
                        strokeWidth={1}
                      />
                      <text x={4} y={y + 4} className="fill-gray-500 text-[10px] font-medium">
                        {tick}
                      </text>
                    </g>
                  );
                })}
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {areaD ? <path d={areaD} fill={`url(#${gradId})`} /> : null}
                {lineD ? (
                  <path d={lineD} fill="none" stroke="currentColor" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                ) : null}
                {pts.map((p, i) => {
                  const cx = pad + (p.x / 100) * innerW;
                  const cy = pad + (p.y / 100) * innerH;
                  return (
                    <circle
                      key={`${p.x}-${p.y}-${i}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      className="fill-white dark:fill-gray-900 stroke-current"
                      strokeWidth={2}
                    />
                  );
                })}
              </svg>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
                <span>{first ? formatShortDate(first.recordedAt) : ''}</span>
                <span>{last ? formatShortDate(last.recordedAt) : ''}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Recorded</th>
                    <th className="px-3 py-2 font-semibold">Overall</th>
                    <th className="px-3 py-2 font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[...history].reverse().map((row, idx) => {
                    const tier = getNumericScoreTier(row.overall);
                    return (
                      <tr key={`${row.recordedAt}-${row.overall}-${idx}`}>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatShortDate(row.recordedAt)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-semibold tabular-nums ${tier.textClass}`}>{row.overall}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{row.grade}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
