// Copies the public part (Part A) of the legal drafts into src/content/legal/*.md.
// Usage: node scripts/legal-import.mjs /path/to/car-website/legal
// Square-bracket placeholders become settings from src/lib/site.js ({{operator}}, {{emailX}}).
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/legal-import.mjs <legal folder>"); process.exit(1); }
const out = path.resolve("src/content/legal");
fs.mkdirSync(out, { recursive: true });

const FILES = {
  "privacy-policy.md": "privacy",
  "terms-of-use.md": "terms",
  "review-guidelines.md": "review-guidelines",
  "takedown-and-right-of-reply.md": "right-of-reply",
};
const SUBS = [
  [/\[Rishal full name\]/g, "{{operator}}"],
  [/\*Last updated: \[date\]\*/g, "*Last updated: {{updated}}*"],
  [/privacy@knowsmycar\.ae/g, "{{emailPrivacy}}"],
  [/reply@knowsmycar\.ae/g, "{{emailReply}}"],
  [/hello@knowsmycar\.ae/g, "{{emailHello}}"],
  [/, or WhatsApp \[number\]/g, ""],
  [/\[email provider\]/g, "our email provider"],
  [/\[the EU \/ the US\]/g, "the EU or the US"],
  [/\[([0-9]+ (?:months|days))\]/g, "$1"],
  [/\[(Cloudflare Web Analytics|Supabase|Cloudflare|Google)\]/g, "$1"],
];

for (const [file, slug] of Object.entries(FILES)) {
  const text = fs.readFileSync(path.join(src, file), "utf8");
  // Part A is the first run of blockquote lines.
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.startsWith(">"));
  let end = first;
  while (end < lines.length && (lines[end].startsWith(">") || lines[end].trim() === "")) end++;
  let body = lines.slice(first, end).map((l) => l.replace(/^> ?/, "")).join("\n").trim();
  const title = (body.match(/^\*\*Title:\*\*\s*(.+)$/m) || [])[1] || slug;
  body = body.replace(/^\*\*Title:\*\*.*\n+/m, "");
  for (const [re, to] of SUBS) body = body.replace(re, to);
  const left = body.match(/\[[^\]]+\](?!\()/g);
  if (left) console.warn(`[legal] ${slug}: unfilled placeholders ${left.join(", ")}`);
  fs.writeFileSync(path.join(out, `${slug}.md`), `---\ntitle: ${JSON.stringify(title)}\n---\n\n${body}\n`);
  console.log(`[legal] wrote ${slug}.md`);
}
