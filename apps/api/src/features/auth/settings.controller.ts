import { Router } from "express"
import { getPrisma } from "../../lib/db.js"
import { requireAuth } from "./auth.middleware.js"
import { getSettings, validatePreferences } from "./settings.service.js"
export const settingsRouter = Router()
settingsRouter.get("/settings", requireAuth, async (request, response) => {
  response.json(
    await getSettings(request.auth!.user.id, request.auth!.sessionId),
  )
})
settingsRouter.patch("/settings", requireAuth, async (request, response) => {
  const preferences = validatePreferences(request.body)
  await getPrisma()!.user.update({
    where: { id: request.auth!.user.id },
    data: { settings: preferences },
  })
  response.json(preferences)
})
settingsRouter.post(
  "/sessions/revoke-all",
  requireAuth,
  async (request, response) => {
    await getPrisma()!.session.deleteMany({
      where: { userId: request.auth!.user.id },
    })
    response.status(204).send()
  },
)
settingsRouter.post(
  "/sessions/revoke-others",
  requireAuth,
  async (request, response) => {
    await getPrisma()!.session.deleteMany({
      where: {
        userId: request.auth!.user.id,
        id: { not: request.auth!.sessionId },
      },
    })
    response.status(204).send()
  },
)
settingsRouter.delete(
  "/sessions/:id",
  requireAuth,
  async (request, response) => {
    const result = await getPrisma()!.session.deleteMany({
      where: { userId: request.auth!.user.id, id: String(request.params.id) },
    })
    if (!result.count) {
      response.status(404).json({ error: "Session not found" })
      return
    }
    response.status(204).send()
  },
)
