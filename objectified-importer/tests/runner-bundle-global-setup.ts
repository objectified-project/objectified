import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Builds `dist/run-cli.mjs` before tests so spawn-based runner tests match production resolution (#3304).
 */
export default function runnerBundleGlobalSetup(): void {
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const script = path.join(pkgRoot, 'scripts/build-import-runner.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: pkgRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`scripts/build-import-runner.mjs failed with exit ${result.status}`);
  }
}
