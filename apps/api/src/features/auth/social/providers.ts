import { createHash } from "node:crypto"
import {
  createRemoteJWKSet,
  SignJWT,
  importPKCS8,
  jwtVerify,
  type JWTPayload,
} from "jose"

export type Provider = "google" | "facebook" | "apple"

export type ProviderIdentity = {
  provider: Provider
  subject: string
  email?: string
  emailVerified: boolean
  fullName?: string
}

export type ProviderConfig = {
  provider: Provider
  clientId: string
  clientSecret?: string
  redirectUri: string
  teamId?: string
  keyId?: string
  privateKey?: string
  graphVersion?: string
}

export type ProviderCallback = {
  code: string
  nonce: string
  codeVerifier: string
  user?: unknown
}

const requestTimeoutMs = 5_000
const googleIssuer = ["https://accounts.google.com", "accounts.google.com"]
const appleIssuer = "https://appleid.apple.com"
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  {
    timeoutDuration: requestTimeoutMs,
  },
)
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
  {
    timeoutDuration: requestTimeoutMs,
  },
)

type JsonObject = Record<string, unknown>

function record(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function requireConfiguration(config: ProviderConfig): void {
  try {
    if (!nonEmpty(config.clientId) || !nonEmpty(config.redirectUri))
      throw new Error()
    const redirect = new URL(config.redirectUri)
    if (redirect.protocol !== "https:" && redirect.hostname !== "localhost")
      throw new Error()
    if (config.provider === "google" || config.provider === "facebook") {
      if (!nonEmpty(config.clientSecret)) throw new Error()
    }
    if (config.provider === "apple") {
      if (
        !nonEmpty(config.teamId) ||
        !nonEmpty(config.keyId) ||
        !nonEmpty(config.privateKey)
      )
        throw new Error()
    }
    if (
      config.provider === "facebook" &&
      config.graphVersion !== undefined &&
      !/^v?\d+\.\d+$/.test(config.graphVersion)
    ) {
      throw new Error()
    }
    if (!(
      config.provider === "google" ||
      config.provider === "facebook" ||
      config.provider === "apple"
    ))
      throw new Error()
  } catch {
    throw new Error("Invalid provider configuration")
  }
}

function requireInput(value: unknown): asserts value is string {
  if (!nonEmpty(value)) throw new Error("Invalid provider callback")
}

function googleVersionlessChallenge(verifier: string): string {
  if (
    verifier.length < 43 ||
    verifier.length > 128 ||
    !/^[A-Za-z0-9._~-]+$/.test(verifier)
  ) {
    throw new Error("Invalid provider callback")
  }
  return createHash("sha256").update(verifier).digest("base64url")
}

export async function authorizationUrl(
  config: ProviderConfig,
  state: string,
  nonce: string,
  codeVerifier: string,
): Promise<string> {
  requireConfiguration(config)
  requireInput(state)
  const url = new URL(
    config.provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : config.provider === "apple"
        ? "https://appleid.apple.com/auth/authorize"
        : `https://www.facebook.com/${facebookVersion(config)}/dialog/oauth`,
  )
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("state", state)

  if (config.provider === "google") {
    requireInput(nonce)
    const challenge = googleVersionlessChallenge(codeVerifier)
    url.searchParams.set("scope", "openid email profile")
    url.searchParams.set("nonce", nonce)
    url.searchParams.set("code_challenge", challenge)
    url.searchParams.set("code_challenge_method", "S256")
    url.searchParams.set("access_type", "online")
  } else if (config.provider === "apple") {
    requireInput(nonce)
    url.searchParams.set("scope", "name email")
    url.searchParams.set("nonce", nonce)
    url.searchParams.set("response_mode", "form_post")
  } else {
    url.searchParams.set("scope", "email public_profile")
  }
  return url.toString()
}

function facebookVersion(config: ProviderConfig): string {
  const raw = config.graphVersion ?? "v26.0"
  return raw.startsWith("v") ? raw : `v${raw}`
}

async function fetchJson(url: URL, init?: RequestInit): Promise<JsonObject> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(requestTimeoutMs),
    })
  } catch {
    throw new Error("Provider request failed")
  }
  if (!response.ok) throw new Error("Provider request failed")
  try {
    const parsed = record(await response.json())
    if (!parsed) throw new Error()
    return parsed
  } catch {
    throw new Error("Provider returned an invalid response")
  }
}

function formBody(values: Record<string, string>): URLSearchParams {
  return new URLSearchParams(values)
}

function tokenEndpointRequest(
  url: string,
  values: Record<string, string>,
): Promise<JsonObject> {
  return fetchJson(new URL(url), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody(values),
  })
}

function value(payload: JWTPayload, key: string): unknown {
  return payload[key]
}

function verifiedEmail(
  payload: JWTPayload,
  provider: "google" | "apple",
): boolean {
  const claim = value(payload, "email_verified")
  return claim === true || (provider === "apple" && claim === "true")
}

function identityFromClaims(
  provider: "google" | "apple",
  payload: JWTPayload,
): ProviderIdentity {
  if (!nonEmpty(payload.sub))
    throw new Error("Provider callback could not be verified")
  const email = nonEmpty(payload.email) ? payload.email : undefined
  const fullName = nonEmpty(payload.name) ? payload.name : undefined
  return {
    provider,
    subject: payload.sub,
    ...(email ? { email } : {}),
    emailVerified: verifiedEmail(payload, provider),
    ...(fullName ? { fullName } : {}),
  }
}

function appleUser(value: unknown): JsonObject | undefined {
  if (typeof value !== "string") return record(value)
  if (value.length > 4096) return undefined
  try {
    return record(JSON.parse(value))
  } catch {
    return undefined
  }
}

async function verifyGoogle(
  config: ProviderConfig,
  callback: ProviderCallback,
): Promise<ProviderIdentity> {
  const tokens = await tokenEndpointRequest(
    "https://oauth2.googleapis.com/token",
    {
      grant_type: "authorization_code",
      code: callback.code,
      client_id: config.clientId,
      client_secret: config.clientSecret!,
      redirect_uri: config.redirectUri,
      code_verifier: callback.codeVerifier,
    },
  )
  if (!nonEmpty(tokens.id_token))
    throw new Error("Provider callback could not be verified")
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(tokens.id_token, googleJwks, {
      issuer: googleIssuer,
      audience: config.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "nonce"],
    }))
  } catch {
    throw new Error("Provider callback could not be verified")
  }
  if (payload.nonce !== callback.nonce)
    throw new Error("Provider callback could not be verified")
  return identityFromClaims("google", payload)
}

async function appleClientSecret(config: ProviderConfig): Promise<string> {
  let key
  try {
    key = await importPKCS8(config.privateKey!, "ES256")
  } catch {
    throw new Error("Invalid provider configuration")
  }
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId!, typ: "JWT" })
    .setIssuer(config.teamId!)
    .setSubject(config.clientId)
    .setAudience(appleIssuer)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key)
}

async function verifyApple(
  config: ProviderConfig,
  callback: ProviderCallback,
): Promise<ProviderIdentity> {
  const clientSecret = await appleClientSecret(config)
  const tokens = await tokenEndpointRequest(
    "https://appleid.apple.com/auth/token",
    {
      grant_type: "authorization_code",
      code: callback.code,
      client_id: config.clientId,
      client_secret: clientSecret,
      redirect_uri: config.redirectUri,
    },
  )
  if (!nonEmpty(tokens.id_token))
    throw new Error("Provider callback could not be verified")
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(tokens.id_token, appleJwks, {
      issuer: appleIssuer,
      audience: config.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "nonce"],
    }))
  } catch {
    throw new Error("Provider callback could not be verified")
  }
  if (payload.nonce !== callback.nonce)
    throw new Error("Provider callback could not be verified")
  const identity = identityFromClaims("apple", payload)
  const user = appleUser(callback.user)
  if (identity.fullName || !user) return identity
  const name = record(user.name)
  const components = [name?.firstName, name?.lastName].filter(nonEmpty)
  if (components.length) identity.fullName = components.join(" ")
  return identity
}

async function verifyFacebook(
  config: ProviderConfig,
  callback: ProviderCallback,
): Promise<ProviderIdentity> {
  const version = facebookVersion(config)
  const tokenUrl = new URL(
    `https://graph.facebook.com/${version}/oauth/access_token`,
  )
  const tokens = await fetchJson(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: config.clientId,
      client_secret: config.clientSecret!,
      redirect_uri: config.redirectUri,
      code: callback.code,
    }),
  })
  if (!nonEmpty(tokens.access_token))
    throw new Error("Provider callback could not be verified")

  const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`)
  debugUrl.searchParams.set("input_token", tokens.access_token)
  const debugResult = await fetchJson(debugUrl, {
    method: "GET",
    headers: {
      authorization: `Bearer ${config.clientId}|${config.clientSecret}`,
    },
  })
  const debug = record(debugResult.data)
  const expiresAt = debug?.expires_at
  const dataAccessExpiresAt = debug?.data_access_expires_at
  const now = Date.now() / 1000
  if (
    !debug ||
    debug.is_valid !== true ||
    debug.app_id !== config.clientId ||
    !nonEmpty(debug.user_id) ||
    typeof expiresAt !== "number" ||
    !Number.isFinite(expiresAt) ||
    expiresAt < 0 ||
    (expiresAt > 0 && expiresAt <= now) ||
    (dataAccessExpiresAt !== undefined &&
      (typeof dataAccessExpiresAt !== "number" ||
        !Number.isFinite(dataAccessExpiresAt) ||
        dataAccessExpiresAt < 0 ||
        (dataAccessExpiresAt > 0 && dataAccessExpiresAt <= now)))
  ) {
    throw new Error("Provider callback could not be verified")
  }

  const profileUrl = new URL(`https://graph.facebook.com/${version}/me`)
  profileUrl.search = new URLSearchParams({
    fields: "id,name,email",
  }).toString()
  const profile = await fetchJson(profileUrl, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })
  if (!nonEmpty(profile.id) || profile.id !== debug.user_id)
    throw new Error("Provider callback could not be verified")
  const email = nonEmpty(profile.email) ? profile.email : undefined
  const fullName = nonEmpty(profile.name) ? profile.name : undefined
  return {
    provider: "facebook",
    subject: profile.id,
    ...(email ? { email } : {}),
    emailVerified: false,
    ...(fullName ? { fullName } : {}),
  }
}

export async function verifyCallback(
  config: ProviderConfig,
  callback: ProviderCallback,
): Promise<ProviderIdentity> {
  requireConfiguration(config)
  requireInput(callback?.code)
  if (config.provider === "google" || config.provider === "apple")
    requireInput(callback.nonce)
  if (config.provider === "google")
    googleVersionlessChallenge(callback.codeVerifier)
  try {
    if (config.provider === "google")
      return await verifyGoogle(config, callback)
    if (config.provider === "apple") return await verifyApple(config, callback)
    return await verifyFacebook(config, callback)
  } catch {
    throw new Error("Provider callback could not be verified")
  }
}
