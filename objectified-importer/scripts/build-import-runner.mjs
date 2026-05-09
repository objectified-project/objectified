import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(root, 'src/runner/cli.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(root, 'dist/run-cli.mjs'),
  external: ['pg'],
  packages: 'external',
});
