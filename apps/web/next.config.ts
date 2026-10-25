import type { NextConfig } from "next"
import path from "node:path"

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  async rewrites() {
    const apiOrigin = (
      process.env.API_PROXY_TARGET || "http://localhost:3001"
    ).replace(/\/$/, "")

    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
  },
}

export default nextConfig
