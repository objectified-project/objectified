/**
 * Controls for `objectified schema swagger` (browser vs bundle download).
 *
 * Default: when stdout is a TTY and the user did not pass `--output` or `--format`,
 * open the hosted Swagger UI URL (interactive viewing). When stdout is not a TTY,
 * emit the published OpenAPI JSON bundle for piping (clig.dev-style).
 */
export function resolveSchemaSwaggerModes(opts: {
  stdoutIsTTY: boolean;
  /** When true (`--json` / OBJECTIFIED_JSON), skip the interactive default even if stdout is a TTY. */
  machineOutput: boolean;
  openFlag: boolean;
  outputPath: string;
  formatProvided: boolean;
}): { openBrowser: boolean; writeBundle: boolean } {
  const hasOutput = opts.outputPath.trim() !== "";
  const conversationalDefault =
    opts.stdoutIsTTY && !opts.machineOutput && !hasOutput && !opts.formatProvided;
  const openBrowser = opts.openFlag || conversationalDefault;
  const writeBundle = hasOutput || opts.formatProvided || !openBrowser;
  return { openBrowser, writeBundle };
}
