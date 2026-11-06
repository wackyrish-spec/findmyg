// Loads data/garages.json at build time and builds the indexes every page uses.
import raw from "../../data/garages.json";
import intros from "../content/intros.json";
import { CATALOG } from "./catalog.js";
import { loadReviews, ownerStats } from "./reviews.js";

const REVIEWS = await loadReviews();

export const CITY = { slug: "dubai", name: "Dubai" };
export const slugify = (s) =>
  String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const CONF = { high: 3, medium: 2, low: 1 };
export const LEVELS = ["No evidence", "Some experience", "Good match", "Strong match"];

export const AREA_GROUPS = [
  "Al Quoz", "Ras Al Khor", "Al Qusais", "Dubai Investments Park", "Jebel Ali",
  "Umm Ramool", "Nadd Al Hamar", "Al Khabaisi", "Saih Shuaib",
];

// Job pages for people who search by problem, not by car.
export const JOBS = [
  { slug: "servicing", name: "Servicing", plain: "Regular servicing and oil changes", re: /oil change|tune up|servic|maintenance/i },
  { slug: "ac-repair", name: "AC repair", plain: "Car AC not cold", re: /air conditioning|\bac\b/i },
  { slug: "gearbox", name: "Gearbox and transmission", plain: "Gearbox slipping, jerky or warning light", re: /transmission|gearbox|dsg/i },
  { slug: "electrical", name: "Electrical", plain: "Warning lights, battery and electrical faults", re: /electrical|battery|electr/i },
  { slug: "engine", name: "Engine repair", plain: "Engine noise, leaks and rebuilds", re: /engine|machine shop/i },
  { slug: "bodywork", name: "Bodywork and paint", plain: "Dents, scratches and accident repair", re: /body|paint|dent/i },
  { slug: "brakes", name: "Brakes", plain: "Brake noise and replacement", re: /brake/i },
  { slug: "suspension", name: "Suspension", plain: "Knocks, air suspension and alignment", re: /spring|suspension|alignment|shock/i },
  { slug: "restoration", name: "Restoration", plain: "Classic and older car restoration", re: /restoration/i },
];

function goodFor(text) {
  const out = [];
  if (/restoration/i.test(text)) out.push("Restorations");
  if (/engine rebuild|transmission|machine shop/i.test(text)) out.push("Big repairs");
  if (/oil change|tune up|maintenance|servic/i.test(text)) out.push("Regular servicing");
  if (/body|paint|dent/i.test(text)) out.push("Bodywork");
  return out.slice(0, 2);
}

function norm(g) {
  const specs = (g.specialties || [])
    .filter((s) => s.make)
    .map((s) => ({
      make: s.make,
      makeSlug: slugify(s.make),
      models: (s.models || []).filter(Boolean),
      level: s.level || "brand",
      confidence: s.confidence || "low",
      conf: CONF[s.confidence] || 1,
      evidence: s.evidence || "",
      mentions: s.mentions || 0,
      basis: s.basis || "",
    }))
    .sort((a, b) => b.conf - a.conf || b.mentions - a.mentions);
  const real = (s) => /reviews|community|founder/.test(s.basis) && s.conf >= 2;
  const bySource = {};
  (g.external_ratings || []).forEach((r) => {
    bySource[r.source] = { source: r.source, rating: r.rating ?? null, count: r.count ?? null, url: r.url || "", asOf: r.as_of || "", snips: [] };
  });
  (g.external_reviews || []).forEach((r) => {
    (bySource[r.source] ||= { source: r.source, rating: null, count: null, url: r.url || "", snips: [] }).snips.push({
      text: r.excerpt, author: r.author || "", date: r.date || "", url: r.url || "", rating: r.rating ?? null, mentions: r.mentions || [],
    });
  });
  const ext = Object.values(bySource);
  const google = ext.find((e) => e.source === "Google" && e.rating) || null;
  const areaGroup = AREA_GROUPS.find((a) => (g.area || "").startsWith(a)) || null;
  const text = [...(g.categories || []), ...(g.services || [])].join(" | ");
  return {
    ...g,
    slug: g.id || slugify(g.name),
    specs,
    ext,
    google,
    isDealer: g.business_type === "dealer",
    // Product spec: a garage ranks only if owners can reach or find it.
    contactable: !!(g.phone || g.whatsapp || g.maps_url || (g.lat && g.lng)),
    founderPick: specs.some((s) => s.basis === "founder"),
    hasEvidence: g.business_type !== "dealer" && specs.some(real),
    topConf: Math.max(0, ...specs.map((s) => s.conf)),
    areaGroup,
    areaSlug: areaGroup ? slugify(areaGroup) : null,
    jobs: JOBS.filter((j) => j.re.test(text)).map((j) => j.slug),
    goodFor: goodFor(text),
    waNumber: waNumber(g),
    ownerReviews: REVIEWS[g.id || slugify(g.name)] || [],
    own: ownerStats(REVIEWS[g.id || slugify(g.name)]),
    ownerCount: (REVIEWS[g.id || slugify(g.name)] || []).length,
    makes: [...new Set(specs.map((s) => s.make))],
    // Own-words summary (array of sentences, or a string in older data).
    summary: [].concat(g.evidence_summary || []).filter(Boolean),
  };
}

export function waNumber(g) {
  const n = String(g.whatsapp || g.phone || "").replace(/\D/g, "");
  if (/^9715\d{8}$/.test(n)) return n;
  if (/^05\d{8}$/.test(n)) return "971" + n.slice(1);
  return "";
}

const defaultRank = (a, b) =>
  a.isDealer - b.isDealer || (b.ownerCount >= 3) - (a.ownerCount >= 3) || b.hasEvidence - a.hasEvidence || b.topConf - a.topConf || a.name.localeCompare(b.name);

export const GARAGES = (raw.garages || raw).filter((g) => g && g.name).map(norm).sort(defaultRank);
export const BY_SLUG = Object.fromEntries(GARAGES.map((g) => [g.slug, g]));
export const DATA_UPDATED = raw.updated || "";
export const METHOD = raw.method || "";

/* ---------- brand and model indexes ---------- */
export function specFor(g, make, model) {
  const s = g.specs.filter((x) => x.make === make);
  if (!s.length) return null;
  if (model) {
    const hit = s.filter((x) => x.models.includes(model));
    if (hit.length) return { ...hit[0], modelHit: true };
    return { ...s[0], conf: Math.min(s[0].conf, 2), modelHit: false };
  }
  return s[0];
}
export const levelOf = (spec) => (spec ? spec.conf : 0);
const lc = (x) => String(x || "").toLowerCase();
// An owner review on KnowsMyCar for this car is evidence too.
const ownerFor = (g, make, model) =>
  g.ownerReviews.some((r) => lc(r.car_make) === lc(make) && (!model || lc(r.car_model).includes(lc(model))));
const realFor = (g, make, model) => {
  if (g.isDealer || !g.contactable) return false;
  if (ownerFor(g, make, model)) return true;
  const s = specFor(g, make, model);
  return !!s && /reviews|community|founder/.test(s.basis) && s.conf >= 2 && (!model || s.modelHit);
};
export { realFor };

/* ---------- list split (product spec 11a and 11c) ----------
   Ranked: garages with evidence. Dealers never rank; they sit in a collapsed comparison strip
   on brand/model pages only. No-evidence garages never rank; on brand/model pages they appear
   collapsed only when fewer than 5 garages rank. */
export const OTHERS_MIN = 5;
// Dealer price ranges from owners' reports of dealer quotes, per job, only with 3+ reports.
export function dealerPrices(make, model) {
  const by = {};
  GARAGES.forEach((g) => g.ownerReviews.forEach((r) => {
    if (!(r.dealer_quote > 0) || lc(r.car_make) !== lc(make) || (model && !lc(r.car_model).includes(lc(model)))) return;
    const k = lc(r.job).trim();
    (by[k] ||= { job: r.job, q: [] }).q.push(r.dealer_quote);
  }));
  return Object.values(by).filter((x) => x.q.length >= 3)
    .map((x) => ({ job: x.job, n: x.q.length, min: Math.min(...x.q), max: Math.max(...x.q) }));
}
// Cited dealer-vs-independent line (research/dealer-price-anchors.md). Land Rover pages only.
export const DEALER_NOTES = {
  "land-rover": { text: "Agency servicing on a Range Rover typically costs 30 to 50% more than independents.", source: "CarSwitch, Jul 2026", url: "https://carswitch.com/newsroom/range-rover-price-in-uae-2026-used-vs-new-generation-guide-true-cost-of-owning-a-pre-owned-range-rover/" },
};
export function splitBrand(garages, make, model) {
  const ranked = [], others = [], dealers = [];
  garages.forEach((g) => (g.isDealer ? dealers : realFor(g, make, model) || (model && realFor(g, make)) ? ranked : others).push(g));
  return { ranked, others: ranked.length < OTHERS_MIN ? others : [], dealers };
}
export function splitGeneral(garages) {
  const ok = garages.filter((g) => !g.isDealer);
  const ranks = (g) => g.contactable && (g.hasEvidence || g.ownerCount > 0);
  return { ranked: ok.filter(ranks), others: ok.filter((g) => !ranks(g)), dealers: [] };
}

function rankFor(make, model) {
  return (a, b) => {
    const sa = specFor(a, make, model), sb = specFor(b, make, model);
    return (sb?.conf || 0) - (sa?.conf || 0) || (sb?.modelHit ? 1 : 0) - (sa?.modelHit ? 1 : 0) ||
      (sb?.mentions || 0) - (sa?.mentions || 0) || a.name.localeCompare(b.name);
  };
}

export const BRANDS = (() => {
  const m = {};
  GARAGES.forEach((g) => g.specs.forEach((s) => {
    (m[s.makeSlug] ||= { make: s.make, slug: s.makeSlug, garages: new Set(), models: {} }).garages.add(g.slug);
    s.models.forEach((md) => ((m[s.makeSlug].models[slugify(md)] ||= { model: md, slug: slugify(md), garages: new Set() }).garages.add(g.slug)));
  }));
  // Brands a garage claims only on its own website: listed (collapsed), never ranked.
  GARAGES.forEach((g) => (g.self_claims || []).forEach((c) => c.make && m[slugify(c.make)]?.garages.add(g.slug)));
  // Main dealers (no specialties) join their marque's page as unranked price anchors.
  GARAGES.forEach((g) => g.isDealer && g.dealer_for && m[slugify(g.dealer_for)]?.garages.add(g.slug));
  GARAGES.forEach((g) => g.ownerReviews.forEach((r) => m[slugify(r.car_make || "")]?.garages.add(g.slug)));
  return Object.values(m).map((b) => {
    const garages = [...b.garages].map((x) => BY_SLUG[x]).sort(rankFor(b.make));
    const models = Object.values(b.models).map((md) => ({
      ...md,
      garages: [...md.garages].map((x) => BY_SLUG[x]).sort(rankFor(b.make, md.model)),
    }));
    models.forEach((md) => (md.evidenceCount = md.garages.filter((g) => realFor(g, b.make, md.model)).length));
    return { make: b.make, slug: b.slug, garages, models, evidenceCount: garages.filter((g) => realFor(g, b.make)).length };
  }).sort((a, b) => b.evidenceCount - a.evidenceCount || b.garages.length - a.garages.length);
})();

export const AREAS = AREA_GROUPS.map((a) => ({
  name: a, slug: slugify(a), garages: GARAGES.filter((g) => g.areaGroup === a),
})).filter((a) => a.garages.length).map((a) => ({ ...a, evidenceCount: a.garages.filter((g) => g.hasEvidence && g.contactable).length }));

export const JOB_PAGES = JOBS.map((j) => {
  const garages = GARAGES.filter((g) => g.jobs.includes(j.slug));
  return { ...j, re: undefined, garages, evidenceCount: garages.filter((g) => g.hasEvidence && g.contactable).length };
}).filter((j) => j.garages.length);

/* ---------- indexing rule (research doc section 14) ----------
   A list page is indexed only with 3+ garages that have real evidence AND an approved intro. */
// Only approved entries are used. An entry may also carry title, description and h1
// overrides for its page (SEO spec, "On-page SEO for go-live").
export function intro(key) {
  const i = intros[key];
  return i && i.approved ? i : null;
}
export function isIndexable(key, evidenceCount) {
  const i = intros[key];
  return evidenceCount >= 3 && !!(i && i.text && i.approved);
}
// Garage pages are indexed when they have real evidence for at least one specialty.
export const garageIndexable = (g) => g.hasEvidence || g.ownerCount > 0;

/* ---------- picker payload (kept small; shipped to the browser) ---------- */
export function pickerCatalog() {
  const rows = CATALOG.map((c) => ({ ...c }));
  BRANDS.forEach((b) => b.models.forEach((md) => {
    if (!rows.some((r) => r.make === b.make && r.model === md.model)) rows.push({ make: b.make, model: md.model, code: "", years: "", aliases: "" });
  }));
  const pages = {};
  BRANDS.forEach((b) => {
    pages[b.make] = { url: `/${CITY.slug}/${b.slug}/`, models: Object.fromEntries(b.models.map((md) => [md.model, `/${CITY.slug}/${b.slug}/${md.slug}/`])) };
  });
  return { rows, pages };
}
