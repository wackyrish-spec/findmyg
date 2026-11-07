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
  if (c.model && p.models[c.model]) return p.models[c.model];
  return c.model ? `${p.url}?close=${encodeURIComponent(c.model)}` : p.url;
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
function searchOthers(q) {
  const nq = norm(q), toks = nq.split(" ").filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  (DATA.problems || []).forEach((p) => {
    const hay = norm(`${p.label} ${p.syn}`), words = hay.split(" ");
    if (hay.includes(nq) || toks.every((t) => t.length > 1 && words.some((w) => near(t, w)))) out.push({ type: "problem", label: p.label, slug: p.slug });
  });
  if (IDX && IDX.garages) {
    IDX.garages.forEach((g) => {
      const words = norm(g.n).split(" ");
      if (toks.every((t) => words.some((w) => near(t, w)))) out.push({ type: "garage", label: g.n, slug: g.s, sub: g.d ? "Main dealer" : g.a });
    });
    IDX.areas.forEach((a) => { if (toks.every((t) => norm(a.n).split(" ").some((w) => near(t, w)))) out.push({ type: "area", label: a.n, slug: a.s }); });
  }
  return [...out.filter((x) => x.type === "problem").slice(0, 3), ...out.filter((x) => x.type === "garage").slice(0, 5), ...out.filter((x) => x.type === "area").slice(0, 2)];
}

/* ---------- search ---------- */
function searchCars(q) {
  q = q.toLowerCase().replace(/\b(19[89]\d|20[0-3]\d)\b/, "").trim();
  if (!q) return [];
  const toks = q.split(/[\s,]+/).filter(Boolean);
  const out = [];
  BRANDS.forEach((b) => {
    const bl = b.toLowerCase();
    if (bl.startsWith(q) || toks.every((t) => bl.split(" ").some((w) => w.startsWith(t)))) out.push({ make: b, model: "", code: "", years: "", score: 3, brandOnly: true });
  });
  DATA.rows.forEach((c) => {
    const hay = [c.make, c.model, c.code, c.aliases].join(" ").toLowerCase();
    const words = hay.split(/[\s-]+/);
    let s = 0;
    for (const t of toks) {
      if (c.code && c.code.toLowerCase() === t) s += 5;
      else if (words.includes(t)) s += 3;
      else if (words.some((w) => w.startsWith(t))) s += 1;
      else { s = -1; break; }
    }
    if (s > 0) out.push({ ...c, score: s });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
function wirePicker(root, onPick, all = false) {
  const inp = $("input", root), list = $(".sugg", root);
  let items = [], act = -1;
  const find = (v) => all ? [...searchCars(v).slice(0, 5).map((c) => ({ ...c, type: "car" })), ...searchOthers(v)] : searchCars(v);
  const head = { car: "Cars", problem: "Problems", garage: "Garages", area: "Areas" };
  const draw = () => {
    if (!items.length) {
      if (inp.value.trim().length >= 2) { list.innerHTML = `<p class="nomatch">No match yet. Try the make or model name, like "Cayenne" or "Giulietta", or <a href="/add-a-garage/">tell us your car</a>.</p>`; list.hidden = false; }
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
    setCar({ make: c.make, model: c.model || "", code: c.code || "", year: yr });
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
  sg.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(sg), err = sg.querySelector(".err"), v = (k) => (d.get(k) || "").toString().trim() || null;
    if ((v("details") || "").length < 5) { err.textContent = "Add a few words so we know what to check."; err.hidden = false; return; }
    err.hidden = true;
    const r = attribution();
    try {
      const res = await fetch(`${SB_URL}/rest/v1/garage_suggestions`, {
        method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ kind: fix ? "fix" : "new", garage_slug: v("garage_slug"), name: v("name"), area: v("area"), cars: v("cars"), details: v("details"), contact: v("contact"), ref: r.ref || r.utm_source || null }),
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

/* ---------- "close" answer: brand page without model-specific evidence ---------- */
{
  const close = new URLSearchParams(location.search).get("close"), box = $("#results");
  if (close && box) {
    const n = document.createElement("div");
    n.className = "card closenote";
    n.textContent = `No ${close.slice(0, 40)}-specific evidence yet. These are ${box.dataset.make || "brand"} specialists, which is the next best thing.`;
    box.parentNode.insertBefore(n, box);
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
