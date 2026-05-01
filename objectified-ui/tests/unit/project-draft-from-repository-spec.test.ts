import { projectDraftFromRepositorySpec } from '../../lib/project-draft-from-repository-spec';

describe('projectDraftFromRepositorySpec', () => {
  it('extracts OpenAPI info fields into a project draft', () => {
    const yaml = `
openapi: 3.0.3
info:
  title: Storefront API
  version: 1.0.0
  description: Public storefront operations.
  termsOfService: https://example.com/terms
  contact:
    name: Support
    url: https://example.com/support
    email: support@example.com
  license:
    name: Apache 2.0
    identifier: Apache-2.0
    url: https://www.apache.org/licenses/LICENSE-2.0.html
paths: {}
`;
    const r = projectDraftFromRepositorySpec(yaml, 'openapi/storefront.yaml');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.projectName).toBe('Storefront API');
    expect(r.draft.projectDescription).toContain('Public storefront');
    expect(r.draft.metadataContactEmail).toBe('support@example.com');
    expect(r.draft.metadataLicenseIdentifier).toBe('Apache-2.0');
  });

  it('returns ok false for non-info specs', () => {
    const r = projectDraftFromRepositorySpec('hello: world', 'x.yaml');
    expect(r.ok).toBe(false);
  });
});
