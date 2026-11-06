// Site-wide settings. Change the name or contact details here, not in pages.
export const SITE = {
  name: "KnowsMyCar",
  tagline: "Find the garage that knows your car",
  proof: "Independent. No paid listings. Every specialist backed by owner reviews.",
  // Legal operator and contact details: Rishal to confirm before the legal pages go live.
  operator: import.meta.env.PUBLIC_OPERATOR_NAME || "[operator full name]",
  legalUpdated: "6 November 2026",
  emailHello: import.meta.env.PUBLIC_EMAIL_HELLO || "hello@knowsmycar.ae",
  emailReply: import.meta.env.PUBLIC_EMAIL_REPLY || "reply@knowsmycar.ae",
  emailPrivacy: import.meta.env.PUBLIC_EMAIL_PRIVACY || "privacy@knowsmycar.ae",
  // Sitewide noindex until launch. Set PUBLIC_INDEXING=on in Cloudflare on launch day.
  indexing: import.meta.env.PUBLIC_INDEXING === "on",
};
