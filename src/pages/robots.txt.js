import { SITE } from "../lib/site.js";
// When indexing is off (branch previews, or PUBLIC_INDEXING=off) the whole site is closed to crawlers.
export function GET({ site }) {
  const rules = SITE.indexing ? "Allow: /\nDisallow: /review/" : "Disallow: /";
  return new Response(`User-agent: *\n${rules}\n\nSitemap: ${new URL("/sitemap.xml", site)}\n`, { headers: { "Content-Type": "text/plain" } });
}
