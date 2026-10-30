import { createHash, randomBytes } from "node:crypto"
import { Role, type User } from "../../generated/prisma/client.js"
import { isUniqueConflict } from "../../lib/errors.js"
import { publicUser } from "../users/users.dto.js"
import { clearFailures, loginAllowed, recordFailure } from "./auth.limiter.js"
import { hashPassword, validPassword, verifyPassword } from "./auth.password.js"
import { authRepository } from "./auth.repository.js"
import { normalizedEmail, validRegistrationProfile } from "./auth.schema.js"
import { signAccessToken, jwtKey } from "./auth.jwt.js"

export const SESSION_DAYS = 7

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "AuthError"
  }
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function issueSession(user: User) {
  jwtKey()
  const refreshToken = randomBytes(32).toString("base64url")
  const session = await authRepository.createSession({
    tokenHash: tokenHash(refreshToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  })
  return {
    ...(await signAccessToken(user.id, session.id, session.expiresAt)),
    refreshToken,
    user: publicUser(user),
  }
}

export const authService = {
  async refresh(refreshToken: unknown) {
    if (!authRepository.isDatabaseAvailable())
      throw new AuthError(503, "Database unavailable")
    if (
      typeof refreshToken !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(refreshToken)
    )
      throw new AuthError(401, "Invalid or expired session")
    jwtKey()
    const nextToken = randomBytes(32).toString("base64url")
    const session = await authRepository.rotateRefreshToken(
      tokenHash(refreshToken),
      tokenHash(nextToken),
    )
    if (!session) throw new AuthError(401, "Invalid or expired session")
    return {
      ...(await signAccessToken(session.userId, session.id, session.expiresAt)),
      refreshToken: nextToken,
    }
  },
  async register(input: {
    email?: unknown
    password?: unknown
    fullName?: unknown
    contactNumber?: unknown
  }) {
    if (!authRepository.isDatabaseAvailable()) {
      throw new AuthError(503, "Database unavailable")
    }
    const cleanEmail = normalizedEmail(input.email)
    const password = input.password
    const fullName = input.fullName
    const contactNumber = input.contactNumber

    if (!cleanEmail || !validPassword(password)) {
      throw new AuthError(
        400,
        "Provide a valid email and password of at least 12 characters",
      )
    }
    if (!validRegistrationProfile(fullName, contactNumber)) {
      throw new AuthError(400, "Provide a valid name and contact number")
    }

    const existingUser = await authRepository.findUserByEmail(cleanEmail)
    if (existingUser) {
      throw new AuthError(409, "Email is already registered")
    }

    try {
      const user = await authRepository.createUser({
        email: cleanEmail,
        fullName: (fullName as string).trim(),
        contactNumber: (contactNumber as string).trim(),
        passwordHash: await hashPassword(password as string),
        role: Role.USER,
      })
      return await issueSession(user)
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new AuthError(409, "Email is already registered")
      }
      throw error
    }
  },

  async login(input: { email?: unknown; password?: unknown; ip?: string }) {
    if (!authRepository.isDatabaseAvailable()) {
      throw new AuthError(503, "Database unavailable")
    }
    const cleanEmail = normalizedEmail(input.email)
    const password = input.password
    if (
      !cleanEmail ||
      typeof password !== "string" ||
      Buffer.byteLength(password) > 1024
    ) {
      throw new AuthError(400, "Provide a valid email and password")
    }
    const attemptKey = `${input.ip ?? "unknown"}\0${cleanEmail}`
    if (!loginAllowed(attemptKey)) {
      throw new AuthError(429, "Too many login attempts. Try again later")
    }
    const user = await authRepository.findUserByEmail(cleanEmail)
    if (
      !user ||
      !user.isActive ||
      user.accountDeletedAt !== null ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      recordFailure(attemptKey)
      throw new AuthError(401, "Invalid email or password")
    }
    clearFailures(attemptKey)
    return await issueSession(user)
  },

  async logout(sessionId: string) {
    await authRepository.deleteSession(sessionId)
  },

  async changePassword(input: {
    userId: string
    currentPasswordHash: string
    currentPassword?: unknown
    newPassword?: unknown
  }) {
    const currentPassword = input.currentPassword
    const newPassword = input.newPassword
    if (
      typeof currentPassword !== "string" ||
      Buffer.byteLength(currentPassword) > 1024 ||
      !validPassword(newPassword)
    ) {
      throw new AuthError(
        400,
        "Provide the current password and a new password of at least 12 characters",
      )
    }
    if (!(await verifyPassword(currentPassword, input.currentPasswordHash))) {
      throw new AuthError(401, "Current password is incorrect")
    }
    const newPasswordHash = await hashPassword(newPassword)
    await authRepository.updatePasswordAndRevokeSessions(
      input.userId,
      newPasswordHash,
    )
  },
}
