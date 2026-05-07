import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const genDir = path.join(pkgRoot, "src", "generated");

const models = `/** Auto-generated barrel — do not edit. Run \`yarn codegen\`. */
export type * from "./types.gen.js";
`;

const operations = `/** Auto-generated barrel — do not edit. Run \`yarn codegen\`. */
export * from "./sdk.gen.js";
`;

const client = `/** Auto-generated barrel — do not edit. Run \`yarn codegen\`. */
export * from "./client/index.js";
export type { Client as ObjectifiedClient } from "./client/types.js";
`;

fs.writeFileSync(path.join(genDir, "models.ts"), models, "utf8");
fs.writeFileSync(path.join(genDir, "operations.ts"), operations, "utf8");
fs.writeFileSync(path.join(genDir, "client.ts"), client, "utf8");
