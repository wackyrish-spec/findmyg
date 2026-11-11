"""KnowsMyCar Instagram carousels (1080x1350, up to 10 slides) and story cards (1080x1920).

python3 brand/social/make_carousel.py brand/social/carousels.sample.json brand/social/out/carousels
One JSON entry per post: {"kind": "paid"|"who"|"poll"|"verdict", "name": "...", ...}. See carousels.sample.json.
Writes <name>-1.png ... <name>-N.png (or <name>.png for single cards).

Colour rule: amber marks owner evidence only. Published or dealer figures are white/grey, and each one carries a source label.
"sample": true (the default) stamps SAMPLE DATA on every slide; set it to false only for real, sourced numbers.
"""
import html, json, os, pathlib, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from make_social import CSS as BASE_CSS, LOGO, ROOT  # noqa: E402

e = html.escape
CSS = BASE_CSS + """
.c{--pad:84px}
.c>*{flex-shrink:0}
/* amber = evidence only: headline emphasis and eyebrows stay neutral here */
h1 em{color:#FFFFFF}h1{color:#C9CED6}h1:not(:has(em)){color:#FFFFFF}
.eyebrow{color:#9AA3B1}
.top{display:flex;align-items:center;justify-content:space-between}
.count{font:700 26px/1 MR;color:#9AA3B1;letter-spacing:.06em}
.stamp{position:static}
.src{display:inline-block;font:700 24px/1.2 MR;color:#C9CED6;border:2px solid #3A414C;border-radius:10px;padding:10px 14px}
.src.own{border-color:#FFB400;color:#FFB400}
.swipe{font:800 30px/1 MR;color:#fff;display:flex;align-items:center;gap:14px}
.swipe i{display:inline-block;width:64px;height:4px;background:#fff;position:relative}
.swipe i::after{content:"";position:absolute;right:-2px;top:-8px;border:10px solid transparent;border-left:14px solid #fff;border-right:0}
.bars{display:flex;flex-direction:column;gap:36px}
.bar .l{display:flex;justify-content:space-between;font:800 34px/1 MR;margin-bottom:14px}
.bar .l span:last-child{font:800 52px/1 BC;font-variant-numeric:tabular-nums}
.bar .t{height:44px;background:#1C222B;border-radius:8px;position:relative}
.bar .f{position:absolute;top:0;bottom:0;border-radius:8px}
.bar.dealer .f{background:#5B6370}
.bar.indep .f{background:#FFFFFF}
.bar.own .f{background:#FFB400}
.note{font:500 34px/1.45 MR;color:#C9CED6}
.note b{color:#fff}
ul.pts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:26px}
ul.pts li{font:700 38px/1.3 MR;padding-left:44px;position:relative}
ul.pts li::before{content:"";position:absolute;left:0;top:14px;width:20px;height:20px;border-radius:4px;background:#3A414C}
.gens{display:flex;gap:14px;flex-wrap:wrap}
.gens .g{font:600 34px/1 JB;padding:12px 16px;border-radius:10px;border:2px solid #3A414C;color:#fff}
.meter{display:flex;gap:6px}.meter i{width:16px;height:52px;border-radius:3px;background:#2C323C}.meter i.on{background:#FFB400}
.opt{border:3px dashed #3A414C;border-radius:24px;height:300px;display:flex;align-items:center;justify-content:center;font:700 30px/1.3 MR;color:#5B6370;text-align:center;padding:0 40px}
.verdict{display:inline-flex;align-items:center;gap:18px;font:800 80px/1 BC;text-transform:uppercase;padding:18px 30px;border-radius:16px}
.v-fair{background:#3FBF82;color:#0E1116}.v-high{background:#E0A54A;color:#0E1116}.v-over{background:#F07A66;color:#0E1116}
.vs{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.vs>div{background:#1C222B;border-radius:20px;padding:30px}
.vs .k{font:800 24px/1 MR;letter-spacing:.12em;text-transform:uppercase;color:#9AA3B1}
.vs .v{font:800 76px/1 BC;margin-top:16px;font-variant-numeric:tabular-nums}
.vs .s{font:700 26px/1.3 MR;color:#9AA3B1;margin-top:10px}
"""

def money(v):
    return f"{int(v):,}"

def frame(inner, i=None, n=None, sample=True, h=1350, foot=True):
    count = f'<span class="count">{i}/{n}</span>' if n and n > 1 else ""
    stamp = '<span class="stamp">SAMPLE DATA</span>' if sample else ""
    pad = "padding-top:200px;padding-bottom:260px;" if h == 1920 else ""
    footer = ('<div class="foot"><span>Independent. No paid listings. Not affiliated with any car maker.</span>'
              '<b>knowsmycar.com</b></div>') if foot else ""
    return (f'<div class="c" style="--h:{h}px;{pad}"><div class="top"><div class="logo">{LOGO}</div>'
            f'<div style="display:flex;gap:18px;align-items:center">{stamp}{count}</div></div>'
            f'<div style="height:64px"></div>{inner}{footer}</div>')

def src_label(s, own=False):
    return f'<span class="src{" own" if own else ""}">{e(s)}</span>'

# ---------- 1. What owners paid ----------
def paid(d):
    own = d.get("source_kind") == "owners"
    lo, hi = d["indep"]["low"], d["indep"]["high"]
    dealer = d.get("dealer")
    dlo, dhi = (dealer["low"], dealer["high"]) if dealer else (None, None)
    top = max(dhi or 0, hi) * 1.05
    pct = lambda v: 100 * v / top
    s = []
    s.append(f"""<div class="eyebrow">{'What owners paid' if own else 'What it costs'} · Dubai</div>
{f'<div style="margin-top:34px"><span class="chip">{e(d["code"])}</span></div>' if d.get("code") else ""}
<h1 style="margin-top:28px">{e(d['model'])}<br><em>{e(d['job'])}</em></h1>
<div class="gap"></div>
<div class="sub">{e(d['hook'])}</div>
<div class="swipe" style="margin-top:40px">Swipe <i></i></div><div style="height:50px"></div>""")
    big_cls = 'style="color:#FFB400"' if own else 'style="color:#fff"'
    s.append(f"""<div class="eyebrow">At an independent specialist</div>
<div class="gap"></div>
<div class="big" {big_cls}><small>AED</small>{money(lo)}–{money(hi)}</div>
<div style="margin-top:30px">{src_label(d['indep']['source'], own)}</div>
<div class="gap"></div>
<div class="note">{e(d['indep'].get('note',''))}</div><div style="height:50px"></div>""")
    fill = lambda a, b: f'left:{pct(a):.1f}%;width:{max(pct(b) - pct(a), 1.5):.1f}%'
    dealer_row = (f'<div class="bar dealer"><div class="l"><span>Main dealer</span><span>AED {money(dlo)}–{money(dhi)}</span></div><div class="t"><div class="f" style="{fill(dlo, dhi)}"></div></div></div>'
                  if dealer else
                  '<div class="bar dealer"><div class="l"><span>Main dealer</span><span style="color:#9AA3B1">Not published</span></div><div class="t" style="background:transparent;border:3px dashed #3A414C"></div></div>')
    s.append(f"""<div class="eyebrow">Dealer vs independent</div>
<h1 style="margin-top:24px;font-size:96px">The gap</h1>
<div class="gap"></div>
<div class="bars">
 {dealer_row}
 <div class="bar {'own' if own else 'indep'}"><div class="l"><span>Independent</span><span>AED {money(lo)}–{money(hi)}</span></div><div class="t"><div class="f" style="{fill(lo, hi)}"></div></div></div>
</div>
<div style="margin-top:40px;display:flex;flex-direction:column;gap:12px;align-items:flex-start">{src_label('Dealer: ' + dealer['source']) if dealer else ''}{src_label('Independent: ' + d['indep']['source'], own)}</div>
{f'<div class="sub" style="margin-top:30px">{e(d["dealer_note"])}</div>' if not dealer and d.get("dealer_note") else ''}
<div class="gap"></div>""")
    pts = "".join(f"<li>{e(p)}</li>" for p in d["drivers"])
    s.append(f"""<div class="eyebrow">What moves the price</div>
<div class="gap"></div><ul class="pts">{pts}</ul><div class="gap"></div>""")
    s.append(cta(d.get("cta", "Had this job done? Add your price. It's anonymous, and the next owner will thank you."), d.get("cta_title", "Full list and prices: link in bio")))
    return s

def cta(body, title):
    return f"""<div class="gap"></div>
<h1 style="font-size:104px">{e(title)}</h1>
<div class="sub" style="margin-top:34px">{e(body)}</div>
<div class="gap"></div>
<div class="sub muted" style="font-size:30px">Follow @knowsmycar · Save this for later</div><div style="height:50px"></div>"""

# ---------- 2. Who fixes yours? ----------
def who(d):
    s = [f"""<div class="eyebrow">Dubai · {e(d['make'])}</div>
<h1 style="margin-top:28px">Who fixes<br><em>your {e(d['model'])}?</em></h1>
<div class="gap"></div>
<div class="sub">{e(d['hook'])}</div>
<div class="sub muted" style="font-size:30px;margin-top:16px">Ranked by owner evidence, never by payment.</div>
<div class="swipe" style="margin-top:40px">Swipe <i></i></div><div style="height:50px"></div>"""]
    for g in d["garages"][:8]:  # Instagram allows 10 slides: cover + up to 8 garages + CTA
        meter = "".join("<i class=on></i>" if k < g.get("level", 0) else "<i></i>" for k in range(3))
        gens = "".join(f'<span class="g">{e(x)}</span>' for x in g.get("generations", []))
        s.append(f"""<div class="eyebrow">{e(g['area'])}</div>
<h1 style="margin-top:24px;font-size:104px">{e(g['name'])}</h1>
{f'<div style="margin-top:24px;color:#9AA3B1;font:700 30px/1 MR">{e(g["handle"])}</div>' if g.get("handle") else ""}
<div class="gap"></div>
<div style="display:flex;align-items:center;gap:22px"><span class="meter">{meter}</span><span style="font:800 52px/1 BC;text-transform:uppercase">{e(g.get('level_label',''))}</span></div>
<div class="sub" style="margin-top:22px;color:#FFB400">{e(g['evidence'])}</div>
<div style="margin-top:44px" class="gens">{gens}</div>
<div class="gap"></div>""")
    s.append(cta("Used one of these for your " + d["model"] + "? Tell the next owner. Two minutes.", "Used one? Tell the next owner"))
    return s

# ---------- 3. Poll / question story ----------
def poll(d):
    return [f"""<div class="eyebrow">{e(d.get('eyebrow','Fair or overcharged?'))}</div>
<div style="margin-top:30px"><span class="chip">{e(d['code'])}</span></div>
<h1 style="margin-top:28px;font-size:100px">{e(d['question'])}</h1>
<div class="sub muted" style="margin-top:24px">{e(d.get('detail',''))}</div>
<div class="gap"></div>
<div class="opt">Place the Instagram poll sticker here</div>
<div class="gap"></div>
<div class="sub">{e(d.get('ask','Got a quote? Send it to us. We compare it with what owners paid.'))}</div>"""]

# ---------- 4. Fair or overcharged? verdict ----------
VERDICT = {"fair": ("v-fair", "Fair"), "high": ("v-high", "On the high side"), "over": ("v-over", "Overcharged")}
def verdict(d):
    cls, word = VERDICT[d["verdict"]]
    own = d.get("source_kind") == "owners"
    return [f"""<div class="eyebrow">Fair or overcharged?</div>
<div style="margin-top:30px"><span class="chip">{e(d['code'])}</span></div>
<h1 style="margin-top:22px;font-size:84px">{e(d['model'])}<br><em>{e(d['job'])}</em></h1>
<div class="gap"></div>
<div class="vs">
 <div><div class="k">The quote</div><div class="v">{money(d['quote'])}</div><div class="s">AED · {e(d.get('quote_from','a follower, anonymised'))}</div></div>
 <div><div class="k">{"Owners paid" if own else "Independents charge"}</div><div class="v" style="color:{'#FFB400' if own else '#fff'}">{money(d['range'][0])}–{money(d['range'][1])}</div><div class="s">AED · {e(d['source'])}</div></div>
</div>
<div style="margin-top:34px"><span class="verdict {cls}">{e(word)}</span></div>
<div class="sub" style="margin-top:24px;font-size:34px">{e(d['why'])}</div>
<div class="gap"></div>
<div class="sub muted" style="font-size:30px">Garage not named. Send us your quote, we'll check it.</div><div style="height:40px"></div>"""]

KINDS = {"paid": (paid, 1350), "who": (who, 1350), "poll": (poll, 1920), "verdict": (verdict, 1350)}

def render(d, out):
    fn, h = KINDS[d["kind"]]
    slides = fn(d)
    n = len(slides)
    names = []
    for i, inner in enumerate(slides, 1):
        name = d["name"] + (f"-{i}" if n > 1 else "")
        hp = os.path.join(out, name + ".html")
        open(hp, "w").write(f"<!doctype html><meta charset=utf-8><style>{CSS}</style>"
                            + frame(inner, i, n, d.get("sample", True), h, foot=h != 1920))
        subprocess.run(["node", str(ROOT / "scripts" / "render.cjs"), hp, os.path.join(out, name + ".png"), "1080", str(h), "1"], check=True)
        os.remove(hp)
        names.append(name)
    return names

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for d in json.load(open(src)):
        print(", ".join(render(d, out)))
