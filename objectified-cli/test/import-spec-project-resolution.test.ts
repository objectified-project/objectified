import { afterEach, describe, expect, it, vi } from "vitest";

import { ObjectifiedCliError } from "../src/lib/errors.js";
import { EXIT_CODES } from "../src/lib/exit-codes.js";
import {
  resolveCreateOrMapProjectImport,
  resolveCreateProjectImport,
  resolveMapProjectImport,
  throwIfConflictingImportProjectFlags,
} from "../src/lib/import/spec-import-project-resolution.js";

describe("spec import project resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws misuse when multiple strategy flags are set", () => {
    expect(() =>
      throwIfConflictingImportProjectFlags({
        mapProjectRaw: "svc",
        createProject: true,
        createOrMapProject: false,
        existingProjectId: undefined,
      }),
    ).toThrow(
      expect.objectContaining({
        name: "ObjectifiedCliError",
        exitCode: EXIT_CODES.MISUSE,
      }),
    );
  });

  it("throws misuse when combining legacy existing-project-id with --map-project", () => {
    expect(() =>
      throwIfConflictingImportProjectFlags({
        mapProjectRaw: "svc",
        createProject: false,
        createOrMapProject: false,
        existingProjectId: "prj_1",
      }),
    ).toThrow(ObjectifiedCliError);
  });

  it("resolveMapProjectImport: maps existing project and forwards catalog fields", async () => {
    const getProjectBySlug = vi.fn().mockResolvedValue({
      id: "p-existing",
      tenant_id: "t1",
      name: "Payments API",
      slug: "payments-api",
      description: "Pay",
    });
    const api = {
      getProjectBySlug,
      createProject: vi.fn(),
      fetchProjectDomainsAllowlist: vi.fn(),
    };

    const r = await resolveMapProjectImport({
      api,
      tenant: "acme",
      mapSlugRaw: "payments-api",
    });

    expect(getProjectBySlug).toHaveBeenCalledWith("acme", "payments-api");
    expect(r.existingProjectId).toBe("p-existing");
    expect(r.project).toEqual({
      name: "Payments API",
      slug: "payments-api",
      description: "Pay",
    });
  });

  it("resolveCreateProjectImport: creates when slug is free", async () => {
    const getProjectBySlug = vi.fn().mockRejectedValue(
      new ObjectifiedCliError({
        message: "missing",
        exitCode: EXIT_CODES.NOT_FOUND,
        title: "Not found",
      }),
    );
    const createProject = vi.fn().mockResolvedValue({
      id: "p-new",
      tenant_id: "t1",
      name: "New API",
      slug: "new-api",
      description: null,
    });
    const fetchProjectDomainsAllowlist = vi.fn().mockResolvedValue(["payments"]);

    const r = await resolveCreateProjectImport({
      api: { getProjectBySlug, createProject, fetchProjectDomainsAllowlist },
      tenant: "acme",
      project: { name: "New API", slug: "new-api", description: null },
      domain: "payments",
      visibility: "public",
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(r.existingProjectId).toBe("p-new");
    expect(r.project.slug).toBe("new-api");
  });

  it("resolveCreateProjectImport: refuses when slug already exists", async () => {
    const getProjectBySlug = vi.fn().mockResolvedValue({
      id: "p-old",
      tenant_id: "t1",
      name: "Old",
      slug: "taken",
      description: null,
    });

    await expect(
      resolveCreateProjectImport({
        api: {
          getProjectBySlug,
          createProject: vi.fn(),
          fetchProjectDomainsAllowlist: vi.fn().mockResolvedValue([]),
        },
        tenant: "acme",
        project: { name: "X", slug: "taken", description: null },
      }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.MISUSE });
  });

  it("resolveCreateOrMapProjectImport: maps when slug exists and metadata matches", async () => {
    const getProjectBySlug = vi.fn().mockResolvedValue({
      id: "p1",
      tenant_id: "t1",
      name: "Same",
      slug: "svc",
      description: "D",
      metadata: { visibility: "private", domainCategory: "payments" },
    });

    const r = await resolveCreateOrMapProjectImport({
      api: {
        getProjectBySlug,
        createProject: vi.fn(),
        fetchProjectDomainsAllowlist: vi.fn().mockResolvedValue(["payments"]),
      },
      tenant: "acme",
      project: { name: "Same", slug: "svc", description: "D" },
      hints: {
        descriptionProvided: true,
        domainProvided: true,
        visibilityProvided: true,
      },
      domain: "payments",
      visibility: "private",
    });

    expect(r.existingProjectId).toBe("p1");
    expect(r.project.slug).toBe("svc");
  });

  it("resolveCreateOrMapProjectImport: validation error when slug exists but name differs", async () => {
    const getProjectBySlug = vi.fn().mockResolvedValue({
      id: "p1",
      tenant_id: "t1",
      name: "Server Name",
      slug: "svc",
      description: null,
    });

    await expect(
      resolveCreateOrMapProjectImport({
        api: {
          getProjectBySlug,
          createProject: vi.fn(),
          fetchProjectDomainsAllowlist: vi.fn(),
        },
        tenant: "acme",
        project: { name: "Client Name", slug: "svc", description: null },
        hints: {
          descriptionProvided: false,
          domainProvided: false,
          visibilityProvided: false,
        },
      }),
    ).rejects.toMatchObject({ exitCode: EXIT_CODES.VALIDATION });
  });

  it("resolveCreateOrMapProjectImport: creates when slug is missing", async () => {
    const getProjectBySlug = vi.fn().mockResolvedValue(null);
    const createProject = vi.fn().mockResolvedValue({
      id: "p-new",
      tenant_id: "t1",
      name: "Fresh",
      slug: "fresh",
      description: null,
    });

    const r = await resolveCreateOrMapProjectImport({
      api: {
        getProjectBySlug,
        createProject,
        fetchProjectDomainsAllowlist: vi.fn().mockResolvedValue([]),
      },
      tenant: "acme",
      project: { name: "Fresh", slug: "fresh", description: null },
      hints: {
        descriptionProvided: false,
        domainProvided: false,
        visibilityProvided: false,
      },
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(r.existingProjectId).toBe("p-new");
  });
});
