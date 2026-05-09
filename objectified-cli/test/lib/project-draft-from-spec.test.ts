import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  metadataRecordFromSpecDraft,
  projectDraftFromSpecContent,
} from "../../src/lib/spec/project-draft-from-spec.js";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readFixture(name: string): string {
  return fs.readFileSync(path.join(pkgRoot, "fixtures", name), "utf8");
}

describe("projectDraftFromSpecContent", () => {
  it("maps OpenAPI 3.0 fixture (petstore)", () => {
    const raw = readFixture("petstore.yaml");
    const r = projectDraftFromSpecContent(raw, "petstore.yaml");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe("openapi");
    expect(r.draft.projectName).toBe("Swagger Petstore");
    expect(r.draft.projectSlugSuggestion).toMatch(/^[a-z][a-z0-9-]{1,62}$/);
    expect(r.draft.metadataSummary).toBe("Swagger Petstore");
  });

  it("maps OpenAPI 3.1 fixture", () => {
    const raw = readFixture("openapi31.yaml");
    const r = projectDraftFromSpecContent(raw, "openapi31.yaml");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe("openapi");
    expect(r.draft.projectName).toBe("Demo");
    expect(r.draft.projectSlugSuggestion).toBe("demo");
  });

  it("maps Swagger 2.0 JSON (license string)", () => {
    const raw = readFixture("swagger20.json");
    const r = projectDraftFromSpecContent(raw, "swagger20.json");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe("swagger2");
    expect(r.draft.projectName).toBe("Minimal API");
    expect(r.draft.projectSlugSuggestion).toBe("minimal-api");
  });

  it("maps Arazzo 1.x JSON", () => {
    const raw = readFixture("arazzo100.json");
    const r = projectDraftFromSpecContent(raw, "arazzo100.json");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe("arazzo");
    expect(r.draft.projectName).toBe("Demo Workflow");
    expect(r.draft.projectSlugSuggestion).toBe("demo-workflow");
  });

  it("maps OpenAPI 3.1 contact and license object", () => {
    const raw = `
openapi: 3.1.0
info:
  title: Payments API
  version: 2.4.0
  description: Real-time payments for merchants.
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
    const r = projectDraftFromSpecContent(raw, "payments.yaml");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.projectName).toBe("Payments API");
    expect(r.draft.projectSlugSuggestion).toBe("payments-api");
    expect(r.draft.projectDescription).toContain("Real-time payments");
    expect(r.draft.metadataTermsOfService).toContain("example.com/terms");
    expect(r.draft.metadataContactEmail).toBe("support@example.com");
    expect(r.draft.metadataLicenseIdentifier).toBe("Apache-2.0");

    const meta = metadataRecordFromSpecDraft(r.draft);
    expect(meta.summary).toBeDefined();
    expect((meta.contact as { email?: string }).email).toBe("support@example.com");
    expect((meta.license as { identifier?: string }).identifier).toBe("Apache-2.0");
  });

  it("uses info.summary when title missing (OpenAPI)", () => {
    const raw = `
openapi: 3.0.0
info:
  summary: Brief summary only
  version: "1"
paths: {}
`;
    const r = projectDraftFromSpecContent(raw, "x.yaml");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.projectName).toBe("Brief summary only");
  });

  it("rejects unknown root shape", () => {
    const raw = `{ "foo": 1 }`;
    const r = projectDraftFromSpecContent(raw, "x.json");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/does not expose/i);
  });
});
