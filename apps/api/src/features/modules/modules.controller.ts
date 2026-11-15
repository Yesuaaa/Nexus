import { Router } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  getAdministrativeModule,
  listAdministrativeModules,
} from "./modules.service.js"

export const modulesRouter = Router()
modulesRouter.use(requireAuth)
modulesRouter.get("/", (request, response) => {
  response.json({ modules: listAdministrativeModules(request.auth!.user) })
})
modulesRouter.get("/:id", (request, response) => {
  response.json({
    module: getAdministrativeModule(
      request.auth!.user,
      String(request.params.id),
    ),
  })
})
