import { Router } from "express"
import { publicUser } from "../users/users.dto.js"
import { requireAuth, requirePermission } from "./auth.middleware.js"
import { Permission } from "./auth.permissions.js"
import { AuthError, authService } from "./auth.service.js"

export const authRouter = Router()

authRouter.post("/register", async (request, response, next) => {
  try {
    const session = await authService.register(request.body ?? {})
    return response.status(201).json(session)
  } catch (error) {
    if (error instanceof AuthError) {
      return response.status(error.status).json({ error: error.message })
    }
    next(error)
  }
})

authRouter.post("/login", async (request, response, next) => {
  try {
    const session = await authService.login({
      email: request.body?.email,
      password: request.body?.password,
      ip: request.ip,
    })
    return response.json(session)
  } catch (error) {
    if (error instanceof AuthError) {
      return response.status(error.status).json({ error: error.message })
    }
    next(error)
  }
})

authRouter.get(
  "/me",
  requireAuth,
  requirePermission(Permission.PROFILE_READ),
  (request, response) => {
    response.json({ user: publicUser(request.auth!.user) })
  },
)

authRouter.post("/logout", requireAuth, async (request, response, next) => {
  try {
    await authService.logout(request.auth!.sessionId)
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

authRouter.post(
  "/change-password",
  requireAuth,
  requirePermission(Permission.PROFILE_CHANGE_PASSWORD),
  async (request, response, next) => {
    try {
      await authService.changePassword({
        userId: request.auth!.user.id,
        currentPasswordHash: request.auth!.user.passwordHash,
        currentPassword: request.body?.currentPassword,
        newPassword: request.body?.newPassword,
      })
      return response.status(204).send()
    } catch (error) {
      if (error instanceof AuthError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

authRouter.post("/forgot-password", async (request, response, next) => {
  try {
    const result = await authService.forgotPassword({
      email: request.body?.email,
      clientIp: request.ip || "unknown",
    })
    return response.json(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return response.status(error.status).json({ error: error.message })
    }
    next(error)
  }
})

authRouter.post("/reset-password", async (request, response, next) => {
  try {
    await authService.resetPassword({
      token: request.body?.token,
      newPassword: request.body?.newPassword,
      clientIp: request.ip || "unknown",
    })
    return response.status(204).send()
  } catch (error) {
    if (error instanceof AuthError) {
      return response.status(error.status).json({ error: error.message })
    }
    next(error)
  }
})
