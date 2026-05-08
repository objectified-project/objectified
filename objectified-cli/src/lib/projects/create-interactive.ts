import { confirm, input, select } from "@inquirer/prompts";

import { ObjectifiedCliError } from "../errors.js";
import { EXIT_CODES } from "../exit-codes.js";

import { PROJECT_DOMAIN_CATEGORY_NONE, PROJECT_DOMAIN_CHOICES } from "./domain-categories.js";
import type { Visibility } from "./project-create-body.js";
import { suggestSlugFromName, validateProjectSlug } from "./project-slug.js";

export type InteractiveProjectDraft = {
  name: string;
  slug: string;
  description: string;
  domainCategory: string;
  /** Set only when the user passed `--visibility` on the CLI. */
  visibility?: Visibility;
};

export async function promptProjectCreateInteractive(opts: {
  draft: InteractiveProjectDraft;
  domainAllowlist: Set<string>;
  skipFinalConfirm: boolean;
  promptDescription: boolean;
  promptDomain: boolean;
  promptVisibility: boolean;
}): Promise<InteractiveProjectDraft & { visibility: Visibility }> {
  const out: InteractiveProjectDraft = { ...opts.draft };

  if (out.name.trim() === "") {
    const v = await input({
      message: "Name:",
      validate: (x) => (x.trim() === "" ? "Name is required" : true),
    });
    out.name = v.trim();
  }

  if (out.slug.trim() === "") {
    const defaultSlug = suggestSlugFromName(out.name);
    const raw = await input({
      message: "Slug:",
      default: defaultSlug,
      validate: (x) => {
        const r = validateProjectSlug(x);
        if (r.ok) return true;
        return r.suggestion !== undefined ? `${r.message} Suggested: ${r.suggestion}` : r.message;
      },
    });
    const again = validateProjectSlug(raw);
    out.slug = again.ok ? again.slug : suggestSlugFromName(out.name);
  }

  if (opts.promptDescription) {
    const v = await input({
      message: "Description:",
      default: out.description,
    });
    out.description = v;
  }

  if (opts.promptDomain && out.domainCategory.trim() === "") {
    const knownIds = new Set(PROJECT_DOMAIN_CHOICES.map((c) => c.id));
    // Any ids returned by the API that are not in the static catalog are shown
    // using just the id as the label — they have no local descriptive text.
    const extraChoices = Array.from(opts.domainAllowlist)
      .filter((id) => !knownIds.has(id))
      .sort()
      .map((id) => ({ value: id, name: id }));
    const choices = [
      { value: PROJECT_DOMAIN_CATEGORY_NONE, name: "(none)" },
      ...PROJECT_DOMAIN_CHOICES.filter((c) => opts.domainAllowlist.has(c.id)).map((c) => ({
        value: c.id,
        name: `${c.id} — ${c.label}`,
      })),
      ...extraChoices,
    ];
    const picked = await select({
      message: "Domain:",
      choices,
    });
    out.domainCategory = picked;
  }

  let visibility: Visibility = opts.draft.visibility ?? "private";
  if (opts.promptVisibility) {
    visibility = await select({
      message: "Visibility:",
      choices: [
        { value: "private" as const, name: "private" },
        { value: "public" as const, name: "public" },
      ],
      default: "private",
    });
  }

  if (!opts.skipFinalConfirm) {
    const ok = await confirm({
      message: "Create now?",
      default: true,
    });
    if (!ok) {
      throw new ObjectifiedCliError({
        message: "Project creation aborted.",
        exitCode: EXIT_CODES.MISUSE,
        title: "Aborted",
      });
    }
  }

  return { ...out, visibility };
}
