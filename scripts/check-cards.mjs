// Card v3 B guard (Yuki + Daniel 17 Nov): every rendered card's headline row and badge must match the table thresholds,
// and on model pages the count must be the garage's own count for that model in garages.json.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const raw = JSON.parse(readFileSync("data/garages.json", "utf8"));
const list = Array.isArray(raw) ? raw : raw.garages;
const byId = Object.fromEntries(list.map((g) => [g.id, g]));
const R = { strongN: 10, strongShare: 0.15, strongThreads: 3, goodN: 5, goodThreads: 2 };
const bad = [];
let cards = 0;
function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "index.html") check(p);
  }
}
function check(file) {
  const html = readFileSync(file, "utf8");
  const res = html.match(/id="results" data-make="([^"]*)" data-model="([^"]*)"/);
  const [, make = "", model = ""] = res || [];
  for (const m of html.matchAll(/<article class="card gcard v3" data-garage="([^"]+)" data-cw="([^"]*)"([\s\S]*?)<\/article>/g)) {
    const [, slug, cw, body] = m;
    if (!cw) continue;
    cards++;
    const [cnt, n, threads, founder, badge] = cw.split("|").map(Number);
    const why = (body.match(/<p class="why">([^<]*)<\/p>/) || [])[1] || "";
    const shown = /match l3/.test(body) ? 3 : /match l2/.test(body) ? 2 : 0;
    const want = founder || threads >= R.strongThreads || (cnt >= R.strongN && n > 0 && cnt / n >= R.strongShare) ? 3 : cnt >= R.goodN || threads >= R.goodThreads ? 2 : 0;
    const err = (e) => bad.push(`${file.replace("dist", "")} ${slug}: ${e} [cnt ${cnt} of ${n}, threads ${threads}, why "${why}"]`);
    if (shown !== want || badge !== want) err(`badge ${shown}, rule says ${want}`);
    if (/often review it$/.test(why) && cnt < 10) err("'often review it' under 10");
    if (/owners review it$/.test(why) && !(cnt >= 3 && cnt < 10)) err("'review it' outside 3 to 9");
    if (/^Owners recommend/.test(why) && threads < 2) err("'recommend' under 2 threads");
    if (/^Founder's pick/.test(why) && !founder) err("founder headline without founder basis");
    if (shown === 3 && /(review it|have mentioned it)$/.test(why) && cnt < 10) err("Strong with a weak headline");
    if (/mostly the /.test(body) && model && cnt < 3) err("'mostly the' under 3");
    if (make && model) {
      const g = byId[slug];
      const own = Math.min(Number(g?.model_mentions?.counts?.[make]?.[model]) || 0, Number(g?.reviews_analysed) || 0);
      if (g && own !== cnt) err(`model count ${cnt} but garages.json says ${own}`);
    }
  }
}
walk("dist/dubai");
if (bad.length) { console.error(`check-cards: ${bad.length} card(s) break the v3 B table:\n` + bad.slice(0, 40).join("\n")); process.exit(1); }
console.log(`check-cards: ${cards} cards match the headline and badge table`);
