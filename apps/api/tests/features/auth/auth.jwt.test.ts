import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { test } from "node:test"
import { SignJWT } from "jose"
import {
  ACCESS_SECONDS,
  jwtKey,
  signAccessToken,
  verifyAccessToken,
} from "./auth.jwt.js"

test("JWT verification enforces signatures, claims, algorithms, and lifetime", async (t) => {
  const original = process.env.JWT_SECRET
  process.env.JWT_SECRET = randomBytes(32).toString("base64url")
  t.after(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })
  const valid = await signAccessToken(
    "user",
    "session",
    new Date(Date.now() + 86400_000),
  )
  assert.equal(valid.expiresIn, ACCESS_SECONDS)
  assert.deepEqual(await verifyAccessToken(valid.token), {
    userId: "user",
    sessionId: "session",
  })
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    sub: "user",
    sid: "session",
    iss: "nexus-api",
    aud: "nexus-web",
    iat: now,
    exp: now + 900,
    jti: "unique",
  }
  for (const change of [
    { iss: "attacker" },
    { aud: "another-app" },
    { exp: now - 1 },
    { iat: now + 60 },
    { exp: now + 901 },
    { sid: null },
    { sub: "" },
  ]) {
    const token = await new SignJWT({ ...claims, ...change })
      .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
      .sign(jwtKey())
    await assert.rejects(verifyAccessToken(token))
  }
  for (const missing of ["sub", "sid", "iat", "exp", "jti"]) {
    const payload: Record<string, unknown> = { ...claims }
    delete payload[missing]
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
      .sign(jwtKey())
    await assert.rejects(verifyAccessToken(token))
  }
  for (const header of [
    { alg: "HS384", typ: "at+jwt" },
    { alg: "HS256", typ: "JWT" },
  ]) {
    const token = await new SignJWT(claims)
      .setProtectedHeader(header)
      .sign(randomBytes(64))
    await assert.rejects(verifyAccessToken(token))
  }
  const forged = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.`
  await assert.rejects(verifyAccessToken(forged))
  const wrongKey = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .sign(randomBytes(32))
  await assert.rejects(verifyAccessToken(wrongKey))
  const bounded = await signAccessToken(
    "user",
    "session",
    new Date((now + 20) * 1000),
  )
  assert.ok(bounded.expiresIn <= 20)
  for (const value of ["", "weak-secret", "a".repeat(10)]) {
    process.env.JWT_SECRET = value
    assert.throws(jwtKey, /JWT_SECRET/)
  }
})
