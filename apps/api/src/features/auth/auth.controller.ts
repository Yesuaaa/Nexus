import { Router } from "express"
import { publicUser } from "../users/users.dto.js"
import { requireAuth, requirePermission } from "./auth.middleware.js"
import { Permission } from "./auth.permissions.js"
import { AuthError, authService } from "./auth.service.js"
import { authRateLimit } from "./auth.limiter.js"
import { uploadProfileImage } from "./profile-images.service.js"
import {
  getProfile,
  updateProfile,
  updateSpecialistProfile,
} from "./profile.service.js"

import { settingsRouter } from "./settings.controller.js"

export const authRouter = Router()
authRouter.use(settingsRouter)

authRouter.post(
  "/profile/images",
  requireAuth,
  async (request, response, next) => {
    try {
      response
        .status(201)
        .json(await uploadProfileImage(request.auth!.user.id, request.body))
    } catch (error) {
      if (error instanceof AuthError)
        return response.status(error.status).json({ error: error.message })
      next(error)
    }
  },
)

authRouter.get(
  "/profile",
  requireAuth,
  requirePermission(Permission.PROFILE_READ),
  async (request, response, next) => {
    try {
      response.json(await getProfile(request.auth!.user.id))
    } catch (error) {
      if (error instanceof AuthError)
        return response.status(error.status).json({ error: error.message })
      next(error)
    }
  },
)
authRouter.patch(
  "/profile",
  requireAuth,
  requirePermission(Permission.PROFILE_READ),
  authRateLimit({ production: 30 }),
  async (request, response, next) => {
    try {
      response.json(await updateProfile(request.auth!.user.id, request.body))
    } catch (error) {
      if (error instanceof AuthError)
        return response.status(error.status).json({ error: error.message })
      next(error)
    }
  },
)
authRouter.put(
  "/profile/specialist",
  requireAuth,
  authRateLimit({ production: 30 }),
  async (request, response, next) => {
    try {
      response.json(
        await updateSpecialistProfile(request.auth!.user.id, request.body),
      )
    } catch (error) {
      if (error instanceof AuthError)
        return response.status(error.status).json({ error: error.message })
      next(error)
    }
  },
)

authRouter.post(
  "/register",
  authRateLimit({ production: 10, development: 50 }),
  async (request, response, next) => {
    try {
      const session = await authService.register({
        ...request.body,
        ip: request.ip,
        userAgent: request.header("user-agent"),
      })
      return response.status(201).json(session)
    } catch (error) {
      if (error instanceof AuthError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

authRouter.post(
  "/login",
  authRateLimit({ production: 60, development: 300 }),
  async (request, response, next) => {
    try {
      const session = await authService.login({
        email: request.body?.email,
        password: request.body?.password,
        ip: request.ip,
        userAgent: request.header("user-agent"),
      })
      return response.json(session)
    } catch (error) {
      if (error instanceof AuthError) {
        return response.status(error.status).json({ error: error.message })
      }
      next(error)
    }
  },
)

authRouter.post(
  "/refresh",
  authRateLimit({ production: 120 }),
  async (request, response, next) => {
    try {
      return response.json(
        await authService.refresh(request.body?.refreshToken),
      )
    } catch (error) {
      if (error instanceof AuthError)
        return response.status(error.status).json({ error: error.message })
      next(error)
    }
  },
)

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
