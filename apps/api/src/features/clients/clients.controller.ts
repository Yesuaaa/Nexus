import { Router } from "express"
import {
  requireAuth,
  requirePermission,
  requireRole,
} from "../auth/auth.middleware.js"
import { Role } from "../../generated/prisma/client.js"
import { Permission } from "../auth/auth.permissions.js"
import { clientsRepository } from "./clients.repository.js"
import { parseClientFilters, parseClientInput } from "./clients.schema.js"
import { passwordIssue } from "../../shared/password-policy.js"
import { parsePage } from "../../shared/query/pagination.js"
import { isRecordId } from "../../shared/validation.js"
import { mapPrismaErrors } from "../../shared/http-error.js"

export const clientsRouter = Router()
clientsRouter.use(requireAuth, requirePermission(Permission.CLIENTS_READ))

for (const method of ["post", "patch"] as const) {
  clientsRouter[method](
    method === "post" ? "/" : "/:id",
    requireRole(method === "post" ? Role.ADMIN : Role.SUPERADMIN),
    async (request, response) => {
      const creating = method === "post"
      if (!creating && !isRecordId(String(request.params.id)))
        return response.status(400).json({ error: "Invalid client id" })
      const input = parseClientInput(request.body, creating)
      if (!input)
        return response.status(400).json({
          error:
            (creating && passwordIssue(request.body?.password)) ||
            "Provide a valid name, email, contact number, and account status.",
        })
      const client = await clientsRepository.save(
        input,
        creating ? null : String(request.params.id),
      )
      if (!client)
        return response.status(404).json({ error: "Client not found" })
      return response.status(creating ? 201 : 200).json({ client })
    },
  )
}

clientsRouter.delete(
  "/:id",
  requireRole(Role.SUPERADMIN),
  async (request, response) => {
    const id = String(request.params.id)
    if (!isRecordId(id))
      return response.status(400).json({ error: "Invalid client id" })
    const result = await clientsRepository.delete(id)
    if (result === "missing")
      return response.status(404).json({ error: "Client not found" })
    if (result === "linked")
      return response.status(409).json({
        error:
          "This client has service requests or projects and cannot be deleted. Set the account to inactive to preserve its history.",
      })
    return response.status(204).send()
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
  if (!isRecordId(id))
    return response.status(400).json({ error: "Invalid client id" })
  const result = await clientsRepository.detail(id)
  if (!result) return response.status(404).json({ error: "Client not found" })
  return response.json(result)
})
clientsRouter.get("/:id/service-requests", async (request, response) => {
  const id = String(request.params.id)
  const page = parsePage(request.query.page)
  if (!isRecordId(id) || page === null)
    return response.status(400).json({ error: "Invalid client id or page" })
  const result = await clientsRepository.serviceRequests(id, page)
  if (!result) return response.status(404).json({ error: "Client not found" })
  return response.json(result)
})
clientsRouter.get("/:id/projects", async (request, response) => {
  const id = String(request.params.id)
  const page = parsePage(request.query.page)
  if (!isRecordId(id) || page === null)
    return response.status(400).json({ error: "Invalid client id or page" })
  const result = await clientsRepository.projects(id, page)
  if (!result) return response.status(404).json({ error: "Client not found" })
  return response.json(result)
})

// Client writes are Serializable; give their conflicts client-specific wording.
clientsRouter.use(
  mapPrismaErrors({
    P2002: {
      status: 409,
      message: "An account with this email already exists.",
    },
    P2034: {
      status: 409,
      message: "The client changed during this request. Please try again.",
    },
  }),
)
