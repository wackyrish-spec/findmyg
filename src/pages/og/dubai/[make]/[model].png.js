import { BRANDS, splitBrand } from "../../../../lib/data.js";
import { card, png, pngResponse } from "../../../../lib/og.js";

export function getStaticPaths() {
  return BRANDS.flatMap((b) => b.models.map((m) => ({ params: { make: b.slug, model: m.slug }, props: { b, m } })));
}

export async function GET({ props: { b, m } }) {
  const ev = m.evidenceCount > 0;
  const n = ev ? m.evidenceCount : m.garages.length;
  return pngResponse(await png(card({
    eyebrow: `Dubai · ${b.make}`,
    title: `Who fixes your ${m.model}?`,
    chips: splitBrand(m.garages, b.make, m.model).ranked.slice(0, 3).map((g) => g.name.length > 18 ? g.name.slice(0, 17) + "…" : g.name),
    stat: { big: n, label: `${n === 1 ? "garage" : "garages"} ${ev ? "owners rate" : "listed so far"} for the ${m.model}` },
  })));
}
