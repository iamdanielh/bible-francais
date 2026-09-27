// Full-corpus dead-tap scan for English. Run: node scripts/en-coverage.mjs
import { EnEngine } from "../js/en-engine.js";
import { readFileSync } from "node:fs";

const eng = new EnEngine(
  JSON.parse(readFileSync("data/en/dict.json", "utf8")),
  JSON.parse(readFileSync("data/en/names.json", "utf8")),
);
const bible = JSON.parse(readFileSync("data/en/bible.json", "utf8"));

const TRIM = /^[.,;:!?…'"“”‘’()[\]*–—-]+|[.,;:!?…'"“”‘’()[\]*–—-]+$/g;
let total = 0, nulls = 0;
const nullWords = {};
const walk = (o) => {
  if (typeof o === "string") {
    for (const t of o.split(/\s+/)) {
      const w = t.replace(TRIM, "");
      if (!w || /^\d+$/.test(w)) continue;
      total++;
      const [m, info] = eng.resolve(w);
      if (!m && !info.isName) {
        nulls++;
        const k = w.toLowerCase();
        nullWords[k] = (nullWords[k] || 0) + 1;
      }
    }
  } else if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === "object") Object.values(o).forEach(walk);
};
walk(bible);
console.log("tokens:", total, "| null (non-name):", nulls);
console.log("top nulls:",
  Object.entries(nullWords).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([w, n]) => `${w}(${n})`).join(" "));
