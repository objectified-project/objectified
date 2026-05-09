import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * createRequire(import.meta.url) breaks Jest (import.meta in a CJS-emitted graph).
 * Resolve a real file under this package from various process.cwd() values (UI tests,
 * importer Vitest, turbo/Next), then load the UI db pool via require.
 */
export function createImporterEngineRequire(): ReturnType<typeof createRequire> {
  const candidates = [
    join(process.cwd(), 'objectified-importer', 'src', 'engine', 'import-transaction.ts'),
    join(process.cwd(), '..', 'objectified-importer', 'src', 'engine', 'import-transaction.ts'),
    join(process.cwd(), 'src', 'engine', 'import-transaction.ts'),
  ];
  const anchor = candidates.find((p) => existsSync(p));
  if (!anchor) {
    throw new Error(
      `objectified-importer: cannot resolve engine anchor from cwd=${process.cwd()}`
    );
  }
  return createRequire(anchor);
}
