import { createHash, timingSafeEqual } from "node:crypto"
import { normalizedEmail } from "../validation.js"
import type { Provider, ProviderConfig } from "./providers.js"

export const providers: Provider[] = ["google", "facebook", "apple"]
export function isProvider(value: unknown): value is Provider {
  return providers.includes(value as Provider)
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}
export function proofMatches(value: unknown, hash: string): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(value) &&
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(Buffer.from(digest(value)), Buffer.from(hash))
  )
}
export function completionEmail(identity: {
  email?: string | null
  emailVerified: boolean
}) {
  return identity.emailVerified ? normalizedEmail(identity.email) : undefined
}

export function socialConfig(
  provider: Provider,
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfig | undefined {
  try {
    const api = new URL(env.API_PUBLIC_URL ?? "")
    const web = new URL(env.WEB_ORIGIN ?? "")
    if (
      api.username ||
      api.password ||
      api.search ||
      api.hash ||
      api.pathname !== "/" ||
      web.username ||
      web.password ||
      web.search ||
      web.hash ||
      web.pathname !== "/"
    )
      return
    if (
      [api, web].some(
        (url) =>
          url.protocol !== "https:" &&
          !(
            env.NODE_ENV !== "production" &&
            url.protocol === "http:" &&
            url.hostname === "localhost"
          ),
      )
    )
      return
    const prefix = provider.toUpperCase()
    const clientId =
      env[`${prefix}_${provider === "facebook" ? "APP_ID" : "CLIENT_ID"}`]
    const clientSecret =
      env[
        `${prefix}_${provider === "facebook" ? "APP_SECRET" : "CLIENT_SECRET"}`
      ]
    if (!clientId?.trim()) return
    if (provider !== "apple" && !clientSecret?.trim()) return
    if (
      provider === "apple" &&
      (api.protocol !== "https:" ||
        api.hostname === "localhost" ||
        /^\d+(\.\d+){3}$/.test(api.hostname) ||
        !env.APPLE_TEAM_ID ||
        !env.APPLE_KEY_ID ||
        !env.APPLE_PRIVATE_KEY)
    )
      return
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: `${api.origin}/api/auth/social/${provider}/callback`,
      teamId: env.APPLE_TEAM_ID,
      keyId: env.APPLE_KEY_ID,
      privateKey: env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      graphVersion: env.FACEBOOK_GRAPH_API_VERSION || "v26.0",
    }
  } catch {
    return undefined
  }
}
