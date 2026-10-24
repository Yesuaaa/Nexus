import { createHash, randomBytes } from "node:crypto"
import { Router, type RequestHandler } from "express"
import { Role, type User } from "./generated/prisma/client.js"
import { getPrisma } from "./db.js"
import { hashPassword, validPassword, verifyPassword } from "./password.js"
import { canAssignRole } from "./role-policy.js"

const sessionDays = 7
const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  contactNumber: user.contactNumber,
  role: user.role,
  createdAt: user.createdAt,
})

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

function normalizedEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return undefined
  return email
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

async function issueSession(user: User) {
  const prisma = getPrisma()!
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

// This limits repeated guesses in a single API process. Use a shared limiter for multiple replicas.
const loginAttempts = new Map<string, { count: number; until: number }>()
function loginAllowed(key: string): boolean {
  const attempt = loginAttempts.get(key)
  if (!attempt || attempt.until < Date.now()) {
    loginAttempts.delete(key)
    return true
  }
  return attempt.count < 10
}
function recordFailure(key: string) {
  const now = Date.now()
  const attempt = loginAttempts.get(key)
  if (loginAttempts.size >= 10000) {
    for (const [key, value] of loginAttempts) {
      if (value.until < now) loginAttempts.delete(key)
    }
    if (loginAttempts.size >= 10000) {
      const oldest = loginAttempts.keys().next().value
      if (oldest) loginAttempts.delete(oldest)
    }
  }
  loginAttempts.set(key, {
    count: attempt && attempt.until >= now ? attempt.count + 1 : 1,
    until:
      attempt && attempt.until >= now ? attempt.until : now + 15 * 60 * 1000,
  })
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

export function requireRole(...roles: Role[]): RequestHandler {
  return (request, response, next) => {
    if (!request.auth) {
      response.status(401).json({ error: "Authentication required" })
    } else if (!roles.includes(request.auth.user.role)) {
      response.status(403).json({ error: "Insufficient permissions" })
    } else {
      next()
    }
  }
}

export const authRouter = Router()
authRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store")
  next()
})

authRouter.post("/auth/register", async (request, response) => {
  const prisma = getPrisma()
  if (!prisma)
    return response.status(503).json({ error: "Database unavailable" })
  const email = normalizedEmail(request.body?.email)
  const password = request.body?.password
  const fullName = request.body?.fullName
  const contactNumber = request.body?.contactNumber
  if (!email || !validPassword(password)) {
    return response.status(400).json({
      error: "Provide a valid email and password of at least 12 characters",
    })
  }
  if (
    (fullName !== undefined &&
      (typeof fullName !== "string" ||
        fullName.trim().length < 2 ||
        fullName.trim().length > 100)) ||
    (contactNumber !== undefined &&
      (typeof contactNumber !== "string" ||
        !/^\+?[0-9][0-9\s-]{6,19}$/.test(contactNumber.trim())))
  ) {
    return response
      .status(400)
      .json({ error: "Provide a valid name and contact number" })
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return response.status(409).json({ error: "Email is already registered" })
  }
  try {
    const user = await prisma.user.create({
      data: {
        email,
        fullName: typeof fullName === "string" ? fullName.trim() : null,
        contactNumber:
          typeof contactNumber === "string" ? contactNumber.trim() : null,
        passwordHash: await hashPassword(password),
        role: Role.USER,
      },
    })
    return response.status(201).json(await issueSession(user))
  } catch (error) {
    // A concurrent registration can win after the duplicate check.
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return response.status(409).json({ error: "Email is already registered" })
    }
    throw error
  }
})

authRouter.post("/auth/login", async (request, response) => {
  const prisma = getPrisma()
  if (!prisma)
    return response.status(503).json({ error: "Database unavailable" })
  const email = normalizedEmail(request.body?.email)
  const password = request.body?.password
  if (
    !email ||
    typeof password !== "string" ||
    Buffer.byteLength(password) > 1024
  ) {
    return response
      .status(400)
      .json({ error: "Provide a valid email and password" })
  }
  const attemptKey = `${request.ip ?? "unknown"}\0${email}`
  if (!loginAllowed(attemptKey))
    return response
      .status(429)
      .json({ error: "Too many login attempts. Try again later" })
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordFailure(attemptKey)
    return response.status(401).json({ error: "Invalid email or password" })
  }
  loginAttempts.delete(attemptKey)
  return response.json(await issueSession(user))
})

authRouter.get("/auth/me", requireAuth, (request, response) => {
  response.json({ user: publicUser(request.auth!.user) })
})

authRouter.post("/auth/logout", requireAuth, async (request, response) => {
  await getPrisma()!.session.delete({ where: { id: request.auth!.sessionId } })
  response.status(204).send()
})

authRouter.post(
  "/auth/change-password",
  requireAuth,
  async (request, response) => {
    const currentPassword = request.body?.currentPassword
    const newPassword = request.body?.newPassword
    if (
      typeof currentPassword !== "string" ||
      Buffer.byteLength(currentPassword) > 1024 ||
      !validPassword(newPassword)
    ) {
      return response.status(400).json({
        error:
          "Provide the current password and a new password of at least 12 characters",
      })
    }
    if (
      !(await verifyPassword(currentPassword, request.auth!.user.passwordHash))
    ) {
      return response
        .status(401)
        .json({ error: "Current password is incorrect" })
    }
    const prisma = getPrisma()!
    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.auth!.user.id },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      prisma.session.deleteMany({ where: { userId: request.auth!.user.id } }),
    ])
    return response.status(204).send()
  },
)

authRouter.get(
  "/users",
  requireAuth,
  requireRole(Role.ADMIN, Role.SUPERADMIN),
  async (_request, response) => {
    const users = await getPrisma()!.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    response.json({ users: users.map(publicUser) })
  },
)

authRouter.patch(
  "/users/:id/role",
  requireAuth,
  requireRole(Role.ADMIN, Role.SUPERADMIN),
  async (request, response) => {
    const actor = request.auth!.user
    const role = request.body?.role
    if (
      typeof role !== "string" ||
      !Object.values(Role).includes(role as Role)
    ) {
      return response.status(400).json({ error: "Invalid role" })
    }
    if (actor.id === request.params.id) {
      return response
        .status(403)
        .json({ error: "You cannot change your own role" })
    }
    const prisma = getPrisma()!
    const target = await prisma.user.findUnique({
      where: { id: String(request.params.id) },
    })
    if (!target) return response.status(404).json({ error: "User not found" })
    if (!canAssignRole(actor.role, target.role, role as Role)) {
      return response
        .status(403)
        .json({ error: "Admins can only manage Staff and User roles" })
    }
    if (actor.role === Role.ADMIN) {
      const result = await prisma.user.updateMany({
        where: { id: target.id, role: { in: [Role.STAFF, Role.USER] } },
        data: { role: role as Role },
      })
      if (result.count === 0)
        return response
          .status(409)
          .json({ error: "Role changed; refresh and retry" })
    } else {
      await prisma.user.update({
        where: { id: target.id },
        data: { role: role as Role },
      })
    }
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    })
    return response.json({ user: publicUser(updated) })
  },
)
