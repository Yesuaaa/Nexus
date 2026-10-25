import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { publicUser } from "../users/public-user.js"
import { clearFailures, loginAllowed, recordFailure } from "./login-limiter.js"
import { hashPassword, validPassword, verifyPassword } from "./password.js"
import { Permission } from "./permissions.js"
import { issueSession, requireAuth, requirePermission } from "./session.js"
import { normalizedEmail, validRegistrationProfile } from "./validation.js"

export const authRouter = Router()

authRouter.post("/register", async (request, response) => {
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
  if (!validRegistrationProfile(fullName, contactNumber)) {
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
        fullName: fullName.trim(),
        contactNumber: (contactNumber as string).trim(),
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

authRouter.post("/login", async (request, response) => {
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
  clearFailures(attemptKey)
  return response.json(await issueSession(user))
})

authRouter.get(
  "/me",
  requireAuth,
  requirePermission(Permission.PROFILE_READ),
  (request, response) => {
    response.json({ user: publicUser(request.auth!.user) })
  },
)

authRouter.post("/logout", requireAuth, async (request, response) => {
  await getPrisma()!.session.delete({ where: { id: request.auth!.sessionId } })
  response.status(204).send()
})

authRouter.post(
  "/change-password",
  requireAuth,
  requirePermission(Permission.PROFILE_CHANGE_PASSWORD),
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
