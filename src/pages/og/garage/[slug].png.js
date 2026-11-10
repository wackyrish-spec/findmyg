import { ALL_GARAGES } from "../../../lib/data.js";
import { card, png, pngResponse } from "../../../lib/og.js";

export function getStaticPaths() {
  return ALL_GARAGES.map((g) => ({ params: { slug: g.slug }, props: { g } }));
}

export async function GET({ props: { g } }) {
  const evidenced = (g.hasEvidence || g.ownerCount > 0) && !g.isDealer;
  const top = evidenced ? g.specs[0] : null;
  const chips = !evidenced ? [] : [...new Set(g.specs.flatMap((s) => [s.make, ...s.models.slice(0, 2)]))].slice(0, 4);
  return pngResponse(await png(card({
    eyebrow: ["Garage", g.area || "Dubai"].join(" · "),
    // OG fonts are Latin only: drop other scripts (e.g. Arabic) and fall back to a generic title.
    title: g.name.replace(/\s*[\[(|].*$/, "").replace(/[^\x20-\x7E\u00C0-\u024F\u2019&]/g, "").replace(/\s+/g, " ").trim() || `Garage in ${g.area || "Dubai"}`,
    chips,
    meterInfo: top && top.conf ? { level: top.conf, label: top.mentions ? `${top.mentions} ${/community/.test(top.basis) ? "community posts" : "Google reviews"} mention ${top.make}` : `for ${top.make}` } : null,
  })));
}
