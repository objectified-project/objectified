'use client';

import type { CSSProperties } from 'react';

/**
 * Tone palette mirrors the KPI sparkline tones in
 * `dashboardScreenClasses.repositoryKpiSparkToneClass`. Spelled out as
 * static class strings so Tailwind's JIT picks them up.
 */
const TONE_CLASS = {
  indigo: 'text-indigo-500 dark:text-indigo-400',
  emerald: 'text-emerald-500 dark:text-emerald-400',
  amber: 'text-amber-500 dark:text-amber-400',
  sky: 'text-sky-500 dark:text-sky-400',
  violet: 'text-violet-500 dark:text-violet-400',
  rose: 'text-rose-500 dark:text-rose-400',
  slate: 'text-slate-400 dark:text-slate-500',
} as const;

export type SparklineTone = keyof typeof TONE_CLASS;

export interface SparklineProps {
  /** Numeric series. <2 points renders nothing. */
  points: number[];
  /** Stroke + endpoint dot tone. Default: indigo. */
  tone?: SparklineTone;
  /** Whether to draw a soft area underneath. */
  area?: boolean;
  /** Whether to draw the trailing endpoint dot. */
  showEnd?: boolean;
  /** Width × height. Defaults match the listing's table cell size. */
  width?: number;
  height?: number;
  /** Override CSS via class (e.g. `w-full h-3`). When set, width/height are ignored. */
  className?: string;
  /** Inline style escape hatch. */
  style?: CSSProperties;
  /** A11y label. Defaults to a generic "trend" caption. */
  ariaLabel?: string;
}

/**
 * Lightweight inline sparkline. Distinct from `RepositoryKpiCard`'s
 * built-in sparkline because we need:
 *   1. A flexible footprint (full-width inline in lists, fixed-size in
 *      table cells).
 *   2. An optional area fill.
 *   3. No endpoint dot when used as a row glyph (it adds noise at small
 *      sizes).
 *
 * Anything bigger / fancier should keep using `RepositoryKpiCard`.
 */
export function Sparkline({
  points,
  tone = 'indigo',
  area = false,
  showEnd = false,
  width = 80,
  height = 18,
  className,
  style,
  ariaLabel = 'Activity trend',
}: SparklineProps) {
  if (!points || points.length < 2) {
    return <span className={className} style={{ width, height, display: 'inline-block', ...style }} aria-hidden="true" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  let line = '';
  let endX = 0;
  let endY = 0;
  points.forEach((value, idx) => {
    const x = idx * stepX;
    const y = height - ((value - min) / span) * height;
    line += `${idx === 0 ? 'M' : ' L'}${x.toFixed(2)},${y.toFixed(2)}`;
    if (idx === points.length - 1) {
      endX = x;
      endY = y;
    }
  });
  const fill = area
    ? `${line} L${(points.length - 1) * stepX},${height} L0,${height} Z`
    : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`${TONE_CLASS[tone]}${className ? ` ${className}` : ''}`}
      style={className ? style : { width, height, ...style }}
      role="img"
      aria-label={ariaLabel}
      focusable="false"
    >
      {fill ? <path d={fill} fill="currentColor" fillOpacity={0.15} /> : null}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {showEnd ? <circle cx={endX} cy={endY} r={1.5} fill="currentColor" /> : null}
    </svg>
  );
}
