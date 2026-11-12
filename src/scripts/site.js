// Client-side behaviour: saved car, car picker, re-ranking, match panel, WhatsApp.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LEVELS = ["No evidence", "Some experience", "Good match", "Strong match"];
const DATA = JSON.parse($("#picker-data")?.textContent || '{"rows":[],"pages":{}}');
const BRANDS = [...new Set(DATA.rows.map((r) => r.make))];

/* ---------- saved car ---------- */
// First-touch attribution: ?ref= and utm_* from the landing URL, kept for the visit.
function attribution() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("gg:ref") || "null");
    if (saved) return saved;
    const q = new URLSearchParams(location.search), r = {};
    ["ref", "utm_source", "utm_medium", "utm_campaign"].forEach((k) => { const v = q.get(k); if (v) r[k] = v.slice(0, 80); });
    if (!r.ref && q.get("src")) r.ref = q.get("src").slice(0, 80);
    sessionStorage.setItem("gg:ref", JSON.stringify(r));
    return r;
  } catch { return {}; }
}
attribution();
window.ggAttribution = attribution;
const store = {
  get(k, d) { try { const v = localStorage.getItem("gg:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("gg:" + k, JSON.stringify(v)); } catch {} },
};
let car = store.get("car", null);
const carLabel = (c) => (c ? [c.year, c.make, c.model, c.code].filter(Boolean).join(" ") : "");
const carShort = (c) => (c ? (c.model ? [c.model, c.code].filter(Boolean).join(" ") : c.make) : "");
function setCar(c) { car = c; store.set("car", c); paintCar(); }
function paintCar() {
  const b = $("#mycarBtn");
  if (b) {
    b.innerHTML = car ? `<span class="dot"></span><span>${esc(carShort(car))}</span>` : `<span>Set your car</span>`;
    b.setAttribute("aria-label", car ? `Your car: ${carLabel(car)}. Change` : "Set your car");
  }
  $$("[data-carlabel]").forEach((e) => (e.textContent = car ? carLabel(car) : "not set"));
}
// Covered / close / not yet (PM spec 12.1).
function pageFor(c) {
  const p = DATA.pages[c.make];
  if (!p) return `/car-not-covered/?make=${encodeURIComponent(c.make)}${c.model ? `&model=${encodeURIComponent(c.model)}` : ""}`;
  // Deepest page that exists. A classic generation, or a model with no page, gets the honest "no X-specific evidence" banner.
  const base = (c.model && p.models[c.model]) || p.url;
  const hasModel = !!(c.model && p.models[c.model]);
  const gap = c.classic ? (hasModel ? c.code || c.model : [c.model, c.code].filter(Boolean).join(" ")) : (c.model && !hasModel ? c.model : "");
  return gap ? `${base}?close=${encodeURIComponent(gap)}` : base;
}

/* ---------- one search box: cars, garages, areas, problems ---------- */
let IDX = null, IDXP = null;
const loadIdx = () => IDXP || (IDXP = fetch("/search-index.json").then((r) => r.json()).catch(() => ({ garages: [], areas: [] })));
const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// Typo-tolerant word match: prefix, or one edit away for words of 4+ letters.
function near(a, b) {
  if (b.startsWith(a)) return true;
  if (a.length < 4) return false;
  // A typo while still typing: compare with the same-length start of the word.
  if (a.length >= 5 && b.length > a.length + 1) b = b.slice(0, a.length);
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}
const PSTOP = new Set("my the a an is it its car cars vehicle when in on of and to with problem problems issue issues dubai please help why what i im getting get got has have keeps keep very bit".split(" "));
const pstem = (w) => w.replace(/(ing|ed|es|s)$/, "");
const problemWords = (q) => norm(q).split(" ").filter((t) => t && !PSTOP.has(t) && t.length > 1);
// Problems: forgiving match (users type sentences like "my car won't start" or "brakes squeaking").
// Filler words are ignored, word endings are trimmed, typos allowed; best match first.
function problemScores(q) {
  const ptoks = problemWords(q);
  if (!ptoks.length) return [];
  return (DATA.problems || []).map((p) => {
    const hay = norm(`${p.label} ${p.syn}`), words = hay.split(" ");
    const hit = ptoks.filter((t) => words.some((w) => near(t, w) || near(pstem(t), w) || (pstem(t).length >= 4 && pstem(w).startsWith(pstem(t))))).length;
    return { p, score: hay.includes(ptoks.join(" ")) ? 99 : hit / ptoks.length };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}
// Edit distance of 2 or less.
function lev2(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  let prev = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 2;
}
function searchOthers(q) {
  const nq = norm(q), toks = nq.split(" ").filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  // Problems: forgiving match (users type sentences like "my car won't start" or "brakes squeaking").
  // Filler words are ignored, word endings are trimmed, typos allowed; best match first.
  problemScores(q).filter((x) => x.score >= 0.6)
    .forEach(({ p }) => out.push({ type: "problem", label: p.label, slug: p.slug }));
  if (IDX && IDX.garages) {
    const gm = (fn) => IDX.garages.forEach((g) => {
      const words = norm(g.n).split(" ");
      if (toks.every((t) => words.some((w) => fn(t, w)))) out.push({ type: "garage", label: g.n, slug: g.s, sub: g.d ? "Main dealer" : g.a });
    });
    gm(near);
    // Nothing found: allow two wrong letters in longer words ("octain" finds Octane).
    if (!out.some((x) => x.type === "garage")) gm((t, w) => near(t, w) || (t.length >= 6 && lev2(t, w.slice(0, t.length + 1))));
    IDX.areas.forEach((a) => { if (toks.every((t) => norm(a.n).split(" ").some((w) => near(t, w)))) out.push({ type: "area", label: a.n, slug: a.s }); });
  }
  return [...out.filter((x) => x.type === "problem").slice(0, 3), ...out.filter((x) => x.type === "garage").slice(0, 5), ...out.filter((x) => x.type === "area").slice(0, 2)];
}

/* ---------- search ---------- */
// Short names people type for a make.
const MAKE_ALIAS = { "Mercedes-Benz": "merc mercedes benz mb", Volkswagen: "vw volkswagon", BMW: "beemer bimmer", "Land Rover": "rangie landrover lr", "Alfa Romeo": "alfa", Toyota: "", Chevrolet: "chevy" };
const makeWords = (m) => `${m} ${MAKE_ALIAS[m] || ""}`.toLowerCase().split(/[\s-]+/).filter(Boolean);
// Find a make named anywhere in the typed words ("e30 bmw", "merc e class"). Returns the make and the other words.
function resolveMake(toks) {
  const all = [...new Set(DATA.rows.map((r) => r.make))];
  for (const m of all) {
    const name = norm(m).split(" "), al = (MAKE_ALIAS[m] || "").split(" ").filter(Boolean);
    if (name.every((w) => toks.includes(w))) return { make: m, rest: toks.filter((t) => !name.includes(t)) };
    const hit = toks.find((t) => al.includes(t) || (t.length >= 4 && name.length === 1 && near(t, name[0]) && Math.abs(t.length - name[0].length) <= 1));
    if (hit) return { make: m, rest: toks.filter((t) => t !== hit && !name.includes(t)) };
  }
  return null;
}
function searchCars(q) {
  q = q.toLowerCase().replace(/\b(19[5-9]\d|20[0-3]\d)\b/, "").replace(/[^a-z0-9\s,.-]+/g, " ").trim();
  if (!q) return [];
  const toks = q.split(/[\s,-]+/).filter(Boolean);
  const out = [];
  BRANDS.forEach((b) => {
    const bl = makeWords(b).join(" ");
    if (b.toLowerCase().startsWith(q) || toks.every((t) => bl.split(" ").some((w) => w.startsWith(t)))) out.push({ make: b, model: "", code: "", years: "", score: 3, brandOnly: true });
    else if (toks.every((t) => bl.split(" ").some((w) => near(t, w)))) out.push({ make: b, model: "", code: "", years: "", score: 2, brandOnly: true });
  });
  DATA.rows.forEach((c) => {
    const hay = [c.make, MAKE_ALIAS[c.make] || "", c.model, c.code, c.aliases].join(" ").toLowerCase();
    const words = hay.split(/[\s-]+/);
    let s = 0;
    for (const t of toks) {
      if (c.code && c.code.toLowerCase() === t) s += 5;
      else if (words.includes(t)) s += 3;
      else if (words.some((w) => w.startsWith(t))) s += 1;
      else if (t.length >= 4 && /^[a-z]+$/.test(t) && words.some((w) => near(t, w))) s += 1; // one typo: "porshe cayene" (never on codes like w212)
      else { s = -1; break; }
    }
    // Classic generations sit below current ones unless their code was typed.
    if (s > 0) out.push({ ...c, score: c.classic && !toks.includes((c.code || "").toLowerCase()) ? s - 0.5 : s });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
// Nothing matched: send unknown cars to the honest "not covered" page (logs demand), and unknown problems
// to the closest problems we do cover, plus a one-line "tell us what's wrong" that logs the words (feedback table).
const OTHER_MAKES = "kia hyundai honda mazda chevrolet chevy ford gmc dodge ram chrysler mitsubishi suzuki mg geely chery haval great wall tesla volvo peugeot renault citroen skoda seat infiniti cadillac lincoln genesis subaru isuzu changan jetour byd fiat opel buick mini jaguar maserati bentley rolls royce ferrari lamborghini mclaren aston martin acura polestar lucid rivian tank exeed gac hongqi jac".split(" ");
const PROBLEM_RX = /leak|nois|sound|start|smok|overheat|vibrat|shak|light|warn|squeal|squeak|grind|jerk|slip|smell|stall|fail|broke|dead|drain|rattl|knock|stuck|rough|delay|wobbl|drip|cold|\bac\b|brake|gear|engine|clutch|tyre|tire|battery|steer|suspens|\boil\b|coolant|wont|won t|doesn|not work/;
const GARAGE_RX = /\b(garage|garages|auto|autos|motors|motor|service|services|workshop|care|centre|center|llc|repair|repairs|tuning|performance)\b/;
function noMatch(v, all) {
  const raw = v.trim().replace(/\b(19[89]\d|20[0-3]\d)\b/, "").trim().slice(0, 120), n = norm(raw), words = raw.split(/\s+/).filter(Boolean);
  const chips = (list) => `<div class="nmchips">${list.map((p) => `<a class="pill" href="/dubai/problem/${p.slug}/">${esc(p.label)}</a>`).join("")}</div>`;
  const common = all ? `<p class="sgh">Common problems</p>${chips((DATA.problems || []).slice(0, 6))}` : "";
  const notify = (make, model) => `/car-not-covered/?make=${encodeURIComponent(make)}${model ? `&model=${encodeURIComponent(model)}` : ""}`;
  // Not Latin script (e.g. Arabic): we only index English names.
  if (!n) return `<p class="nomatch">Try searching in English, like "BMW", "Patrol" or "brakes".</p>${common}`;
  // Covered make, unknown model ("BMW i3"): the brand page says the model isn't covered yet.
  const rm = resolveMake(n.split(" "));
  if (rm) {
    const model = words.filter((w) => rm.rest.includes(norm(w))).join(" ");
    if (DATA.pages[rm.make]) return `<p class="nomatch">We have no ${esc(model || "model")}-specific evidence yet. <a href="${pageFor({ make: rm.make, model })}">See ${esc(rm.make)} specialists</a>, the closest we have.</p>${common}`;
    return `<p class="nomatch">We don't cover ${esc(rm.make)} yet. We only list garages with owner evidence for a car. <a href="${notify(rm.make, model)}">Tell us you want it covered</a>.</p>${common}`;
  }
  // A make we don't cover ("Kia Sportage").
  const other = OTHER_MAKES.find((m) => n === m || n.startsWith(m + " "));
  if (other) {
    const make = words.slice(0, 1).join(" "), model = words.slice(1).join(" ");
    return `<p class="nomatch">We don't cover ${esc(make)} yet. We only list garages with owner evidence for a car. <a href="${notify(make, model)}">Tell us you want it covered</a>.</p>${common}`;
  }
  // Looks like a garage name we don't list.
  if (all && GARAGE_RX.test(n)) return `<p class="nomatch">We don't list that garage. Know it? <a href="/add-a-garage/">Suggest a garage</a>.</p>${common}`;
  // Looks like a problem we have no page for ("sunroof leaking", "gearbox jerks").
  const close = problemScores(raw).slice(0, 3).map((x) => x.p);
  if (all && (PROBLEM_RX.test(n) || (problemWords(raw).length >= 2 && close.length))) {
    return `<p class="nomatch">We don't have a page for that problem yet.${close.length ? " These are the closest:" : ""}</p>${close.length ? chips(close) : ""}
      <form class="nmtell" data-tell><label class="sr" for="tellIn">Tell us what's wrong</label><input id="tellIn" maxlength="200" placeholder="Tell us what's wrong" value="${esc(raw)}"><button class="btn sm" type="submit">Send</button></form>
      <p class="nomatch" style="padding-top:0">Got a quote already? <a href="/check-a-quote/">Check a dealer quote</a>.</p>`;
  }
  // Anything else: a car we couldn't match.
  return `<p class="nomatch">We couldn't match that car. Try the make or model, like "Cayenne" or "Giulietta". Not listed? <a href="${notify(words[0] || raw, words.slice(1).join(" "))}">Pick your car</a>.</p>${common}`;
}
document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-tell]"); if (!f) return;
  e.preventDefault();
  const note = ($("input", f).value || "").trim().slice(0, 200);
  if (note && SB_URL && SB_KEY) fetch(`${SB_URL}/rest/v1/feedback`, { method: "POST", keepalive: true, headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ page: "search:problem", helped: false, note, ref: "problem-demand" }) }).catch(() => {});
  f.outerHTML = `<p class="nomatch okmsg">Thanks. We'll use this to choose the next problem guides.</p>`;
});
function wirePicker(root, onPick, all = false) {
  const inp = $("input", root), list = $(".sugg", root);
  let items = [], act = -1;
  // Car plus problem ("Cayenne coolant leak"): match the car word on its own, and the rest as a problem.
  const mixed = (v) => {
    const w = v.trim().split(/\s+/);
    if (w.length < 2) return null;
    for (let i = 0; i < w.length; i++) {
      if (w[i].length < 3) continue;
      const cars = searchCars(w[i]).filter((c) => !c.brandOnly || w.length === 2);
      if (cars.length) {
        const probs = problemScores(w.filter((_, j) => j !== i).join(" ")).filter((x) => x.score >= 0.5).slice(0, 3)
          .map(({ p }) => ({ type: "problem", label: p.label, slug: p.slug }));
        if (probs.length) return [...cars.slice(0, 2).map((c) => ({ ...c, type: "car" })), ...probs];
      }
    }
    return null;
  };
  const find = (v) => {
    if (!all) return searchCars(v);
    const r = [...searchCars(v).slice(0, 5).map((c) => ({ ...c, type: "car" })), ...searchOthers(v)];
    return r.length ? r : (mixed(v) || []);
  };
  const head = { car: "Cars", problem: "Problems", garage: "Garages", area: "Areas" };
  const draw = () => {
    if (!items.length) {
      if (inp.value.trim().length >= 2) {
        list.innerHTML = noMatch(inp.value, all); list.hidden = false; }
      else list.hidden = true;
      inp.setAttribute("aria-expanded", "false"); return;
    }
    list.innerHTML = items.map((c, i) => {
      const h = all && (i === 0 || items[i - 1].type !== c.type) ? `<p class="sgh">${head[c.type || "car"]}</p>` : "";
      const body = c.type && c.type !== "car"
        ? `<span>${esc(c.label)}</span><small>${esc(c.sub || "")}</small>`
        : `<span>${c.brandOnly ? `${esc(c.make)} <span class="muted">· any model</span>` : `${esc(c.make)} ${esc(c.model)} ${c.code ? `<span class="code">${esc(c.code)}</span>` : ""}`}</span><small>${esc(c.years || "")}</small>`;
      return `${h}<button type="button" role="option" class="${i === act ? "act" : ""}" data-i="${i}">${body}</button>`;
    }).join("");
    list.hidden = false; inp.setAttribute("aria-expanded", "true");
  };
  const choose = (c) => {
    if (c.type === "garage") { location.href = `/garage/${c.slug}/`; return; }
    if (c.type === "area") { location.href = `/dubai/area/${c.slug}/`; return; }
    if (c.type === "problem") { location.href = `/dubai/problem/${c.slug}/`; return; }
    const yr = (inp.value.match(/\b(19[89]\d|20[0-3]\d)\b/) || [])[1] || "";
    setCar({ make: c.make, model: c.model || "", code: c.code || "", year: yr, ...(c.classic ? { classic: 1 } : {}) });
    items = []; draw(); inp.value = carLabel(car); onPick(car);
  };
  inp.addEventListener("input", () => {
    items = find(inp.value); act = items.length ? 0 : -1; draw();
    if (all && !IDX) loadIdx().then((x) => { IDX = x; items = find(inp.value); act = items.length ? 0 : -1; draw(); });
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { act = Math.min(items.length - 1, act + 1); draw(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { act = Math.max(0, act - 1); draw(); e.preventDefault(); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[act]) choose(items[act]); }
    else if (e.key === "Escape") { items = []; draw(); }
  });
  list.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) choose(items[+b.dataset.i]); });
  document.addEventListener("click", (e) => { if (!root.contains(e.target)) { items = []; list.hidden = true; } }, true);
  return { inp, run: () => { if (items[act]) choose(items[act]); else { items = find(inp.value); act = 0; if (items.length === 1) choose(items[0]); else draw(); } } };
}

/* ---------- dialog ---------- */
const dlg = $("#dlg");
$("#dlgX")?.addEventListener("click", () => dlg.close());
dlg?.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
function openDlg(title, html) { $("#dlgTitle").textContent = title; $("#dlgBody").innerHTML = html; if (!dlg.open) dlg.showModal(); }

function carDialog() {
  openDlg("Your car", `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="picker" id="dp"><label class="label" for="dpIn">What do you drive?</label>
      <div class="pickrow"><input id="dpIn" autocomplete="off" role="combobox" aria-expanded="false" placeholder="e.g. Cayenne 958, E90 335i, LC200" value="${esc(carLabel(car))}"></div>
      <div class="sugg" role="listbox" hidden></div></div>
    <p class="muted" style="margin:0;font-size:13px">Saved on this device. Lists re-sort around it.</p>
    ${car ? `<button class="btn" type="button" id="clearCar">Clear my car</button>` : ""}</div>`);
  const p = wirePicker($("#dp"), () => { dlg.close(); applyCar(true); });
  p.inp.focus();
  $("#clearCar")?.addEventListener("click", () => { setCar(null); dlg.close(); applyCar(true); });
}

/* ---------- ranking ---------- */
function matchFor(specs, c) {
  if (!c) return null;
  const ent = specs.filter((s) => s[0] === c.make);
  if (!ent.length) return { l: 0, ev: "", hit: false };
  let best = ent[0], l = Math.max(...ent.map((s) => s[2])), hit = false;
  if (c.model) {
    const mh = ent.filter((s) => s[1].includes(c.model));
    if (mh.length) { best = mh[0]; l = Math.max(...mh.map((s) => s[2])); hit = true; } else l = Math.min(l, 2);
  }
  return { l, ev: best[3], hit };
}
const matchHTML = (m) => `<span class="match l${m.l}"><span class="meter">${[1, 2, 3].map((i) => `<i class="${i <= m.l ? "on" : ""}"></i>`).join("")}</span>${LEVELS[m.l]}</span>`;

function rerank(announce) {
  const box = $("#results");
  if (!box) return;
  const cards = $$(".gcard", box);
  const pageMake = box.dataset.make;
  // On a brand page for another make, the saved car doesn't apply.
  const c = car && (!pageMake || pageMake === car.make) ? car : null;
  const scored = cards.map((el, i) => {
    const specs = JSON.parse(el.dataset.specs || "[]");
    const m = c ? matchFor(specs, c) : null;
    return { el, i, m };
  });
  if (c) {
    scored.sort((a, b) => (b.m.l - a.m.l) || ((b.m.hit ? 1 : 0) - (a.m.hit ? 1 : 0)) || (a.i - b.i));
    scored.forEach(({ el, m }) => {
      const slot = $(".matchslot", el); if (slot) slot.innerHTML = matchHTML(m);
      const ev = $(".evid", el); if (ev && m.ev) ev.textContent = m.ev;
      el.classList.toggle("dim", m.l === 0);
      const d = $("details.enth", el); if (d && c.code) d.open = true;
    });
  } else scored.sort((a, b) => a.i - b.i);
  scored.forEach(({ el }) => box.appendChild(el));
  const r = $("#resort");
  if (r && c && announce) { r.hidden = false; r.textContent = `Re-sorted for your ${carShort(c)}`; }
  else if (r) r.hidden = true;
}

function matchPanel() {
  const page = $("[data-garage-page]"), panel = $("#matchPanel");
  if (!page || !panel) return;
  const specs = JSON.parse(page.dataset.specs || "[]");
  $$("[data-model-tile]").forEach((t) => { const [mk, md] = t.dataset.modelTile.split("|"); t.classList.toggle("hit", !!car && car.make === mk && car.model === md); });
  if (!car) {
    panel.hidden = false;
    panel.classList.remove("matchpanel");
    panel.innerHTML = `<h2>Does it know your car?</h2><p class="muted" style="margin:0 0 12px">Set your car to see how well this garage matches it.</p><button class="btn primary" type="button" data-setcar>Set your car</button>`;
    return;
  }
  const m = matchFor(specs, car);
  panel.classList.add("matchpanel");
  panel.hidden = false;
  panel.innerHTML = `<h2>Match for your ${esc(carShort(car))}</h2>
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">${matchHTML(m)}<span class="evid">${esc(m.ev || `No reviews we've read mention ${car.make} here.`)}</span></div>
    <p class="muted" style="font-size:13px;margin:10px 0 0">Not your car? <button class="btn sm" type="button" data-setcar>Change car</button></p>`;
}

function applyCar(announce) { paintCar(); rerank(announce); matchPanel(); }

/* ---------- WhatsApp ---------- */
function waDialog(btn) {
  const num = btn.dataset.waNum, name = btn.dataset.name;
  const jobs = ["Service", "Diagnosis of a fault", "Repair quote", "Something else"];
  openDlg(`WhatsApp ${name}`, `<div style="display:flex;flex-direction:column;gap:12px">
    ${car ? "" : `<div class="note">Add your car so the garage can quote properly. <button class="btn sm" type="button" data-setcar>Set your car</button></div>`}
    <label class="fld" for="waJob">What do you need?<select id="waJob">${jobs.map((j) => `<option>${j}</option>`).join("")}</select></label>
    <label class="fld" for="waNote">Anything to add? (optional)<input id="waNote" placeholder="e.g. warning light on, car is drivable"></label>
    <div><div class="label" style="margin-bottom:6px">Your message</div><div class="msg" id="waMsg"></div></div>
    <a class="btn wa" id="waGo" target="_blank" rel="noopener">Open WhatsApp</a></div>`);
  const upd = () => {
    const note = $("#waNote").value.trim();
    const m = `Hi, found you on KnowsMyCar. I have ${car ? "a " + carLabel(car) : "a car"}, looking for: ${$("#waJob").value.toLowerCase()}.${note ? " " + note : ""} Can you quote?`;
    $("#waMsg").textContent = m;
    $("#waGo").href = `https://wa.me/${num}?text=${encodeURIComponent(m)}`;
  };
  $("#waJob").onchange = upd; $("#waNote").oninput = upd; upd();
  $("#waGo").onclick = () => track(btn.dataset.wa, "whatsapp");
}
// North-star metric: garage contacts (WhatsApp, call, directions), with the visitor's ref/UTM tags.
const SB_URL = import.meta.env.PUBLIC_SUPABASE_URL, SB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
function track(slug, kind) {
  const log = store.get("contacts", []);
  log.unshift({ slug, kind, t: Date.now() });
  store.set("contacts", log.slice(0, 20));
  if (!SB_URL || !SB_KEY || !slug) return;
  const r = attribution();
  try {
    fetch(`${SB_URL}/rest/v1/contacts`, {
      method: "POST", keepalive: true,
      headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ garage_slug: slug, kind, page: location.pathname, ref: r.ref || null, utm_source: r.utm_source || null, utm_medium: r.utm_medium || null, utm_campaign: r.utm_campaign || null }),
    }).catch(() => {});
  } catch {}
}

/* ---------- events ---------- */
document.addEventListener("click", (e) => {
  const pm = e.target.closest("[data-pickmodel]");
  // Model chip on a brand page: remember the car (keeps the year/code if it's the same model), then follow the link.
  if (pm) { if (!(car && car.make === pm.dataset.make && car.model === pm.dataset.pickmodel)) store.set("car", { make: pm.dataset.make, model: pm.dataset.pickmodel }); return; }
  const t = e.target.closest("[data-setcar],#mycarBtn,[data-wa],[data-track],[data-try]");
  if (!t) return;
  if (t.matches("[data-setcar],#mycarBtn")) carDialog();
  else if (t.dataset.wa) waDialog(t);
  else if (t.dataset.track) {
    const slug = t.dataset.slug || t.closest("[data-garage]")?.dataset.garage || $("[data-garage-page]")?.dataset.garagePage;
    if (slug) track(slug, t.dataset.track);
  }
  else if (t.dataset.try !== undefined) { const i = $("#hpIn"); if (i) { i.value = t.dataset.try; i.dispatchEvent(new Event("input")); i.focus(); } }
});

const hp = $("#hp");
if (hp) {
  const p = wirePicker(hp, (c) => { location.href = pageFor(c); }, true);
  $("#hpGo")?.addEventListener("click", () => (p.inp.value.trim() ? p.run() : car ? (location.href = pageFor(car)) : p.inp.focus()));
  if (car) p.inp.value = carLabel(car);
}
if ($("#sticky")) document.body.classList.add("has-sticky");
applyCar(!!$("#results") && !!car);

/* ---------- "my car isn't covered yet" ---------- */
const nf = $("#notifyForm");
if (nf) nf.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#nEmail").value.trim(), carText = $("#nCar").value.trim(), err = $("#nErr");
  if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Enter a valid email."; err.hidden = false; return; }
  err.hidden = true;
  if (!SB_URL || !SB_KEY) { err.textContent = "Sign-up isn't open yet. Please try again soon."; err.hidden = false; return; }
  const r = attribution();
  try {
    const res = await fetch(`${SB_URL}/rest/v1/coverage_requests`, {
      method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ email, car: carText || [nf.dataset.make, nf.dataset.model].filter(Boolean).join(" ") || null, page: nf.dataset.page, ref: r.ref || r.utm_source || null }),
    });
    if (!res.ok) throw new Error(res.status);
    nf.querySelector("button[type=submit]").hidden = true;
    $("#nOk").hidden = false;
  } catch { err.textContent = "Something went wrong. Please try again."; err.hidden = false; }
});

/* ---------- report a review ---------- */
document.querySelectorAll(".reportForm").forEach((f) => f.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = f.querySelector(".err"), d = new FormData(f);
  if (!SB_URL || !SB_KEY) { err.textContent = "Reporting isn't open yet. Please email us from the For garages page."; err.hidden = false; return; }
  err.hidden = true;
  const val = (k) => (d.get(k) || "").toString().trim() || null;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/reports`, {
      method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ review_id: f.closest("[data-review-id]").dataset.reviewId, reason: val("reason"), reporter_type: val("reporter_type") || "other", details: val("details"), contact: val("contact"), page: location.pathname }),
    });
    if (!res.ok) throw new Error(res.status);
    f.querySelector("button[type=submit]").hidden = true;
    f.querySelector(".okmsg").hidden = false;
  } catch { err.textContent = "Something went wrong. Please try again."; err.hidden = false; }
}));

/* ---------- add a garage / suggest a correction ---------- */
const sg = $("#sgForm");
if (sg) {
  const fix = new URLSearchParams(location.search).get("fix");
  if (fix) {
    sg.elements.garage_slug.value = fix.slice(0, 120);
    $("#sgTitle").textContent = "Suggest a correction";
    $("#sgLead").textContent = "Tell us what's wrong or missing on this garage's page: phone, hours, address, or the cars they work on.";
    sg.elements.name.closest("label").hidden = true;
  }
  if (new URLSearchParams(location.search).get("closed")) { sg.elements.details.value = "This garage has closed or moved. "; $("#sgTitle").textContent = "Closed or moved?"; }
  sg.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(sg), err = sg.querySelector(".err"), v = (k) => (d.get(k) || "").toString().trim() || null;
    if ((v("details") || "").length < 5) { err.textContent = "Add a few words so we know what to check."; err.hidden = false; return; }
    err.hidden = true;
    const owner = !!sg.elements.is_owner?.checked;
    // Until the database is connected, hand the same message to email (never a "coming soon" dead end).
    if (!SB_URL || !SB_KEY) {
      const body = [["Garage", v("name") || v("garage_slug")], ["Area", v("area")], ["Cars", v("cars")], ["Details", v("details")], ["This is my garage", owner ? "yes" : ""], ["Reply to", v("contact")]]
        .filter(([, x]) => x).map(([k, x]) => `${k}: ${x}`).join("\n");
      location.href = `mailto:${sg.dataset.mail}?subject=${encodeURIComponent(fix ? `Correction: ${fix}` : "New garage")}&body=${encodeURIComponent(body)}`;
      return;
    }
    const r = attribution();
    try {
      const res = await fetch(`${SB_URL}/rest/v1/garage_suggestions`, {
        method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ kind: fix ? "fix" : "new", garage_slug: v("garage_slug"), name: v("name"), area: v("area"), cars: v("cars"), details: v("details"), contact: v("contact"), is_owner: owner, ref: r.ref || r.utm_source || null }),
      });
      if (!res.ok) throw new Error(res.status);
      sg.querySelector("button[type=submit]").hidden = true; sg.querySelector(".okmsg").hidden = false;
    } catch { err.textContent = "Something went wrong. Please try again."; err.hidden = false; }
  });
}

/* ---------- "Did this help?" ---------- */
const fb = $("#helpFb");
if (fb && SB_URL && SB_KEY) {
  fb.hidden = false;
  const send = async (helped, note) => {
    const r = attribution();
    try { await fetch(`${SB_URL}/rest/v1/feedback`, { method: "POST", keepalive: true, headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ page: location.pathname.slice(0, 200), helped, note: note ? note.slice(0, 300) : null, ref: r.ref || r.utm_source || null }) }); } catch {}
  };
  fb.addEventListener("click", (e) => {
    const b = e.target.closest("[data-help]"); if (!b) return;
    const yes = b.dataset.help === "yes";
    fb.dataset.helped = yes ? "1" : "0";
    $(".fbq", fb).hidden = true;
    if (yes) { send(true); $(".fbthanks", fb).hidden = false; } else $(".fbmore", fb).hidden = false;
  });
  $(".fbmore", fb).addEventListener("submit", (e) => { e.preventDefault(); send(false, $("input", e.target).value.trim()); e.target.hidden = true; $(".fbthanks", fb).hidden = false; });
}

/* ---------- missing cars (PM missing-car spec, 11 Nov): one-tap "I want it covered", then an optional email ---------- */
const sbPost = (table, row) => (SB_URL && SB_KEY)
  ? fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", keepalive: true, headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) })
  : Promise.reject(new Error("off"));
const once = (key) => { try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "1"); } catch {} return true; };
// state "B" = make covered, model or generation not; "C" = make not covered. page "want" marks a tap, not a view.
function logDemand(make, model, state, page) {
  const row = { make: String(make).slice(0, 40), model: (model || "").slice(0, 60) || null, state, page: String(page).slice(0, 200) };
  if (!once("gg:dem:" + [row.make, row.model, state, page === "want" ? "want" : "view"].join("|"))) return;
  sbPost("car_demand", row).catch(() => {});
}
// Fills `el` with the want button for one car. label is what we call it back ("E30", "Kia Sportage").
function wantBox(el, { make, model, label, state }) {
  const id = "w" + Math.random().toString(36).slice(2, 7);
  el.innerHTML = `<button class="btn primary wantbtn" type="button">I want ${esc(label)} covered</button>
    <div class="wantafter" hidden><p class="wantok">Noted, thanks.</p>
      <form class="wantmail" novalidate><label class="fld" for="${id}">Want an email when it's covered? (optional)
        <span class="wantrow"><input id="${id}" type="email" autocomplete="email" placeholder="you@example.com"><button class="btn" type="submit">Email me</button></span></label>
        <div class="err" hidden></div><p class="muted wantfine">One email, when it's covered. Nothing else. <a href="/privacy/">Privacy</a>.</p></form></div>`;
  const btn = $(".wantbtn", el), after = $(".wantafter", el), form = $(".wantmail", el), err = $(".err", el);
  btn.addEventListener("click", () => { logDemand(make, model, state, "want"); btn.hidden = true; after.hidden = false; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("input", form).value.trim(), sub = $("button", form);
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Enter a valid email."; err.hidden = false; return; }
    err.hidden = true; sub.disabled = true;
    try {
      const r = attribution(), res = await sbPost("coverage_requests", { email, car: [make, model].filter(Boolean).join(" ").slice(0, 80), page: location.pathname, ref: r.ref || r.utm_source || null });
      if (!res.ok) throw new Error(res.status);
      after.innerHTML = `<p class="wantok">Noted, thanks. We'll email you once, when ${esc(label)} is covered.</p>`;
    } catch { sub.disabled = false; err.textContent = "Couldn't send. Please try again."; err.hidden = false; }
  });
}

/* ---------- "close" answer: covered make, model or generation without its own evidence (state B) ---------- */
{
  const close = (new URLSearchParams(location.search).get("close") || "").slice(0, 40), box = $("#results");
  if (close && box) {
    const make = box.dataset.make || "", pm = box.dataset.model || "";
    const model = pm && pm.toLowerCase() !== close.toLowerCase() ? `${pm} ${close}` : close;
    const n = document.createElement("div");
    n.className = "card closenote";
    n.innerHTML = `<p><b>No ${esc(close)}-specific evidence yet.</b> These ${esc(make || "brand")} specialists are the closest.</p><div class="wantbox"></div>`;
    const anchor = $(".mchips") || $("#resort") || box;
    anchor.parentNode.insertBefore(n, anchor);
    document.body.classList.add("is-close");
    wantBox($(".wantbox", n), { make, model, label: close, state: "B" });
    logDemand(make, model, "B", location.pathname);
  }
}

/* ---------- not-covered page: make we don't cover (state C), or a car we couldn't recognise ---------- */
{
  const nc = $("#ncPage");
  if (nc) {
    const q = new URLSearchParams(location.search), makes = [...new Set(DATA.rows.map((r) => r.make))].sort();
    const findMake = (t) => makes.find((m) => norm(m) === norm(t || "")) || resolveMake(norm(t || "").split(" "))?.make || null;
    const selMake = $("#ncMake"), selModel = $("#ncModel"), yr = $("#ncYear");
    selMake.innerHTML = `<option value="">Make</option>` + makes.map((m) => `<option>${esc(m)}</option>`).join("");
    const fillModels = (make, pick) => {
      const ms = [...new Set(DATA.rows.filter((r) => r.make === make && r.model).map((r) => r.model))].sort();
      selModel.innerHTML = `<option value="">Model (optional)</option>` + ms.map((m) => `<option${m.toLowerCase() === (pick || "").toLowerCase() ? " selected" : ""}>${esc(m)}</option>`).join("");
      selModel.disabled = !make;
    };
    const paint = (make, model, typed) => {
      const car = [make, model].filter(Boolean).join(" ");
      if (!make) {
        $("#ncTitle").textContent = typed ? "We couldn't recognise that car" : "Tell us your car";
        $("#ncLead").textContent = typed ? `We couldn't match "${typed.slice(0, 40)}". Pick it here:` : "Pick your car here:";
        $("#ncWant").hidden = true; $("#ncSuggest").hidden = true; $("#ncPick").open = true; $("#ncPickSum").textContent = "Pick your car";
        return;
      }
      $("#ncTitle").textContent = `We don't cover the ${car} yet`;
      $("#ncLead").textContent = "We only list garages that owners vouch for with your car. Tell us you want it, and it moves up our list.";
      $("#ncWant").hidden = false; wantBox($("#ncWant"), { make, model, label: car, state: "C" });
      $("#ncSuggest").hidden = false; $("#ncSuggestMake").textContent = make; $("#ncPickSum").textContent = "Not quite your car?"; $("#ncPick").open = false;
      logDemand(make, model, "C", location.pathname);
    };
    const typedMake = (q.get("make") || "").slice(0, 40), typedModel = (q.get("model") || "").slice(0, 40);
    const make0 = findMake(typedMake);
    if (make0) { selMake.value = make0; fillModels(make0, typedModel); } else fillModels("", "");
    paint(make0, make0 ? (selModel.value || typedModel) : "", [typedMake, typedModel].filter(Boolean).join(" "));
    const changed = () => {
      const make = selMake.value, model = selModel.value, y = /^(19[5-9]\d|20[0-2]\d)$/.test(yr.value) ? yr.value : "";
      if (!make) return;
      // A make we do cover: go to its specialists instead.
      if (DATA.pages[make]) { setCar({ make, model, code: "", year: y }); location.href = pageFor({ make, model }); return; }
      setCar({ make, model, code: "", year: y });
      history.replaceState(null, "", `/car-not-covered/?make=${encodeURIComponent(make)}${model ? `&model=${encodeURIComponent(model)}` : ""}`);
      paint(make, model, "");
    };
    selMake.addEventListener("change", () => { fillModels(selMake.value, ""); changed(); });
    selModel.addEventListener("change", changed); yr.addEventListener("change", changed);
  }
}

// Home: "Review a garage you've used" points the one search box at garage names.
document.querySelector("[data-reviewcta]")?.addEventListener("click", () => {
  const i = document.getElementById("hpIn");
  if (!i) return;
  i.placeholder = "Type the garage's name";
  i.value = ""; i.focus();
  i.scrollIntoView({ block: "center", behavior: "smooth" });
});


/* ---------- 13.2 "Did you go to X?": 2 to 30 days after a contact click, on this device only ---------- */
(() => {
  if ($("#reviewForm") || $("#mentionForm")) return;
  const DAY = 864e5, now = Date.now(), asked = store.get("asked", {});
  const c = store.get("contacts", []).find((x) => now - x.t >= 2 * DAY && now - x.t <= 30 * DAY && !asked[x.slug]);
  if (!c) return;
  loadIdx().then((idx) => {
    const g = (idx.garages || []).find((x) => x.s === c.slug);
    if (!g) return;
    const bar = document.createElement("div");
    bar.className = "followup";
    bar.innerHTML = `<span>Did you go to <b>${esc(g.n)}</b>?</span> <a class="btn sm primary" href="/review/${esc(c.slug)}/">Yes, review it</a> <button class="btn sm" type="button" data-no>Not yet</button>`;
    const done = () => { asked[c.slug] = now; store.set("asked", asked); bar.hidden = true; };
    bar.querySelector("[data-no]").onclick = done;
    bar.querySelector("a").onclick = () => {
      // Pre-fill the review form with the saved car (review.js reads this draft).
      if (car) { try { const k = `gg:draft:${c.slug}`, d = JSON.parse(localStorage.getItem(k) || "{}");
        localStorage.setItem(k, JSON.stringify({ ...d, rMake: d.rMake || car.make, rModel: d.rModel || [car.model, car.code].filter(Boolean).join(" "), rYear: d.rYear || car.year || "" })); } catch {} }
      done();
    };
    document.querySelector("main .wrap, .wrap")?.prepend(bar);
  });
})();

/* ---------- 13.3 problem pages: filter by make ---------- */
const mf = $("#makeFilter");
if (mf) mf.addEventListener("change", () => {
  const m = mf.value;
  $$("#results .gcard").forEach((el) => { el.hidden = !!m && !JSON.parse(el.dataset.specs || "[]").some((s) => s[0] === m); });
  const n = $$("#results .gcard:not([hidden])").length, o = $("#makeFilterOut");
  if (o) o.innerHTML = m ? (n ? `${n} for ${esc(m)}` : `None for ${esc(m)} yet. A ${esc(m)} specialist is the better start: <a href="${esc(mf.selectedOptions[0].dataset.url || "/dubai/")}">see ${esc(m)} garages</a>.`) : "";
});

/* ---------- 13.4 "Near me": browser location, client-side only, never stored ---------- */
const nb = $("#nearBtn");
if (nb) nb.addEventListener("click", () => {
  const out = $("#nearOut");
  const fallback = () => { if (out) { out.hidden = false; out.innerHTML = `Location is off. <a href="/#areas">Pick an area instead</a>.`; } };
  if (!navigator.geolocation) return fallback();
  nb.disabled = true;
  navigator.geolocation.getCurrentPosition((p) => {
    const { latitude: la, longitude: lo } = p.coords, R = Math.PI / 180;
    const dist = (el) => { const [a, b] = (el.dataset.ll || "").split(",").map(Number); if (!a) return 1e9;
      const x = (b - lo) * R * Math.cos(((a + la) / 2) * R), y = (a - la) * R; return 6371 * Math.hypot(x, y); };
    const box = $("#results");
    $$(".gcard", box).map((el) => ({ el, d: dist(el) })).sort((a, b) => a.d - b.d).forEach(({ el, d }) => {
      box.appendChild(el);
      let t = $(".kmaway", el); if (!t && d < 1e9) { t = document.createElement("span"); t.className = "kmaway"; $(".meta", el)?.appendChild(t); }
      if (t) t.textContent = d < 1e9 ? `${d < 10 ? d.toFixed(1) : Math.round(d)} km away` : "";
    });
    nb.disabled = false; nb.textContent = "Sorted by distance";
  }, () => { nb.disabled = false; fallback(); }, { timeout: 8000, maximumAge: 6e5 });
});

/* ---------- C5 quote check: car picker ---------- */
const qc = $("#qcCar");
if (qc) wirePicker(qc, () => {});

/* ---------- page counter (11 Nov: the team reads visits without a dashboard) ---------- */
// One row per page view on the live domain: path, referring site, ?ref tag, first page of the visit, mobile or not.
// No cookies, no ids; the "first page" flag lives in sessionStorage for this tab only.
(() => {
  if (!SB_URL || !SB_KEY || location.hostname !== "knowsmycar.com" || navigator.webdriver) return;
  let landing = false;
  try { landing = !sessionStorage.getItem("gg:seen"); sessionStorage.setItem("gg:seen", "1"); } catch {}
  let refHost = null;
  try { const h = document.referrer && new URL(document.referrer).hostname; if (h && h !== location.hostname) refHost = h.replace(/^www\./, "").slice(0, 100); } catch {}
  const r = attribution();
  fetch(`${SB_URL}/rest/v1/page_views`, { method: "POST", keepalive: true, headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ path: location.pathname.slice(0, 200), ref_host: refHost, ref_tag: (r.ref || r.utm_source || "").slice(0, 80) || null, landing, mobile: matchMedia("(max-width: 700px)").matches }) }).catch(() => {});
})();
