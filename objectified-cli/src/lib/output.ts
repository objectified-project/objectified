import chalk, { Chalk, type ChalkInstance } from "chalk";

export type OutputCapableCommand = {
  flags: { quiet?: boolean };
  context: { json: boolean; color: boolean };
  log: (msg?: string, ...args: unknown[]) => void;
};

function chalkIf(color: boolean): ChalkInstance {
  return color ? chalk : new Chalk({ level: 0 });
}

/** Normal informational line (respects --quiet and JSON mode). */
export function logInfo(cmd: OutputCapableCommand, message: string): void {
  if (cmd.flags.quiet) return;
  if (cmd.context.json) return;
  cmd.log(chalkIf(cmd.context.color).bold(message));
}

/** Structured stdout for JSON mode (single JSON object per invocation). */
export function writeJsonLine(cmd: Pick<OutputCapableCommand, "context">, payload: unknown): void {
  if (!cmd.context.json) return;
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}
