'use client';

import type { ReactNode } from 'react';
import {
  repositoryStatusChipBaseClass,
  repositoryStatusChipToneClass,
  type RepositoryStatusChipTone,
} from './dashboardScreenClasses';

/**
 * Maps a raw API status string to its canonical chip tone.
 * Unknown statuses fall back to `neutral`.
 */
export function resolveRepositoryStatusTone(status: string): RepositoryStatusChipTone {
  switch (status) {
    case 'healthy':
      return 'healthy';
    case 'warnings':
      return 'warnings';
    case 'error':
    case 'failed':
      return 'error';
    case 'scan_in_progress':
    case 'scanning':
      return 'scanning';
    case 'archived':
    case 'disabled':
      return 'disabled';
    default:
      return 'neutral';
  }
}

/**
 * Human-friendly label for an API status value. Mirrors the tone resolver so
 * callers can render either independently.
 */
export function formatRepositoryStatusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'warnings':
      return 'Warnings';
    case 'error':
    case 'failed':
      return 'Error';
    case 'scan_in_progress':
    case 'scanning':
      return 'Scanning';
    case 'archived':
    case 'disabled':
      return 'Disabled';
    default:
      return status.replace(/_/g, ' ');
  }
}

export interface RepositoryStatusChipProps {
  /** Raw status from the API (canonical or already-mapped). */
  status: string;
  /** Optional override label; defaults to the resolved status label. */
  label?: ReactNode;
  /** Show a pulsing dot to indicate live activity (auto-on for `scanning`). */
  pulse?: boolean;
  className?: string;
}

/**
 * Compact uppercase status pill used across the redesigned Repositories
 * surface. Pairs the canonical status -> tone resolver with a single base
 * style so every chip stays visually consistent.
 */
export function RepositoryStatusChip({
  status,
  label,
  pulse,
  className,
}: RepositoryStatusChipProps) {
  const tone = resolveRepositoryStatusTone(status);
  const showPulse = pulse ?? tone === 'scanning';
  const resolvedLabel = label ?? formatRepositoryStatusLabel(status);

  return (
    <span
      className={`${repositoryStatusChipBaseClass} ${repositoryStatusChipToneClass[tone]}${className ? ` ${className}` : ''}`}
    >
      {showPulse ? (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse"
        />
      ) : null}
      {resolvedLabel}
    </span>
  );
}
