// Group mention report: magic-link sign-in, then one pending row per account per garage.
import { createClient } from "@supabase/supabase-js";
const form = document.getElementById("mentionForm");
const URL_ = import.meta.env.PUBLIC_SUPABASE_URL, KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
if (form && URL_ && KEY) {
  const sb = createClient(URL_, KEY);
  const $ = (id) => document.getElementById(id);
  const slug = form.dataset.garage, DRAFT = `gg:mention:${slug}`;
  const err = (m) => { $("mErr").textContent = m; $("mErr").hidden = !m; };
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d) { $("mGroup").value = d.g || ""; $("mType").value = d.t || "facebook"; } } catch {}
  let session = null;
  const paint = () => { $("mSignin").hidden = !!session; $("mGo").textContent = session ? "Send" : "Email me a sign-in link"; };
  sb.auth.getSession().then(({ data }) => { session = data.session; paint(); });
  sb.auth.onAuthStateChange((_e, s) => { session = s; paint(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const group = $("mGroup").value.trim().slice(0, 120), type = $("mType").value;
    if (group.length < 3) return err("Add the group's name.");
    err("");
    try {
      if (!session) {
        const email = $("mEmail").value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return err("Enter your email so we can send the sign-in link.");
        try { localStorage.setItem(DRAFT, JSON.stringify({ g: group, t: type })); } catch {}
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
        if (error) throw error;
        $("mOk").textContent = `Check ${email} for a sign-in link. Open it on this device and your report will be here, ready to send.`; $("mOk").hidden = false;
        return;
      }
      const { error } = await sb.from("group_mentions").insert({ garage_slug: slug, group_name: group, group_type: type });
      if (error) {
        if (error.code === "23505") return err("You've already told us about a group for this garage. Thanks!");
        throw error;
      }
      try { localStorage.removeItem(DRAFT); } catch {}
      $("mGo").hidden = true; $("mOk").textContent = "Thanks. We'll check it before it counts."; $("mOk").hidden = false;
    } catch (x) { err("Something went wrong. Please try again."); }
  });
}
