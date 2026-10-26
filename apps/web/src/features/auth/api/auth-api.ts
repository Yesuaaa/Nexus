import { apiUrl } from "../../../lib/api-url.ts"
import type { Account, RegistrationData } from "../model/types"

type AuthResult = { token: string; user: Account; expiresIn: number }

const tokenKey = "nexus.auth.token"
const socialFlowKey = "nexus.auth.social.pending"

export type SocialProvider = "google" | "facebook" | "apple"
export type SocialStartPurpose = "signin" | "link" | "reauth"
export type SocialFlow = {
  code?: string
  verifier: string
  purpose: SocialStartPurpose
  provider: SocialProvider
  nextProvider?: SocialProvider
}
export type SocialCompletion =
  | AuthResult
  | {
      onboarding: true
      emailRequired: boolean
      fullName?: string
      email?: string
    }
  | { linked: true }
  | { reauthenticated: true }

export function saveSocialFlow(flow: SocialFlow): void {
  sessionStorage.setItem(socialFlowKey, JSON.stringify(flow))
}

export function getSocialFlow(): SocialFlow | null {
  try {
    const value = sessionStorage.getItem(socialFlowKey)
    if (!value) return null
    const flow: unknown = JSON.parse(value)
    if (
      !flow ||
      typeof flow !== "object" ||
      !("verifier" in flow) ||
      typeof flow.verifier !== "string" ||
      !("provider" in flow) ||
      !("purpose" in flow)
    )
      return null
    return flow as SocialFlow
  } catch {
    return null
  }
}

export function clearSocialFlow(): void {
  try {
    sessionStorage.removeItem(socialFlowKey)
  } catch {
    // A blocked storage API cannot retain a social auth flow.
  }
}

async function createVerifier(): Promise<{
  verifier: string
  verifierHash: string
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const verifier = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  )
  const verifierHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
  return { verifier, verifierHash }
}

export async function getSocialProviders(): Promise<
  Record<SocialProvider, boolean>
> {
  const result = await request<{ providers: Record<SocialProvider, boolean> }>(
    "/api/auth/social/providers",
  )
  return result.providers
}

export async function startSocialAuth(
  provider: SocialProvider,
  options: {
    purpose?: SocialStartPurpose
    currentPassword?: string
    nextProvider?: SocialProvider
  } = {},
): Promise<{ url: string }> {
  const { verifier, verifierHash } = await createVerifier()
  saveSocialFlow({
    verifier,
    provider,
    purpose: options.purpose ?? "signin",
    ...(options.nextProvider ? { nextProvider: options.nextProvider } : {}),
  })
  const result = await request<{ url: string }>(
    `/api/auth/social/${provider}/start`,
    {
      method: "POST",
      body: JSON.stringify({
        verifierHash,
        ...(options.purpose ? { purpose: options.purpose } : {}),
        ...(options.currentPassword
          ? { currentPassword: options.currentPassword }
          : {}),
      }),
    },
  )
  return result
}

export async function completeSocialAuth(data: {
  code: string
  verifier: string
  fullName?: string
  contactNumber?: string
  email?: string
  emailCode?: string
}): Promise<SocialCompletion> {
  const result = await request<SocialCompletion>("/api/auth/social/complete", {
    method: "POST",
    body: JSON.stringify(data),
  })
  if ("token" in result) sessionStorage.setItem(tokenKey, result.token)
  return result
}

export async function sendSocialEmailCode(
  code: string,
  verifier: string,
  email: string,
): Promise<void> {
  await request<void>("/api/auth/social/email", {
    method: "POST",
    body: JSON.stringify({ code, verifier, email }),
  })
}

export function getSocialConnections(): Promise<{
  providers: string[]
  hasPassword: boolean
}> {
  return request("/api/auth/social/connections")
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(tokenKey)
  } catch {
    return null
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(tokenKey)
  } catch {
    // A blocked storage API cannot hold a session to clear.
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const token = getToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  })

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Something went wrong. Please try again."
    throw new ApiError(message, response.status)
  }

  return (response.status === 204 ? undefined : await response.json()) as T
}

export { request as apiRequest }

export async function signIn(
  email: string,
  password: string,
): Promise<Account> {
  const result = await request<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  sessionStorage.setItem(tokenKey, result.token)
  return result.user
}

export async function register(data: RegistrationData): Promise<Account> {
  const result = await request<AuthResult>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  })
  sessionStorage.setItem(tokenKey, result.token)
  return result.user
}

export function getCurrentAccount(): Promise<{ user: Account }> {
  return request("/api/auth/me")
}

export async function signOut(): Promise<void> {
  if (!getToken()) return
  try {
    await request<void>("/api/auth/logout", { method: "POST" })
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error
  }
  clearToken()
}
