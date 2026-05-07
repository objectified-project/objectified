export { BaseCommand } from "./base-command.js";
export { EXIT_CODES, exitCodeReferenceJson, formatExitCodeDocs } from "./lib/exit-codes.js";
export {
  CliError,
  httpStatusToCliError,
  networkErrnoToCliError,
  ObjectifiedCliError,
} from "./lib/errors.js";
export {
  cliFailureJsonEnvelope,
  formatAndReportCliFailure,
  handleError,
  resolveDebugStacks,
  resolveEffectiveExitCode,
  truncateRequestId,
} from "./lib/handle-error.js";
