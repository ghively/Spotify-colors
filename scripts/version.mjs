import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const out = resolve(root, "public/version.json");

const payload = {
  version: pkg.version,
  builtAt: new Date().toISOString(),
};

writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
console.log(`wrote ${out}: ${JSON.stringify(payload)}`);
