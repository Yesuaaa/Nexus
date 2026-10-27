import { Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { clientsRepository } from "./clients.repository.js"
import { parseClientFilters } from "./clients.schema.js"
import { parsePage } from "../../shared/query-helpers.js"

export const clientsRouter = Router()
clientsRouter.use(requireAuth, requirePermission(Permission.CLIENTS_READ))
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
