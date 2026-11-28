// One list of indexable URLs, shared by the sitemap and by internal links that must only point at indexable pages (Karim 20 Nov).
import { GUIDES } from "./guides.js";
import { PROBLEM_PAGES, problemLive } from "./problems.js";
import { contentDate, dataPageDate } from "./lastmod.js";
import { slugify, BRANDS, AREAS, JOB_PAGES, GARAGES, isIndexable, modelIndexable, areaIndexable, garageIndexable, JOB_TO_PROBLEM, PROBLEMS, problemGarages } from "./data.js";
let cache = null;
const LASTMOD = new Map();
export const lastmodFor = (p) => { indexableUrls(); return LASTMOD.get(p) || ""; };
export function indexableUrls() {
  if (cache) return cache;
  const urls = ["/", "/dubai/", "/how-it-works/", "/about/", "/review-guidelines/", "/right-of-reply/", "/privacy/", "/terms/"];
  const STATIC = { "/how-it-works/": "src/pages/how-it-works.astro", "/about/": "src/pages/about.astro", "/review-guidelines/": "src/pages/review-guidelines.astro", "/right-of-reply/": "src/pages/right-of-reply.astro", "/privacy/": "src/pages/privacy.astro", "/terms/": "src/pages/terms.astro" };
  for (const p of urls) LASTMOD.set(p, STATIC[p] ? contentDate(STATIC[p]) : dataPageDate("src/content/intros.json"));
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
    if (b && fm.status === "published" && Number(fm.sourced_issues || 0) >= 3) { const p = `/dubai/${b.slug}/${(b.models.find((x) => x.model === fm.model) || { slug: slugify(fm.model) }).slug}/issues/`; urls.push(p); LASTMOD.set(p, contentDate(f.file, fm.updated)); }
  });
  GUIDES.filter((g) => g.live).forEach((g) => { urls.push(g.url); LASTMOD.set(g.url, contentDate(g.f.file, g.fm.updated)); });
  // Model-problem pages: approved and 4+ garages on the list (Daniel).
  PROBLEM_PAGES.filter(problemLive).forEach((p) => { urls.push(p.url); LASTMOD.set(p.url, contentDate(p.f.file, p.fm.updated)); });
  // Garage pages also move when their template's visible text changes (Daniel 28 Nov).
  GARAGES.filter(garageIndexable).forEach((g) => { const p = `/garage/${g.slug}/`; urls.push(p); LASTMOD.set(p, dataPageDate("src/pages/garage/[slug]/index.astro")); });
  for (const p of urls) if (!LASTMOD.has(p)) LASTMOD.set(p, dataPageDate(/^\/dubai\/[^/]+\/$/.test(p) || /^\/dubai\/[^/]+\/[^/]+\/$/.test(p) ? "src/content/intros.json" : ""));
  cache = urls;
  return urls;
}
export const isIndexableUrl = (p) => { const s = (indexableUrls()._set ||= new Set(indexableUrls())); return s.has(p); };
