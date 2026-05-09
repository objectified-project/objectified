#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const bundled = path.join(root, 'dist/run-cli.mjs');

(async () => {
  if (existsSync(bundled)) {
    await import(pathToFileURL(bundled).href);
    return;
  }
  const { register } = await import('tsx/esm/api');
  register();
  await import(pathToFileURL(path.join(root, 'src/runner/cli.ts')).href);
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
