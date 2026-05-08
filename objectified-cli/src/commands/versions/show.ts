import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { ObjectifiedCliError } from "../../lib/errors.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import type { VersionSchema } from "../../lib/client.js";
import { chalkForContext, localePrefersAsciiTable, stableDeepSort } from "../../lib/output.js";
import { completionProfileCacheKey, resolveProjectForTenant } from "../../lib/resolve.js";
import { formatVersionLabel } from "../../lib/versions/list-format.js";
import {
  buildPublishedSpecUrls,
  extractPathsDeltaFromChangeModel,
  formatVersionsShowHumanLines,
  revisionToDisplayVersionMap,
  summarizeClassDelta,
  tagsOnRevisionFromIndex,
} from "../../lib/versions/show-format.js";
import { findSemverPredecessor, resolveVersionForShow } from "../../lib/versions/show-resolve.js";

function forkedFromDisplay(version: VersionSchema, revisionToLabel: Map<string, string>): string {
  const forkId = version.forkedFromRevisionId?.trim();
  if (forkId !== undefined && forkId !== "") {
    const lbl = version.forkSourceVersionLabel?.trim();
    if (lbl !== undefined && lbl !== "") return formatVersionLabel(lbl);
    return revisionToLabel.get(forkId) ?? `${forkId.slice(0, 8)}…`;
  }
  const parent = version.parent_version_id?.trim();
  if (parent !== undefined && parent !== "") return formatVersionLabel(parent);
  return "no";
}

export default class VersionsShow extends BaseCommand {
  static description =
    "Show one schema revision by semver, revision UUID, or tag name (GET …/{record_id} or …/by-version/{version_id}; tags from version tags)";

  static examples = [
    "<%= config.bin %> <%= command.id %> payments-api v2.1.0",
    "<%= config.bin %> <%= command.id %> payments-api 2.1.0",
    "<%= config.bin %> --json <%= command.id %> payments-api stable",
    "<%= config.bin %> <%= command.id %> payments-api 22222222-2222-2222-2222-222222222222",
    "<%= config.bin %> --profile staging <%= command.id %> my-api next",
  ];

  static seeAlso = ["versions list", "projects show", "tenants use", "docs errors"];

  static args = {
    project: Args.string({
      description: "Project slug or UUID (uuid-shaped refs resolve as id first)",
      required: true,
    }),
    version: Args.string({
      description: "Semver string (with or without v), revision UUID, or tag name (e.g. stable)",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const tenant = this.context.tenantSlug;
    if (tenant === undefined || tenant === "") {
      throw new ObjectifiedCliError({
        message:
          "Tenant slug is required for this command. Pass --tenant, set OBJECTIFIED_TENANT, or configure tenant_slug for your profile.",
        exitCode: EXIT_CODES.CONFIG,
        title: "Configuration error",
        hint: "Run `objectified tenants use <slug>` to save a default tenant, or `objectified tenants list` to see accessible tenants.",
      });
    }

    const rawProjectArg = this.commandArgs.project;
    const projectArg = typeof rawProjectArg === "string" ? rawProjectArg : "";
    const rawVersionArg = this.commandArgs.version;
    const versionArg = typeof rawVersionArg === "string" ? rawVersionArg : "";

    this.ensureAuthenticated();

    const profileKey = completionProfileCacheKey({
      baseUrl: this.context.baseUrl,
      profile: this.context.profile,
      tenantSlug: tenant,
    });

    const project = await resolveProjectForTenant(this.api, tenant, projectArg, profileKey);

    const [projectVersions, tags] = await Promise.all([
      this.api.listVersions(tenant, project.id),
      this.api.listVersionTags(tenant, project.id),
    ]);

    const { version, resolution } = await resolveVersionForShow({
      api: this.api,
      tenantSlug: tenant,
      projectId: project.id,
      rawRef: versionArg,
      tags,
    });

    const predecessor = findSemverPredecessor(projectVersions, version.version_id);
    const predecessorLabel =
      predecessor === undefined ? undefined : formatVersionLabel(predecessor.version_id);

    let compatibility = null;
    if (predecessor !== undefined) {
      compatibility = await this.api.checkRevisionCompatibility(tenant, project.id, {
        baseRevisionId: predecessor.id,
        headRevisionId: version.id,
      });
    }

    let classDelta;
    if (predecessor !== undefined) {
      const [baseClasses, headClasses] = await Promise.all([
        this.api.listClasses(tenant, predecessor.id),
        this.api.listClasses(tenant, version.id),
      ]);
      classDelta = summarizeClassDelta(baseClasses, headClasses);
    }

    const changeReport = await this.api.tryGetVersionChangeReport(tenant, project.id, version.id);
    const pathsDelta = extractPathsDeltaFromChangeModel(
      changeReport?.changeModelJson as Record<string, unknown> | undefined,
    );

    const revisionMap = revisionToDisplayVersionMap(projectVersions);
    const forked = forkedFromDisplay(version, revisionMap);

    const specUrls = buildPublishedSpecUrls({
      baseUrl: this.context.baseUrl,
      tenantSlug: tenant,
      projectSlug: project.slug,
      versionSlug: version.version_id,
    });

    const tagsOnRevision = tagsOnRevisionFromIndex(tags, version.id);

    if (this.context.json) {
      const composite: Record<string, unknown> = {
        ...(version as Record<string, unknown>),
        compatibility_summary: compatibility,
        spec_urls: specUrls,
      };
      if (resolution.kind === "tag") {
        composite.tag_resolution = {
          tag: resolution.tagName,
          resolved_version_id: resolution.resolvedVersionId,
        };
      }
      this.output.json(stableDeepSort(composite));
      return;
    }

    const c = chalkForContext(this.context.color);
    const langAscii = localePrefersAsciiTable(process.env);
    const separator = langAscii ? "-".repeat(62) : "─".repeat(62);
    const starGlyph = langAscii ? "*" : "★";

    const lines = formatVersionsShowHumanLines({
      projectName: project.name.trim() !== "" ? project.name : project.slug,
      version,
      tagsOnRevision,
      resolution,
      predecessorLabel,
      compatibility,
      classDelta,
      pathsDelta:
        pathsDelta !== undefined && predecessorLabel !== undefined ? pathsDelta : undefined,
      forkedFromDisplay: forked,
      specUrls,
      separator,
      titleBold: (s) => c.bold(s),
      starGlyph,
    });
    for (const line of lines) {
      this.output.text(line);
    }
  }
}
