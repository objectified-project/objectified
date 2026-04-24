import path from 'path';
import YAML from 'yaml';

export interface RepositoryResolverRefFile {
  path: string;
  content: string;
}

export interface ResolveRepositoryCrossFileRefsInput {
  source: string;
  content: string;
  refs: RepositoryResolverRefFile[];
}

const MAX_PASSES_PER_DOCUMENT = 2048;

export function resolveRepositoryCrossFileRefs(input: ResolveRepositoryCrossFileRefsInput): string {
  const sourcePath = normalizeSourcePath(input.source);
  const virtualFs = buildVirtualFs(sourcePath, input.content, input.refs);
  const resolutionOrder = computeResolutionOrder(virtualFs);
  const resolvedDocs = new Map<string, unknown>();

  for (const filePath of resolutionOrder) {
    const originalDoc = virtualFs.get(filePath);
    if (originalDoc === undefined) {
      throw new Error(`Missing virtual filesystem entry for '${filePath}'.`);
    }
    resolvedDocs.set(
      filePath,
      resolveDocumentRefs({
        filePath,
        document: originalDoc,
        resolvedDocs,
      })
    );
  }

  const resolvedRoot = resolvedDocs.get(sourcePath);
  if (resolvedRoot === undefined) {
    throw new Error(`Unable to resolve root document '${sourcePath}'.`);
  }

  return shouldSerializeAsJson(input.content)
    ? JSON.stringify(resolvedRoot, null, 2)
    : YAML.stringify(resolvedRoot);
}

function buildVirtualFs(
  sourcePath: string,
  sourceContent: string,
  refs: RepositoryResolverRefFile[]
): Map<string, unknown> {
  const fsMap = new Map<string, unknown>();
  fsMap.set(sourcePath, parseSpecDocument(sourceContent, sourcePath));

  for (const ref of refs) {
    const normalizedPath = normalizeVirtualPath(ref.path);
    if (!normalizedPath) {
      continue;
    }
    if (!fsMap.has(normalizedPath)) {
      fsMap.set(normalizedPath, parseSpecDocument(ref.content, normalizedPath));
    }
  }

  return fsMap;
}

function computeResolutionOrder(virtualFs: Map<string, unknown>): string[] {
  const reverseDependencies = new Map<string, Set<string>>();
  const pendingDependencyCount = new Map<string, number>();

  for (const [filePath, document] of virtualFs.entries()) {
    const refs = collectExternalRefTargets(document, filePath);
    const existingTargets = [...refs].filter((target) => virtualFs.has(target));
    const dependencySet = new Set(existingTargets);
    pendingDependencyCount.set(filePath, dependencySet.size);

    for (const target of dependencySet) {
      const reverse = reverseDependencies.get(target) ?? new Set<string>();
      reverse.add(filePath);
      reverseDependencies.set(target, reverse);
    }
  }

  const queue = [...pendingDependencyCount.entries()]
    .filter(([, depCount]) => depCount === 0)
    .map(([filePath]) => filePath)
    .sort((a, b) => a.localeCompare(b));
  const ordered: string[] = [];
  let index = 0;

  while (index < queue.length) {
    const current = queue[index];
    index += 1;
    ordered.push(current);

    const dependents = [...(reverseDependencies.get(current) ?? new Set<string>())].sort((a, b) =>
      a.localeCompare(b)
    );
    for (const dependent of dependents) {
      const nextCount = (pendingDependencyCount.get(dependent) ?? 0) - 1;
      pendingDependencyCount.set(dependent, nextCount);
      if (nextCount === 0) {
        queue.push(dependent);
      }
    }
  }

  if (ordered.length !== virtualFs.size) {
    const cycleMembers = [...pendingDependencyCount.entries()]
      .filter(([, depCount]) => depCount > 0)
      .map(([filePath]) => filePath)
      .sort((a, b) => a.localeCompare(b));
    throw new Error(`Cross-file $ref cycle detected: ${cycleMembers.join(' -> ')} -> ${cycleMembers[0]}`);
  }

  return ordered;
}

function resolveDocumentRefs(input: {
  filePath: string;
  document: unknown;
  resolvedDocs: Map<string, unknown>;
}): unknown {
  const workingRoot = deepClone(input.document);
  const rootHolder: { value: unknown } = { value: workingRoot };
  const externalMemo = new Map<string, unknown>();
  let pass = 0;

  while (pass < MAX_PASSES_PER_DOCUMENT) {
    let refsResolved = 0;
    const stack: Array<{ holder: Record<string, unknown>; key: string }> = [{ holder: rootHolder, key: 'value' }];

    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) {
        continue;
      }

      const value = item.holder[item.key];
      if (!isObject(value)) {
        continue;
      }

      if (typeof value.$ref === 'string') {
        const parsedRef = parseRef(value.$ref);
        const targetPath = parsedRef.filePath
          ? normalizeVirtualPath(parsedRef.filePath, path.posix.dirname(input.filePath))
          : input.filePath;
        const memoKey = parsedRef.filePath ? `${targetPath}#${parsedRef.fragment}` : null;

        let replacement: unknown;
        if (memoKey && externalMemo.has(memoKey)) {
          replacement = deepClone(externalMemo.get(memoKey));
        } else {
          const targetDocument = input.resolvedDocs.get(targetPath);
          if (targetDocument === undefined) {
            throw new Error(`Unable to resolve $ref '${value.$ref}' from '${input.filePath}': missing '${targetPath}'.`);
          }

          replacement = deepClone(resolveJsonPointer(targetDocument, parsedRef.fragment, targetPath, value.$ref));
          if (memoKey) {
            externalMemo.set(memoKey, deepClone(replacement));
          }
        }

        item.holder[item.key] = replacement;
        refsResolved += 1;
        continue;
      }

      if (Array.isArray(value)) {
        for (let idx = value.length - 1; idx >= 0; idx -= 1) {
          const key = String(idx);
          stack.push({ holder: value as unknown as Record<string, unknown>, key });
        }
        continue;
      }

      const entries = Object.keys(value).sort((a, b) => b.localeCompare(a));
      for (const key of entries) {
        stack.push({ holder: value as Record<string, unknown>, key });
      }
    }

    if (refsResolved === 0) {
      return rootHolder.value;
    }
    pass += 1;
  }

  throw new Error(`Unable to fully resolve $ref values in '${input.filePath}': maximum pass limit reached.`);
}

function collectExternalRefTargets(document: unknown, basePath: string): Set<string> {
  const targets = new Set<string>();
  const stack: unknown[] = [document];

  while (stack.length > 0) {
    const value = stack.pop();
    if (!isObject(value)) {
      continue;
    }

    if (typeof value.$ref === 'string') {
      const parsedRef = parseRef(value.$ref);
      if (parsedRef.filePath) {
        targets.add(normalizeVirtualPath(parsedRef.filePath, path.posix.dirname(basePath)));
      }
    }

    if (Array.isArray(value)) {
      for (let idx = value.length - 1; idx >= 0; idx -= 1) {
        stack.push(value[idx]);
      }
      continue;
    }

    for (const key of Object.keys(value)) {
      stack.push((value as Record<string, unknown>)[key]);
    }
  }

  return targets;
}

function parseSpecDocument(content: string, filePath: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error(`Cannot resolve refs in '${filePath}': file content is empty.`);
  }

  try {
    return YAML.parse(trimmed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown parse error';
    throw new Error(`Failed to parse '${filePath}' while resolving refs: ${message}`);
  }
}

function parseRef(ref: string): { filePath: string; fragment: string } {
  const hashIndex = ref.indexOf('#');
  if (hashIndex < 0) {
    return { filePath: ref, fragment: '' };
  }
  return {
    filePath: ref.slice(0, hashIndex),
    fragment: ref.slice(hashIndex + 1),
  };
}

function normalizeSourcePath(source: string): string {
  if (source.startsWith('repository://')) {
    return normalizeVirtualPath(source.slice('repository://'.length));
  }
  return normalizeVirtualPath(source);
}

function normalizeVirtualPath(rawPath: string, baseDir?: string): string {
  const stripped = rawPath.trim();
  if (!stripped) {
    return '';
  }

  const withoutScheme = stripped.startsWith('repository://')
    ? stripped.slice('repository://'.length)
    : stripped;

  const resolved = withoutScheme.startsWith('/')
    ? path.posix.normalize(withoutScheme.slice(1))
    : path.posix.normalize(path.posix.join(baseDir ?? '', withoutScheme));

  if (resolved === '..' || resolved.startsWith('../')) {
    throw new Error(`$ref path '${rawPath}' escapes the repository root.`);
  }

  return resolved.replace(/^\.\/+/, '');
}

function resolveJsonPointer(
  source: unknown,
  fragment: string,
  filePath: string,
  originalRef: string
): unknown {
  if (!fragment) {
    return source;
  }
  const normalized = fragment.startsWith('/') ? fragment : `/${fragment}`;
  const parts = normalized
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current: unknown = source;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error(`Invalid JSON pointer '${originalRef}' in '${filePath}'.`);
      }
      current = current[index];
      continue;
    }

    if (isObject(current) && Object.prototype.hasOwnProperty.call(current, part)) {
      current = (current as Record<string, unknown>)[part];
      continue;
    }

    throw new Error(`Invalid JSON pointer '${originalRef}' in '${filePath}'.`);
  }
  return current;
}

function shouldSerializeAsJson(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function deepClone<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
