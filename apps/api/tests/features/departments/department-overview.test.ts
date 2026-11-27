import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "PG-022-F011-A004-T007 privileged department overview projection",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const head = await prisma.user.create({
      data: {
        email: "head@pg022.test",
        fullName: "Synthetic Head",
        role: "STAFF",
        passwordHash: "fixture",
      },
    })
    const department = await prisma.department.create({
      data: { name: "Aster", headId: head.id },
    })
    await prisma.employee.create({
      data: {
        employeeId: "PG022",
        fullName: "Synthetic Employee",
        departmentId: department.id,
      },
    })
    await prisma.team.create({
      data: { name: "Synthetic Team", departmentId: department.id },
    })
    await prisma.service.create({
      data: {
        name: "Synthetic Service",
        description: "Fixture",
        departments: { connect: { id: department.id } },
      },
    })
    const actors = await Promise.all(
      (["ADMIN", "SUPERADMIN"] as const).map(async (role) => {
        const actor = await prisma.user.create({
          data: { email: `${role}@pg022.test`, role, passwordHash: "fixture" },
        })
        return issueSession(actor)
      }),
    )
    const snapshot = () =>
      Promise.all([
        prisma.department.findMany({ orderBy: { id: "asc" } }),
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.employee.findMany({ orderBy: { id: "asc" } }),
        prisma.team.findMany({ orderBy: { id: "asc" } }),
        prisma.service.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceManagementChange.findMany({ orderBy: { id: "asc" } }),
      ])
    const before = await snapshot()
    for (const { token } of actors) {
      const response = await fetch(`${base}/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        departments: [
          {
            id: department.id,
            name: department.name,
            color: department.color,
            code: department.code,
            description: department.description,
            headId: head.id,
            head: {
              id: head.id,
              email: head.email,
              fullName: head.fullName,
              role: head.role,
            },
            memberCount: 1,
            teamCount: 1,
            serviceCount: 1,
            createdAt: department.createdAt.toISOString(),
            updatedAt: department.updatedAt.toISOString(),
          },
        ],
      })
    }
    assert.deepEqual(await snapshot(), before)
  },
)
