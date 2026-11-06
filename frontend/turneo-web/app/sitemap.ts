import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/siteUrl";

const siteUrl = SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/reservar`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/servicios`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/mis-turnos`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}