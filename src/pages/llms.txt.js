// /llms.txt (SEO, 12 Nov): a short plain-Markdown map of the site for AI models. Only indexable pages are listed.
import { GUIDES } from "../lib/guides.js";
import { BRANDS, PROBLEMS, problemGarages, isIndexable, modelIndexable, slugify, DATA_UPDATED, GARAGES } from "../lib/data.js";
import { SITE } from "../lib/site.js";

export function GET({ site }) {
  const u = (p) => new URL(p, site).toString();
  const brands = BRANDS.filter((b) => isIndexable(`dubai/${b.slug}`, b.evidenceCount));
  const models = BRANDS.flatMap((b) => b.models.filter((m) => modelIndexable(`dubai/${b.slug}/${m.slug}`, b.evidenceCount, m.evidenceCount)).map((m) => ({ b, m })));
  const issues = Object.values(import.meta.glob("../content/issues/*.md", { eager: true })).map((f) => {
    const fm = f.frontmatter || {}, b = BRANDS.find((x) => x.make === fm.make);
    if (!b || fm.status !== "published" || Number(fm.sourced_issues || 0) < 3) return null;
    return { name: `${fm.make} ${fm.model} known issues`, url: `/dubai/${b.slug}/${(b.models.find((x) => x.model === fm.model) || { slug: slugify(fm.model) }).slug}/issues/` };
  }).filter(Boolean);
  const problems = PROBLEMS.filter((p) => isIndexable(`dubai/problem/${p.slug}`, problemGarages(p).length));
  const line = (name, url, note) => `- [${name}](${u(url)})${note ? `: ${note}` : ""}`;
  const body = `# ${SITE.name}

> A free, independent guide to specialist car garages in Dubai, organised by car brand and model. Garages are ranked by owner evidence: reviews from owners of that car and recommendations in owner communities. There are no paid listings and no booking fees.

How to read the site:
- A garage is listed for a brand or model only when owners of that car vouch for it. Pages say plainly when there is no model-specific evidence yet.
- Prices are published third-party or garage figures with a source and date, or prices reported by owners. Dealer and independent prices are shown side by side where both exist.
- Summaries of outside reviews are written by ${SITE.name} and labelled as such. Star ratings from other sites are not republished.
- ${GARAGES.length} garages are tracked.${DATA_UPDATED ? ` Garage data last updated ${DATA_UPDATED}.` : ""}

## How it works
${line("How KnowsMyCar ranks garages", "/how-it-works/")}
${line("About", "/about/")}
${line("Review guidelines", "/review-guidelines/")}

## Specialists by brand
${brands.map((b) => line(`${b.make} specialists in Dubai`, `/dubai/${b.slug}/`, `${b.evidenceCount} garages with owner evidence`)).join("\n")}

## Specialists by model
${models.map(({ b, m }) => line(`${m.model.startsWith(b.make) ? m.model : `${b.make} ${m.model}`} specialists in Dubai`, `/dubai/${b.slug}/${m.slug}/`)).join("\n")}

## Service cost guides
${GUIDES.filter((g) => g.live).map((g) => line(g.fm.h1 || g.fm.title, g.url, "sourced, dated prices")).join("\n")}

## Known issues by model
${issues.map((i) => line(i.name, i.url)).join("\n")}

## By problem
${problems.map((p) => line(`${p.symptom} in Dubai`, `/dubai/problem/${p.slug}/`)).join("\n")}

## Tools
${line("Check a dealer quote", "/check-a-quote/", "compare a quote with published prices")}
`;
  return new Response(SITE.indexing ? body : `# ${SITE.name}\n\nPreview build.\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
