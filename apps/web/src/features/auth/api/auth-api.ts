import { apiUrl } from "../../../lib/api-url.ts"
import { departmentColorValues } from "../../departments/model/department-color.ts"
import { canSignInToPortal } from "../model/auth-portal.ts"
import { Permissions } from "../model/permissions.ts"
import { roles } from "../model/roles.ts"
import type { Account, AuthPortal, RegistrationData } from "../model/types"

type TokenResult = { token: string; refreshToken: string; expiresIn: number }
type AuthResult = TokenResult & { user: Account }

const tokenKey = "nexus.auth.token"
const refreshKey = "nexus.auth.refreshToken"
const permissionValues = new Set<string>(Object.values(Permissions))
let refreshFlight: { token: string; promise: Promise<void> } | null = null
let sessionVersion = 0

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export class PortalAccessError extends Error {
  readonly portal: AuthPortal

  constructor(portal: AuthPortal) {
    super("This account cannot use the selected sign-in portal.")
    this.portal = portal
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
  sessionVersion += 1
  try {
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(refreshKey)
  } catch {
    // A blocked storage API cannot hold a session to clear.
  }
}

function storeTokens(result: TokenResult) {
  if (!validTokenResult(result))
    throw new ApiError(
      "Invalid authentication response. Please try again.",
      502,
    )
  try {
    sessionStorage.setItem(tokenKey, result.token)
    if (result.refreshToken)
      sessionStorage.setItem(refreshKey, result.refreshToken)
    else sessionStorage.removeItem(refreshKey)
  } catch (error) {
    clearToken()
    throw error
  }
}

function validTokenResult(result: unknown): result is TokenResult {
  if (!result || typeof result !== "object") return false
  return (
    "token" in result &&
    typeof result.token === "string" &&
    Boolean(result.token.trim()) &&
    "refreshToken" in result &&
    typeof result.refreshToken === "string" &&
    Boolean(result.refreshToken.trim()) &&
    "expiresIn" in result &&
    typeof result.expiresIn === "number" &&
    Number.isFinite(result.expiresIn) &&
    result.expiresIn > 0
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function optionalNullableString(record: Record<string, unknown>, key: string) {
  return !(key in record) || isNullableString(record[key])
}

function optionalNamedSummary(record: Record<string, unknown>, key: string) {
  if (!(key in record) || record[key] === null) return true
  const summary = record[key]
  return (
    isRecord(summary) &&
    typeof summary.id === "string" &&
    typeof summary.name === "string"
  )
}

function optionalDepartment(record: Record<string, unknown>) {
  if (!("department" in record) || record.department === null) return true
  const department = record.department
  return (
    isRecord(department) &&
    typeof department.id === "string" &&
    typeof department.name === "string" &&
    isNullableString(department.code) &&
    typeof department.color === "string" &&
    departmentColorValues.includes(
      department.color as (typeof departmentColorValues)[number],
    )
  )
}

function validAccount(value: unknown): value is Account {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    Boolean(value.id.trim()) &&
    typeof value.email === "string" &&
    Boolean(value.email.trim()) &&
    isNullableString(value.fullName) &&
    isNullableString(value.contactNumber) &&
    roles.includes(value.role as (typeof roles)[number]) &&
    typeof value.isActive === "boolean" &&
    Array.isArray(value.permissions) &&
    value.permissions.every(
      (permission) =>
        typeof permission === "string" && permissionValues.has(permission),
    ) &&
    typeof value.createdAt === "string" &&
    Boolean(value.createdAt.trim()) &&
    optionalNullableString(value, "imageUrl") &&
    optionalNullableString(value, "accountDeletedAt") &&
    optionalNullableString(value, "position") &&
    optionalNullableString(value, "departmentId") &&
    optionalNullableString(value, "teamId") &&
    optionalNamedSummary(value, "team") &&
    optionalNamedSummary(value, "headOf") &&
    optionalDepartment(value)
  )
}

function assertAuthResult(result: unknown): asserts result is AuthResult {
  if (
    !validTokenResult(result) ||
    !("user" in result) ||
    !validAccount(result.user)
  )
    throw new ApiError(
      "Invalid authentication response. Please try again.",
      502,
    )
}

async function responseError(response: Response) {
  const payload: unknown = await response.json().catch(() => null)
  const body = payload && typeof payload === "object" ? payload : {}
  const message =
    "error" in body && typeof body.error === "string"
      ? body.error
      : "Something went wrong. Please try again."
  const code =
    "code" in body && typeof body.code === "string" ? body.code : undefined
  return { error: new ApiError(message, response.status), code }
}

async function refreshSession(version: number) {
  const refreshToken = sessionStorage.getItem(refreshKey)
  if (!refreshToken) {
    clearToken()
    throw new ApiError("Your session has expired. Please sign in again.", 401)
  }
  if (refreshFlight?.token === refreshToken) return refreshFlight.promise
  const promise = (async () => {
    const response = await fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (sessionVersion !== version)
      throw new ApiError("Session changed. Please try again.", 409)
    if (!response.ok) {
      const { error } = await responseError(response)
      if (sessionVersion !== version)
        throw new ApiError("Session changed. Please try again.", 409)
      if (
        response.status === 401 &&
        sessionStorage.getItem(refreshKey) === refreshToken
      )
        clearToken()
      throw error
    }
    const result: unknown = await response.json()
    if (sessionVersion !== version)
      throw new ApiError("Session changed. Please try again.", 409)
    if (!validTokenResult(result))
      throw new ApiError("Unable to renew your session. Please try again.", 502)
    // An in-flight refresh must not restore a signed-out or replaced session.
    if (sessionStorage.getItem(refreshKey) !== refreshToken)
      throw new ApiError("Session changed. Please try again.", 409)
    storeTokens(result)
  })()
  refreshFlight = { token: refreshToken, promise }
  try {
    await promise
  } finally {
    if (refreshFlight?.promise === promise) refreshFlight = null
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
  rawResponse = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const token = getToken()
  const version = sessionVersion
  const credentialRequest = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
  ].includes(path)
  const managedToken = !credentialRequest && !headers.has("Authorization")
  const assertCurrentSession = () => {
    if ((managedToken || credentialRequest) && sessionVersion !== version) {
      throw new ApiError("Session changed. Please try again.", 409)
    }
  }
  if (token && managedToken) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    cache: "no-store",
    headers,
  })
  assertCurrentSession()

  if (!response.ok) {
    const { error, code } = await responseError(response)
    assertCurrentSession()
    if (response.status === 401 && managedToken && token) {
      if (!retried && code === "ACCESS_TOKEN_EXPIRED") {
        if (getToken() === token) await refreshSession(version)
        if (sessionVersion !== version)
          throw new ApiError("Session changed. Please try again.", 409)
        if (getToken()) return request<T>(path, options, true, rawResponse)
      }
      if (getToken() === token) clearToken()
    }
    throw error
  }

  if (rawResponse) return response as T
  const result = response.status === 204 ? undefined : await response.json()
  assertCurrentSession()
  return result as T
}

export { request as apiRequest }

// Streaming fetch shares the same session checks and access-token renewal.
export function apiStreamRequest(path: string, options: RequestInit = {}) {
  return request<Response>(path, options, false, true)
}

export async function signIn(
  email: string,
  password: string,
): Promise<Account> {
  const version = ++sessionVersion
  const result = await request<unknown>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  if (sessionVersion !== version)
    throw new ApiError("Session changed. Please try again.", 409)
  assertAuthResult(result)
  storeTokens(result)
  return result.user
}

export async function signInToPortal(
  email: string,
  password: string,
  portal: AuthPortal,
): Promise<Account> {
  const account = await signIn(email, password)
  if (canSignInToPortal(account.role, portal)) return account

  // The shared API authenticates credentials before the client knows the role.
  // Revoke a session created through the wrong portal and always remove its
  // local bearer tokens, even if the revocation request cannot reach the API.
  try {
    await signOut()
  } catch {
    clearToken()
  }
  throw new PortalAccessError(portal)
}

export async function register(data: RegistrationData): Promise<Account> {
  const version = ++sessionVersion
  const result = await request<unknown>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  })
  if (sessionVersion !== version)
    throw new ApiError("Session changed. Please try again.", 409)
  assertAuthResult(result)
  storeTokens(result)
  return result.user
}

export function getCurrentAccount(): Promise<{ user: Account }> {
  return request("/api/auth/me")
}

export async function signOut(): Promise<void> {
  if (!getToken()) {
    clearToken()
    return
  }
  try {
    await request<void>("/api/auth/logout", { method: "POST" })
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error
  }
  clearToken()
}
