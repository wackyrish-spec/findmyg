// Build guard: fail when a rendered page shows a broken value (∞, NaN, undefined, null, Infinity) in visible text or attributes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : []; });
const BAD = /∞|\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/;
const hits = [];
for (const f of walk("dist")) {
  const html = readFileSync(f, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const m = html.match(BAD);
  if (m) hits.push(`${f}: "${m[0]}" near "${html.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")}"`);
}
if (hits.length) { console.error(`check-html: ${hits.length} page(s) show a broken value:\n` + hits.slice(0, 20).join("\n")); process.exit(1); }
console.log("check-html: no broken values in rendered pages");
