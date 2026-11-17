import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

/** Only the public pages; everything else needs a login. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return [
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
