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
  // Centred layout: WhatsApp and iMessage crop to a near-square on some phones, so the title, the number and the chips
  // sit inside the middle ~760px. The logo and domain live in the corners, where a crop loses nothing important.
  const tsize = title.length > 30 ? 84 : title.length > 20 ? 100 : 116;
  const proof = stat
    ? h("div", { alignItems: "baseline", gap: 16, marginTop: 26 },
        h("div", { fontFamily: "BC", fontWeight: 800, fontSize: 96, lineHeight: 0.9, color: AMBER }, String(stat.big)),
        h("div", { fontFamily: "MR", fontWeight: 700, fontSize: 28, lineHeight: 1.25, color: WHITE, maxWidth: 520 }, stat.label))
    : meterInfo
    ? h("div", { flexDirection: "column", alignItems: "center", gap: 10, marginTop: 26 },
        h("div", { alignItems: "center", gap: 16 },
          meter(meterInfo.level),
          h("div", { fontFamily: "BC", fontWeight: 800, fontSize: 48, lineHeight: 1, color: WHITE, textTransform: "uppercase" }, LEVELS[meterInfo.level] || "")),
        h("div", { fontFamily: "MR", fontWeight: 700, fontSize: 24, lineHeight: 1.3, color: MUTED }, meterInfo.label))
    : null;
  return h("div", { width: 1200, height: 630, background: INK, padding: "40px 56px 36px", flexDirection: "column", position: "relative" },
    h("div", { position: "absolute", left: 0, top: 0, width: 12, height: 630, background: AMBER }),
    h("div", { justifyContent: "space-between", alignItems: "center" },
      logo(34),
      h("div", { fontFamily: "MR", fontWeight: 700, fontSize: 22, color: MUTED }, "knowsmycar.com")),
    h("div", { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 180px" },
      eyebrow && h("div", { fontFamily: "MR", fontWeight: 800, fontSize: 24, letterSpacing: 3, color: AMBER, textTransform: "uppercase" }, eyebrow),
      h("div", { fontFamily: "BC", fontWeight: 800, fontSize: tsize, lineHeight: 0.95, color: WHITE, textTransform: "uppercase", marginTop: 14, justifyContent: "center", textAlign: "center" }, title),
      proof,
      chips.length > 0 && h("div", { gap: 12, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }, chips.slice(0, 4).map(chip))),
    h("div", { justifyContent: "center", fontFamily: "MR", fontWeight: 700, fontSize: 20, color: MUTED }, foot));
}

export async function png(node) {
  const svg = await satori(node, { width: 1200, height: 630, fonts: fonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

export const pngResponse = (buf) => new Response(buf, { headers: { "Content-Type": "image/png" } });
