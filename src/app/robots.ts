import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/login", "/signup"], disallow: ["/api/", "/vocabulary", "/practice", "/journal", "/account", "/unsubscribe", "/offline"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
