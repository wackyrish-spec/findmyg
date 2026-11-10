// Cost guides (SEO two-week plan): markdown in src/content/guides/, URL from frontmatter `url`.
// Indexed when status says approved or published. Article + FAQPage schema; never Review/AggregateRating.
const files = Object.values(import.meta.glob("../content/guides/*.md", { eager: true }));
export const GUIDES = files.map((f) => {
  const fm = f.frontmatter || {};
  const parts = String(fm.url || "").split("/").filter(Boolean); // dubai, make[, model], service-cost
  const raw = typeof f.rawContent === "function" ? f.rawContent() : "";
  const faqBlock = raw.split(/^## FAQ\s*$/m)[1] || "";
  const faq = [...faqBlock.matchAll(/^\*\*(.+?)\*\*\s*\n([\s\S]+?)(?=\n\s*\n|\n\*\*|$)/gm)].map((m) => ({ q: m[1].trim(), a: m[2].trim().replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") }));
  return { f, fm, make: parts[1], model: parts.length === 4 ? parts[2] : null, url: fm.url, faq,
    live: /^(approved|published)/i.test(String(fm.status || "")), updated: fm.updated || "2026-11-10" };
}).filter((g) => g.url && g.make);
export const guideFor = (makeSlug, modelSlug = null) => GUIDES.find((g) => g.make === makeSlug && g.model === modelSlug);
