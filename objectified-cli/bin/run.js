#!/usr/bin/env node

import { execute } from "@oclif/core";

import { promoteLeadingGlobalFlags } from "../dist/lib/normalize-argv.js";

await execute({
  dir: import.meta.url,
  args: promoteLeadingGlobalFlags(process.argv.slice(2)),
});
