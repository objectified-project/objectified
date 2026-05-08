import { Ajv, type ErrorObject } from "ajv";

/**
 * JSON Schema for `objectified projects create --from-file` (#3204).
 * Top-level `domain` is an alias of `domainCategory` (UI metadata key).
 */
export const PROJECT_CREATE_FILE_SCHEMA = {
  type: "object",
  required: ["name", "slug"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    slug: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    domain: { type: "string" },
    domainCategory: { type: "string" },
    visibility: { type: "string", enum: ["private", "public"] },
    metadata: { type: "object", additionalProperties: true },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateCompiled = ajv.compile(PROJECT_CREATE_FILE_SCHEMA);

export type ProjectCreateFileShape = {
  name: string;
  slug: string;
  description?: string | null;
  domain?: string;
  domainCategory?: string;
  visibility?: "private" | "public";
  metadata?: Record<string, unknown>;
};

function formatAjvErrors(errors: ErrorObject[] | undefined | null): string {
  if (!errors?.length) return "Invalid project file.";
  return errors
    .map((e) => {
      const path = e.instancePath === "" ? "(root)" : e.instancePath;
      return `${path}: ${e.message ?? "invalid"}`;
    })
    .join("; ");
}

export function validateProjectCreateFileJson(data: unknown): ProjectCreateFileShape {
  if (!validateCompiled(data)) {
    throw new Error(formatAjvErrors(validateCompiled.errors));
  }
  return data as ProjectCreateFileShape;
}
