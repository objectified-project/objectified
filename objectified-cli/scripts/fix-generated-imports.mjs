import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const genRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "generated");

function walkTs(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkTs(p));
    else if (ent.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Append `.js` to relative specifiers for NodeNext / `moduleResolution: NodeNext`. */
function patchSource(content) {
  return content.replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/g, (full, q, spec) => {
    if (spec.endsWith(".js")) return full;
    return `from ${q}${spec}.js${q}`;
  });
}

for (const file of walkTs(genRoot)) {
  const before = fs.readFileSync(file, "utf8");
  let after = patchSource(before);
  const base = path.basename(file);
  if (base === "sdk.gen.ts" || base === "client.gen.ts") {
    after = after
      .replaceAll("from './client.js'", "from './client/index.js'")
      .replaceAll('from "./client.js"', 'from "./client/index.js"');
  }
  if (before !== after) fs.writeFileSync(file, after, "utf8");
}
