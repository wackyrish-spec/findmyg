# GarageGuide (findmyg)

A free, SEO-first guide to Dubai's independent specialist garages: "find the garage that knows your car".

Static site built with [Astro](https://astro.build). Every page is plain HTML generated at build time from `data/garages.json`, so Google can read it.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs static files to dist/
```

Set `SITE_URL` (for example `https://garageguide.ae`) when building for production. It's used for canonical URLs and the sitemap.

## How it's organised

| Path | What |
|---|---|
| `data/garages.json` | Garage data from the research pipeline (specialties, evidence, ratings, excerpts). Replace this file to update the site. |
| `src/lib/data.js` | Loads the data, builds brand/model/area/job indexes, ranking and the indexing rule. |
| `src/lib/catalog.js` | Car catalogue with chassis codes and aliases for the "What do you drive?" picker. |
| `src/content/intros.json` | Hand-written intros for brand/model/area/job pages. |
| `src/pages/` | URL structure (see below). |
| `src/scripts/site.js` | Browser behaviour: saved car, picker, re-ranking, match panel, WhatsApp message. |
| `src/scripts/review.js` | Owner review form: email sign-in link and saving the review to Supabase. |
| `src/lib/reviews.js` | Fetches approved owner reviews at build time. |
| `supabase/schema.sql` | Reviews table and access rules. Run once in Supabase. |

### URLs

```
/                                   home: "What do you drive?"
/dubai/                             all garages
/dubai/{make}/                      brand specialists
/dubai/{make}/{model}/              model specialists
/dubai/area/{area}/                 garages by area
/dubai/job/{job}/                   garages by job (AC repair, gearbox...)
/garage/{slug}/                     garage profile (AutoRepair schema)
/review/{slug}/                     owner review form (noindex)
/sitemap.xml, /robots.txt
```

### Listing rules

- Ranked results only include garages with evidence: a specialty backed by reviews or the community (medium or high confidence), or a GarageGuide owner review for that car.
- Garages without evidence keep their own page ("Listed, no owner reviews yet"), but never rank. On brand and model pages they appear in a collapsed "Also in Dubai" section only when fewer than 5 garages rank. Area, job and all-garage pages always list them collapsed.
- Main dealers (`business_type: "dealer"`, marque in `dealer_for`) never rank and never count as evidence. They appear only in a collapsed "Main dealer for comparison" strip on their marque's brand and model pages.

### Indexing rule

A brand, model, area or job page is only indexed by Google when it has **3+ garages with real evidence** (confidence medium or high, from reviews or owner recommendations) **and** an approved intro in `src/content/intros.json`. Until then it carries `noindex` and stays out of the sitemap. Garage pages are indexed when they have real evidence for at least one specialty.

### Reviews

Ratings from Google and other sites are shown under "What the internet says" and never mixed into GarageGuide ratings. `aggregateRating` schema is built only from GarageGuide's own approved owner reviews.

Owner reviews live in Supabase:

1. An owner fills in `/review/{slug}/`, signs in with an emailed link, and the review is saved as `pending` (`src/scripts/review.js`).
2. You approve it in Supabase (Table editor → `reviews` → set `status` to `approved`).
3. The approval fires a database webhook that calls the Cloudflare deploy hook, so the site rebuilds and the review appears on the garage page (`src/lib/reviews.js` fetches approved reviews at build time). A nightly GitHub Action rebuilds as a fallback.

Without Supabase settings the site still builds, with no owner reviews and the form shown as "opening soon". To test locally with fake reviews: `REVIEWS_FIXTURE=path/to/reviews.json npm run build`.

## Setup

### Supabase (owner reviews and sign-in)

1. SQL editor → run `supabase/schema.sql`, then `supabase/002_review_rules.sql` (6-month review limit, private WhatsApp field).
2. Authentication → URL configuration: set Site URL to the live domain and add `https://<domain>/**` to Redirect URLs.
3. Optional, Google sign-in: create an OAuth client in Google Cloud (Web application, redirect URI `https://<project>.supabase.co/auth/v1/callback`), paste its ID and secret into Authentication → Providers → Google, then set `PUBLIC_GOOGLE_SIGNIN=1` in Cloudflare. Email sign-in links work without this.
4. Project settings → API: copy the Project URL and the anon (publishable) key. Both are public. Never put the service role key in this repo or in Cloudflare.

### Cloudflare Pages (hosting)

1. Workers & Pages → Create → Pages → connect the GitHub repo.
2. Build command `npm run build`, output directory `dist`.
3. Environment variables: `SITE_URL`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, optional `PUBLIC_GOOGLE_SIGNIN` (see `.env.example`).
4. Settings → Builds → Deploy hooks: create one and copy its URL.

### Rebuild when a review is approved

- Supabase → Database → Webhooks: on `reviews` UPDATE, HTTP POST to the deploy hook URL.
- GitHub repo → Settings → Secrets → Actions: add `CF_DEPLOY_HOOK` with the same URL for the nightly rebuild.
