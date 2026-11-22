// Model-problem pages (seo/model-problem-pages-plan.md): markdown in src/content/problems/, URL from frontmatter `url`
// (/dubai/{make}/{model}/{problem}/ or /dubai/{make}/{problem}/). Garage list from data only, no hand-picking.
import { BRANDS, GARAGES, garageIndexable, lowRated, communityThreads } from "./data.js";
const files = Object.values(import.meta.glob("../content/problems/*.md", { eager: true }));
export const JOB_WORD = { suspension: "suspension", gearbox: "gearbox", oil_leak: "oil leak", overheating: "cooling system" };
export const PROBLEM_PAGES = files.map((f) => {
  const fm = f.frontmatter || {};
  const parts = String(fm.url || "").split("/").filter(Boolean); // dubai, make[, model], problem
  const b = BRANDS.find((x) => x.slug === parts[1] || x.make === fm.make);
  const modelSlug = parts.length === 4 ? parts[2] : null;
  const m = modelSlug ? b?.models.find((x) => x.slug === modelSlug) || { model: fm.model, slug: modelSlug, none: true } : null;
  return { f, fm, b, m, url: fm.url, slug: parts.at(-1), key: fm.problem, approved: /^(approved|published)/i.test(String(fm.status || "")), updated: fm.updated || "2026-11-20" };
}).filter((p) => p.url && p.b && p.key);

// Rule (Karim 20 Nov + Daniel's 4 changes): indexable independent garage, in Dubai or marked worth the drive,
// a real spec (conf >= 2) for the make, the model in its spec or model mentions, and reviews that mention the job
// (or an owner discussion tagged with it). Model pages rank by model-mention tier first; low-rated never in the top 3.
export function problemList(p) {
  const make = p.b.make, model = p.m?.model;
  const tier = (n) => (n >= 10 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);
  const rows = GARAGES.filter((g) => !g.isDealer && garageIndexable(g) && (!g.outsideDubai || g.worthDrive)).flatMap((g) => {
    const sp = g.specs.find((s) => s.make === make && s.conf >= 2);
    if (!sp) return [];
    const mm = model ? Number(g.model_mentions?.counts?.[make]?.[model]) || 0 : 0;
    if (model && !(sp.models || []).includes(model) && mm < 1) return [];
    const job = Number(g.problem_counts?.counts?.[p.key]) || 0;
    const discJob = (g.community_mentions?.sources || []).filter((x) => (x.topics || []).includes(p.key) && !/negative|mixed/i.test(x.sentiment || "")).length;
    if (job < 1 && discJob < 1) return [];
    return [{ g, job, disc: communityThreads(g).length, makeN: sp.mentions || 0, tier: model ? tier(mm) : 0, mm }];
  });
  rows.sort((a, b) => b.tier - a.tier || b.job - a.job || b.disc - a.disc || b.makeN - a.makeN || a.g.name.localeCompare(b.g.name));
  // Ranking floor: a garage under 3.5 stars on 20+ reviews never sits in the top 3.
  const low = rows.filter((r) => lowRated(r.g)), ok = rows.filter((r) => !lowRated(r.g));
  return ok.length >= 3 ? [...ok.slice(0, 3), ...[...ok.slice(3), ...low].sort((a, b) => rows.indexOf(a) - rows.indexOf(b))] : [...ok, ...low];
}
export const problemLive = (p) => p.approved && problemList(p).length >= 4;
export const problemsFor = (makeSlug, modelSlug = null) => PROBLEM_PAGES.filter((p) => p.b.slug === makeSlug && (!p.m || p.m.slug === modelSlug) && problemLive(p));
