import { runStdioImportCli } from './index';

const code = await runStdioImportCli({
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exitCode = code;
