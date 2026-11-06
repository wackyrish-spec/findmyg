"""KnowsMyCar social templates (Instagram 1080x1350 portrait, stories/TikTok 1080x1920).

python3 brand/social/make_social.py brand/social/cards.sample.json brand/social/out
Each entry in the JSON: {"template": "paid"|"who"|"quote", "format": "post"|"story", ...fields}. See cards.sample.json.
Sample renders carry a "SAMPLE DATA" stamp; set "sample": false for real posts.
"""
import html, json, os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
FONTS = (ROOT / "fonts").as_uri()
LOGO = (ROOT / "logo" / "logo-a-on-dark.svg").read_text()
e = html.escape

CSS = f"""
@font-face{{font-family:BC;src:url({FONTS}/BarlowCondensed-800.ttf);font-weight:800}}
@font-face{{font-family:BC;src:url({FONTS}/BarlowCondensed-700.ttf);font-weight:700}}
@font-face{{font-family:MR;src:url({FONTS}/Manrope-500.ttf);font-weight:500}}
@font-face{{font-family:MR;src:url({FONTS}/Manrope-700.ttf);font-weight:700}}
@font-face{{font-family:MR;src:url({FONTS}/Manrope-800.ttf);font-weight:800}}
@font-face{{font-family:JB;src:url({FONTS}/JetBrainsMono-600.ttf);font-weight:600}}
*{{box-sizing:border-box;margin:0}}
html,body{{background:#14171C}}
.c{{width:1080px;height:var(--h);background:#14171C;color:#fff;padding:84px 84px 72px;display:flex;flex-direction:column;position:relative;overflow:hidden}}
.c::before{{content:"";position:absolute;left:0;top:0;bottom:0;width:18px;background:#FFB400}}
.logo svg{{height:58px;width:auto;display:block}}
.stamp{{position:absolute;right:84px;top:96px;font:800 22px/1 MR;letter-spacing:.12em;color:#14171C;background:#9AA3B1;padding:10px 14px;border-radius:8px}}
.eyebrow{{font:800 30px/1 MR;letter-spacing:.14em;text-transform:uppercase;color:#FFB400}}
.chip{{display:inline-block;background:#FFB400;color:#14171C;font:600 38px/1 JB;padding:14px 18px;border-radius:12px}}
h1{{font:800 112px/.92 BC;text-transform:uppercase;letter-spacing:.005em}}
h1 em{{font-style:normal;color:#FFB400}}
.big{{white-space:nowrap;font:800 150px/.9 BC;color:#FFB400;font-variant-numeric:tabular-nums;letter-spacing:-.01em}}
.big small{{font-size:80px;color:#fff;margin-right:18px}}
.sub{{font:700 40px/1.3 MR;color:#fff}}
.muted{{color:#9AA3B1}}
.foot{{margin-top:auto;padding-top:30px;border-top:2px solid #2C323C;display:flex;justify-content:space-between;gap:24px;font:700 24px/1.3 MR;color:#9AA3B1}}
.foot b{{color:#fff}}
.list{{display:flex;flex-direction:column;gap:22px}}
.row{{display:flex;align-items:center;gap:28px;padding:30px 34px;background:#1C222B;border-radius:22px}}
.row .n{{font:800 72px/1 BC;color:#FFB400;width:60px}}
.row .t{{font:800 54px/1 BC;text-transform:uppercase}}
.row .m{{font:700 28px/1.3 MR;color:#9AA3B1;margin-top:6px}}
.meter{{display:flex;gap:6px;margin-left:auto}}.meter i{{width:14px;height:44px;border-radius:3px;background:#2C323C}}.meter i.on{{background:#FFB400}}
blockquote{{font:700 66px/1.18 MR;letter-spacing:-.01em}}
blockquote::before{{content:"“";display:block;font:800 220px/.6 BC;color:#FFB400;margin-bottom:20px}}
.who{{font:700 32px/1.4 MR;color:#9AA3B1;margin-top:40px}}.who b{{color:#fff}}
.gap{{flex:1}}
"""

def foot(sample):
    return '<div class="foot"><span>Independent. No paid listings. Not affiliated with any car maker.</span><b>knowsmycar.ae</b></div>'

def paid_t(d):
    s = f"""<div class="eyebrow">What owners paid · Dubai</div>
<div style="margin-top:34px"><span class="chip">{e(d['code'])}</span></div>
<h1 style="margin-top:28px">{e(d['model'])}<br><em>{e(d['job'])}</em></h1>
<div class="gap"></div>
<div class="big"><small>AED</small>{e(d['low'])}–{e(d['high'])}</div>
<div class="sub" style="margin-top:22px">from {e(str(d['reports']))} owner reports <span class="muted">· {e(d.get('period','last 12 months'))}</span></div>"""
    if d.get("dealer"):
        s += f'<div class="sub muted" style="margin-top:10px;font-size:32px">Main dealer quote: AED {e(d["dealer"])}</div>'
    return s + '<div style="height:56px"></div>'

def who_t(d):
    rows = "".join(
        f'<div class="row"><div class="n">{i+1}</div><div><div class="t">{e(g["name"])}</div><div class="m">{e(g["area"])} · {e(g["note"])}</div></div>'
        f'<div class="meter">{"".join("<i class=on></i>" if k < g["level"] else "<i></i>" for k in range(3))}</div></div>'
        for i, g in enumerate(d["garages"][:3]))
    return f"""<div class="eyebrow">Dubai · {e(d['make'])}</div>
<h1 style="margin-top:28px">Who fixes<br><em>your {e(d['model'])}?</em></h1>
<div style="margin-top:22px"><span class="chip">{e(d['code'])}</span></div>
<div class="gap"></div>
<div class="list">{rows}</div>
<div class="sub muted" style="margin-top:26px;font-size:30px">Ranked by owner evidence, never by payment. From {e(str(d['reviews']))} owner reviews.</div>
<div style="height:40px"></div>"""

def quote_t(d):
    return f"""<div class="eyebrow">Owner review · {e(d['garage'])}</div>
<div class="gap"></div>
<blockquote>{e(d['quote'])}</blockquote>
<div class="who"><b>{e(d['author'])}</b> · {e(d['car'])} <span class="chip" style="font-size:28px;padding:8px 12px;margin-left:10px;vertical-align:4px">{e(d['code'])}</span><br>{e(d['job'])}</div>
<div class="gap"></div>"""

T = {"paid": paid_t, "who": who_t, "quote": quote_t}

def render(d, out_dir, i):
    h = 1920 if d.get("format") == "story" else 1350
    stamp = '<div class="stamp">SAMPLE DATA</div>' if d.get("sample", True) else ""
    pad = "padding-top:180px;padding-bottom:220px;" if h == 1920 else ""  # keep clear of story UI
    body = f'<div class="c" style="--h:{h}px;{pad}"><div class="logo">{LOGO}</div>{stamp}<div style="height:70px"></div>{T[d["template"]](d)}{foot(True)}</div>'
    name = d.get("name") or f'{i:02d}-{d["template"]}-{d.get("format","post")}'
    hp = os.path.join(out_dir, name + ".html")
    open(hp, "w").write(f"<!doctype html><meta charset=utf-8><style>{CSS}</style>{body}")
    subprocess.run(["node", str(ROOT / "scripts" / "render.cjs"), hp, os.path.join(out_dir, name + ".png"), "1080", str(h), "1"], check=True)
    os.remove(hp)
    return name

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for i, d in enumerate(json.load(open(src)), 1):
        print(render(d, out, i))
