import { Router } from "express"
import { getPrisma } from "../../lib/db.js"
import { Permission } from "../auth/permissions.js"
import { requireAuth, requirePermission } from "../auth/session.js"
import { validateServiceInput } from "./validation.js"

export const servicesRouter = Router()
servicesRouter.use(requireAuth)

const departmentSelect = { id: true, name: true, code: true } as const
const departmentsInclude = {
  departments: {
    orderBy: { name: "asc" as const },
    select: departmentSelect,
  },
} as const

// Active services are the only options exposed to new client-request forms.
// Historical records can continue to reference a service after it is deactivated.
servicesRouter.get("/available", async (_request, response) => {
  const services = await getPrisma()!.service.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: departmentsInclude,
  })
  response.json({ services })
})

servicesRouter.get(
  "/",
  requirePermission(Permission.SERVICES_READ),
  async (_request, response) => {
    const services = await getPrisma()!.service.findMany({
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      include: departmentsInclude,
    })
    response.json({ services })
  },
)

servicesRouter.get(
  "/:id",
  requirePermission(Permission.SERVICES_READ),
  async (request, response) => {
    const service = await getPrisma()!.service.findUnique({
      where: { id: String(request.params.id) },
      include: departmentsInclude,
    })
    if (!service)
      return response.status(404).json({ error: "Service not found" })
    response.json({ service })
  },
)

servicesRouter.post(
  "/",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const parsed = validateServiceInput(request.body)
    if (!parsed.value) return response.status(400).json({ error: parsed.error })

    const prisma = getPrisma()!
    const departments = await prisma.department.findMany({
      where: { id: { in: parsed.value.departmentIds } },
      select: { id: true },
    })
    if (departments.length !== parsed.value.departmentIds.length) {
      return response
        .status(400)
        .json({ error: "One or more selected departments do not exist" })
    }

    try {
      const { departmentIds, ...serviceInput } = parsed.value
      const service = await prisma.service.create({
        data: {
          ...serviceInput,
          departments: {
            connect: departmentIds.map((id) => ({ id })),
          },
        },
        include: departmentsInclude,
      })
      return response.status(201).json({ service })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return response
          .status(409)
          .json({ error: "A service with this name already exists" })
      }
      throw error
    }
  },
)

servicesRouter.put(
  "/:id",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const id = String(request.params.id)
    const parsed = validateServiceInput(request.body)
    if (!parsed.value) return response.status(400).json({ error: parsed.error })

    const prisma = getPrisma()!
    const [existing, departments] = await Promise.all([
      prisma.service.findUnique({ where: { id }, select: { id: true } }),
      prisma.department.findMany({
        where: { id: { in: parsed.value.departmentIds } },
        select: { id: true },
      }),
    ])
    if (!existing)
      return response.status(404).json({ error: "Service not found" })
    if (departments.length !== parsed.value.departmentIds.length) {
      return response
        .status(400)
        .json({ error: "One or more selected departments do not exist" })
    }

    try {
      const { departmentIds, ...serviceInput } = parsed.value
      const service = await prisma.service.update({
        where: { id },
        data: {
          ...serviceInput,
          departments: {
            set: departmentIds.map((departmentId) => ({ id: departmentId })),
          },
        },
        include: departmentsInclude,
      })
      return response.json({ service })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return response
          .status(409)
          .json({ error: "A service with this name already exists" })
      }
      throw error
    }
  },
)

servicesRouter.patch(
  "/:id/status",
  requirePermission(Permission.SERVICES_MANAGE),
  async (request, response) => {
    const id = String(request.params.id)
    if (typeof request.body?.isActive !== "boolean") {
      return response.status(400).json({ error: "isActive must be a boolean" })
    }

    const prisma = getPrisma()!
    const existing = await prisma.service.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing)
      return response.status(404).json({ error: "Service not found" })

    const service = await prisma.service.update({
      where: { id },
      data: { isActive: request.body.isActive },
      include: departmentsInclude,
    })
    return response.json({ service })
  },
)

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002",
  )
}
