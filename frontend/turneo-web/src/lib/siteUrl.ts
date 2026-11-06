// Single source of truth for the public site base URL (no trailing slash).
//
// Fails loudly at import time when NEXT_PUBLIC_SITE_URL is missing: an empty
// value silently produced broken canonical, sitemap, robots and Open Graph
// URLs, and the bookings proxies hid it behind a hardcoded host. Keep the
// literal `process.env.NEXT_PUBLIC_SITE_URL` access so Next.js can inline it.
const rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

if (!rawSiteUrl) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is not set. It must be the public site base URL " +
      "(e.g. https://www.example.com). Define it in .env.local or in the " +
      "deployment environment variables."
  );
}

export const SITE_URL: string = rawSiteUrl;
