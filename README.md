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

### Indexing rule

A brand, model, area or job page is only indexed by Google when it has **3+ garages with real evidence** (confidence medium or high, from reviews or owner recommendations) **and** an approved intro in `src/content/intros.json`. Until then it carries `noindex` and stays out of the sitemap. Garage pages are indexed when they have real evidence for at least one specialty.

### Reviews

Ratings from Google and other sites are shown under "What the internet says" and never mixed into GarageGuide ratings. `aggregateRating` schema will only be built from GarageGuide's own owner reviews (Supabase, next step).

## Deploy (Cloudflare Pages)

Build command `npm run build`, output directory `dist`, environment variable `SITE_URL`.
