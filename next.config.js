/** @type {import('next').NextConfig} */

const path = require("path");
const { SECURITY_HEADERS } = require(path.join(__dirname, "lib", "security", "headers.cjs"));

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Atomic build swap: `npm run build` (scripts/build-swap.mjs) builds into a
  // candidate dir (NEXT_DIST_DIR=.next-build) and only renames it to .next on
  // success, so a failed build can never remove or corrupt the .next the
  // running server is serving. Also enables isolated verification builds.
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  experimental: {
    instrumentationHook: true,
    /** Tree-shake lucide icon imports — reduces client JS for CWV. */
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.footystats.org" },
      { protocol: "https", hostname: "media.api-sports.io" },
    ],
  },
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      { key: "Pragma", value: "no-cache" },
    ];
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/go/:path*",
        headers: noStore,
      },
      {
        source: "/api/internal/:path*",
        headers: noStore,
      },
      {
        source: "/api/:path*/diagnostics",
        headers: noStore,
      },
      {
        source: "/admin",
        headers: noStore,
      },
      {
        source: "/developer/:path*",
        headers: noStore,
      },
      {
        source: "/icon.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
