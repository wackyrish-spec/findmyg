import { SITE } from "../lib/site.js";
// When indexing is off (branch previews, or PUBLIC_INDEXING=off) the whole site is closed to crawlers.
// AI search and answer crawlers are named explicitly so a later rule can't block them by accident (SEO, 12 Nov).
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "Google-Extended", "Bingbot"];
export function GET({ site }) {
  const rules = SITE.indexing ? "Allow: /\nDisallow: /review/" : "Disallow: /";
  const ai = SITE.indexing ? AI_BOTS.map((b) => `User-agent: ${b}\n${rules}\n`).join("\n") + "\n" : "";
  return new Response(`User-agent: *\n${rules}\n\n${ai}Sitemap: ${new URL("/sitemap.xml", site)}\n`, { headers: { "Content-Type": "text/plain" } });
}
