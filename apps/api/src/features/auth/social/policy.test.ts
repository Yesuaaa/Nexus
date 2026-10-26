import assert from "node:assert/strict"
import { test } from "node:test"
import {
  completionEmail,
  proofMatches,
  digest,
  socialConfig,
} from "./policy.js"

test("completion requires browser proof and rejects malformed verifiers", () => {
  const verifier = "a".repeat(43)
  assert.equal(proofMatches(verifier, digest(verifier)), true)
  assert.equal(proofMatches("b".repeat(43), digest(verifier)), false)
  assert.equal(proofMatches("a", digest("a")), false)
})

test("only verified provider emails may become account email without a challenge", () => {
  assert.equal(
    completionEmail({ email: "USER@Example.com", emailVerified: true }),
    "user@example.com",
  )
  assert.equal(
    completionEmail({ email: "user@example.com", emailVerified: false }),
    undefined,
  )
  assert.equal(completionEmail({ emailVerified: true }), undefined)
})

test("provider configuration fails closed when credentials or public origins are absent", () => {
  assert.equal(socialConfig("google", {}), undefined)
  assert.equal(
    socialConfig("google", {
      API_PUBLIC_URL: "https://api.example.com",
      WEB_ORIGIN: "https://example.com",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
    })?.redirectUri,
    "https://api.example.com/api/auth/social/google/callback",
  )
  assert.equal(
    socialConfig("apple", {
      API_PUBLIC_URL: "http://localhost:3001",
      WEB_ORIGIN: "http://localhost:5173",
      APPLE_CLIENT_ID: "client",
      APPLE_TEAM_ID: "team",
      APPLE_KEY_ID: "key",
      APPLE_PRIVATE_KEY: "key",
    }),
    undefined,
  )
})
