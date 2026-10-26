import { createHash, randomBytes } from "node:crypto"
import type { RequestHandler } from "express"
import type { Prisma, User } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { publicUser } from "../users/public-user.js"
import { hasPermission, type Permission } from "./permissions.js"

const sessionDays = 7

type AuthContext = { user: User; sessionId: string }

declare global {
  // Express augments Request through its global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function issueSession(
  user: User,
  prisma: Prisma.TransactionClient = getPrisma()!,
) {
  const token = randomBytes(32).toString("base64url")
  await prisma.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000),
    },
  })
  return {
    token,
    user: publicUser(user),
    expiresIn: sessionDays * 24 * 60 * 60,
  }
}

export const requireAuth: RequestHandler = async (request, response, next) => {
  const prisma = getPrisma()
  if (!prisma) {
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
    const session = await prisma.session.findUnique({
      where: { tokenHash: tokenHash(match[1]) },
      include: { user: true },
    })
    if (!session || session.expiresAt <= new Date()) {
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
