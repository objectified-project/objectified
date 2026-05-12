/** Monaco `MarkerSeverity` values — numeric to avoid importing `monaco-editor` in Jest. */
const MARKER_HINT = 1;
const MARKER_INFO = 2;
const MARKER_WARNING = 4;
const MARKER_ERROR = 8;

export type DiagnosticSummary = {
  errors: number;
  warnings: number;
  infos: number;
  hints: number;
};

export const EMPTY_DIAGNOSTIC_SUMMARY: DiagnosticSummary = {
  errors: 0,
  warnings: 0,
  infos: 0,
  hints: 0,
};

export function countDiagnosticsFromMarkers(
  markers: readonly { severity: number }[] | null | undefined,
): DiagnosticSummary {
  if (!markers?.length) return { ...EMPTY_DIAGNOSTIC_SUMMARY };

  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let hints = 0;
  for (const m of markers) {
    const s = m.severity;
    if (s === MARKER_ERROR) errors++;
    else if (s === MARKER_WARNING) warnings++;
    else if (s === MARKER_INFO) infos++;
    else if (s === MARKER_HINT) hints++;
    else if (typeof s === 'number' && s >= MARKER_ERROR) errors++;
    else warnings++;
  }
  return { errors, warnings, infos, hints };
}

export function sumDiagnosticSummaries(a: DiagnosticSummary, b: DiagnosticSummary): DiagnosticSummary {
  return {
    errors: a.errors + b.errors,
    warnings: a.warnings + b.warnings,
    infos: a.infos + b.infos,
    hints: a.hints + b.hints,
  };
}
