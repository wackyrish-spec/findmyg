// Owner review form: email magic-link sign-in, then insert a pending review.
// Moderation (approve/reject) happens in Supabase; approval triggers a site rebuild.
import { createClient } from "@supabase/supabase-js";

const form = document.getElementById("reviewForm");
const URL_ = import.meta.env.PUBLIC_SUPABASE_URL;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (form && form.dataset.ready && URL_ && KEY) {
  const sb = createClient(URL_, KEY);
  const $ = (id) => document.getElementById(id);
  const slug = form.dataset.garage;
  const DRAFT = `gg:draft:${slug}`;
  const err = $("rErr"), go = $("rGo"), ok = $("rOk"), signin = $("rSignin");
  const showErr = (m) => { err.textContent = m; err.hidden = !m; };
  const fields = ["rMake", "rModel", "rYear", "rJob", "rPaid", "rRating", "rText", "rName", "rWa", "rDealer", "rJobNote"];

  const read = () => ({
    ...Object.fromEntries(fields.map((f) => [f, $(f).value.trim()])),
    qvf: form.querySelector("[name=qvf]:checked")?.value || "",
    knew: form.querySelector("[name=knew]:checked")?.value || "",
    c1: $("c1").checked, c2: $("c2").checked, c3: $("c3").checked,
  });
  const fill = (d) => {
    fields.forEach((f) => { if (d[f] != null) $(f).value = d[f]; });
    ["qvf", "knew"].forEach((n) => { const r = d[n] && form.querySelector(`[name=${n}][value=${d[n]}]`); if (r) r.checked = true; });
    ["c1", "c2", "c3"].forEach((c) => ($(c).checked = !!d[c]));
  };
  const saveDraft = () => { try { localStorage.setItem(DRAFT, JSON.stringify(read())); } catch {} };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT); } catch {} };
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d) fill(d); } catch {}
  form.addEventListener("input", saveDraft);

  const validate = (d) => {
    if (!d.rMake) return "Add your car's brand.";
    if (!d.rJob) return "Choose the type of job.";
    if (d.rJob === "Other" && !d.rJobNote) return "Describe the job in a few words.";
    if (!d.rRating) return "Choose an overall rating.";
    if (d.rText.length < 40) return "Write at least 40 characters about how it went.";
    if (d.rYear && !/^(19|20)\d\d$/.test(d.rYear)) return "Year should look like 2014.";
    if (d.rDealer && !/^\d+$/.test(d.rDealer.replace(/[,\s]/g, ""))) return "Dealer quote should be a number in AED.";
    if (d.rWa && !/^\+?[0-9 ]{7,20}$/.test(d.rWa)) return "WhatsApp number should be digits only, like +971 50 123 4567.";
    if (d.rPaid && !/^\d+$/.test(d.rPaid.replace(/[,\s]/g, ""))) return "Total paid should be a number in AED.";
    return "";
  };

  let session = null;
  const paint = () => {
    signin.hidden = !!session;
    go.textContent = session ? "Submit review" : "Email me a sign-in link";
  };
  $("rGoogle")?.addEventListener("click", async () => {
    saveDraft();
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("#")[0] } });
    if (error) showErr(error.message);
  });
  sb.auth.getSession().then(({ data }) => { session = data.session; paint(); });
  sb.auth.onAuthStateChange((_e, s) => { session = s; paint(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = read();
    const bad = validate(d);
    if (bad) return showErr(bad);
    showErr("");
    go.disabled = true;
    try {
      if (!session) {
        const email = $("rEmail").value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { showErr("Enter your email so we can send the sign-in link."); return; }
        saveDraft();
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
        if (error) throw error;
        ok.textContent = `Check ${email} for a sign-in link. Open it on this device and your review will be here, ready to submit.`;
        ok.hidden = false;
        return;
      }
      const { error } = await sb.from("reviews").insert({
        garage_slug: slug,
        display_name: d.rName || null,
        car_make: d.rMake,
        car_model: d.rModel || null,
        car_year: d.rYear ? Number(d.rYear) : null,
        job: d.rJob,
        job_note: d.rJobNote || null,
        price_paid: d.rPaid ? Number(d.rPaid.replace(/[,\s]/g, "")) : null,
        quote_vs_final: d.qvf || null,
        knew_car: d.knew || null,
        rating: Number(d.rRating),
        showed_old_parts: d.c1,
        called_before_extra: d.c2,
        would_return: d.c3,
        body: d.rText,
        whatsapp: d.rWa || null,
        dealer_quote: d.rDealer ? Number(d.rDealer.replace(/[,\s]/g, "")) : null,
      });
      if (error) {
        if (error.code === "23505" || /recent_review/.test(error.message || ""))
          throw new Error("You've reviewed this garage in the last 6 months. Thanks, one review per owner per garage every 6 months keeps things fair.");
        throw error;
      }
      clearDraft();
      form.hidden = true;
      ok.textContent = "Thanks! Your review is in. We check every review by hand, and it appears on the garage page once approved, usually within a day.";
      ok.hidden = false;
    } catch (x) {
      showErr(x.message || "Something went wrong. Please try again.");
    } finally {
      go.disabled = false;
    }
  });
}
