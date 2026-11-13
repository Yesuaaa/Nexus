import { Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { departmentsService } from "./departments.service.js"
import { teamsService } from "./teams.service.js"

// Service errors are HttpErrors; Express 5 forwards them to `handleError`.
export const departmentsRouter = Router()
departmentsRouter.use(requireAuth)

// GET /api/departments - List departments with head and related record counts
departmentsRouter.get(
  "/",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (_request, response) => {
    response.json(await departmentsService.listDepartments())
  },
)

// GET /api/departments/eligible-heads - List staff users who can be assigned as department head
departmentsRouter.get(
  "/eligible-heads",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response.json(await departmentsService.listEligibleHeads(request.query))
  },
)

// GET /api/departments/employee-options - Search employee records for department assignment
departmentsRouter.get(
  "/employee-options",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (request, response) => {
    response.json(await departmentsService.getEmployeeOptions(request.query))
  },
)

// GET /api/departments/:id - Get department details with list of members and teams
departmentsRouter.get(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (request, response) => {
    response.json(
      await departmentsService.getDepartmentById(String(request.params.id)),
    )
  },
)

// POST /api/departments - Create a new department
departmentsRouter.post(
  "/",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response
      .status(201)
      .json(await departmentsService.createDepartment(request.body))
  },
)

// PUT /api/departments/:id - Update department details or head
departmentsRouter.put(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response.json(
      await departmentsService.updateDepartment(
        String(request.params.id),
        request.body,
      ),
    )
  },
)

// POST /api/departments/:id/members - Assign employees to this department
departmentsRouter.post(
  "/:id/members",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response.json(
      await departmentsService.assignMembers(
        String(request.params.id),
        request.body,
      ),
    )
  },
)

// DELETE /api/departments/:id/members/:memberId - Remove employee from department
departmentsRouter.delete(
  "/:id/members/:memberId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response.json(
      await departmentsService.removeMember(
        String(request.params.id),
        String(request.params.memberId),
      ),
    )
  },
)

// DELETE /api/departments/:id - Delete department
departmentsRouter.delete(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_DELETE),
  async (request, response) => {
    response.json(
      await departmentsService.deleteDepartment(String(request.params.id)),
    )
  },
)

// POST /api/departments/:id/teams - Create a team in department
departmentsRouter.post(
  "/:id/teams",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response
      .status(201)
      .json(
        await teamsService.createTeam(String(request.params.id), request.body),
      )
  },
)

// PUT /api/departments/:id/teams/:teamId - Update a team
departmentsRouter.put(
  "/:id/teams/:teamId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response.json(
      await teamsService.updateTeam(
        String(request.params.id),
        String(request.params.teamId),
        request.body,
      ),
    )
  },
)

// DELETE /api/departments/:id/teams/:teamId - Delete a team
departmentsRouter.delete(
  "/:id/teams/:teamId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response.json(
      await teamsService.deleteTeam(
        String(request.params.id),
        String(request.params.teamId),
      ),
    )
  },
)

// PATCH /api/departments/:id/members/:memberId - Update member position and team
departmentsRouter.patch(
  "/:id/members/:memberId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    response.json(
      await departmentsService.updateMember(
        String(request.params.id),
        String(request.params.memberId),
        request.body ?? {},
      ),
    )
  },
)
