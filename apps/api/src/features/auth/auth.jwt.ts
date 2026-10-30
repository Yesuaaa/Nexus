import { randomUUID } from "node:crypto"
import { SignJWT, errors, jwtVerify } from "jose"

export const ACCESS_SECONDS = 15 * 60
const issuer = "nexus-api"
const audience = "nexus-web"

export function jwtKey(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? ""
  const key = Buffer.from(secret, "base64url")
  if (
    !/^[A-Za-z0-9_-]+$/.test(secret) ||
    key.length < 32 ||
    key.length > 128 ||
    key.toString("base64url") !== secret
  ) {
    throw new Error(
      "JWT_SECRET must be a base64url-encoded random key of 32 to 128 bytes",
    )
  }
  return key
}

export async function signAccessToken(
  userId: string,
  sessionId: string,
  sessionExpiresAt: Date,
) {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = Math.min(
    now + ACCESS_SECONDS,
    Math.floor(sessionExpiresAt.getTime() / 1000),
  )
  const token = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setJti(randomUUID())
    .sign(jwtKey())
  return { token, expiresIn: Math.max(0, expiresAt - now) }
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, jwtKey(), {
    algorithms: ["HS256"],
    issuer,
    audience,
    typ: "at+jwt",
    requiredClaims: ["sub", "sid", "iat", "exp", "jti"],
    maxTokenAge: ACCESS_SECONDS,
    clockTolerance: 0,
  })
  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.sid !== "string" ||
    !payload.sid ||
    typeof payload.jti !== "string" ||
    !payload.jti ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > ACCESS_SECONDS
  ) {
    throw new errors.JWTClaimValidationFailed(
      "Invalid access token claims",
      payload,
    )
  }
  return { userId: payload.sub, sessionId: payload.sid }
}
