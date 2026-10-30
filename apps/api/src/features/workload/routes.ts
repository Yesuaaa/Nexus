import { Router, type Request, type Response } from "express"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { workloadError, workloadService } from "./service.js"
import { id, reportingRange } from "./validation.js"

export const workloadRouter = Router()
workloadRouter.use(requireAuth, requirePermission(Permission.WORKLOAD_READ))
workloadRouter.use((request, response, next) => {
  if (request.method === "GET") return next()
  return requirePermission(Permission.WORKLOAD_MANAGE)(request, response, next)
})
function handler(
  action: (request: Request, response: Response) => Promise<unknown>,
) {
  return async (request: Request, response: Response) => {
    try {
      return await action(request, response)
    } catch (error) {
      const failure = workloadError(error)
      if (failure)
        return response.status(failure.status).json({ error: failure.error })
      throw error
    }
  }
}
workloadRouter.get(
  "/",
  handler(async (req, res) =>
    res.json(
      await workloadService.overview(
        req.auth!.user.id,
        reportingRange(req.query),
      ),
    ),
  ),
)
workloadRouter.get(
  "/options",
  handler(async (req, res) =>
    res.json(await workloadService.options(req.auth!.user.id)),
  ),
)
workloadRouter.put(
  "/projects/:id/responsibility",
  handler(async (req, res) =>
    res.json(
      await workloadService.configureProject(
        req.auth!.user.id,
        id(req.params.id),
      ),
    ),
  ),
)
workloadRouter.post(
  "/projects/:id/tasks",
  handler(async (req, res) =>
    res
      .status(201)
      .json(
        await workloadService.createTask(
          req.auth!.user.id,
          id(req.params.id),
          req.body,
        ),
      ),
  ),
)
workloadRouter.get(
  "/employees/:id",
  handler(async (req, res) =>
    res.json(
      await workloadService.detail(
        req.auth!.user.id,
        id(req.params.id),
        reportingRange(req.query),
      ),
    ),
  ),
)
workloadRouter.put(
  "/employees/:id/configuration",
  handler(async (req, res) =>
    res.json(
      await workloadService.configure(
        req.auth!.user.id,
        id(req.params.id),
        req.body,
      ),
    ),
  ),
)
workloadRouter.post(
  "/employees/:id/commitments",
  handler(async (req, res) =>
    res
      .status(201)
      .json(
        await workloadService.addCommitment(
          req.auth!.user.id,
          id(req.params.id),
          req.body,
        ),
      ),
  ),
)
workloadRouter.delete(
  "/employees/:id/commitments/:commitmentId",
  handler(async (req, res) =>
    res.json(
      await workloadService.removeCommitment(
        req.auth!.user.id,
        id(req.params.id),
        id(req.params.commitmentId),
      ),
    ),
  ),
)
workloadRouter.post(
  "/assignments",
  handler(async (req, res) =>
    res
      .status(201)
      .json(await workloadService.assign(req.auth!.user.id, req.body)),
  ),
)
workloadRouter.patch(
  "/assignments/:id",
  handler(async (req, res) =>
    res.json(
      await workloadService.transition(
        req.auth!.user.id,
        id(req.params.id),
        req.body,
      ),
    ),
  ),
)
workloadRouter.post(
  "/staffing-requests",
  handler(async (req, res) =>
    res
      .status(201)
      .json(await workloadService.requestStaffing(req.auth!.user.id, req.body)),
  ),
)
workloadRouter.patch(
  "/staffing-requests/:id",
  handler(async (req, res) =>
    res.json(
      await workloadService.decideStaffing(
        req.auth!.user.id,
        id(req.params.id),
        req.body,
      ),
    ),
  ),
)
