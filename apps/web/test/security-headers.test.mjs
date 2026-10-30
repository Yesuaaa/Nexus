import assert from "node:assert/strict"
import test from "node:test"
import nextConfig from "../next.config.ts"
import { buildContentSecurityPolicy } from "../src/lib/content-security-policy.ts"

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

test("all web responses disable MIME sniffing", async () => {
  const headerRules = await nextConfig.headers()
  const globalRule = headerRules.find((rule) => rule.source === "/:path*")
  const nosniff = globalRule?.headers.find(
    (header) => header.key === "X-Content-Type-Options",
  )?.value

  assert.equal(nosniff, "nosniff")
})

test("page CSP permits eval only for the Next.js development runtime", () => {
  const developmentCsp = buildContentSecurityPolicy("test-nonce", "", true)
  const productionCsp = buildContentSecurityPolicy("test-nonce", "", false)

  assert.match(developmentCsp, /script-src[^;]*'unsafe-eval'/)
  assert.doesNotMatch(productionCsp, /unsafe-eval/)
})

test("page CSP permits dynamic presentation styles without weakening scripts", () => {
  const productionCsp = buildContentSecurityPolicy("test-nonce", "", false)

  assert.match(
    productionCsp,
    /style-src 'self' 'nonce-test-nonce'; style-src-attr 'unsafe-inline'/,
  )
  assert.doesNotMatch(productionCsp, /(?:^|; )style-src [^;]*'unsafe-inline'/)
  assert.doesNotMatch(productionCsp, /script-src[^;]*'unsafe-inline'/)
  assert.match(productionCsp, /img-src[^;]*https:\/\/\*\.supabase\.co/)
})
