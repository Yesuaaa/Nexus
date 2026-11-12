import { Router } from "express"
import { publicUser } from "../users/users.dto.js"
import { requireAuth, requirePermission } from "./auth.middleware.js"
import { Permission } from "./auth.permissions.js"
import { authService } from "./auth.service.js"
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

authRouter.post("/profile/images", requireAuth, async (request, response) => {
  response
    .status(201)
    .json(await uploadProfileImage(request.auth!.user.id, request.body))
})

authRouter.get(
  "/profile",
  requireAuth,
  requirePermission(Permission.PROFILE_READ),
  async (request, response) => {
    response.json(await getProfile(request.auth!.user.id))
  },
)
authRouter.patch(
  "/profile",
  requireAuth,
  requirePermission(Permission.PROFILE_READ),
  authRateLimit(30),
  async (request, response) => {
    response.json(await updateProfile(request.auth!.user.id, request.body))
  },
)
authRouter.put(
  "/profile/specialist",
  requireAuth,
  authRateLimit(30),
  async (request, response) => {
    response.json(
      await updateSpecialistProfile(request.auth!.user.id, request.body),
    )
  },
)

authRouter.post("/register", authRateLimit(10), async (request, response) => {
  const session = await authService.register({
    ...request.body,
    ip: request.ip,
    userAgent: request.header("user-agent"),
  })
  return response.status(201).json(session)
})

authRouter.post("/login", authRateLimit(60), async (request, response) => {
  const session = await authService.login({
    email: request.body?.email,
    password: request.body?.password,
    ip: request.ip,
    userAgent: request.header("user-agent"),
  })
  return response.json(session)
})

authRouter.post("/refresh", authRateLimit(120), async (request, response) => {
  return response.json(await authService.refresh(request.body?.refreshToken))
})

authRouter.get(
  "/me",
  requireAuth,
  requirePermission(Permission.PROFILE_READ),
  (request, response) => {
    response.json({ user: publicUser(request.auth!.user) })
  },
)

authRouter.post("/logout", requireAuth, async (request, response) => {
  await authService.logout(request.auth!.sessionId)
  response.status(204).send()
})

authRouter.post(
  "/change-password",
  requireAuth,
  requirePermission(Permission.PROFILE_CHANGE_PASSWORD),
  async (request, response) => {
    await authService.changePassword({
      userId: request.auth!.user.id,
      currentPasswordHash: request.auth!.user.passwordHash,
      currentPassword: request.body?.currentPassword,
      newPassword: request.body?.newPassword,
    })
    return response.status(204).send()
  },
)
