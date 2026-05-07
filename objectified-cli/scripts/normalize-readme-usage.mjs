#!/usr/bin/env node
/**
 * `oclif readme` injects the machine-specific `--version` line (platform + Node patch).
 * Normalize it so README.md is identical across CI vs developer laptops (see workflow git diff).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const path = join(root, "README.md");
let readme = readFileSync(path, "utf8");

const pattern = /^objectified-cli\/[\d.]+\s+\S+\s+node-v[\d.]+$/gm;
const replacement = `objectified-cli/${pkg.version} <platform> node-v<major.minor.patch>`;
readme = readme.replace(pattern, replacement);
writeFileSync(path, readme);
