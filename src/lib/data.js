// Loads data/garages.json at build time and builds the indexes every page uses.
import raw from "../../data/garages.json";
import intros from "../content/intros.json";
import { CATALOG, EXTRA_FAMILIES } from "./catalog.js";
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
// Garages outside Dubai are listed in their own group, never ranked in Dubai lists.
const OUTSIDE = /abu dhabi|sharjah|ajman|al ain|ras al khaimah|\brak\b|fujairah|umm al quwain/i;
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

// Data's website_note: dead or hijacked sites lose their link; non-workshops are left out of lists.
const BROKEN_SITE = /suspend|gambling|unrelated|default server|no content|check before/i;
const NOT_WORKSHOP = /not (clearly )?a (repair )?workshop|parts (supplier|distributor)|distributor|retailer|transport company|showroom/i;
const SITE_BASIS = (s) => s.basis === "website" || /self-description|on (the )?garage('s)? (own )?website/i.test(s.evidence || "");
function norm(g) {
  const note = g.website_note || "";
  const website = g.website && !BROKEN_SITE.test(note) ? g.website : "";
  // A specialty whose only basis is the garage's own website is "the garage says", never owner-backed or ranked.
  const self_claims = [...(g.self_claims || []).map((c) => ({ ...c, url: c.url && BROKEN_SITE.test(note) ? "" : c.url })), ...(g.specialties || []).filter((s) => s.make && SITE_BASIS(s))
    .map((s) => ({ make: s.make, models: (s.models || []).filter(Boolean), url: website, note: "" }))];
  const specs = (g.specialties || []).filter((s) => !SITE_BASIS(s))
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
    // NFKC turns styled Unicode names (e.g. bold maths letters from Maps listings) into plain text.
    name: String(g.name).normalize("NFKC").replace(/\s+/g, " ").trim(),
    slug: g.id || slugify(g.name),
    website, self_claims,
    sources: (g.sources || []).filter((u) => website || !g.website || !u.includes(g.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, ""))),
    focus: g.website_focus?.focus && website ? g.website_focus.focus : "",
    notWorkshop: NOT_WORKSHOP.test(note) && !/workshop in/i.test(note),
    specs,
    ext,
    google,
    isDealer: g.business_type === "dealer",
    // Product spec: a garage ranks only if owners can reach or find it.
    contactable: !!(g.phone || g.whatsapp || g.maps_url || (g.lat && g.lng)),
    founderPick: specs.some((s) => s.basis === "founder"),
    outsideDubai: OUTSIDE.test(`${g.area || ""} ${g.city || ""} ${g.address || ""}`) || (g.specialties || []).some((s) => /not Dubai/i.test(s.evidence || "")),
    hasEvidence: g.business_type !== "dealer" && specs.some(real),
    topConf: Math.max(0, ...specs.map((s) => s.conf)),
    areaGroup,
    areaSlug: areaGroup ? slugify(areaGroup) : null,
    jobs: JOBS.filter((j) => j.re.test(text)).map((j) => j.slug),
    goodFor: goodFor(text),
    waNumber: waNumber(g),
    priceTalk: priceTalk(g.price_signal),
    prices: normPrices(g.price_examples),
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

// Every garage keeps its page (slugs are frozen); non-workshops are left out of lists and search.
export const ALL_GARAGES = (raw.garages || raw).filter((g) => g && g.name).map(norm).sort(defaultRank);
export const GARAGES = ALL_GARAGES.filter((g) => !g.notWorkshop);
export const BY_SLUG = Object.fromEntries(ALL_GARAGES.map((g) => [g.slug, g]));
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
  if (g.isDealer || !g.contactable || g.outsideDubai) return false;
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
  const ranked = [], others = [], dealers = [], outside = [];
  garages.forEach((g) => (g.isDealer ? dealers : g.outsideDubai ? outside : realFor(g, make, model) || (model && realFor(g, make)) ? ranked : others).push(g));
  return { ranked, others: ranked.length < OTHERS_MIN ? others : [], dealers, outside };
}
export function splitGeneral(garages) {
  const ok = garages.filter((g) => !g.isDealer && !g.outsideDubai);
  const ranks = (g) => g.contactable && (g.hasEvidence || g.ownerCount > 0);
  return { ranked: ok.filter(ranks), others: ok.filter((g) => !ranks(g)), dealers: [], outside: garages.filter((g) => !g.isDealer && g.outsideDubai) };
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
// Indexable with evidence, owner reviews, or a person-checked summary of 20+ outside reviews read (PM spec, SEO input).
export const garageIndexable = (g) => !g.notWorkshop && (g.hasEvidence || g.ownerCount > 0
  || (g.summary_checked === true && (g.reviews_read || g.price_signal?.reviews_read || 0) >= 20));

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
  // Problems for the one search box (PM spec 12.3): label, slug and synonyms only.
  const problems = PROBLEMS.map((p) => ({ slug: p.slug, label: p.label, syn: p.syn }));
  return { rows, pages, problems };
}

// Cost signal from reviews on other sites (Data's price pass): counts only, no review text.
// Shown when 5+ reviews mention price; typical prices only for jobs with 3+ sources. Never used for ranking.
export function priceTalk(ps) {
  if (!ps || !(ps.price_mentions >= 5)) return null;
  const n = ps.price_mentions, exp = ps.expensive || 0, fair = ps.fair || 0, cheap = ps.cheap || 0;
  const pos = fair + cheap;
  const label = exp / n >= 0.5 ? `Reviewers often call it expensive (${exp} of ${n} who mentioned price)`
    : pos / n >= 0.6 && exp / n < 0.25 ? `Reviewers call prices fair (${pos} of ${n} who mentioned price)`
    : `Mixed views on price (${n} reviewers mentioned it)`;
  const tone = exp / n >= 0.5 ? "neg" : pos / n >= 0.6 && exp / n < 0.25 ? "pos" : "mid";
  const jobs = (ps.jobs || []).filter((j) => j.sources >= 3 && j.aed_low > 0)
    .map((j) => ({ ...j, aed_high: Math.max(j.aed_high || j.aed_low, j.aed_low) }));
  return { label, tone, n, read: ps.reviews_read || null, asOf: ps.as_of || "", jobs };
}

// Price points a garage publishes or owners reported elsewhere (Data's price_examples), normalised.
// Accepts old rows ({item, price_aed: 1350 | "840–1,575"}) and new rows ({job, make, model, aed_low, aed_high, includes_parts}).
export function normPrices(list) {
  return (list || []).map((p) => {
    let low = Number(p.aed_low), high = Number(p.aed_high);
    if (!(low > 0)) {
      const nums = String(p.price_aed ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/g) || [];
      low = Number(nums[0]); high = Number(nums[1] || nums[0]);
    }
    if (!(low > 0)) return null;
    if (!(high >= low)) high = low;
    const source = p.source || "";
    // Store AED including VAT: add 5% when the source says it excludes VAT.
    const exVat = /excl/i.test(p.vat || "");
    if (exVat) { low *= 1.05; high *= 1.05; }
    return { item: (p.item || "").replace(/\s+/g, " ").trim(), job: p.job || "", make: p.make || "", model: p.model || "",
      low: Math.round(low), high: Math.round(high), vat: p.vat && p.vat !== "unknown" ? p.vat : "", vatNote: exVat ? "VAT added" : /incl/i.test(p.vat || "") ? "incl. VAT" : "",
      from: /starting|from/i.test(source) || p.from === true,
      parts: p.includes_parts === true ? "parts included" : p.includes_parts === false ? "labour only" : "",
      source, owner: /owner/i.test(source), url: p.url || "", asOf: p.as_of || p.date || "" };
  }).filter(Boolean);
}

// Cost benchmark (PM decision, research/cost-benchmark-decision.md): three everyday jobs, compared per car make.
// Prices are AED including VAT. Minor service is the headline number on result cards.
export const BENCHMARKS = [
  { slug: "minor-service", key: "minor_service", name: "Minor service", plain: "Minor service (oil and filter)", job: ["minor_service", "oil_service"], re: /minor service|oil (and|&) filter|oil change|\b10,?000 ?km service|small service/i,
    includes: ["Oil and filter", "Air filter", "Cabin filter"] },
  { slug: "front-brake-pads", key: "brake_pads_front", name: "Front brake pads", plain: "Front brake pads, fitted", job: ["brake_pads_front", "brake_pads_axle"], re: /brake pad/i,
    includes: ["Pads only", "Discs too", "Sensors too"] },
  { slug: "ac-regas", key: "ac_regas", name: "AC re-gas", plain: "AC re-gas and leak check", job: ["ac_regas"], re: /re-?gas|ac gas|refrigerant/i,
    includes: ["Re-gas only", "Leak repair"] },
  { slug: "diagnostic", key: "diagnostic", name: "Diagnostic check", plain: "Diagnostic check (warning-light scan)", job: ["diagnostic"], re: /diagnos|warning.light scan|obd/i,
    includes: [], pageOnly: true },
];
function benchPoints(g, b) {
  const pts = [];
  g.ownerReviews.forEach((r) => { if (r.price_paid > 0 && (r.job === b.name || b.re.test(`${r.job} ${r.job_note || ""}`))) pts.push({ src: "owners", make: r.car_make, model: r.car_model || "", low: r.price_paid, high: r.price_paid }); });
  g.prices.forEach((p) => { if (b.job.includes(p.job) || (!p.job && b.re.test(p.item))) pts.push({ ...p, src: g.isDealer ? "dealer" : p.owner ? "reported" : /website/i.test(p.source) ? "site" : "list" }); });
  (g.priceTalk?.jobs || []).forEach((j) => { if (b.re.test(j.job || "") || b.job.includes(j.job)) pts.push({ src: "web", make: j.make, model: j.model || "", low: j.aed_low, high: j.aed_high }); });
  return pts;
}
export function benchmarks(g, make = null, model = null) {
  return BENCHMARKS.map((b) => {
    let pts = benchPoints(g, b).filter((p) => !make || !p.make || lc(p.make) === lc(make));
    if (model) { const m = pts.filter((p) => lc(p.model).includes(lc(model))); if (m.length) pts = m; }
    if (!pts.length) return null;
    // Owner prices win once there are 3+; otherwise the garage's list, then owner reports online, then reviews elsewhere.
    const own = pts.filter((p) => p.src === "owners");
    const src = own.length >= 3 ? "owners" : ["dealer", "list", "reported", "owners", "web"].find((s) => pts.some((p) => p.src === s));
    let use = pts.filter((p) => p.src === src);
    // Prefer rows filed under the main job key (e.g. minor_service over a plain oil_service).
    if (use.some((p) => p.job === b.job[0])) use = use.filter((p) => !p.job || p.job === b.job[0]);
    const one = (k) => { const v = [...new Set(use.map((p) => p[k] || ""))]; return v.length === 1 ? v[0] : ""; };
    return { ...b, src, n: use.length, low: Math.min(...use.map((p) => p.low)), high: Math.max(...use.map((p) => p.high)),
      from: use.some((p) => p.from), make: one("make"), car: [one("make"), one("model")].filter(Boolean).join(" "), vatNote: one("vatNote"), parts: one("parts") };
  }).filter(Boolean);
}
// Budget tier for a make: only when 3+ independents have a minor-service price for it.
export function budgetTier(g, make) {
  if (!make || g.isDealer) return "";
  const lows = GARAGES.filter((x) => !x.isDealer).map((x) => benchmarks(x, make).find((b) => b.slug === "minor-service")?.low).filter((v) => v > 0).sort((a, b) => a - b);
  const mine = benchmarks(g, make).find((b) => b.slug === "minor-service")?.low;
  if (lows.length < 3 || !mine) return "";
  const rank = lows.filter((v) => v < mine).length / lows.length;
  return rank < 1 / 3 ? "$" : rank < 2 / 3 ? "$$" : "$$$";
}
export const BENCH_SRC = { owners: "KnowsMyCar owners", list: "garage's price list", site: "garage's website", dealer: "dealer price list", reported: "owner on a forum", web: "reviews elsewhere" };
export const aedRange = (lo, hi) => lo === hi ? `AED ${Number(lo).toLocaleString("en-US")}` : `AED ${Number(lo).toLocaleString("en-US")} to ${Number(hi).toLocaleString("en-US")}`;

// ---------- Search by problem (PM spec 12.3) ----------
// Everyday symptoms, each with a one-line list of common causes (never a verdict) and Data's problem_counts key.
export const PROBLEMS = [
  { slug: "ac-not-cold", symptom: "Car AC not cold", trade: "AC repair or AC regas", label: "AC not cold", key: "ac", job: "ac-repair", syn: "ac aircon air con a/c not cold warm air ac smell ac smells ac gas", causes: "Low gas, a leak, a failing compressor or a blocked condenser." },
  { slug: "warning-light", symptom: "Car warning light on", trade: "diagnostics (a code read)", label: "Warning light on", key: "warning_light", job: "electrical", syn: "check engine engine light warning light dashboard light dash light", causes: "Anything from a loose fuel cap or a sensor to a serious engine fault. A scan reads the fault code." },
  { slug: "gearbox-jerks", symptom: "Car gearbox jerking or slipping", trade: "gearbox or transmission repair", label: "Gearbox jerks or slips", key: "gearbox", job: "gearbox", syn: "gearbox transmission jerk jerks jerking slipping slips dsg harsh shift", causes: "Old fluid, a software issue, worn clutches or a valve body fault." },
  { slug: "noise-over-bumps", symptom: "Car knocking over bumps", trade: "suspension repair", label: "Noise over bumps", key: "suspension", job: "suspension", syn: "knock knocking clunk bumps sagging suspension air suspension rattle", causes: "Worn bushes, links or shock absorbers, or an air suspension leak." },
  { slug: "wont-start", symptom: "Car won't start", trade: "battery and electrical repair", label: "Won't start", key: "battery", job: "electrical", syn: "won't start wont start not starting dead battery battery no crank", causes: "Usually the battery. Sometimes the starter, the alternator or the immobiliser." },
  { slug: "overheating", symptom: "Car overheating", trade: "cooling system repair", label: "Overheating", key: "overheating", job: "engine", syn: "overheat overheating temperature coolant hot engine", causes: "Low coolant, a leak, or a failing fan, thermostat or water pump." },
  { slug: "brakes-noise", symptom: "Car brakes squeaking or grinding", trade: "brake repair", label: "Brakes squeak or grind", key: "brakes", job: "brakes", syn: "brake brakes squeak squeal grind grinding vibration when braking", causes: "Worn pads or discs, or a sticking calliper." },
  { slug: "oil-leak", symptom: "Car leaking oil", trade: "oil leak repair", label: "Oil leak", key: "oil_leak", job: "engine", syn: "oil leak leaking drip drips oil under car", causes: "A gasket, a seal or the oil pan. A leak test finds the source." },
  { slug: "steering", symptom: "Car steering pulling or heavy", trade: "steering and wheel alignment", label: "Steering pulls or feels heavy", key: "steering", job: "suspension", syn: "steering pulls pulling alignment heavy steering wheel shakes", causes: "Wheel alignment, tyres, or the power steering fluid or pump." },
  { slug: "service-due", symptom: "Car service due", trade: "car servicing", label: "Service due", key: "service", job: "servicing", syn: "service servicing oil change maintenance minor service major service", causes: "Routine oil, filters and checks at the interval in your service book." },
  { slug: "dents-scratches", symptom: "Car dents and scratches", trade: "bodywork and paint", label: "Dents or scratches", key: "bodywork", job: "bodywork", syn: "dent dents scratch scratches paint accident bumper body", causes: "Bodywork and paint repair, from a small touch-up to accident work." },
  { slug: "buying-used", symptom: "Checking a used car before you buy", trade: "a pre-purchase inspection (PPI)", label: "Buying a used car", key: "pre_purchase", job: null, syn: "ppi pre purchase pre-purchase inspection used car check buying a car", causes: "A pre-purchase inspection before you pay, to catch hidden faults." },
];
export const PROBLEM_MIN = 2; // Data: 2+ reviews mentioning the job is enough to list a garage under it.
export function problemGarages(p) {
  return GARAGES.filter((g) => !g.isDealer && g.contactable && !g.outsideDubai && (g.problem_counts?.counts?.[p.key] || 0) >= PROBLEM_MIN)
    .map((g) => ({ g, n: g.problem_counts.counts[p.key] }))
    .sort((a, b) => b.n - a.n || a.g.name.localeCompare(b.g.name));
}

// ---------- Covered / close / not yet (PM spec 12.1) ----------
const FAMILIES = { ...(raw.car_families || {}), ...EXTRA_FAMILIES };
export const FAMILY_LABEL = { japanese_korean: "Japanese and Korean cars", german: "German cars", european_other: "European cars", american: "American cars", british: "British cars", chinese: "Chinese cars" };
export const MAKE_FAMILY = Object.fromEntries(Object.entries(FAMILIES).flatMap(([f, makes]) => makes.map((m) => [m, f])));
// Garages owners trust with a whole family (evidence for any make in it), then all-makes workshops.
export function familyGarages(family, limit = 6) {
  const makes = new Set(FAMILIES[family] || []);
  const fam = makes.size ? GARAGES.filter((g) => !g.isDealer && g.contactable && !g.outsideDubai && g.hasEvidence && g.specs.some((s) => makes.has(s.make))) : [];
  const all = GARAGES.filter((g) => !g.isDealer && g.contactable && !g.outsideDubai && g.works_on_all_makes === true && !fam.includes(g))
    .sort((a, b) => (b.hasEvidence - a.hasEvidence) || (b.google?.count || 0) - (a.google?.count || 0));
  return { family: fam.slice(0, limit), all: all.slice(0, limit) };
}


// One URL per intent (PM): job pages that match one problem page 301 to it (public/_redirects).
export const JOB_TO_PROBLEM = { "ac-repair": "ac-not-cold", gearbox: "gearbox-jerks", brakes: "brakes-noise", bodywork: "dents-scratches", servicing: "service-due" };
export const jobUrl = (slug) => (JOB_TO_PROBLEM[slug] ? `/dubai/problem/${JOB_TO_PROBLEM[slug]}/` : `/dubai/job/${slug}/`);
