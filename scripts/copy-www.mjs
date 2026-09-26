// Copies the static web app into www/ for Capacitor.
// Usage: node scripts/copy-www.mjs
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "www");

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const items = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "css",
  "js",
  "data",
];
for (const item of items) {
  cpSync(join(root, item), join(www, item), { recursive: true });
}
console.log("www/ listo:", items.join(", "));
