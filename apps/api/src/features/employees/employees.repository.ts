import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"

export const employeeInclude = {
  department: { select: { id: true, name: true, code: true } },
  team: { select: { id: true, name: true } },
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      accountDeletedAt: true,
    },
  },
} satisfies Prisma.EmployeeInclude

export const employeesRepository = {
  getPrisma() {
    return getPrisma()!
  },

  async findManyWithCount(
    where: Prisma.EmployeeWhereInput,
    orderBy: Prisma.EmployeeOrderByWithRelationInput[],
    skip: number,
    take: number,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction([
      prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy,
        skip,
        take,
      }),
      prisma.employee.count({ where }),
    ])
  },

  async findById(id: string) {
    const prisma = getPrisma()!
    return prisma.employee.findUnique({
      where: { id },
      include: employeeInclude,
    })
  },
}
