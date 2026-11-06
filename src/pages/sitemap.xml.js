import { BRANDS, AREAS, JOB_PAGES, GARAGES, isIndexable, garageIndexable } from "../lib/data.js";

export function GET({ site }) {
  const u = (p) => new URL(p, site).toString();
  const urls = ["/", "/dubai/", "/how-it-works/"];
  BRANDS.forEach((b) => {
    if (isIndexable(`dubai/${b.slug}`, b.evidenceCount)) urls.push(`/dubai/${b.slug}/`);
    b.models.forEach((m) => { if (isIndexable(`dubai/${b.slug}/${m.slug}`, m.evidenceCount)) urls.push(`/dubai/${b.slug}/${m.slug}/`); });
  });
  AREAS.forEach((a) => { if (isIndexable(`dubai/area/${a.slug}`, a.evidenceCount)) urls.push(`/dubai/area/${a.slug}/`); });
  JOB_PAGES.forEach((j) => { if (isIndexable(`dubai/job/${j.slug}`, j.evidenceCount)) urls.push(`/dubai/job/${j.slug}/`); });
  GARAGES.filter(garageIndexable).forEach((g) => urls.push(`/garage/${g.slug}/`));
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${u(p)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
