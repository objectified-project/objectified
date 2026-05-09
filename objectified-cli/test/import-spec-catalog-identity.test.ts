import { describe, expect, it } from "vitest";

import {
  deriveCatalogIdentityFromSpecBytes,
  resolveCatalogIdentityForCreateOrMap,
} from "../src/lib/import/spec-import-catalog-identity.js";

describe("spec import catalog identity", () => {
  it("derives title and version from OpenAPI JSON", () => {
    const bytes = Buffer.from(
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Payments API", version: "2.1.0" },
        paths: {},
      }),
    );
    expect(deriveCatalogIdentityFromSpecBytes(bytes, "openapi-3")).toEqual({
      title: "Payments API",
      version: "2.1.0",
    });
  });

  it("derives from OpenAPI YAML", () => {
    const yaml = `openapi: 3.0.0
info:
  title: Event Bus
  version: "1.0.0"
paths: {}
`;
    const d = deriveCatalogIdentityFromSpecBytes(Buffer.from(yaml), "openapi-3");
    expect(d.title).toBe("Event Bus");
    expect(d.version).toBe("1.0.0");
  });

  it("derives from AsyncAPI", () => {
    const bytes = Buffer.from(`asyncapi: 2.6.0
info:
  title: Notifications
  version: "0.5.0"
channels: {}
`);
    expect(deriveCatalogIdentityFromSpecBytes(bytes, "asyncapi-2")).toEqual({
      title: "Notifications",
      version: "0.5.0",
    });
  });

  it("returns empty derivation for protobuf kind", () => {
    expect(deriveCatalogIdentityFromSpecBytes(Buffer.from("syntax = \"proto3\";"), "protobuf")).toEqual(
      {},
    );
  });

  it("resolveCatalogIdentityForCreateOrMap uses spec when CLI omits fields", () => {
    const r = resolveCatalogIdentityForCreateOrMap({
      derived: { title: "My API", version: "1.2.3" },
      sourceKind: "openapi-3",
      cliProjectName: "",
      cliProjectSlug: "",
      cliVersionRaw: "",
    });
    expect(r.projectName).toBe("My API");
    expect(r.projectSlug).toBe("my-api");
    expect(r.versionId).toBe("1.2.3");
  });

  it("CLI overrides beat spec derivation", () => {
    const r = resolveCatalogIdentityForCreateOrMap({
      derived: { title: "Ignored", version: "9.9.9" },
      sourceKind: "openapi-3",
      cliProjectName: "Shown",
      cliProjectSlug: "shown-api",
      cliVersionRaw: "3.0.0",
    });
    expect(r.projectName).toBe("Shown");
    expect(r.projectSlug).toBe("shown-api");
    expect(r.versionId).toBe("3.0.0");
  });

  it("throws when name cannot be resolved", () => {
    expect(() =>
      resolveCatalogIdentityForCreateOrMap({
        derived: {},
        sourceKind: "openapi-3",
        cliProjectName: "",
        cliProjectSlug: "",
        cliVersionRaw: "1.0.0",
      }),
    ).toThrow(/project-name/);
  });

  it("throws when version cannot be resolved", () => {
    expect(() =>
      resolveCatalogIdentityForCreateOrMap({
        derived: { title: "Only Title" },
        sourceKind: "openapi-3",
        cliProjectName: "",
        cliProjectSlug: "",
        cliVersionRaw: "",
      }),
    ).toThrow(/version/);
  });
});
