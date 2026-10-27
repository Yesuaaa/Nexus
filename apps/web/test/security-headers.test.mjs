import assert from "node:assert/strict"
import test from "node:test"
import nextConfig from "../next.config.ts"

test("Next.js static assets receive a restrictive CSP", async () => {
  const headerRules = await nextConfig.headers()
  const staticRule = headerRules.find(
    (rule) => rule.source === "/_next/static/:path*",
  )
  const csp = staticRule?.headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value

  assert.ok(csp)
  assert.match(csp, /default-src 'none'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.doesNotMatch(csp, /unsafe-eval/)
})
