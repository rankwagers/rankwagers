import type { MetadataRoute } from "next";
import { resolveAppEnv } from "@/lib/config/env";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const appEnv = resolveAppEnv();

  // Staging (and any non-production deploy marker) must never be indexed.
  if (appEnv === "staging" || process.env.STAGING_NOINDEX === "true") {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/developer",
          "/developer/",
          "/go/",
          "/not-available",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl().replace(/^https?:\/\//, ""),
  };
}
