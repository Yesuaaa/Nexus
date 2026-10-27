import type { NextConfig } from "next"
import path from "node:path"

const staticAssetCsp = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ")

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: staticAssetCsp,
          },
        ],
      },
    ]
  },
  async rewrites() {
    const apiOrigin = (
      process.env.API_PROXY_TARGET || "http://localhost:3001"
    ).replace(/\/$/, "")

    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
  },
}

export default nextConfig
