import {
  Prisma,
  Role,
  type EmploymentType,
  type EmployeeStatus,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"

export const employeeInclude = {
  department: {
    select: { id: true, name: true, code: true, color: true },
  },
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

const directoryAccountSelect = {
  id: true,
  fullName: true,
  email: true,
  contactNumber: true,
  isActive: true,
  role: true,
  accountDeletedAt: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    include: {
      department: { select: { id: true, name: true, code: true } },
      team: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect

function directoryEmployee(
  account: Prisma.UserGetPayload<{ select: typeof directoryAccountSelect }>,
) {
  const hr = account.employee
  return {
    id: hr?.id ?? `account:${account.id}`,
    accountId: account.id,
    hasEmployeeRecord: Boolean(hr),
    employeeId: hr?.employeeId ?? "",
    fullName: account.fullName?.trim() || account.email,
    email: account.email,
    contactNumber: account.contactNumber,
    position: hr?.position ?? null,
    employmentType: hr?.employmentType ?? null,
    status: hr?.status ?? null,
    startDate: hr?.startDate ?? null,
    departmentId: hr?.departmentId ?? null,
    teamId: hr?.teamId ?? null,
    department: hr?.department ?? null,
    team: hr?.team ?? null,
    accountRole: account.role,
    accountDeletedAt: account.accountDeletedAt,
    hasAccount: !account.accountDeletedAt,
    accountIsActive: account.isActive,
    createdAt: hr?.createdAt ?? account.createdAt,
    updatedAt: hr?.updatedAt ?? account.updatedAt,
  }
}

export async function directoryLogin(tx: Prisma.TransactionClient, id: string) {
  const user = await tx.user.findFirst({
    where: id.startsWith("account:")
      ? { id: id.slice(8) }
      : { employee: { is: { id } } },
    select: { id: true, role: true, isActive: true, accountDeletedAt: true },
  })
  return user ? { user } : null
}

export const employeesRepository = {
  getPrisma() {
    return getPrisma()!
  },
  async listAccounts(filters: {
    search: string
    departmentId: string
    employmentType: string
    status: string
    page: number
    archived?: boolean
  }) {
    const hr: Prisma.EmployeeWhereInput = {
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.employmentType
        ? { employmentType: filters.employmentType as EmploymentType }
        : {}),
      ...(filters.status ? { status: filters.status as EmployeeStatus } : {}),
    }
    const where: Prisma.UserWhereInput = {
      role: { in: [Role.ADMIN, Role.STAFF] },
      accountDeletedAt: filters.archived ? { not: null } : null,
      ...(Object.keys(hr).length ? { employee: { is: hr } } : {}),
      ...(filters.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
              {
                contactNumber: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                employee: {
                  is: {
                    employeeId: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    }
    const prisma = getPrisma()!
    const [accounts, total] = await prisma.$transaction(
      [
        prisma.user.findMany({
          where,
          select: directoryAccountSelect,
          orderBy: [{ fullName: "asc" }, { email: "asc" }, { id: "asc" }],
          skip: (filters.page - 1) * 10,
          take: 10,
        }),
        prisma.user.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    )
    return {
      employees: accounts.map(directoryEmployee),
      total,
      page: filters.page,
      pageSize: 10,
    }
  },
  async findById(id: string) {
    const account = await getPrisma()!.user.findFirst({
      where: {
        ...(id.startsWith("account:")
          ? { id: id.slice(8) }
          : { employee: { is: { id } } }),
        role: { in: [Role.ADMIN, Role.STAFF] },
        accountDeletedAt: null,
      },
      select: directoryAccountSelect,
    })
    return account ? directoryEmployee(account) : null
  },
}
