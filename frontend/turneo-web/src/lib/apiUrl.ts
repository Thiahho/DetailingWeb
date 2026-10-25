// Single source of truth for the backend API base URL.
//
// Fails loudly at import time when NEXT_PUBLIC_API_URL is missing: a silent
// fallback to a hardcoded host once pointed production at a retired backend
// and broke the site without any visible error. Keep the literal
// `process.env.NEXT_PUBLIC_API_URL` access so Next.js can inline it.
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

if (!rawApiUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. It must point to the backend API " +
      "(e.g. https://<backend>.onrender.com). Define it in .env.local or in the " +
      "deployment environment variables."
  );
}

export const API_URL: string = rawApiUrl;
