import type { RequestHandler } from "express"
import { Role, type User } from "../../generated/prisma/client.js"
import { authRepository } from "./auth.repository.js"
import { hasPermission, type Permission } from "./auth.permissions.js"
import { issueSession } from "./auth.service.js"
import { verifyAccessToken } from "./auth.jwt.js"
import { errors } from "jose"

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
  const match =
    /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
      authorization ?? "",
    )
  if (!match || match[1].length > 4096) {
    response.status(401).json({ error: "Authentication required" })
    return
  }
  try {
    const claims = await verifyAccessToken(match[1])
    const session = await authRepository.findSessionById(claims.sessionId)
    if (
      !session ||
      session.userId !== claims.userId ||
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
    if (error instanceof errors.JOSEError) {
      response.status(401).json({
        error: "Invalid or expired session",
        code:
          error instanceof errors.JWTExpired
            ? "ACCESS_TOKEN_EXPIRED"
            : "INVALID_ACCESS_TOKEN",
      })
      return
    }
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
