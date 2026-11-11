import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the sign-in page is public; everything else needs a Zinema account.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/$", "/login", "/opengraph-image", "/twitter-image", "/brand/"], disallow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
