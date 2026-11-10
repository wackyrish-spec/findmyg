import { BRANDS } from "../../../lib/data.js";
import { card, png, pngResponse } from "../../../lib/og.js";

export function getStaticPaths() {
  return BRANDS.map((b) => ({ params: { make: b.slug }, props: { b } }));
}

export async function GET({ props: { b } }) {
  const ev = b.evidenceCount > 0;
  const n = ev ? b.evidenceCount : b.garages.length;
  return pngResponse(await png(card({
    eyebrow: "Dubai · independent specialists",
    title: `Who fixes your ${b.make}?`,
    chips: b.models.slice().sort((x, y) => y.garages.length - x.garages.length).slice(0, 4).map((m) => m.model),
    stat: { big: n, label: `${n === 1 ? "garage" : "garages"} ${ev ? "owners rate" : "listed so far"} for it` },
  })));
}
