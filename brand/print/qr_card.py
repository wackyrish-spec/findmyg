"""Garage QR kit: A5 counter card + 100 mm window sticker, print-ready PDF.

python3 brand/print/qr_card.py --slug armotors --name "ARMotors" --known "Porsche" --known "Cayenne 958" --out brand/print/out
python3 brand/print/qr_card.py --generic --out brand/print/out     # cars-and-coffee handout, QR to the home page

QR target: https://knowsmycar.ae/review/<slug>/?src=qr  (the review form for that garage).
Needs: pip install segno ; Playwright (pre-installed) for the PDF step.
"""
import argparse, html, io, os, subprocess, pathlib
import segno

ROOT = pathlib.Path(__file__).resolve().parents[1]
FONTS = (ROOT / "fonts").as_uri()
LOGO_DARK = (ROOT / "logo" / "logo-a-on-dark.svg").read_text()
SITE = "https://knowsmycar.ae"

def qr_svg(url):
    q = segno.make(url, error="m")
    rows = list(q.matrix_iter(border=2))
    n = len(rows)
    d = "".join(f"M{x} {y}h1v1h-1z" for y, r in enumerate(rows) for x, v in enumerate(r) if v)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
            f'<rect width="{n}" height="{n}" fill="#fff"/><path d="{d}" fill="#14171C"/></svg>')

CSS = f"""
@font-face{{font-family:BC;src:url({FONTS}/BarlowCondensed-800.ttf);font-weight:800}}
@font-face{{font-family:BC;src:url({FONTS}/BarlowCondensed-700.ttf);font-weight:700}}
@font-face{{font-family:MR;src:url({FONTS}/Manrope-700.ttf);font-weight:700}}
@font-face{{font-family:MR;src:url({FONTS}/Manrope-500.ttf);font-weight:500}}
@font-face{{font-family:JB;src:url({FONTS}/JetBrainsMono-600.ttf);font-weight:600}}
*{{box-sizing:border-box;margin:0}}
body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.page{{page:card;width:148mm;height:210mm;background:#14171C;color:#fff;padding:12mm 12mm 10mm;display:flex;flex-direction:column;page-break-after:always;position:relative;overflow:hidden}}
.logo svg{{height:9mm;width:auto;display:block}}
.kicker{{font:700 9pt/1 MR;letter-spacing:.14em;text-transform:uppercase;color:#FFB400;margin-top:11mm}}
h1{{font:800 34pt/.95 BC;text-transform:uppercase;letter-spacing:.005em;margin-top:3mm}}
h1 em{{font-style:normal;color:#FFB400}}
.garage{{margin-top:6mm;display:flex;align-items:center;gap:3mm;flex-wrap:wrap}}
.garage b{{font:800 16pt/1 BC;text-transform:uppercase;letter-spacing:.02em}}
.chip{{display:inline-block;background:#FFB400;color:#14171C;font:700 10pt/1 JB;padding:1.6mm 2.2mm;border-radius:1.3mm}}
.qrwrap{{margin-top:auto;display:flex;gap:7mm;align-items:flex-end}}
.qr{{background:#fff;border-radius:3mm;padding:2mm;width:64mm;height:64mm;flex:none;position:relative}}
.qr svg{{width:100%;height:100%;display:block}}
.qr::before{{content:"";position:absolute;inset:-2.2mm;border:1.2mm solid #FFB400;border-radius:4.4mm;clip-path:polygon(0 0,28% 0,28% 6%,6% 6%,6% 28%,0 28%,0 72%,6% 72%,6% 94%,28% 94%,28% 100%,72% 100%,72% 94%,94% 94%,94% 72%,100% 72%,100% 28%,94% 28%,94% 6%,72% 6%,72% 0,100% 0,100% 100%,0 100%)}}
.steps{{font:500 10pt/1.45 MR;color:#C9CED6}}
.steps strong{{display:block;font:800 15pt/1.05 BC;text-transform:uppercase;color:#fff;margin-bottom:2mm}}
.url{{font:600 8.5pt/1.3 JB;color:#FFB400;margin-top:3mm;word-break:break-all}}
.foot{{margin-top:8mm;padding-top:4mm;border-top:.3mm solid #2C323C;font:500 8pt/1.4 MR;color:#9AA3B1}}
.stripe{{position:absolute;right:-18mm;top:22mm;width:60mm;height:8mm;background:#FFB400;transform:rotate(-0deg);display:none}}
/* sticker 100x100 */
.sticker{{page:stk;width:100mm;height:100mm;background:#14171C;color:#fff;border-radius:6mm;padding:7mm;display:flex;flex-direction:column;page-break-after:always}}
.sticker .logo svg{{height:6.5mm}}
.sticker h2{{font:800 21pt/.95 BC;text-transform:uppercase;margin-top:4mm}}
.sticker h2 em{{font-style:normal;color:#FFB400}}
.sticker .row{{display:flex;gap:4mm;align-items:flex-end;margin-top:auto}}
.sticker .qr{{width:40mm;height:40mm;padding:1.5mm;border-radius:2mm}}
.sticker .qr::before{{inset:-1.6mm;border-width:.9mm;border-radius:3mm}}
.sticker p{{font:500 7.5pt/1.4 MR;color:#C9CED6}}
"""

def card(url, headline, known_html, steps_title, steps_body, foot):
    return f"""<section class="page">
  <div class="logo">{LOGO_DARK}</div>
  <div class="kicker">Independent · No paid listings</div>
  <h1>{headline}</h1>
  {known_html}
  <div class="qrwrap">
    <div class="qr">{qr_svg(url)}</div>
    <div class="steps"><strong>{steps_title}</strong>{steps_body}<div class="url">{html.escape(url.replace('https://','').split('?')[0])}</div></div>
  </div>
  <div class="foot">{foot}</div>
</section>"""

def sticker(url, headline, sub):
    return f"""<section class="sticker">
  <div class="logo">{LOGO_DARK}</div>
  <h2>{headline}</h2>
  <div class="row"><div class="qr">{qr_svg(url)}</div><p>{sub}</p></div>
</section>"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug"); ap.add_argument("--name"); ap.add_argument("--known", action="append", default=[])
    ap.add_argument("--generic", action="store_true"); ap.add_argument("--out", default="brand/print/out")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    foot = "Independent. No paid listings. Every specialist backed by owner reviews.<br>Garages never pay to be listed or ranked on KnowsMyCar."
    if a.generic:
        url = f"{SITE}/?src=qr-meet"
        pages = card(url, "<span style=\"font-size:60pt\">Who fixes <em>yours?</em></span>", "<div class=\"garage\"><span class=\"chip\">958</span><span class=\"chip\">MK5 GTI</span><span class=\"chip\">147</span><span class=\"chip\">LC200</span><span class=\"chip\">E46 M3</span></div>",
                     "Scan · free · no ads", "See which Dubai garages owners of your car trust, and what they paid.", foot)
        pages += sticker(url, "Who fixes <em>yours?</em>", "See which Dubai garages owners of your car trust, and what they paid. Scan · free · no ads")
        name = "knowsmycar-meet-card"
    else:
        url = f"{SITE}/review/{a.slug}/?src=qr"
        known = "".join(f'<span class="chip">{html.escape(k)}</span>' for k in a.known)
        known_html = f'<div class="garage"><b>{html.escape(a.name)}</b>{known}</div>' if a.name else ""
        pages = card(url, "Did we know <em>your car?</em><br><span style=\"font-size:22pt;color:#C9CED6\">Tell the next owner on KnowsMyCar.</span>", known_html,
                     "Scan to review", "Two minutes. Was the bill what we quoted? An honest review helps the next owner find a garage that knows their car.", foot)
        pages += sticker(url, "Did we know <em>your car?</em>", "Scan to review. Tell the next owner on KnowsMyCar.")
        name = f"qr-card-{a.slug}"
    doc = f"<!doctype html><html><head><meta charset=utf-8><style>@page card{{size:148mm 210mm;margin:0}}@page stk{{size:100mm 100mm;margin:0}}{CSS}</style></head><body>{pages}</body></html>"
    h = os.path.join(a.out, name + ".html"); open(h, "w").write(doc)
    # A5 page size: set via CSS on each page; render each section to one PDF
    subprocess.run(["node", str(ROOT / "scripts" / "render.cjs"), h, os.path.join(a.out, name + ".pdf")], check=True)
    subprocess.run(["node", str(ROOT / "scripts" / "render.cjs"), h, os.path.join(a.out, name + "-preview.png"), "560", "1180", "2"], check=True)
    os.remove(h)
    print("wrote", os.path.join(a.out, name + ".pdf"))

if __name__ == "__main__":
    main()
