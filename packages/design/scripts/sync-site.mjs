// Injects the real presets, motion presets and budgets into site/index.html
// so the design site can never drift from the code. Run: npm run site:sync
import { readFileSync, writeFileSync } from "node:fs";
import { AURAS, MOTION, budgets } from "../dist/src/design/index.js";

const file = new URL("../site/index.html", import.meta.url);
const html = readFileSync(file, "utf8");
const data = JSON.stringify({ auras: AURAS, motion: MOTION, budgets });
const out = html.replace(
  /\/\*DATA_START\*\/[\s\S]*?\/\*DATA_END\*\//,
  `/*DATA_START*/\nconst DATA = ${data};\n/*DATA_END*/`,
);
if (out === html && !html.includes(data)) throw new Error("Markers not found in site/index.html");
writeFileSync(file, out);
console.log(`Synced ${AURAS.length} auras into site/index.html`);
