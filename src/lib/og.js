// Build-time Open Graph images (1200x630 PNG) in the KnowsMyCar style.
// satori lays out the card, resvg turns the SVG into a PNG. Fonts come from brand/fonts so the build needs no network.
import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { LEVELS } from "./data.js";

const INK = "#14171C", AMBER = "#FFB400", WHITE = "#FFFFFF", MUTED = "#9AA3B1", LINE = "#2C323C";
const fontDir = path.resolve(process.cwd(), "brand/fonts");
const font = (file, name, weight) => ({ name, weight, style: "normal", data: fs.readFileSync(path.join(fontDir, file)) });
let FONTS;
const fonts = () => (FONTS ||= [
  font("BarlowCondensed-800.ttf", "BC", 800),
  font("BarlowCondensed-700.ttf", "BC", 700),
  font("Manrope-700.ttf", "MR", 700),
  font("Manrope-800.ttf", "MR", 800),
  font("JetBrainsMono-600.ttf", "JB", 600),
]);

// tiny hyperscript: h(type, style, ...children)
const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) } });

const logo = (size = 44) => {
  const word = (t) => h("div", { fontFamily: "BC", fontWeight: 800, fontSize: size, color: WHITE, letterSpacing: size * 0.02, lineHeight: 1 }, t);
  return h("div", { alignItems: "center", gap: size * 0.07 },
    word("KNOWS"),
    h("div", { background: AMBER, color: INK, borderRadius: size * 0.12, padding: `${size * 0.1}px ${size * 0.12}px ${size * 0.06}px`, fontFamily: "BC", fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.02 }, "MY"),
    word("CAR"));
};

const chip = (t) => h("div", { background: AMBER, color: INK, borderRadius: 8, padding: "10px 14px", fontFamily: "JB", fontWeight: 600, fontSize: 26, lineHeight: 1 }, t);
const meter = (n) => h("div", { gap: 6 }, [1, 2, 3].map((i) => h("div", { width: 14, height: 40, borderRadius: 3, background: i <= n ? AMBER : LINE })));

/**
 * card({ eyebrow, title, chips, stat: { big, label } | meter: { level, label }, foot })
 */
export function card({ eyebrow = "", title, chips = [], stat = null, meterInfo = null, foot = "Independent. No paid listings. Every specialist backed by owner reviews." }) {
  const roomy = !stat && !meterInfo;
  const tsize = roomy ? (title.length > 40 ? 84 : 104) : title.length > 34 ? 64 : title.length > 22 ? 78 : 96;
  const right = stat
    ? h("div", { flexDirection: "column", alignItems: "flex-start", justifyContent: "center", width: 300, paddingLeft: 40, borderLeft: `2px solid ${LINE}` },
        h("div", { fontFamily: "BC", fontWeight: 800, fontSize: 168, lineHeight: 0.9, color: AMBER }, String(stat.big)),
        h("div", { fontFamily: "MR", fontWeight: 700, fontSize: 24, lineHeight: 1.3, color: WHITE, marginTop: 14 }, stat.label))
    : meterInfo
    ? h("div", { flexDirection: "column", justifyContent: "center", width: 300, paddingLeft: 40, borderLeft: `2px solid ${LINE}`, gap: 16 },
        meter(meterInfo.level),
        h("div", { fontFamily: "BC", fontWeight: 800, fontSize: 44, lineHeight: 1, color: WHITE, textTransform: "uppercase" }, LEVELS[meterInfo.level] || ""),
        h("div", { fontFamily: "MR", fontWeight: 700, fontSize: 22, lineHeight: 1.35, color: MUTED }, meterInfo.label))
    : null;
  return h("div", { width: 1200, height: 630, background: INK, padding: "56px 64px", flexDirection: "column", position: "relative" },
    h("div", { position: "absolute", left: 0, top: 0, width: 12, height: 630, background: AMBER }),
    logo(44),
    h("div", { flex: 1, alignItems: "center", marginTop: 20 },
      h("div", { flex: 1, flexDirection: "column", justifyContent: "center", paddingRight: 40 },
        eyebrow && h("div", { fontFamily: "MR", fontWeight: 800, fontSize: 24, letterSpacing: 3, color: AMBER, textTransform: "uppercase" }, eyebrow),
        h("div", { fontFamily: "BC", fontWeight: 800, fontSize: tsize, lineHeight: 0.95, color: WHITE, textTransform: "uppercase", marginTop: 14 }, title),
        chips.length > 0 && h("div", { gap: 12, marginTop: 28, flexWrap: "wrap" }, chips.slice(0, 4).map(chip))),
      right),
    h("div", { borderTop: `2px solid ${LINE}`, paddingTop: 20, justifyContent: "space-between", fontFamily: "MR", fontWeight: 700, fontSize: 22, color: MUTED },
      h("div", {}, foot),
      h("div", { color: WHITE }, "knowsmycar.ae")));
}

export async function png(node) {
  const svg = await satori(node, { width: 1200, height: 630, fonts: fonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

export const pngResponse = (buf) => new Response(buf, { headers: { "Content-Type": "image/png" } });
