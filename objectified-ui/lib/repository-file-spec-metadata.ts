import YAML from 'yaml';

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
]);

export type RepositorySpecFormat =
  | 'openapi'
  | 'swagger2'
  | 'asyncapi'
  | 'arazzo'
  | 'json_schema'
  | 'graphql'
  | 'unknown';

export type ParsedRepositorySpecMetadata = {
  format: RepositorySpecFormat;
  /** Human-readable spec line, e.g. "OpenAPI 3.1.0" or "AsyncAPI 2.6.0". */
  spec: string | null;
  title: string | null;
  /** Product / API version (e.g. OpenAPI `info.version`). */
  version: string | null;
  /** Path operations (OpenAPI/Swagger), channel ops (AsyncAPI), workflows (Arazzo), root fields (GraphQL), or null. */
  endpoints: number | null;
  /** Named reusable definitions (OpenAPI `components.*`, AsyncAPI `components.*`, JSON Schema `$defs` / `definitions`). */
  components: number | null;
  /** Server entries (OpenAPI `servers`, AsyncAPI `servers`); Swagger uses schemes/host heuristic. */
  servers: number | null;
  parseError: string | null;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function parseYamlOrJson(content: string, path: string): { root: unknown } | { error: string } {
  const t = content.trim();
  if (!t) return { error: 'Empty file' };
  const lowerPath = path.toLowerCase();
  const preferJson = lowerPath.endsWith('.json') || lowerPath.endsWith('.avsc');

  if (preferJson && (t.startsWith('{') || t.startsWith('['))) {
    try {
      return { root: JSON.parse(t) as unknown };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }

  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return { root: JSON.parse(t) as unknown };
    } catch {
      /* fall through */
    }
  }

  try {
    const root = YAML.parse(t);
    return { root };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid YAML' };
  }
}

function countOpenApiStyleOperations(pathsLike: unknown): number {
  if (!pathsLike || typeof pathsLike !== 'object' || Array.isArray(pathsLike)) return 0;
  let n = 0;
  for (const item of Object.values(pathsLike as Record<string, unknown>)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (HTTP_METHODS.has(k.toLowerCase()) && v != null && typeof v === 'object') n++;
    }
  }
  return n;
}

function countOpenApiComponents(components: unknown): number {
  if (!components || typeof components !== 'object' || Array.isArray(components)) return 0;
  let total = 0;
  for (const bucket of Object.values(components as Record<string, unknown>)) {
    if (bucket && typeof bucket === 'object' && !Array.isArray(bucket)) {
      total += Object.keys(bucket as Record<string, unknown>).length;
    }
  }
  return total;
}

function countSwagger2Components(root: Record<string, unknown>): number {
  let n = 0;
  for (const key of ['definitions', 'parameters', 'responses', 'securityDefinitions']) {
    const b = root[key];
    if (b && typeof b === 'object' && !Array.isArray(b)) {
      n += Object.keys(b as Record<string, unknown>).length;
    }
  }
  return n;
}

function countOpenApiServers(root: Record<string, unknown>): number {
  const servers = root.servers;
  if (Array.isArray(servers)) return servers.length;
  if (servers && typeof servers === 'object' && !Array.isArray(servers)) return 1;
  return 0;
}

function countSwagger2Servers(root: Record<string, unknown>): number {
  const schemes = root.schemes;
  if (Array.isArray(schemes) && schemes.length > 0) return schemes.length;
  const host = str(root.host);
  return host ? 1 : 0;
}

function parseOpenApi(root: Record<string, unknown>): ParsedRepositorySpecMetadata {
  const ver = str(root.openapi);
  const spec = ver ? `OpenAPI ${ver}` : 'OpenAPI';
  const info = root.info && typeof root.info === 'object' ? (root.info as Record<string, unknown>) : {};
  let endpoints = countOpenApiStyleOperations(root.paths);
  if (root.webhooks && typeof root.webhooks === 'object' && !Array.isArray(root.webhooks)) {
    endpoints += countOpenApiStyleOperations(root.webhooks);
  }
  const components = countOpenApiComponents(root.components);
  const servers = countOpenApiServers(root);
  return {
    format: 'openapi',
    spec,
    title: str(info.title),
    version: str(info.version),
    endpoints,
    components,
    servers,
    parseError: null,
  };
}

function parseSwagger2(root: Record<string, unknown>): ParsedRepositorySpecMetadata {
  const info = root.info && typeof root.info === 'object' ? (root.info as Record<string, unknown>) : {};
  return {
    format: 'swagger2',
    spec: 'Swagger 2.0',
    title: str(info.title),
    version: str(info.version),
    endpoints: countOpenApiStyleOperations(root.paths),
    components: countSwagger2Components(root),
    servers: countSwagger2Servers(root),
    parseError: null,
  };
}

function countAsyncApiChannelOperations(channels: unknown): number {
  if (!channels || typeof channels !== 'object' || Array.isArray(channels)) return 0;
  let n = 0;
  for (const ch of Object.values(channels as Record<string, unknown>)) {
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) continue;
    const o = ch as Record<string, unknown>;
    if (o.subscribe != null && typeof o.subscribe === 'object') n++;
    if (o.publish != null && typeof o.publish === 'object') n++;
  }
  return n;
}

function countAsyncApiComponents(components: unknown): number {
  return countOpenApiComponents(components);
}

function countAsyncApiServers(servers: unknown): number {
  if (Array.isArray(servers)) return servers.length;
  if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
    return Object.keys(servers as Record<string, unknown>).length;
  }
  return 0;
}

function parseAsyncApi(root: Record<string, unknown>): ParsedRepositorySpecMetadata {
  const ver = str(root.asyncapi);
  const spec = ver ? `AsyncAPI ${ver}` : 'AsyncAPI';
  const info = root.info && typeof root.info === 'object' ? (root.info as Record<string, unknown>) : {};
  return {
    format: 'asyncapi',
    spec,
    title: str(info.title),
    version: str(info.version),
    endpoints: countAsyncApiChannelOperations(root.channels),
    components: countAsyncApiComponents(root.components),
    servers: countAsyncApiServers(root.servers),
    parseError: null,
  };
}

function parseArazzo(root: Record<string, unknown>): ParsedRepositorySpecMetadata {
  const ver = str(root.arazzo);
  const spec = ver ? `Arazzo ${ver}` : 'Arazzo';
  const info = root.info && typeof root.info === 'object' ? (root.info as Record<string, unknown>) : {};
  const workflows = root.workflows;
  let wfCount = 0;
  if (workflows && typeof workflows === 'object' && !Array.isArray(workflows)) {
    wfCount = Object.keys(workflows as Record<string, unknown>).length;
  }
  return {
    format: 'arazzo',
    spec,
    title: str(info.title) ?? str(info.summary),
    version: str(info.version),
    endpoints: wfCount,
    components: countOpenApiComponents(root.components),
    servers: countAsyncApiServers(root.servers),
    parseError: null,
  };
}

function jsonSchemaTitle(root: Record<string, unknown>): string | null {
  return str(root.title) ?? str(root['x-title']);
}

function countJsonSchemaDefs(root: Record<string, unknown>): number {
  const defs = root.$defs ?? root.definitions;
  if (defs && typeof defs === 'object' && !Array.isArray(defs)) {
    return Object.keys(defs as Record<string, unknown>).length;
  }
  return 0;
}

function parseJsonSchema(root: Record<string, unknown>): ParsedRepositorySpecMetadata {
  const schemaUri = str(root.$schema);
  const id = str(root.$id);
  const spec =
    schemaUri && schemaUri.includes('json-schema')
      ? `JSON Schema (${schemaUri.split('/').pop() ?? schemaUri})`
      : id
        ? `JSON Schema (${id})`
        : 'JSON Schema';
  return {
    format: 'json_schema',
    spec,
    title: jsonSchemaTitle(root),
    version: str(root.version),
    endpoints: null,
    components: countJsonSchemaDefs(root),
    servers: null,
    parseError: null,
  };
}

function extractGraphqlTypeBody(content: string, typeName: string): string | null {
  const re = new RegExp(`\\b(?:extend\\s+)?type\\s+${typeName}\\s*\\{`, 'm');
  const m = content.match(re);
  if (!m || m.index === undefined) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i;
  while (i < content.length && depth > 0) {
    const c = content[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth === 0) return content.slice(start, i);
    i++;
  }
  return null;
}

function countGraphqlFieldsInBlock(block: string): number {
  let n = 0;
  const lines = block.split('\n');
  const skip = new Set([
    'implements',
    'repeatable',
    'extend',
    'scalar',
    'type',
    'enum',
    'input',
    'interface',
    'union',
    'directive',
    'schema',
  ]);
  for (const raw of lines) {
    const line = raw.replace(/#[^\n]*$/, '').trim();
    if (!line || line.startsWith('@') || line.startsWith('"') || line.startsWith("'")) continue;
    const mm = /^([A-Za-z_][\w]*)\s*[:(]/.exec(line);
    if (mm && !skip.has(mm[1].toLowerCase())) n++;
  }
  return n;
}

function parseGraphqlSdl(content: string): ParsedRepositorySpecMetadata {
  let endpoints = 0;
  for (const t of ['Query', 'Mutation', 'Subscription']) {
    const body = extractGraphqlTypeBody(content, t);
    if (body) endpoints += countGraphqlFieldsInBlock(body);
  }
  return {
    format: 'graphql',
    spec: 'GraphQL SDL',
    title: null,
    version: null,
    endpoints: endpoints > 0 ? endpoints : null,
    components: null,
    servers: null,
    parseError: null,
  };
}

function isLikelyJsonSchema(root: Record<string, unknown>): boolean {
  if (root.$schema != null && typeof root.$schema === 'string' && root.$schema.includes('json-schema')) return true;
  if (root.$defs != null && typeof root.$defs === 'object') return true;
  if (
    root.definitions != null &&
    typeof root.definitions === 'object' &&
    root.$schema != null &&
    typeof root.$schema === 'string'
  ) {
    return true;
  }
  return false;
}

function isLikelyGraphQl(content: string, root: unknown): boolean {
  if (root && typeof root === 'object') return false;
  const t = content.trim();
  if (!t) return false;
  if (/\b(type|extend)\s+(Query|Mutation|Subscription)\s*\{/m.test(t)) return true;
  if (/^\s*"""[\s\S]*"""\s*\n\s*type\s+\w+/m.test(t)) return true;
  return false;
}

function unknownMeta(error: string | null): ParsedRepositorySpecMetadata {
  return {
    format: 'unknown',
    spec: null,
    title: null,
    version: null,
    endpoints: null,
    components: null,
    servers: null,
    parseError: error,
  };
}

/**
 * Best-effort client-side parse of API specification metadata for the repository file detail panel.
 */
export function parseRepositoryFileSpecMetadata(content: string, path: string): ParsedRepositorySpecMetadata {
  if (!content.trim()) {
    return unknownMeta(null);
  }

  const parsed = parseYamlOrJson(content, path);
  if ('error' in parsed) {
    if (isLikelyGraphQl(content, null)) {
      try {
        return parseGraphqlSdl(content);
      } catch {
        return unknownMeta(parsed.error);
      }
    }
    return unknownMeta(parsed.error);
  }

  const root = parsed.root;
  if (root == null || typeof root !== 'object' || Array.isArray(root)) {
    if (typeof root === 'string' && isLikelyGraphQl(root, null)) {
      return parseGraphqlSdl(root);
    }
    if (isLikelyGraphQl(content, null)) return parseGraphqlSdl(content);
    return unknownMeta('Document is not a mapping object');
  }

  const doc = root as Record<string, unknown>;

  if (doc.openapi != null && (typeof doc.openapi === 'string' || typeof doc.openapi === 'number')) {
    return parseOpenApi(doc);
  }
  const swaggerVer = str(doc.swagger);
  if (swaggerVer && swaggerVer.startsWith('2.')) {
    return parseSwagger2(doc);
  }
  if (doc.asyncapi != null) {
    return parseAsyncApi(doc);
  }
  if (doc.arazzo != null) {
    return parseArazzo(doc);
  }
  if (isLikelyJsonSchema(doc)) {
    return parseJsonSchema(doc);
  }
  if (isLikelyGraphQl(content, root)) {
    return parseGraphqlSdl(content);
  }

  return unknownMeta(null);
}

export function formatMetadataCell(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString();
}
