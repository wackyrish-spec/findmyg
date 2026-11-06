// Fetches approved owner reviews from Supabase at build time.
// Without Supabase settings the site builds with no owner reviews.
const URL_ = import.meta.env.PUBLIC_SUPABASE_URL;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const COLS = "id,created_at,garage_slug,display_name,car_make,car_model,car_year,job,price_paid,quote_vs_final,knew_car,rating,showed_old_parts,called_before_extra,would_return,body,dealer_quote,job_note";
// Added by supabase/004; the build falls back to COLS if that file hasn't been run yet.
const COLS_TRY = [`${COLS},garage_reply,garage_reply_at,photo_path`, `${COLS},garage_reply,garage_reply_at`, COLS];

export async function loadReviews() {
  // For local testing: REVIEWS_FIXTURE=path/to/reviews.json npm run build
  if (process.env.REVIEWS_FIXTURE) {
    const { readFileSync } = await import("node:fs");
    const by = {};
    JSON.parse(readFileSync(process.env.REVIEWS_FIXTURE, "utf8")).forEach((r) => (by[r.garage_slug] ||= []).push(r));
    return by;
  }
  if (!URL_ || !KEY) return {};
  try {
    const get = (cols) => fetch(`${URL_}/rest/v1/reviews?select=${cols}&order=created_at.desc&limit=10000`, { headers: { apikey: KEY } });
    let res;
    for (const cols of COLS_TRY) { res = await get(cols); if (res.status !== 400 && res.status !== 401) break; }
    if (!res.ok) { console.warn(`[reviews] Supabase returned ${res.status}; building without owner reviews`); return {}; }
    const rows = await res.json();
    const by = {};
    rows.forEach((r) => (by[r.garage_slug] ||= []).push(r));
    console.log(`[reviews] loaded ${rows.length} approved reviews`);
    return by;
  } catch (e) {
    console.warn("[reviews] could not reach Supabase; building without owner reviews", e.message);
    return {};
  }
}

export function ownerStats(list) {
  if (!list || !list.length) return null;
  const n = list.length;
  const avg = list.reduce((a, r) => a + r.rating, 0) / n;
  const q = list.filter((r) => r.quote_vs_final);
  const qa = q.length ? q.filter((r) => r.quote_vs_final !== "higher").length / q.length : null;
  const back = list.filter((r) => r.would_return).length / n;
  return { n, avg, qa, qn: q.length, back };
}
