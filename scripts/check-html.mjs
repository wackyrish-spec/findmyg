// Build guard: fail when a rendered page shows a broken value (∞, NaN, undefined, null, Infinity) in visible text or attributes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : []; });
const BAD = /∞|\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|weak evidence|as a candidate|(high|medium|low) confidence|that name (a|any) make|not yet analysed/i;
const CAPS_BAD = />\s*(HIGH|MEDIUM|LOW)\s*</;
// No "best" in a page title (Karim 15 Nov: raw listing names can carry it).
const TITLE_BAD = /<title>(?!Best )[^<]*\bbest\b[^<]*<\/title>/i;
// Garage cards never show the pipeline's raw asides or the garage's own claims (PM, 12 Nov).
const CARD_BAD = /% of reviews that name any make|name advertises|website says it/i;
const hits = [];
for (const f of walk("dist")) {
  const html = readFileSync(f, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const cb = html.match(CAPS_BAD);
  if (cb) hits.push(`${f}: shows "${cb[0]}"`);
  const tb = /dist\/(garage|dubai)\//.test(f) && html.match(TITLE_BAD);
  if (tb) hits.push(`${f}: title has "best": ${tb[0]}`);
  const m = html.match(BAD);
  if (m) hits.push(`${f}: "${m[0]}" near "${html.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")}"`);
  for (const c of html.match(/<article class="card gcard"[\s\S]*?<\/article>/g) || []) {
    const k = c.match(CARD_BAD);
    if (k) { hits.push(`${f}: card shows "${k[0]}" near "${c.slice(Math.max(0, k.index - 80), k.index + 40).replace(/\s+/g, " ")}"`); break; }
  }
}
if (hits.length) { console.error(`check-html: ${hits.length} page(s) show a broken value:\n` + hits.slice(0, 20).join("\n")); process.exit(1); }
console.log("check-html: no broken values in rendered pages");
