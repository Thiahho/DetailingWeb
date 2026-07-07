import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  if (!siteUrl) return [];

  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/servicios`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/mis-turnos`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}