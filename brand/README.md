# KnowsMyCar brand kit (v1, 6 Nov 2026)

Brand sheet: https://claude.ai/artifact/S2avPHZah4eSrWELDBiSGy · Logo A confirmed by the marketer 6 Nov 2026. Print on hold until knowsmycar.ae is bought. · Direction: brand plan section 4 (`car-website/research/brand-and-growth-plan.md`).

| Folder | What | Remake |
|---|---|---|
| `logo/` | Logo options A (recommended, "chip slot"), B, C; icons; favicon; campaign variants with chassis codes. Text is outlined, no font needed. | `python3 brand/scripts/build_logos.py brand/fonts brand/logo` (needs `pip install fonttools`) |
| `tokens.json`, `tokens.css` | Colour and font tokens, same names as `src/styles/global.css`. Light and dark. | Edit `tokens.json`, regenerate the CSS |
| `print/` | Garage A5 counter card + 100 mm window sticker (PDF), and the "Who fixes yours?" meet handout. | `python3 brand/print/qr_card.py --slug <garage-slug> --name "<Name>" --known Porsche --known "Cayenne 958"` or `--generic` (needs `pip install segno`) |
| `social/` | Instagram post (1080×1350) and story (1080×1920) cards: what owners paid, who fixes yours, owner quote. | `python3 brand/social/make_social.py brand/social/cards.sample.json brand/social/out` |
| `fonts/` | Barlow Condensed, Manrope, JetBrains Mono (OFL). Used by print, social and OG images so builds need no network. | |

Open Graph images are built with the site: `src/lib/og.js` and `src/pages/og/` write `/og/default.png`, `/og/garage/<slug>.png`, `/og/dubai/<make>.png`, `/og/dubai/<make>/<model>.png` (satori + resvg, about 15 s for ~350 images). Pages still need `<meta property="og:image">` pointing at them.

Rules: amber `#FFB400` is a fill, never text on light (use `#8A5A00`). The logo chip is always amber (charcoal on amber grounds). No car clip-art. No "best", "#1" or "top" on any asset. Social templates keep the SAMPLE DATA stamp until numbers come from real owner reports.
