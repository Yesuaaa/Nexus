import assert from "node:assert/strict"
import { createHash, generateKeyPairSync } from "node:crypto"
import { generateKeyPair, exportJWK, SignJWT } from "jose"
import { test } from "node:test"
import {
  authorizationUrl,
  verifyCallback,
  type ProviderConfig,
} from "./providers.js"

const config = (
  provider: ProviderConfig["provider"],
  extra: Partial<ProviderConfig> = {},
): ProviderConfig => ({
  provider,
  clientId: "client-123",
  clientSecret: "client-secret",
  redirectUri: "https://app.example.test/auth/callback",
  ...(provider === "apple"
    ? { teamId: "team-123", keyId: "key-123", privateKey: "unused" }
    : {}),
  ...extra,
})

const withFetch = async (handler: typeof fetch, run: () => Promise<void>) => {
  const original = globalThis.fetch
  globalThis.fetch = handler
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
}

test("authorization URLs bind state and nonce and use Google PKCE", async () => {
  const verifier =
    "verifier-value-that-is-long-enough-for-a-pkce-verifier-123456"
  const url = new URL(
    await authorizationUrl(
      config("google"),
      "state-value",
      "nonce-value",
      verifier,
    ),
  )
  assert.equal(
    url.origin + url.pathname,
    "https://accounts.google.com/o/oauth2/v2/auth",
  )
  assert.equal(url.searchParams.get("state"), "state-value")
  assert.equal(url.searchParams.get("nonce"), "nonce-value")
  assert.equal(url.searchParams.get("code_challenge_method"), "S256")
  assert.equal(
    url.searchParams.get("code_challenge"),
    createHash("sha256").update(verifier).digest("base64url"),
  )
})

test("Apple authorization uses form_post and omits PKCE", async () => {
  const url = new URL(
    await authorizationUrl(config("apple"), "state", "nonce", "verifier"),
  )
  assert.equal(url.searchParams.get("response_mode"), "form_post")
  assert.equal(url.searchParams.get("scope"), "name email")
  assert.equal(url.searchParams.has("code_challenge"), false)
})

test("provider configuration errors do not echo credentials", async () => {
  await assert.rejects(
    authorizationUrl(
      config("google", { clientId: "" }),
      "state",
      "nonce",
      "verifier",
    ),
    (error: Error) =>
      error.message.includes("configuration") &&
      !error.message.includes("client-123"),
  )
})

test("Facebook callback checks app and user identity before returning profile", async () => {
  const calls: Array<{
    url: string
    method: string
    body: string
    authorization: string
  }> = []
  await withFetch(
    async (input, init) => {
      const url = String(input)
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: String(init?.body ?? ""),
        authorization: new Headers(init?.headers).get("authorization") ?? "",
      })
      if (
        url.startsWith("https://graph.facebook.com/v20.0/oauth/access_token")
      ) {
        return Response.json({
          access_token: "access-token",
          token_type: "bearer",
          expires_in: 3600,
        })
      }
      if (url.startsWith("https://graph.facebook.com/v20.0/debug_token")) {
        return Response.json({
          data: {
            app_id: "client-123",
            is_valid: true,
            user_id: "fb-user-9",
            expires_at: 0,
          },
        })
      }
      if (url.startsWith("https://graph.facebook.com/v20.0/me")) {
        return Response.json({
          id: "fb-user-9",
          name: "Avery Example",
          email: "avery@example.test",
        })
      }
      return new Response("unexpected request", { status: 500 })
    },
    async () => {
      const identity = await verifyCallback(
        config("facebook", { graphVersion: "v20.0" }),
        {
          code: "authorization-code",
          nonce: "unused",
          codeVerifier: "unused",
        },
      )
      assert.deepEqual(identity, {
        provider: "facebook",
        subject: "fb-user-9",
        email: "avery@example.test",
        emailVerified: false,
        fullName: "Avery Example",
      })
    },
  )
  assert.equal(calls.length, 3)
  assert.equal(calls[0].method, "POST")
  assert.doesNotMatch(calls[0].url, /client_secret|authorization-code/)
  assert.match(calls[0].body, /client_secret=client-secret/)
  assert.equal(calls[1].method, "GET")
  assert.equal(
    new URL(calls[1].url).searchParams.get("input_token"),
    "access-token",
  )
  assert.equal(new URL(calls[1].url).searchParams.has("access_token"), false)
  assert.equal(calls[1].authorization, "Bearer client-123|client-secret")
  assert.doesNotMatch(calls[1].url, /client-secret/)
})

test("Facebook rejects a token issued to a different app", async () => {
  await withFetch(
    async (input, init) => {
      const url = String(input)
      if (url.includes("/oauth/access_token"))
        return Response.json({ access_token: "secret-token", expires_in: 3600 })
      assert.doesNotMatch(url, /secret-token|client-secret/)
      assert.equal(init?.method, "GET")
      assert.equal(new URL(url).searchParams.get("input_token"), "secret-token")
      return Response.json({
        data: {
          app_id: "other-app",
          is_valid: true,
          user_id: "user-1",
          expires_at: 0,
        },
      })
    },
    async () => {
      await assert.rejects(
        verifyCallback(config("facebook"), {
          code: "code",
          nonce: "n",
          codeVerifier: "v",
        }),
        (error: Error) =>
          !error.message.includes("secret-token") &&
          !error.message.includes("client-secret"),
      )
    },
  )
})

test("Facebook rejects an expired token before fetching its profile", async () => {
  let profileRequested = false
  await withFetch(
    async (input) => {
      const url = String(input)
      if (url.includes("/oauth/access_token"))
        return Response.json({ access_token: "expired-token" })
      if (url.includes("/debug_token")) {
        return Response.json({
          data: {
            app_id: "client-123",
            is_valid: true,
            user_id: "user-1",
            expires_at: 1,
          },
        })
      }
      profileRequested = true
      return Response.json({ id: "user-1" })
    },
    async () => {
      await assert.rejects(
        verifyCallback(config("facebook"), {
          code: "code",
          nonce: "n",
          codeVerifier: "v",
        }),
        /callback/i,
      )
    },
  )
  assert.equal(profileRequested, false)
})

test("Facebook rejects expired data access before fetching its profile", async () => {
  let profileRequested = false
  await withFetch(
    async (input) => {
      const url = String(input)
      if (url.includes("/oauth/access_token"))
        return Response.json({ access_token: "expired-data-access-token" })
      if (url.includes("/debug_token")) {
        return Response.json({
          data: {
            app_id: "client-123",
            is_valid: true,
            user_id: "user-1",
            expires_at: 0,
            data_access_expires_at: 1,
          },
        })
      }
      profileRequested = true
      return Response.json({ id: "user-1" })
    },
    async () => {
      await assert.rejects(
        verifyCallback(config("facebook"), {
          code: "code",
          nonce: "n",
          codeVerifier: "v",
        }),
        /callback/i,
      )
    },
  )
  assert.equal(profileRequested, false)
})

test("Facebook omits a missing email and rejects a profile for another subject", async () => {
  let mismatch = false
  await withFetch(
    async (input) => {
      const url = String(input)
      if (url.includes("/oauth/access_token"))
        return Response.json({ access_token: "profile-token" })
      if (url.includes("/debug_token")) {
        return Response.json({
          data: {
            app_id: "client-123",
            is_valid: true,
            user_id: "expected-subject",
            expires_at: 0,
          },
        })
      }
      return Response.json({
        id: mismatch ? "different-subject" : "expected-subject",
      })
    },
    async () => {
      const identity = await verifyCallback(config("facebook"), {
        code: "code",
        nonce: "n",
        codeVerifier: "v",
      })
      assert.deepEqual(identity, {
        provider: "facebook",
        subject: "expected-subject",
        emailVerified: false,
      })
      mismatch = true
      await assert.rejects(
        verifyCallback(config("facebook"), {
          code: "code",
          nonce: "n",
          codeVerifier: "v",
        }),
        /callback/i,
      )
    },
  )
})

test("Apple callback validates its ID token and signs the client secret", async () => {
  const { privateKey: tokenPrivateKey, publicKey } =
    await generateKeyPair("RS256")
  const jwk = await exportJWK(publicKey)
  jwk.kid = "apple-key"
  jwk.alg = "RS256"
  const { privateKey: signingKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  })
  const appleConfig = config("apple", {
    teamId: "team-123",
    keyId: "signing-key-1",
    privateKey: signingKey,
  })
  const appleToken = async (audience: string) =>
    new SignJWT({
      email: "random@privaterelay.appleid.com",
      email_verified: "true",
      nonce: "apple-nonce",
    })
      .setProtectedHeader({ alg: "RS256", kid: "apple-key" })
      .setIssuer("https://appleid.apple.com")
      .setAudience(audience)
      .setSubject("apple-user-6")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(tokenPrivateKey)
  const idToken = await appleToken(appleConfig.clientId)
  const wrongAudienceToken = await appleToken("other-client")

  await withFetch(
    async (input, init) => {
      if (String(input) === "https://appleid.apple.com/auth/token") {
        const body = new URLSearchParams(String(init?.body))
        const code = body.get("code")
        const clientSecret = body.get("client_secret")
        assert.ok(clientSecret)
        const [header, claims] = clientSecret.split(".")
        assert.equal(
          JSON.parse(Buffer.from(header, "base64url").toString()).alg,
          "ES256",
        )
        const decodedClaims = JSON.parse(
          Buffer.from(claims, "base64url").toString(),
        )
        assert.equal(decodedClaims.iss, "team-123")
        assert.equal(decodedClaims.sub, appleConfig.clientId)
        assert.equal(decodedClaims.aud, "https://appleid.apple.com")
        return Response.json({
          id_token: code === "wrong-audience" ? wrongAudienceToken : idToken,
        })
      }
      if (String(input) === "https://appleid.apple.com/auth/keys")
        return Response.json({ keys: [jwk] })
      return new Response("unexpected request", { status: 500 })
    },
    async () => {
      const identity = await verifyCallback(appleConfig, {
        code: "authorization-code",
        nonce: "apple-nonce",
        codeVerifier: "unused",
        user: { name: { firstName: "Avery", lastName: "Example" } },
      })
      const identityFromFormPostString = await verifyCallback(appleConfig, {
        code: "authorization-code",
        nonce: "apple-nonce",
        codeVerifier: "unused",
        user: JSON.stringify({
          name: { firstName: "Avery", lastName: "Example" },
        }),
      })
      const identityWithoutUserRelay = await verifyCallback(appleConfig, {
        code: "authorization-code",
        nonce: "apple-nonce",
        codeVerifier: "unused",
      })
      assert.deepEqual(identity, {
        provider: "apple",
        subject: "apple-user-6",
        email: "random@privaterelay.appleid.com",
        emailVerified: true,
        fullName: "Avery Example",
      })
      assert.deepEqual(identityFromFormPostString, identity)
      assert.deepEqual(identityWithoutUserRelay, {
        provider: "apple",
        subject: "apple-user-6",
        email: "random@privaterelay.appleid.com",
        emailVerified: true,
      })
      await assert.rejects(
        verifyCallback(appleConfig, {
          code: "wrong-audience",
          nonce: "apple-nonce",
          codeVerifier: "unused",
        }),
        /callback/i,
      )
      await assert.rejects(
        verifyCallback(appleConfig, {
          code: "authorization-code",
          nonce: "wrong-nonce",
          codeVerifier: "unused",
        }),
        /callback/i,
      )
    },
  )
})

test("Google verifies ID-token signature, audience, issuer, expiry, and nonce", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256")
  const { privateKey: wrongSigningKey } = await generateKeyPair("RS256")
  const jwk = await exportJWK(publicKey)
  jwk.kid = "google-key"
  jwk.alg = "RS256"
  const configValue = config("google")
  const verifier =
    "verifier-value-that-is-long-enough-for-a-pkce-verifier-123456"
  const googleToken = async (
    options: {
      audience?: string
      issuer?: string
      expiresAt?: number | null
      signingKey?: typeof privateKey
    } = {},
  ) => {
    let token = new SignJWT({
      email: "avery@example.test",
      email_verified: true,
      nonce: "nonce-value",
      name: "Avery Example",
    })
      .setProtectedHeader({ alg: "RS256", kid: "google-key" })
      .setIssuer(options.issuer ?? "https://accounts.google.com")
      .setAudience(options.audience ?? configValue.clientId)
      .setSubject("google-user-3")
      .setIssuedAt()
    if (options.expiresAt !== null) {
      token = token.setExpirationTime(options.expiresAt ?? "5m")
    }
    return token.sign(options.signingKey ?? privateKey)
  }
  const tokens = new Map<string, string>([
    ["authorization-code", await googleToken()],
    ["wrong-audience", await googleToken({ audience: "other-client" })],
    [
      "wrong-issuer",
      await googleToken({ issuer: "https://accounts.example.test" }),
    ],
    [
      "expired",
      await googleToken({ expiresAt: Math.floor(Date.now() / 1000) - 60 }),
    ],
    ["missing-exp", await googleToken({ expiresAt: null })],
    ["wrong-signature", await googleToken({ signingKey: wrongSigningKey })],
  ])

  await withFetch(
    async (input, init) => {
      const url = String(input)
      if (url === "https://oauth2.googleapis.com/token") {
        const code = new URLSearchParams(String(init?.body)).get("code") ?? ""
        return Response.json({
          id_token: tokens.get(code),
          access_token: "access-token",
        })
      }
      if (url === "https://www.googleapis.com/oauth2/v3/certs")
        return Response.json({ keys: [jwk] })
      return new Response("unexpected request", { status: 500 })
    },
    async () => {
      const identity = await verifyCallback(configValue, {
        code: "authorization-code",
        nonce: "nonce-value",
        codeVerifier: verifier,
      })
      assert.deepEqual(identity, {
        provider: "google",
        subject: "google-user-3",
        email: "avery@example.test",
        emailVerified: true,
        fullName: "Avery Example",
      })
      const failures = [
        { code: "authorization-code", nonce: "wrong-nonce" },
        { code: "wrong-audience", nonce: "nonce-value" },
        { code: "wrong-issuer", nonce: "nonce-value" },
        { code: "expired", nonce: "nonce-value" },
        { code: "missing-exp", nonce: "nonce-value" },
        { code: "wrong-signature", nonce: "nonce-value" },
      ]
      for (const failure of failures) {
        await assert.rejects(
          verifyCallback(configValue, {
            code: failure.code,
            nonce: failure.nonce,
            codeVerifier: verifier,
          }),
          /callback/i,
        )
      }
    },
  )
})
