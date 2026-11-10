// Site-wide settings. Change the name or contact details here, not in pages.
export const SITE = {
  name: "KnowsMyCar",
  tagline: "Find the garage that knows your car",
  proof: "Independent. No paid listings. Every specialist backed by owner reviews.",
  // Legal operator: Rishal chose "KnowsMyCar" (2026-11-10).
  operator: import.meta.env.PUBLIC_OPERATOR_NAME || "KnowsMyCar",
  legalUpdated: "6 November 2026",
  emailHello: import.meta.env.PUBLIC_EMAIL_HELLO || "hello@knowsmycar.com",
  emailReply: import.meta.env.PUBLIC_EMAIL_REPLY || "reply@knowsmycar.com",
  emailPrivacy: import.meta.env.PUBLIC_EMAIL_PRIVACY || "privacy@knowsmycar.com",
  // Sitewide noindex until launch. Set PUBLIC_INDEXING=on in Cloudflare on launch day.
  indexing: import.meta.env.PUBLIC_INDEXING === "on",
  // Brand of the week for /this-week (Instagram link-in-bio). Change this one value each Monday.
  thisWeek: import.meta.env.PUBLIC_THIS_WEEK || "/dubai/porsche/",
};
