// Price points for the quote check (C5), fetched by /check-a-quote/ only.
import { quotePoints, BENCHMARKS } from "../lib/data.js";
export function GET() {
  return new Response(JSON.stringify({ jobs: BENCHMARKS.filter((b) => !b.pageOnly).map((b) => ({ k: b.key, n: b.name })), points: quotePoints() }), { headers: { "Content-Type": "application/json" } });
}
