/**
 * Single 0–100 overall schema quality score for Studio (#245).
 * Combines documentation, naming, inverted complexity (lower structural load is better),
 * and canvas layout quality using fixed weights that sum to 100%.
 */

import type { LayoutQualityResult } from '@/app/utils/layout-quality';
import type { SchemaMetricsResult } from '@/app/utils/schema-metrics';

const W_DOC = 0.3;
const W_NAMING = 0.3;
const W_SIMPLICITY = 0.25;
const W_LAYOUT = 0.15;

/**
 * Weighted composite of schema metrics and optional layout quality.
 * When `layoutQuality` is omitted, layout is excluded and weights are renormalized across the other three factors.
 */
export function computeOverallSchemaQualityScore(
  metrics: SchemaMetricsResult,
  layoutQuality: LayoutQualityResult | null | undefined
): number {
  const doc = metrics.documentationCompletionPercentage;
  const naming = metrics.namingCompliance.compliancePercentage;
  const simplicity = 100 - metrics.complexityScore;

  if (layoutQuality == null) {
    const sumW = W_DOC + W_NAMING + W_SIMPLICITY;
    const raw = ((W_DOC / sumW) * doc + (W_NAMING / sumW) * naming + (W_SIMPLICITY / sumW) * simplicity);
    return Math.min(100, Math.max(0, Math.round(raw)));
  }

  const raw =
    W_DOC * doc + W_NAMING * naming + W_SIMPLICITY * simplicity + W_LAYOUT * layoutQuality.overallScore;
  return Math.min(100, Math.max(0, Math.round(raw)));
}
