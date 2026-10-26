import { Router } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import {
  DepartmentError,
  departmentsService,
} from "./departments.service.js"
import { TeamError, teamsService } from "./teams.service.js"

export const departmentsRouter = Router()
departmentsRouter.use(requireAuth)

// GET /api/departments - List departments with head and related record counts
departmentsRouter.get(
  "/",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (_request, response, next) => {
    try {
      const result = await departmentsService.listDepartments()
      response.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// GET /api/departments/eligible-heads - List staff users who can be assigned as department head
departmentsRouter.get(
  "/eligible-heads",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (_request, response, next) => {
    try {
      const result = await departmentsService.listEligibleHeads()
      response.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// GET /api/departments/employee-options - Search employee records for department assignment
departmentsRouter.get(
  "/employee-options",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (request, response, next) => {
    try {
      const result = await departmentsService.getEmployeeOptions(request.query)
      response.json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// GET /api/departments/:id - Get department details with list of members and teams
departmentsRouter.get(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (request, response, next) => {
    try {
      const result = await departmentsService.getDepartmentById(
        String(request.params.id),
      )
      response.json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// POST /api/departments - Create a new department
departmentsRouter.post(
  "/",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await departmentsService.createDepartment(request.body)
      return response.status(201).json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// PUT /api/departments/:id - Update department details or head
departmentsRouter.put(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await departmentsService.updateDepartment(
        String(request.params.id),
        request.body,
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// POST /api/departments/:id/members - Assign employees to this department
departmentsRouter.post(
  "/:id/members",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await departmentsService.assignMembers(
        String(request.params.id),
        request.body,
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// DELETE /api/departments/:id/members/:memberId - Remove employee from department
departmentsRouter.delete(
  "/:id/members/:memberId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await departmentsService.removeMember(
        String(request.params.id),
        String(request.params.memberId),
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// DELETE /api/departments/:id - Delete department
departmentsRouter.delete(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_DELETE),
  async (request, response, next) => {
    try {
      const result = await departmentsService.deleteDepartment(
        String(request.params.id),
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// POST /api/departments/:id/teams - Create a team in department
departmentsRouter.post(
  "/:id/teams",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await teamsService.createTeam(
        String(request.params.id),
        request.body,
      )
      return response.status(201).json(result)
    } catch (error) {
      if (error instanceof TeamError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// PUT /api/departments/:id/teams/:teamId - Update a team
departmentsRouter.put(
  "/:id/teams/:teamId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await teamsService.updateTeam(
        String(request.params.id),
        String(request.params.teamId),
        request.body,
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof TeamError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// DELETE /api/departments/:id/teams/:teamId - Delete a team
departmentsRouter.delete(
  "/:id/teams/:teamId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await teamsService.deleteTeam(
        String(request.params.id),
        String(request.params.teamId),
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof TeamError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

// PATCH /api/departments/:id/members/:memberId - Update member position and team
departmentsRouter.patch(
  "/:id/members/:memberId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response, next) => {
    try {
      const result = await departmentsService.updateMember(
        String(request.params.id),
        String(request.params.memberId),
        request.body ?? {},
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof DepartmentError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)
