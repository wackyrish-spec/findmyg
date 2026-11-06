export function GET({ site }) {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /review/\n\nSitemap: ${new URL("/sitemap.xml", site)}\n`, { headers: { "Content-Type": "text/plain" } });
}
