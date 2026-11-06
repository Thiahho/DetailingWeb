import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/siteUrl";

const siteUrl = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}