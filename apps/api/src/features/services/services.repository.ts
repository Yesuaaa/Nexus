import { getPrisma } from "../../lib/db.js"
import type { ServiceInput } from "./services.schema.js"

export const departmentSelect = { id: true, name: true, code: true } as const
export const departmentsInclude = {
  departments: {
    orderBy: { name: "asc" as const },
    select: departmentSelect,
  },
} as const

export const servicesRepository = {
  async findAvailable() {
    return getPrisma()!.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: departmentsInclude,
    })
  },

  async findAll() {
    return getPrisma()!.service.findMany({
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      include: departmentsInclude,
    })
  },

  async findById(id: string) {
    return getPrisma()!.service.findUnique({
      where: { id },
      include: departmentsInclude,
    })
  },

  async findHeaderById(id: string) {
    return getPrisma()!.service.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    })
  },

  async findDepartmentsByIds(ids: string[]) {
    return getPrisma()!.department.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })
  },

  async create(data: ServiceInput) {
    const { departmentIds, ...serviceInput } = data
    return getPrisma()!.service.create({
      data: {
        ...serviceInput,
        departments: {
          connect: departmentIds.map((id) => ({ id })),
        },
      },
      include: departmentsInclude,
    })
  },

  async update(id: string, data: ServiceInput) {
    const { departmentIds, ...serviceInput } = data
    return getPrisma()!.service.update({
      where: { id },
      data: {
        ...serviceInput,
        departments: {
          set: departmentIds.map((departmentId) => ({ id: departmentId })),
        },
      },
      include: departmentsInclude,
    })
  },

  async updateStatus(id: string, isActive: boolean) {
    return getPrisma()!.service.update({
      where: { id },
      data: { isActive },
      include: departmentsInclude,
    })
  },

  async deleteInactive(id: string) {
    return getPrisma()!.service.deleteMany({
      where: { id, isActive: false },
    })
  },
}
