import type { Command } from "@oclif/core";

/** Normal informational line (TTY-aware formatting comes with output modes in #3189). */
export function logInfo(cmd: Command, message: string): void {
  cmd.log(message);
}
