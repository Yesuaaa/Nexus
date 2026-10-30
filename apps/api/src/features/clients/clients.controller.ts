import { Router } from "express"
import {
  requireAuth,
  requirePermission,
  requireRole,
} from "../auth/auth.middleware.js"
import { Role, Prisma } from "../../generated/prisma/client.js"
import { Permission } from "../auth/auth.permissions.js"
import { clientsRepository } from "./clients.repository.js"
import { parseClientFilters, parseClientInput } from "./clients.schema.js"
import { parsePage } from "../../shared/query-helpers.js"

export const clientsRouter = Router()
clientsRouter.use(requireAuth, requirePermission(Permission.CLIENTS_READ))

for (const method of ["post", "patch"] as const) {
  clientsRouter[method](
    method === "post" ? "/" : "/:id",
    requireRole(Role.ADMIN),
    async (request, response) => {
      const creating = method === "post"
      if (!creating && !/^[A-Za-z0-9_-]{1,80}$/.test(String(request.params.id)))
        return response.status(400).json({ error: "Invalid client id" })
      const input = parseClientInput(request.body, creating)
      if (!input)
        return response.status(400).json({
          error:
            "Provide a valid name, email, contact number, account status, and a password of at least 12 characters when creating a client.",
        })
      try {
        const client = await clientsRepository.save(
          input,
          creating ? null : String(request.params.id),
        )
        if (!client)
          return response.status(404).json({ error: "Client not found" })
        return response.status(creating ? 201 : 200).json({ client })
      } catch (error) {
        if (
          (error instanceof Error && error.message === "DUPLICATE_EMAIL") ||
          (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002")
        )
          return response
            .status(409)
            .json({ error: "An account with this email already exists." })
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034"
        )
          return response.status(409).json({
            error: "The client changed during this request. Please try again.",
          })
        throw error
      }
    },
  )
}

clientsRouter.delete(
  "/:id",
  requireRole(Role.ADMIN),
  async (request, response) => {
    const id = String(request.params.id)
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
      return response.status(400).json({ error: "Invalid client id" })
    try {
      const result = await clientsRepository.delete(id)
      if (result === "missing")
        return response.status(404).json({ error: "Client not found" })
      if (result === "linked")
        return response.status(409).json({
          error:
            "This client has service requests or projects and cannot be deleted. Set the account to inactive to preserve its history.",
        })
      return response.status(204).send()
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      )
        return response.status(409).json({
          error: "The client changed during this request. Please try again.",
        })
      throw error
    }
  },
)
clientsRouter.get("/", async (request, response) => {
  const filters = parseClientFilters(request.query)
  if (!filters)
    return response.status(400).json({ error: "Invalid client filters" })
  return response.json(await clientsRepository.list(filters))
})
clientsRouter.get("/:id", async (request, response) => {
  const id = String(request.params.id)
  if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id))
    return response.status(400).json({ error: "Invalid client id" })
  const result = await clientsRepository.detail(id)
  if (!result) return response.status(404).json({ error: "Client not found" })
  return response.json(result)
})
clientsRouter.get("/:id/service-requests", async (request, response) => {
  const id = String(request.params.id)
  const page = parsePage(request.query.page)
  if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || page === null)
    return response.status(400).json({ error: "Invalid client id or page" })
  const result = await clientsRepository.serviceRequests(id, page)
  if (!result) return response.status(404).json({ error: "Client not found" })
  return response.json(result)
})
clientsRouter.get("/:id/projects", async (request, response) => {
  const id = String(request.params.id)
  const page = parsePage(request.query.page)
  if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || page === null)
    return response.status(400).json({ error: "Invalid client id or page" })
  const result = await clientsRepository.projects(id, page)
  if (!result) return response.status(404).json({ error: "Client not found" })
  return response.json(result)
})
