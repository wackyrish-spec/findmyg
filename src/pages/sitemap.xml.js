import { indexableUrls } from "../lib/indexable.js";

export function GET({ site }) {
  const u = (p) => new URL(p, site).toString();
  const urls = indexableUrls();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${u(p)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
