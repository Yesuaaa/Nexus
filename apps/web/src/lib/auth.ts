export type Account = {
  id: string
  email: string
  fullName: string | null
  contactNumber: string | null
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "USER"
  createdAt: string
}

type AuthResult = { token: string; user: Account; expiresIn: number }

const tokenKey = "nexus.auth.token"
const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? ""

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export function getToken(): string | null {
  return sessionStorage.getItem(tokenKey)
}

export function clearToken() {
  sessionStorage.removeItem(tokenKey)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
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

export async function register(data: {
  fullName: string
  contactNumber: string
  email: string
  password: string
}): Promise<Account> {
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
