import { card, png, pngResponse } from "../../lib/og.js";

export async function GET() {
  return pngResponse(await png(card({
    eyebrow: "Dubai · free · independent",
    title: "Find the garage that knows your car",
    chips: ["958", "MK5 GTI", "LC200", "W204"],
  })));
}
