import { issueSession } from "../../src/features/auth/auth.service.js"
import type { PrismaClient, Role } from "../../src/generated/prisma/client.js"

export const clientInput = {
  fullName: "Synthetic Client",
  email: "created@pg019.test",
  contactNumber: "09123456789",
  isActive: true,
  password: "SyntheticClient123!",
}
export async function seedPg019(prisma: PrismaClient) {
  async function actor(label: string, role: Role) {
    const user = await prisma.user.create({
      data: {
        id: `pg019-${label}`,
        email: `${label}@pg019.test`,
        fullName: `PG019 ${label}`,
        contactNumber: "09123456789",
        role,
        passwordHash: "synthetic-only",
        createdAt: new Date("2032-03-01T00:00:00Z"),
      },
    })
    return { user, token: (await issueSession(user)).token }
  }
  const admin = await actor("admin", "ADMIN"),
    root = await actor("root", "SUPERADMIN"),
    staff = await actor("staff", "STAFF"),
    head = await actor("head", "STAFF"),
    a = await actor("a", "USER"),
    b = await actor("b", "USER")
  await prisma.department.create({
    data: { name: "PG019 department", headId: head.user.id },
  })
  const service = await prisma.service.create({
    data: { name: "PG019 service", description: "Synthetic" },
  })
  const records = []
  for (const [label, client] of [
    ["A", a],
    ["B", b],
  ] as const) {
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.user.id,
        serviceId: service.id,
        title: `Request ${label}`,
        description: "PRIVATE request body",
      },
    })
    const project = await prisma.project.create({
      data: {
        clientId: client.user.id,
        name: `Project ${label}`,
        requestId: request.id,
        startDate: new Date("2032-03-01"),
        workPlan: { private: "PRIVATE project plan" },
      },
    })
    records.push({ request, project })
  }
  return { admin, root, staff, head, a, b, records }
}
export async function clientSnapshot(prisma: PrismaClient) {
  const orderBy = { id: "asc" } as const
  return {
    users: await prisma.user.findMany({ orderBy }),
    history: await prisma.accountManagementChange.findMany({ orderBy }),
    sessions: await prisma.session.findMany({
      orderBy,
      select: { id: true, userId: true, expiresAt: true },
    }),
    refresh: await prisma.refreshToken.findMany({ orderBy }),
    requests: await prisma.serviceRequest.findMany({ orderBy }),
    projects: await prisma.project.findMany({ orderBy }),
    employees: await prisma.employee.findMany({ orderBy }),
  }
}
