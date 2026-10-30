import { apiUrl } from "../../../lib/api-url.ts"
import type { Account, RegistrationData } from "../model/types"

type AuthResult = { token: string; user: Account; expiresIn: number }

const tokenKey = "nexus.auth.token"

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

export async function requestPasswordReset(
  email: string,
): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<void> {
  await request<void>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  })
}
