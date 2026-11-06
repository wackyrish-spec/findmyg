// Render an HTML file to PDF or PNG with the pre-installed Playwright Chromium.
// node brand/scripts/render.cjs in.html out.pdf|out.png [widthPx heightPx scale]
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const [inp, out, w = "1200", h = "630", scale = "1"] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
  await p.goto("file://" + path.resolve(inp));
  await p.evaluate(() => document.fonts.ready);
  if (out.endsWith(".pdf")) await p.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  else await p.screenshot({ path: out, clip: { x: 0, y: 0, width: +w, height: +h } });
  await b.close();
})();
