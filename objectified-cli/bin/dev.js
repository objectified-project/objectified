#!/usr/bin/env -S node --loader ts-node/esm --disable-warning=ExperimentalWarning

import { execute } from "@oclif/core";

import { promoteLeadingGlobalFlags } from "../src/lib/normalize-argv.js";

await execute({
  development: true,
  dir: import.meta.url,
  args: promoteLeadingGlobalFlags(process.argv.slice(2)),
});
