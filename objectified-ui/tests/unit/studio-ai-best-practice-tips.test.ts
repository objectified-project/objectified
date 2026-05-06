import {
  collectStudioAiBestPracticeLinesFromStudio,
  collectStudioAiBestPracticeTipLines,
} from '../../src/app/utils/studio-ai-best-practice-tips';

describe('collectStudioAiBestPracticeTipLines (#615)', () => {
  it('maps ecommerce domain to inventory guidance', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: 'ecommerce',
      classNames: [],
    });
    expect(lines.some((l) => l.toLowerCase().includes('inventory'))).toBe(true);
  });

  it('maps saas domain to tenant isolation guidance', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: 'saas',
      classNames: [],
    });
    expect(lines.some((l) => l.toLowerCase().includes('tenant isolation'))).toBe(true);
  });

  it('detects auth-heavy class names for refresh-token guidance', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: '',
      classNames: ['User', 'RefreshToken'],
    });
    expect(lines.some((l) => l.toLowerCase().includes('refresh token'))).toBe(true);
  });

  it('detects auth hint from CamelCase compound OAuthSession', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: '',
      classNames: ['OAuthSession'],
    });
    expect(lines.some((l) => l.toLowerCase().includes('refresh token'))).toBe(true);
  });

  it('detects tenant hint from CamelCase compound OrganizationMember', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: 'social',
      classNames: ['OrganizationMember'],
    });
    expect(lines.some((l) => l.toLowerCase().includes('tenant isolation'))).toBe(true);
  });

  it('detects tenant-like class names when domain is not saas', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: 'social',
      classNames: ['Organization', 'Post'],
    });
    expect(lines.some((l) => l.toLowerCase().includes('tenant isolation'))).toBe(true);
  });

  it('does not duplicate tenant isolation when domain is already saas', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: 'saas',
      classNames: ['Organization'],
    });
    expect(lines.filter((l) => l.toLowerCase().includes('tenant isolation')).length).toBe(1);
  });

  it('ignores none domain sentinel', () => {
    const lines = collectStudioAiBestPracticeTipLines({
      domainCategory: 'none',
      classNames: [],
    });
    expect(lines).toHaveLength(0);
  });
});

describe('collectStudioAiBestPracticeLinesFromStudio (#615)', () => {
  it('reads domain from project metadata shape', () => {
    const lines = collectStudioAiBestPracticeLinesFromStudio({
      project: { domainCategory: 'ecommerce' },
      classes: [],
    });
    expect(lines.length).toBeGreaterThan(0);
  });
});
