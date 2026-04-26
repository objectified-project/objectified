/**
 * Per-class spec dispatcher used by `ClassSpecViewer`.
 *
 * The studio code page (`/ade/studio/code`) already drives the project-wide
 * version of this — we lean on the same generators but slice the input down
 * to the selected class plus its transitive class refs so the right rail
 * shows a self-contained document.
 *
 * Each generator's behavior:
 *
 *   - OpenAPI uses `generateClassOpenApiSpec`, which already walks refs
 *     internally and returns a JS object — we just stringify it.
 *   - AsyncAPI / GraphQL / SQL / JSON Schema all take a `classes` array and
 *     don't follow refs, so we walk them ourselves with `findReferencedClasses`
 *     and prepend the dependencies.
 *   - Arazzo is workflow-scoped: a workflow per class. We pass *only* the
 *     selected class so the document doesn't bloom with unrelated workflows.
 *
 * Returning `{ content, language }` keeps the viewer purely visual — it
 * doesn't care about which generator ran, just hands the string to Monaco.
 */

import YAML from 'yaml';
import {
  findReferencedClasses,
  generateClassOpenApiSpec,
} from '@/app/utils/openapi';
import { generateArazzoSpec } from '@/app/utils/arazzo';
import { generateJsonSchema } from '@/app/utils/jsonschema';
import { generateAsyncAPISpec } from '@/app/utils/asyncapi-generator';
import { generateGraphQLSchema } from '@/app/utils/graphql';
import { generateSQL } from '@/app/utils/sql-generator';

export type SpecFormat =
  | 'openapi'
  | 'asyncapi'
  | 'arazzo'
  | 'jsonschema'
  | 'graphql'
  | 'sql';

export type Serialization = 'json' | 'yaml';

export type MonacoLanguage = 'json' | 'yaml' | 'graphql' | 'sql';

export interface SpecFormatMeta {
  id: SpecFormat;
  label: string;
  /** Default Monaco language when the user hasn't picked a serialization. */
  defaultLanguage: MonacoLanguage;
  /** Whether the user can flip between JSON and YAML. */
  supportsSerialization: boolean;
  /** File extension chunk used for downloads (no leading dot). */
  fileExtension: (s: Serialization) => string;
}

export const SPEC_FORMATS: SpecFormatMeta[] = [
  {
    id: 'openapi',
    label: 'OpenAPI',
    defaultLanguage: 'yaml',
    supportsSerialization: true,
    fileExtension: (s) => (s === 'json' ? 'json' : 'yaml'),
  },
  {
    id: 'asyncapi',
    label: 'AsyncAPI',
    defaultLanguage: 'yaml',
    supportsSerialization: true,
    fileExtension: (s) => (s === 'json' ? 'json' : 'yaml'),
  },
  {
    id: 'arazzo',
    label: 'Arazzo',
    defaultLanguage: 'yaml',
    supportsSerialization: true,
    fileExtension: (s) => (s === 'json' ? 'json' : 'yaml'),
  },
  {
    id: 'jsonschema',
    label: 'JSON Schema',
    defaultLanguage: 'json',
    supportsSerialization: false,
    fileExtension: () => 'json',
  },
  {
    id: 'graphql',
    label: 'GraphQL SDL',
    defaultLanguage: 'graphql',
    supportsSerialization: false,
    fileExtension: () => 'graphql',
  },
  {
    id: 'sql',
    label: 'SQL DDL',
    defaultLanguage: 'sql',
    supportsSerialization: false,
    fileExtension: () => 'sql',
  },
];

interface ClassLike {
  id: string;
  name: string;
  description?: string | null;
  schema?: unknown;
  properties?: Array<{
    id: string;
    name: string;
    description?: string | null;
    data?: unknown;
  }>;
}

export interface GenerateSpecArgs {
  format: SpecFormat;
  serialization: Serialization;
  selected: ClassLike;
  allClasses: ClassLike[];
  projectName: string;
  versionId: string;
}

export interface GenerateSpecResult {
  content: string;
  language: MonacoLanguage;
}

/**
 * Walks `$ref` strings on the selected class (schema + property data) and
 * follows them transitively across `allClasses`, returning the dependency
 * set in a stable, name-sorted order. The result excludes the selected
 * class itself so callers can `[selected, ...deps]` without duplication.
 */
function collectTransitiveDeps(
  selected: ClassLike,
  allClasses: ClassLike[]
): ClassLike[] {
  const byName = new Map<string, ClassLike>();
  for (const cls of allClasses) byName.set(cls.name, cls);

  const seen = new Set<string>([selected.name]);
  const queue: ClassLike[] = [selected];
  const out: ClassLike[] = [];

  while (queue.length > 0) {
    const cls = queue.shift()!;
    const refs = new Set<string>();
    const schema =
      typeof cls.schema === 'string' ? safeJsonParse(cls.schema) : cls.schema || {};
    findReferencedClasses(schema, refs);
    for (const prop of cls.properties || []) {
      const data =
        typeof prop.data === 'string' ? safeJsonParse(prop.data) : prop.data;
      findReferencedClasses(data, refs);
    }
    for (const refName of refs) {
      if (seen.has(refName)) continue;
      seen.add(refName);
      const refCls = byName.get(refName);
      if (!refCls) continue;
      out.push(refCls);
      queue.push(refCls);
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function safeJsonParse(s: unknown): unknown {
  if (typeof s !== 'string') return s;
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/**
 * Reformat a JSON spec string as YAML when the user requested YAML,
 * falling back to the original string if anything fails to parse so we
 * never strand the editor on a blank panel.
 */
function reserialize(jsonString: string, serialization: Serialization): string {
  if (serialization === 'json') return jsonString;
  try {
    return YAML.stringify(JSON.parse(jsonString));
  } catch {
    return jsonString;
  }
}

export async function generateClassSpec(
  args: GenerateSpecArgs
): Promise<GenerateSpecResult> {
  const { format, serialization, selected, allClasses, projectName, versionId } =
    args;

  const deps = collectTransitiveDeps(selected, allClasses);
  const classesForSpec = [selected, ...deps];

  switch (format) {
    case 'openapi': {
      const obj = await generateClassOpenApiSpec(selected, allClasses, {
        title: `${projectName} — ${selected.name}`,
        version: versionId,
        description: selected.description ?? undefined,
      });
      const json = JSON.stringify(obj, null, 2);
      return {
        content: reserialize(json, serialization),
        language: serialization === 'json' ? 'json' : 'yaml',
      };
    }

    case 'asyncapi': {
      const json = generateAsyncAPISpec(classesForSpec as never, {
        projectName: `${projectName} — ${selected.name}`,
        version: versionId,
        description: selected.description ?? undefined,
      });
      return {
        content: reserialize(json, serialization),
        language: serialization === 'json' ? 'json' : 'yaml',
      };
    }

    case 'arazzo': {
      const json = await generateArazzoSpec([selected], {
        projectName: `${projectName} — ${selected.name}`,
        version: versionId,
        description: selected.description ?? undefined,
      });
      return {
        content: reserialize(json, serialization),
        language: serialization === 'json' ? 'json' : 'yaml',
      };
    }

    case 'jsonschema': {
      const json = generateJsonSchema(classesForSpec, {
        projectName: `${projectName} — ${selected.name}`,
        version: versionId,
        description: selected.description ?? undefined,
      });
      return { content: json, language: 'json' };
    }

    case 'graphql': {
      const sdl = await generateGraphQLSchema(classesForSpec as never, {
        projectName: `${projectName} — ${selected.name}`,
        version: versionId,
        description: selected.description ?? undefined,
      });
      return { content: sdl, language: 'graphql' };
    }

    case 'sql': {
      const sql = generateSQL(classesForSpec, 'postgresql', {
        includeDropStatements: false,
        includeComments: true,
        schemaName: '',
        namingConvention: 'snake_case',
      });
      return { content: sql, language: 'sql' };
    }
  }
}
