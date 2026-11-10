// Quote check (C5). The comparison runs in the browser; the figures are saved for review only when the database is on.
const $ = (id) => document.getElementById(id);
const form = $("qcForm");
const SB_URL = import.meta.env.PUBLIC_SUPABASE_URL, SB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => Number(n).toLocaleString("en-US");
if (form) {
  let data = null;
  const load = () => data || (data = fetch("/quote-data.json").then((r) => r.json()).catch(() => ({ jobs: [], points: [] })));
  load();
  // Prefill from a known-issues link: ?make=&model=&job=other&note=
  const q = new URLSearchParams(location.search);
  const paramCar = q.get("make") ? { make: q.get("make").slice(0, 40), model: (q.get("model") || "").slice(0, 60) } : null;
  if (paramCar) $("qcIn").value = [paramCar.make, paramCar.model].filter(Boolean).join(" ");
  else try { const c = JSON.parse(localStorage.getItem("gg:car") || "null"); if (c) $("qcIn").value = [c.make, c.model, c.code].filter(Boolean).join(" "); } catch {}
  if (q.get("job")) $("qcJob").value = q.get("job");
  if (q.get("note")) $("qcNote").value = q.get("note").slice(0, 80);
  const showNote = () => { $("qcNoteWrap").hidden = $("qcJob").value !== "other"; };
  $("qcJob").addEventListener("change", showNote); showNote();
  const m = new Date(); $("qcMonth").value = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
  const carFromInput = () => {
    try { const c = JSON.parse(localStorage.getItem("gg:car") || "null"); if (c && $("qcIn").value.includes(c.make)) return c; } catch {}
    if (paramCar && $("qcIn").value.includes(paramCar.make)) return paramCar;
    return null;
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = (t) => { $("qcErr").textContent = t; $("qcErr").hidden = !t; };
    const car = carFromInput(), job = $("qcJob").value, aed = Number($("qcAed").value.replace(/[,\s]/g, "")), side = $("qcSide").value, month = $("qcMonth").value || null;
    if (!car) return err("Pick your car from the list.");
    if (!job) return err("Choose the job.");
    const note = job === "other" ? $("qcNote").value.trim().slice(0, 80) : "";
    if (job === "other" && note.length < 3) return err("Say what the job is, in a few words.");
    if (!(aed > 0 && aed < 1e6)) return err("Enter the quoted price in AED, numbers only.");
    err("");
    const d = await load(), name = (d.jobs.find((j) => j.k === job) || { n: "this job" }).n.toLowerCase();
    const mk = d.points.filter((p) => p.j === job && p.mk === car.make);
    const md = car.model ? mk.filter((p) => p.md && p.md.toLowerCase().includes(car.model.toLowerCase())) : [];
    const use = md.filter((p) => !p.d).length >= 3 ? md : mk, scope = use === md ? `${car.model}` : car.make;
    const ind = use.filter((p) => !p.d).map((p) => p.v).sort((a, b) => a - b), dl = use.filter((p) => p.d).map((p) => p.v);
    const out = $("qcOut");
    let html;
    if (job === "other" || ind.length < 3) {
      html = job === "other" ? `<h2>Thanks, that helps</h2><p>We don't compare prices for this job yet. Your figure goes into the price data for ${esc(note || "this job")} on the ${esc([car.make, car.model].filter(Boolean).join(" "))}, after a check.</p>` : `<h2>Not enough prices yet</h2><p>We have ${ind.length || "no"} independent ${ind.length === 1 ? "price" : "prices"} for ${esc(name)} on a ${esc(scope)} so far, and we only compare with 3 or more. Your figure helps the next owner.</p>`;
    } else {
      const below = ind.filter((v) => v < aed).length;
      html = `<h2>Your quote: AED ${fmt(aed)}</h2><p>It's above <b>${below} of ${ind.length}</b> independent prices we have for ${esc(name)} on a ${esc(scope)}. Independents range from AED ${fmt(ind[0])} to ${fmt(ind[ind.length - 1])}.</p>`
        + (dl.length ? `<p class="muted">Main dealer list price: from AED ${fmt(Math.min(...dl))}.</p>` : "")
        + `<p class="muted" style="font-size:13px">Prices come from owner reports and garages' published price lists. What's included varies, so ask what the quote covers.</p>`;
    }
    const page = (() => { try { return JSON.parse(document.getElementById("picker-data").textContent).pages[car.make]; } catch { return null; } })();
    if (page) html += `<p><a class="btn primary" href="${esc((car.model && page.models[car.model]) || page.url)}">See ${esc(car.model || car.make)} specialists</a></p>`;
    out.innerHTML = html; out.hidden = false; out.scrollIntoView({ behavior: "smooth", block: "start" });
    if (SB_URL && SB_KEY) {
      fetch(`${SB_URL}/rest/v1/quote_checks`, { method: "POST", keepalive: true, headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ make: car.make, model: car.model || null, job, job_note: note || null, aed: Math.round(aed), side, month }) }).catch(() => {});
    }
  });
}
