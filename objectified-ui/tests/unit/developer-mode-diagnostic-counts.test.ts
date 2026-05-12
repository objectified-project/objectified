import {
  countDiagnosticsFromMarkers,
  EMPTY_DIAGNOSTIC_SUMMARY,
  sumDiagnosticSummaries,
} from '@/components/developer-mode/diagnostic-counts';

describe('countDiagnosticsFromMarkers', () => {
  it('returns zeros for empty input', () => {
    expect(countDiagnosticsFromMarkers([])).toEqual(EMPTY_DIAGNOSTIC_SUMMARY);
    expect(countDiagnosticsFromMarkers(undefined)).toEqual(EMPTY_DIAGNOSTIC_SUMMARY);
  });

  it('counts Monaco severities', () => {
    expect(
      countDiagnosticsFromMarkers([
        { severity: 8 },
        { severity: 4 },
        { severity: 2 },
        { severity: 1 },
      ]),
    ).toEqual({ errors: 1, warnings: 1, infos: 1, hints: 1 });
  });
});

describe('sumDiagnosticSummaries', () => {
  it('adds buckets', () => {
    expect(
      sumDiagnosticSummaries(
        { errors: 1, warnings: 2, infos: 0, hints: 0 },
        { errors: 0, warnings: 1, infos: 3, hints: 0 },
      ),
    ).toEqual({ errors: 1, warnings: 3, infos: 3, hints: 0 });
  });
});
