// Sitemap <lastmod> (Karim/Omar 28 Nov): each URL's real last content change, never the build time.
// Content pages use the last git commit that touched their source file; data-driven pages use the last
// commit to data/garages.json. If git history is missing (shallow clone), fall back to data-updated.json.
import { execFileSync } from "node:child_process";
import dataUpdated from "../content/data-updated.json";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const cache = new Map();
let usable = null;
function gitOk() {
  if (usable !== null) return usable;
  try { usable = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() === "false"; } catch { usable = false; }
  return usable;
}
export function gitDate(file) {
  if (!file) return "";
  if (cache.has(file)) return cache.get(file);
  let d = "";
  if (gitOk()) { try { d = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { encoding: "utf8" }).trim(); } catch { d = ""; } }
  if (!ISO.test(d)) d = "";
  cache.set(file, d);
  return d;
}
const later = (...ds) => ds.filter((d) => ISO.test(d || "")).sort().at(-1) || "";
export const DATA_DATE = () => later(gitDate("data/garages.json"), dataUpdated.date);
// A content file: its git date, or its ISO `updated` frontmatter, whichever is later; data date as the last resort.
export const contentDate = (file, fmUpdated) => later(gitDate(file), ISO.test(String(fmUpdated || "")) ? String(fmUpdated) : "") || DATA_DATE();
// A data-driven page: the data date, or a later change to its own supporting file (e.g. intros.json).
export const dataPageDate = (...files) => later(DATA_DATE(), ...files.map(gitDate));
