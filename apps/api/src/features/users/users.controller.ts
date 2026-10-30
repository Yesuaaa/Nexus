import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import {
  requireAuth,
  requirePermission,
  requireRole,
} from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { UsersError, usersService } from "./users.service.js"

export const usersRouter = Router()
usersRouter.use(requireAuth)
usersRouter.use(requireRole(Role.SUPERADMIN))

usersRouter.post(
  "/:id/password",
  requirePermission(Permission.ACCOUNTS_RESET_PASSWORD),
  async (request, response, next) => {
    try {
      await usersService.changePassword(
        request.auth!.user,
        String(request.params.id),
        request.body?.newPassword,
      )
      return response.status(204).send()
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

usersRouter.patch(
  "/:id/status",
  requirePermission(Permission.ACCOUNTS_STATUS_BASIC),
  async (request, response, next) => {
    try {
      const result = await usersService.changeStatus(
        request.auth!.user,
        String(request.params.id),
        request.body?.isActive,
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

usersRouter.post(
  "/:id/restore",
  requirePermission(Permission.ACCOUNTS_STATUS_BASIC),
  async (request, response, next) => {
    try {
      const result = await usersService.restoreUser(
        request.auth!.user,
        String(request.params.id),
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

usersRouter.delete(
  "/:id",
  requirePermission(Permission.ACCOUNTS_STATUS_BASIC),
  async (request, response, next) => {
    try {
      const result = await usersService.softDeleteUser(
        request.auth!.user,
        String(request.params.id),
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

usersRouter.delete(
  "/:id/permanent",
  requirePermission(Permission.ACCOUNTS_STATUS_BASIC),
  async (request, response, next) => {
    try {
      const result = await usersService.permanentlyDeleteUser(
        request.auth!.user,
        String(request.params.id),
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

usersRouter.get(
  "/",
  requirePermission(Permission.ACCOUNTS_READ),
  async (request, response, next) => {
    try {
      const result = await usersService.listUsers(request.query)
      return response.json(result)
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

usersRouter.post(
  "/",
  requirePermission(Permission.ACCOUNTS_CREATE_BASIC),
  async (request, response, next) => {
    try {
      const result = await usersService.createUser(
        request.auth!.user,
        request.body ?? {},
      )
      return response.status(201).json(result)
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

usersRouter.patch(
  "/:id/role",
  requirePermission(Permission.ACCOUNTS_ASSIGN_BASIC),
  async (request, response, next) => {
    try {
      const result = await usersService.changeRole(
        request.auth!.user,
        String(request.params.id),
        request.body?.role,
      )
      return response.json(result)
    } catch (error) {
      if (error instanceof UsersError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)
