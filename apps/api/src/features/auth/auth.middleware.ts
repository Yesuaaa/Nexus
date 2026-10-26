import type { RequestHandler } from "express"
import { Role, type User } from "../../generated/prisma/client.js"
import { authRepository } from "./auth.repository.js"
import { hasPermission, type Permission } from "./auth.permissions.js"
import { issueSession, tokenHash } from "./auth.service.js"

export { issueSession }

export type AuthContext = { user: User; sessionId: string }

declare global {
  // Express augments Request through its global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export const requireAuth: RequestHandler = async (request, response, next) => {
  if (!authRepository.isDatabaseAvailable()) {
    response.status(503).json({ error: "Database unavailable" })
    return
  }
  const authorization = request.header("authorization")
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization ?? "")
  if (!match) {
    response.status(401).json({ error: "Authentication required" })
    return
  }
  try {
    const session = await authRepository.findSessionByTokenHash(
      tokenHash(match[1]),
    )
    if (
      !session ||
      session.expiresAt <= new Date() ||
      !session.user.isActive ||
      session.user.accountDeletedAt !== null
    ) {
      response.status(401).json({ error: "Invalid or expired session" })
      return
    }
    request.auth = { user: session.user, sessionId: session.id }
    next()
  } catch (error) {
    next(error)
  }
}

export function requirePermission(permission: Permission): RequestHandler {
  return (request, response, next) => {
    if (!request.auth) {
      response.status(401).json({ error: "Authentication required" })
    } else if (!hasPermission(request.auth.user.role, permission)) {
      response.status(403).json({ error: "Insufficient permissions" })
    } else {
      next()
    }
  }
}

export function requireRole(role: Role): RequestHandler {
  return (request, response, next) => {
    if (!request.auth) {
      response.status(401).json({ error: "Authentication required" })
    } else if (request.auth.user.role !== role) {
      response.status(403).json({ error: "Insufficient permissions" })
    } else {
      next()
    }
  }
}
