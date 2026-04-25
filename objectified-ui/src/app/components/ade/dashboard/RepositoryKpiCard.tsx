'use client';

import type { ReactNode } from 'react';
import {
  repositoryKpiCardClass,
  repositoryKpiIconToneClass,
  repositoryKpiSparkToneClass,
  repositoryKpiSubtitleToneClass,
  repositoryKpiValueToneClass,
  type RepositoryKpiSubtitleTone,
  type RepositoryKpiTone,
} from './dashboardScreenClasses';

export interface RepositoryKpiCardProps {
  /** Small uppercase label rendered top-left. */
  label: string;
  /** Headline value (renders mono, bold, large). Tints when `tone` calls for it. */
  value: ReactNode;
  /** Optional supporting copy under the value+sparkline row. */
  subtitle?: ReactNode;
  /** Optional small icon to render inline before the subtitle (e.g. trending-up). */
  subtitleIcon?: ReactNode;
  /** Subtitle colour. Default = muted gray. */
  subtitleTone?: RepositoryKpiSubtitleTone;
  /** Top-right accent icon. */
  icon?: ReactNode;
  /** Colour theme for icon, sparkline, and (optionally) value tint. */
  tone?: RepositoryKpiTone;
  /**
   * Optional sparkline points. Rendered as an inline 80x24 SVG at the right
   * edge of the value row, baseline-aligned with the value. Omitted entirely
   * when undefined or fewer than two points — we'd rather leave whitespace
   * than fake a trend we don't have.
   */
  sparkline?: number[];
  className?: string;
}

const SPARK_W = 80;
const SPARK_H = 24;

interface SparkGeometry {
  path: string;
  endX: number;
  endY: number;
}

function buildSparkline(points: number[]): SparkGeometry | null {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = SPARK_W / (points.length - 1);
  let path = '';
  let endX = 0;
  let endY = 0;
  points.forEach((value, idx) => {
    const x = idx * stepX;
    const y = SPARK_H - ((value - min) / span) * SPARK_H;
    path += `${idx === 0 ? 'M' : ' L'}${x.toFixed(2)},${y.toFixed(2)}`;
    if (idx === points.length - 1) {
      endX = x;
      endY = y;
    }
  });
  return { path, endX, endY };
}

/**
 * KPI card used at the top of the Repositories dashboard. Visual structure
 * mirrors the dashboard mockup exactly:
 *   - top row: label (left) + small accent icon (right)
 *   - body row: large mono value (left) + 80x24 sparkline (right, optional)
 *   - subtitle row: small tone-colored support copy with optional inline icon
 */
export function RepositoryKpiCard({
  label,
  value,
  subtitle,
  subtitleIcon,
  subtitleTone = 'default',
  icon,
  tone = 'indigo',
  sparkline,
  className,
}: RepositoryKpiCardProps) {
  const geometry = sparkline ? buildSparkline(sparkline) : null;
  const valueTone = repositoryKpiValueToneClass[tone];
  return (
    <article className={`${repositoryKpiCardClass}${className ? ` ${className}` : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
          {label}
        </p>
        {icon ? (
          <span className={`${repositoryKpiIconToneClass[tone]} shrink-0`} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between mt-2 gap-3">
        <p
          className={`text-3xl font-bold font-mono leading-none ${
            valueTone || 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {value}
        </p>
        {geometry ? (
          <svg
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            preserveAspectRatio="none"
            className={`w-20 h-6 shrink-0 ${repositoryKpiSparkToneClass[tone]}`}
            aria-hidden="true"
            focusable="false"
          >
            <path
              d={geometry.path}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={geometry.endX} cy={geometry.endY} r={1.5} fill="currentColor" />
          </svg>
        ) : null}
      </div>
      {subtitle ? (
        <p
          className={`text-[11px] mt-1 flex items-center gap-1 ${repositoryKpiSubtitleToneClass[subtitleTone]}`}
        >
          {subtitleIcon ? (
            <span className="shrink-0" aria-hidden="true">
              {subtitleIcon}
            </span>
          ) : null}
          <span className="truncate">{subtitle}</span>
        </p>
      ) : null}
    </article>
  );
}
