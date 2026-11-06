"""Build KnowsMyCar logo SVGs with text outlined to paths (no font needed to view them).

Usage: python3 brand/scripts/build_logos.py <fonts_dir> <out_dir>
fonts_dir must hold BarlowCondensed-700.ttf and BarlowCondensed-800.ttf (Google Fonts, OFL).
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONTS, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

INK, PAPER, AMBER, BLUE, WHITE = "#14171C", "#F5F7FB", "#FFB400", "#1F5BFF", "#FFFFFF"

_cache = {}
def font(w):
    if w not in _cache:
        _cache[w] = TTFont(os.path.join(FONTS, f"BarlowCondensed-{w}.ttf"))
    return _cache[w]

def text(s, size, x, y, weight=800, track=0.0):
    """Return (svg path d, advance width, cap height) for s at baseline (x,y). track in em."""
    f = font(weight); gs = f.getGlyphSet(); cmap = f.getBestCmap()
    upm = f["head"].unitsPerEm; sc = size / upm
    pen = SVGPathPen(gs)
    cx = 0.0
    names = [cmap[ord(c)] for c in s]
    for i, n in enumerate(names):
        tp = TransformPen(pen, (sc, 0, 0, -sc, x + cx, y))
        gs[n].draw(tp)
        cx += gs[n].width * sc
        if i < len(names) - 1:
            cx += track * size
    cap = f["OS/2"].sCapHeight * sc
    return pen.getCommands(), cx, cap

def ink_bounds(s, size, weight=800):
    f = font(weight); gs = f.getGlyphSet(); cmap = f.getBestCmap(); sc = size / f["head"].unitsPerEm
    bp = BoundsPen(gs); x = 0
    for c in s:
        g = gs[cmap[ord(c)]]; tp = TransformPen(bp, (1, 0, 0, 1, x, 0)); g.draw(tp); x += g.width
    xmin, ymin, xmax, ymax = bp.bounds
    return xmin * sc, (x - xmax) * sc  # left and right side bearings of the whole run

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')

def chip(x, y, w, h, fill, r=None):
    r = h * 0.16 if r is None else r
    return f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r:.2f}" fill="{fill}"/>'

# ---------- Option A: chip slot  KNOWS [MY] CAR ----------
def option_a(word_ink=INK, chip_fill=AMBER, chip_ink=INK, slot="MY", size=100, track=0.02, tail="CAR"):
    weight = 800
    _, _, cap = text("K", size, 0, 0, weight)
    padv = cap * 0.30                 # chip padding above/below caps
    padh = cap * 0.26
    gap = size * 0.07
    chip_h = cap + 2 * padv
    H = chip_h
    base = padv + cap                 # baseline so caps sit centred in chip height
    parts = []
    x = 0
    lsb, _ = ink_bounds("KNOWS", size, weight)
    d, w, _ = text("KNOWS", size, x - lsb, base, weight, track); parts.append(f'<path d="{d}" fill="{word_ink}"/>')
    _, rsb = ink_bounds("KNOWS", size, weight)
    x += w - lsb - rsb + gap
    l2, r2 = ink_bounds(slot, size, weight)
    _, sw, _ = text(slot, size, 0, 0, weight, track)
    inner = sw - l2 - r2
    cw = inner + 2 * padh
    parts.append(chip(x, 0, cw, chip_h, chip_fill))
    d, _, _ = text(slot, size, x + padh - l2, base, weight, track); parts.append(f'<path d="{d}" fill="{chip_ink}"/>')
    x += cw
    if not tail:
        return x, H, "".join(parts)
    x += gap
    l3, r3 = ink_bounds(tail, size, weight)
    d, w, _ = text(tail, size, x - l3, base, weight, track); parts.append(f'<path d="{d}" fill="{word_ink}"/>')
    x += w - l3 - r3
    return x, H, "".join(parts)

def wrap(w, h, body, m, bg=None, title="KnowsMyCar"):
    W, Hh = w + 2 * m, h + 2 * m
    bgr = f'<rect width="{W:.1f}" height="{Hh:.1f}" fill="{bg}"/>' if bg else ""
    return svg(W, Hh, bgr + f'<g transform="translate({m:.2f} {m:.2f})">{body}</g>', title)

def save(name, content):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)

# A: primary, on light, on dark, one-colour
w, h, b = option_a(); save("logo-a-primary.svg", wrap(w, h, b, 0))
w, h, b = option_a(word_ink=WHITE); save("logo-a-on-dark.svg", wrap(w, h, b, 0))
w, h, b = option_a(word_ink=INK, chip_fill=INK, chip_ink=WHITE); save("logo-a-mono.svg", wrap(w, h, b, 0))
for code in ["958", "MK5", "W204", "LC200"]:
    w, h, b = option_a(slot=code, tail=""); save(f"logo-a-slot-{code.lower()}.svg", wrap(w, h, b, 0, title=f"Knows {code}"))

# ---------- Option B: pit-board K + wordmark ----------
def option_b(word_ink=INK, size=100):
    weight = 800
    _, _, cap = text("K", size, 0, 0, weight)
    bh = cap * 1.62; bw = bh * 1.28
    base = (bh + cap) / 2
    parts = [chip(0, 0, bw, bh, AMBER)]
    l, r = ink_bounds("K", size * 1.08, weight)
    _, kw, cap2 = text("K", size * 1.08, 0, 0, weight)
    inner = kw - l - r
    d, _, _ = text("K", size * 1.08, (bw - inner) / 2 - l, (bh + cap2) / 2, weight); parts.append(f'<path d="{d}" fill="{INK}"/>')
    x = bw + size * 0.16
    l, _ = ink_bounds("KNOWS", size, 700)
    d, w1, _ = text("KNOWS", size, x - l, base, 700, 0.03); parts.append(f'<path d="{d}" fill="{word_ink}"/>')
    _, r = ink_bounds("KNOWS", size, 700)
    x2 = x + w1 - l - r + size * 0.05
    d, w2, _ = text("MYCAR", size, x2, base, 700, 0.03); parts.append(f'<path d="{d}" fill="{BLUE if word_ink == INK else "#6B8FFF"}"/>')
    _, r2 = ink_bounds("MYCAR", size, 700)
    return x2 + w2 - r2, bh, "".join(parts)

w, h, b = option_b(); save("logo-b-primary.svg", wrap(w, h, b, 0))
w, h, b = option_b(word_ink=WHITE); save("logo-b-on-dark.svg", wrap(w, h, b, 0))

# ---------- Option C: stacked pit board (black board, amber letters) ----------
def option_c(size=100):
    weight = 800
    lines = ["KNOWS", "MY", "CAR"]
    _, _, cap = text("K", size, 0, 0, weight)
    lead = cap * 1.32
    widths = []
    for s in lines:
        l, r = ink_bounds(s, size, weight); _, w, _ = text(s, size, 0, 0, weight, 0.04); widths.append((w - l - r, l))
    inner = max(x for x, _ in widths)
    pad = cap * 0.55
    bw = inner + 2 * pad
    bh = cap + 2 * lead + 2 * pad
    parts = [chip(0, 0, bw, bh, INK, r=bw * 0.07)]
    for i, s in enumerate(lines):
        iw, l = widths[i]
        fill = AMBER if s != "MY" else WHITE
        d, _, _ = text(s, size, (bw - iw) / 2 - l, pad + cap + i * lead, weight, 0.04); parts.append(f'<path d="{d}" fill="{fill}"/>')
    return bw, bh, "".join(parts)

w, h, b = option_c(); save("logo-c-board.svg", wrap(w, h, b, 0))

# ---------- Icons (favicon / avatar) ----------
def icon_chip(slot="MY", size=512, bg=INK, fill=AMBER, ink=INK, radius=0.22, title="KnowsMyCar"):
    # square tile, amber chip centred, slot text inside
    S = size
    fs = S * 0.56
    l, r = ink_bounds(slot, fs, 800); _, w, cap = text(slot, fs, 0, 0, 800, 0.01)
    inner = w - l - r
    ch = cap * 1.55; cw = max(inner + cap * 0.7, ch * 1.2)
    cw = min(cw, S * 0.84)
    cx = (S - cw) / 2; cy = (S - ch) / 2
    d, _, _ = text(slot, fs, cx + (cw - inner) / 2 - l, cy + (ch + cap) / 2, 800, 0.01)
    body = (f'<rect width="{S}" height="{S}" rx="{S*radius:.1f}" fill="{bg}"/>' + chip(cx, cy, cw, ch, fill) +
            f'<path d="{d}" fill="{ink}"/>')
    return svg(S, S, body, title)

save("icon-my-dark.svg", icon_chip())
save("icon-my-amber.svg", icon_chip(bg=AMBER, fill=INK, ink=AMBER))
save("icon-k-dark.svg", icon_chip(slot="K"))

def favicon():
    # 32px grid: amber chip filling the tile, bold MY; legible at 16px
    S = 32; fs = 22
    l, r = ink_bounds("MY", fs, 800); _, w, cap = text("MY", fs, 0, 0, 800, 0)
    inner = w - l - r
    d, _, _ = text("MY", fs, (S - inner) / 2 - l, (S + cap) / 2, 800, 0)
    return svg(S, S, f'<rect width="32" height="32" rx="7" fill="{AMBER}"/><path d="{d}" fill="{INK}"/>', "KnowsMyCar")
save("favicon.svg", favicon())
print("ok", sorted(os.listdir(OUT)))
