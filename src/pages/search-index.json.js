// Static index for the one search box: garage names and areas (loaded on first keystroke).
import { GARAGES, AREAS } from "../lib/data.js";
export function GET() {
  const garages = GARAGES.map((g) => ({ n: g.name, s: g.slug, a: g.area || "", d: g.isDealer ? 1 : 0 }));
  const areas = AREAS.map((a) => ({ n: a.name, s: a.slug }));
  return new Response(JSON.stringify({ garages, areas }), { headers: { "Content-Type": "application/json" } });
}
