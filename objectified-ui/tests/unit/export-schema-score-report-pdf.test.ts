import { sanitizeFilenameSegment } from '@/app/utils/export-schema-score-report-pdf';

describe('sanitizeFilenameSegment', () => {
  it('keeps alphanumerics and common safe chars', () => {
    expect(sanitizeFilenameSegment('My Project v1.0')).toBe('My_Project_v1.0');
  });

  it('returns fallback for empty result', () => {
    expect(sanitizeFilenameSegment('!!!')).toBe('report');
  });

  it('truncates very long strings', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeFilenameSegment(long).length).toBeLessThanOrEqual(96);
  });
});
