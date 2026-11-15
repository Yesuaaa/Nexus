import { Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { getProjectManagementOverview } from "./project-management-overview.service.js"

export const projectManagementRouter = Router()
projectManagementRouter.use(requireAuth)

projectManagementRouter.get(
  "/overview",
  requirePermission(Permission.MODULES_ACCESS_ALL),
  requirePermission(Permission.ORGANIZATION_READ_ALL),
  async (_request, response) => {
    response.json(await getProjectManagementOverview())
  },
)
