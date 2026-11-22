// One list of indexable URLs, shared by the sitemap and by internal links that must only point at indexable pages (Karim 20 Nov).
import { GUIDES } from "./guides.js";
import { PROBLEM_PAGES, problemLive } from "./problems.js";
import { slugify, BRANDS, AREAS, JOB_PAGES, GARAGES, isIndexable, modelIndexable, areaIndexable, garageIndexable, JOB_TO_PROBLEM, PROBLEMS, problemGarages } from "./data.js";
let cache = null;
export function indexableUrls() {
  if (cache) return cache;
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
  // Model-problem pages: approved and 4+ garages on the list (Daniel).
  PROBLEM_PAGES.filter(problemLive).forEach((p) => urls.push(p.url));
  GARAGES.filter(garageIndexable).forEach((g) => urls.push(`/garage/${g.slug}/`));
  cache = urls;
  return urls;
}
export const isIndexableUrl = (p) => { const s = (indexableUrls()._set ||= new Set(indexableUrls())); return s.has(p); };
