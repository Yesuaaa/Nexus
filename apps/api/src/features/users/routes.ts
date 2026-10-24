import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireAuth, requireRole } from "../auth/session.js"
import { publicUser } from "./public-user.js"
import { canAssignRole } from "./role-policy.js"

export const usersRouter = Router()
usersRouter.use(requireAuth, requireRole(Role.ADMIN, Role.SUPERADMIN))

usersRouter.get("/", async (_request, response) => {
  const users = await getPrisma()!.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  response.json({ users: users.map(publicUser) })
})

usersRouter.patch("/:id/role", async (request, response) => {
  const actor = request.auth!.user
  const role = request.body?.role
  if (typeof role !== "string" || !Object.values(Role).includes(role as Role)) {
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
})
