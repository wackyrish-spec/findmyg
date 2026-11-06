import { defineConfig } from "astro/config";

// Set SITE_URL once the domain is chosen (used for canonical URLs and the sitemap).
export default defineConfig({
  site: process.env.SITE_URL || "https://garageguide.example",
  trailingSlash: "always",
  build: { format: "directory" },
});
