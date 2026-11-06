import { GARAGES } from "../../../lib/data.js";
import { card, png, pngResponse } from "../../../lib/og.js";

export function getStaticPaths() {
  return GARAGES.map((g) => ({ params: { slug: g.slug }, props: { g } }));
}

export async function GET({ props: { g } }) {
  const evidenced = (g.hasEvidence || g.ownerCount > 0) && !g.isDealer;
  const top = evidenced ? g.specs[0] : null;
  const chips = !evidenced ? [] : [...new Set(g.specs.flatMap((s) => [s.make, ...s.models.slice(0, 2)]))].slice(0, 4);
  return pngResponse(await png(card({
    eyebrow: ["Garage", g.area || "Dubai"].join(" · "),
    title: g.name.replace(/\s*[\[(|].*$/, "").trim() || g.name,
    chips,
    meterInfo: top && top.conf ? { level: top.conf, label: `for ${top.make}${top.mentions ? `, from ${top.mentions} review mentions` : ""}` } : null,
  })));
}
