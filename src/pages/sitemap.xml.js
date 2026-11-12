import { GUIDES } from "../lib/guides.js";
import { slugify } from "../lib/data.js";
import { BRANDS, AREAS, JOB_PAGES, GARAGES, isIndexable, modelIndexable, areaIndexable, garageIndexable, JOB_TO_PROBLEM, PROBLEMS, problemGarages } from "../lib/data.js";

export function GET({ site }) {
  const u = (p) => new URL(p, site).toString();
  const urls = ["/", "/dubai/", "/how-it-works/", "/about/", "/review-guidelines/", "/right-of-reply/", "/privacy/", "/terms/"];
  BRANDS.forEach((b) => {
    if (isIndexable(`dubai/${b.slug}`, b.evidenceCount)) urls.push(`/dubai/${b.slug}/`);
    b.models.forEach((m) => { if (modelIndexable(`dubai/${b.slug}/${m.slug}`, b.evidenceCount, m.evidenceCount)) urls.push(`/dubai/${b.slug}/${m.slug}/`); });
  });
  AREAS.forEach((a) => { if (areaIndexable(`dubai/area/${a.slug}`, a)) urls.push(`/dubai/area/${a.slug}/`); });
  JOB_PAGES.forEach((j) => { if (!JOB_TO_PROBLEM[j.slug] && isIndexable(`dubai/job/${j.slug}`, j.evidenceCount)) urls.push(`/dubai/job/${j.slug}/`); });
  PROBLEMS.forEach((p) => { if (isIndexable(`dubai/problem/${p.slug}`, problemGarages(p).length)) urls.push(`/dubai/problem/${p.slug}/`); });
  // Known-issues pages: same rule as the page itself (published, 3+ sourced issues).
  Object.values(import.meta.glob("../content/issues/*.md", { eager: true })).forEach((f) => {
    const fm = f.frontmatter || {}, b = BRANDS.find((x) => x.make === fm.make);
    if (b && fm.status === "published" && Number(fm.sourced_issues || 0) >= 3) urls.push(`/dubai/${b.slug}/${(b.models.find((x) => x.model === fm.model) || { slug: slugify(fm.model) }).slug}/issues/`);
  });
  GUIDES.filter((g) => g.live).forEach((g) => urls.push(g.url));
  GARAGES.filter(garageIndexable).forEach((g) => urls.push(`/garage/${g.slug}/`));
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${u(p)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
