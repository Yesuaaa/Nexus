import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"

type Payload = {
  employee: { id: string; hasAccount?: boolean }
  employees: { id: string }[]
  users: { email: string }[]
  total: number
  department: {
    members: { id: string }[]
    teams: { id: string; memberCount: number }[]
  }
}

test(
  "employee records and department membership stay consistent",
  { timeout: 120_000 },
  async (t) => {
    const originalUrl = process.env.DATABASE_URL
    const originalDirectUrl = process.env.DIRECT_URL
    const originalPoolMax = process.env.DATABASE_POOL_MAX
    const database = new PGlite()
    const cleanup: {
      socket?: PGLiteSocketServer
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await cleanup.socket?.stop()
      await database.close()
      if (originalUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = originalUrl
      if (originalDirectUrl === undefined) delete process.env.DIRECT_URL
      else process.env.DIRECT_URL = originalDirectUrl
      if (originalPoolMax === undefined) delete process.env.DATABASE_POOL_MAX
      else process.env.DATABASE_POOL_MAX = originalPoolMax
    })
    await database.waitReady
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    const directories = (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()
    for (const name of directories.filter(
      (name) => !name.endsWith("employee_management"),
    )) {
      await database.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }
    for (const [id, role] of [
      ["admin", "ADMIN"],
      ["superadmin", "SUPERADMIN"],
      ["staff", "STAFF"],
      ["user", "USER"],
      ["link-target", "USER"],
    ]) {
      await database.query(
        'INSERT INTO "User" (id,email,"fullName","passwordHash",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())',
        [
          id,
          `${id}@example.com`,
          `${id} Person`,
          "unchanged-password-hash",
          role,
        ],
      )
    }
    await database.exec(`INSERT INTO "Department" (id,name,"headId","updatedAt") VALUES ('product','Product','staff',NOW()),('operations','Operations',NULL,NOW());
    INSERT INTO "Team" (id,name,"departmentId","updatedAt") VALUES ('product-team','Design','product',NOW()),('operations-team','Support','operations',NOW());
    UPDATE "User" SET "departmentId"='product' WHERE id='staff';`)
    for (const name of directories.filter((name) =>
      name.endsWith("employee_management"),
    )) {
      await database.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }
    const socket = new PGLiteSocketServer({
      db: database,
      port: 0,
      host: "127.0.0.1",
    })
    cleanup.socket = socket
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const tokens = new Map<string, string>()
    for (const id of ["admin", "superadmin", "staff", "user"]) {
      const token = createHash("sha256").update(id).digest("base64url")
      tokens.set(id, token)
      await prisma.session.create({
        data: {
          userId: id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 60_000),
        },
      })
    }
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      actor = "admin",
    ) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${tokens.get(actor)}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
    }
    async function json(
      path: string,
      method = "GET",
      body?: unknown,
      status = 200,
      actor = "admin",
    ) {
      const response = await request(path, method, body, actor)
      const result = (await response.json()) as Payload
      assert.equal(response.status, status, JSON.stringify(result))
      return result
    }
    let employeeId = ""
    await t.test(
      "only Admin may use the employee API, including direct writes",
      async () => {
        for (const actor of ["superadmin", "staff", "user"]) {
          assert.equal(
            (await request("/employees", "GET", undefined, actor)).status,
            403,
          )
          assert.equal(
            (
              await request(
                "/employees",
                "POST",
                { employeeId: "DENIED", fullName: "Denied Record" },
                actor,
              )
            ).status,
            403,
          )
        }
      },
    )
    await t.test("only Superadmin may use the account API", async () => {
      for (const actor of ["admin", "staff", "user"]) {
        assert.equal(
          (await request("/users", "GET", undefined, actor)).status,
          403,
        )
        assert.equal(
          (
            await request(
              "/users",
              "POST",
              { email: "denied@example.com" },
              actor,
            )
          ).status,
          403,
        )
      }
      assert.equal(
        (await request("/users", "GET", undefined, "superadmin")).status,
        200,
      )
    })
    await t.test(
      "migration preserves existing members and creates no credentials",
      async () => {
        const staff = await prisma.employee.findUniqueOrThrow({
          where: { userId: "staff" },
        })
        assert.equal(staff.departmentId, "product")
        assert.equal(staff.fullName, "staff Person")
        const department = (await json("/departments/product")).department
        const projectedStaff = department.members.find(
          (member: { id: string }) => member.id === staff.id,
        ) as unknown as Record<string, unknown>
        assert.deepEqual(Object.keys(projectedStaff).sort(), [
          "contactNumber",
          "createdAt",
          "email",
          "fullName",
          "id",
          "position",
          "team",
          "teamId",
          "user",
          "userId",
        ])
        assert.deepEqual(Object.keys(projectedStaff.user as object).sort(), [
          "email",
          "fullName",
          "id",
          "isActive",
          "role",
        ])
        assert.equal(
          await prisma.employee.count({ where: { userId: "superadmin" } }),
          0,
        )
        assert.equal(await prisma.user.count(), 5)
      },
    )
    await t.test(
      "create an employee and Staff account together and search/filter the directory",
      async () => {
        const result = await json(
          "/employees",
          "POST",
          {
            employeeId: "EMP-9001",
            fullName: "Jordan Reyes",
            email: "jordan.hr@example.com",
            contactNumber: "09123456789",
            departmentId: "product",
            position: "Designer",
            employmentType: "CONTRACT",
            startDate: "2026-01-15T00:00:00.000Z",
            teamId: null,
            status: "ACTIVE",
            password: "ValidPassword1!",
          },
          201,
        )
        employeeId = result.employee.id
        assert.equal(await prisma.user.count(), 6)
        const account = await prisma.user.findUniqueOrThrow({
          where: { email: "jordan.hr@example.com" },
        })
        assert.equal(account.role, "STAFF")
        assert.equal(result.employee.hasAccount, true)
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: employeeId },
            })
          ).userId,
          account.id,
        )
        const accounts = await json(
          "/users?search=Jordan",
          "GET",
          undefined,
          200,
          "superadmin",
        )
        assert.equal(accounts.total, 1)
        assert.equal(accounts.users[0].email, "jordan.hr@example.com")
        const filtered = await json(
          "/employees?search=Jordan&departmentId=product&employmentType=CONTRACT&status=ACTIVE",
        )
        assert.equal(filtered.total, 1)
        assert.equal(filtered.employees[0].id, employeeId)
        assert.equal(
          (await json("/employees?status=INACTIVE&search=Jordan")).total,
          0,
        )
        assert.equal((await request("/employees?page=0")).status, 400)
        assert.equal((await request("/employees?status=UNKNOWN")).status, 400)
      },
    )
    await t.test(
      "invalid/duplicate data leaves no partial records",
      async () => {
        const before = await prisma.employee.count()
        const usersBefore = await prisma.user.count()
        await json(
          "/employees",
          "POST",
          {
            employeeId: "NO-PASSWORD",
            fullName: "No Password",
            email: "no.password@example.com",
            contactNumber: "09123456789",
            position: "Designer",
            employmentType: "FULL_TIME",
            startDate: "2026-01-15T00:00:00.000Z",
            departmentId: "product",
            teamId: null,
          },
          400,
        )
        await json(
          "/employees",
          "POST",
          {
            employeeId: "EMP-9001",
            fullName: "Duplicate Person",
            email: "duplicate@example.com",
            contactNumber: "09123456789",
            position: "Designer",
            employmentType: "FULL_TIME",
            startDate: "2026-01-15T00:00:00.000Z",
            departmentId: "product",
            teamId: null,
            password: "ValidPassword1!",
          },
          409,
        )
        await json(
          "/employees",
          "POST",
          {
            employeeId: "BAD-EMAIL",
            fullName: "Bad Email",
            email: "not-an-email",
            contactNumber: "09123456789",
            position: "Designer",
            employmentType: "FULL_TIME",
            startDate: "2026-01-15T00:00:00.000Z",
            departmentId: "product",
            teamId: null,
            password: "ValidPassword1!",
          },
          400,
        )
        assert.equal(await prisma.employee.count(), before)
        assert.equal(await prisma.user.count(), usersBefore)
        await json(
          `/employees/${employeeId}`,
          "PUT",
          { teamId: "operations-team" },
          400,
        )
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: employeeId },
            })
          ).teamId,
          null,
        )
      },
    )
    await t.test(
      "employees with accounts participate in department/team membership",
      async () => {
        await json(`/employees/${employeeId}`, "PUT", {
          teamId: "product-team",
        })
        const detail = (await json("/departments/product")).department
        assert.ok(
          detail.members.some(
            (member: { id: string }) => member.id === employeeId,
          ),
        )
        assert.equal(
          detail.teams.find(
            (team: { id: string }) => team.id === "product-team",
          )?.memberCount,
          1,
        )
        await json(`/departments/product/members/${employeeId}`, "DELETE")
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { id: employeeId },
        })
        assert.equal(employee.departmentId, null)
        assert.equal(employee.teamId, null)
        await json("/departments/product/members", "POST", {
          employeeIds: [employeeId],
        })
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: employeeId },
            })
          ).departmentId,
          "product",
        )
      },
    )
    await t.test(
      "employees work in headless departments and team membership stays consistent",
      async () => {
        const created = await json(
          "/employees",
          "POST",
          {
            employeeId: "EMP-9003",
            fullName: "Casey Morgan",
            email: "casey@example.com",
            contactNumber: "09123456789",
            position: "Support Specialist",
            employmentType: "FULL_TIME",
            startDate: "2026-01-15T00:00:00.000Z",
            departmentId: "operations",
            teamId: null,
            password: "ValidPassword1!",
          },
          201,
        )
        const headlessEmployeeId = created.employee.id

        await json(
          `/departments/operations/members/${headlessEmployeeId}`,
          "DELETE",
        )
        let employee = await prisma.employee.findUniqueOrThrow({
          where: { id: headlessEmployeeId },
        })
        assert.equal(employee.departmentId, null)
        assert.equal(employee.teamId, null)

        await json("/departments/operations/members", "POST", {
          employeeIds: [headlessEmployeeId],
        })
        const assignment = await request(
          "/departments/operations/members",
          "POST",
          { userIds: ["user"] },
        )
        assert.equal(assignment.status, 200)
        const linkedEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "user" },
          select: { id: true },
        })
        const teamResponse = await request(
          "/departments/operations/teams",
          "POST",
          { name: "Operations QA" },
        )
        assert.equal(teamResponse.status, 201)
        const team = (await teamResponse.json()) as { team: { id: string } }

        await json(
          `/departments/operations/members/${headlessEmployeeId}`,
          "PATCH",
          { teamId: team.team.id },
        )
        await json(
          `/departments/operations/members/${linkedEmployee.id}`,
          "PATCH",
          { teamId: team.team.id },
        )
        const detail = (await json("/departments/operations")).department
        assert.ok(
          detail.members.some(
            (member: { id: string; teamId?: string | null }) =>
              member.id === headlessEmployeeId &&
              member.teamId === team.team.id,
          ),
        )
        assert.equal(
          detail.teams.find((entry) => entry.id === team.team.id)?.memberCount,
          2,
        )
        assert.equal(
          (await prisma.user.findUniqueOrThrow({ where: { id: "user" } }))
            .teamId,
          team.team.id,
        )

        await json(
          `/departments/operations/members/${headlessEmployeeId}`,
          "PATCH",
          { teamId: null },
        )
        employee = await prisma.employee.findUniqueOrThrow({
          where: { id: headlessEmployeeId },
        })
        assert.equal(employee.departmentId, "operations")
        assert.equal(employee.teamId, null)

        await json(`/departments/operations/teams/${team.team.id}`, "DELETE")
        employee = await prisma.employee.findUniqueOrThrow({
          where: { id: headlessEmployeeId },
        })
        assert.equal(employee.departmentId, "operations")
        assert.equal(employee.teamId, null)
        assert.equal(
          (await prisma.user.findUniqueOrThrow({ where: { id: "user" } }))
            .teamId,
          null,
        )
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: linkedEmployee.id },
            })
          ).teamId,
          null,
        )
      },
    )
    await t.test(
      "a department head cannot be stranded by an employee transfer",
      async () => {
        const head = await prisma.employee.findUniqueOrThrow({
          where: { userId: "staff" },
        })
        assert.equal(
          (
            await request(`/employees/${head.id}`, "PUT", {
              departmentId: "operations",
            })
          ).status,
          409,
        )
        assert.equal(
          (
            await request(`/employees/${head.id}`, "PUT", {
              teamId: "product-team",
            })
          ).status,
          400,
        )
        assert.equal(
          (await prisma.user.findUniqueOrThrow({ where: { id: "staff" } }))
            .departmentId,
          "product",
        )
      },
    )
    await t.test(
      "legacy user assignment rejects unknown IDs atomically and bounds ID lists",
      async () => {
        const before = await prisma.employee.count()
        assert.equal(
          (
            await request("/departments/operations/members", "POST", {
              userIds: ["link-target", "missing-user"],
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "link-target" },
            })
          ).departmentId,
          null,
        )
        assert.equal(
          await prisma.employee.count({ where: { userId: "link-target" } }),
          0,
        )
        assert.equal(await prisma.employee.count(), before)
        assert.equal(
          (
            await request("/departments/operations/members", "POST", {
              employeeIds: Array.from({ length: 1001 }, () => "employee-id"),
            })
          ).status,
          400,
        )
      },
    )
    await t.test(
      "role changes materialize employees and protect Superadmin linkage",
      async () => {
        await prisma.user.create({
          data: {
            id: "role-target",
            email: "role-target@example.com",
            fullName: "Role target",
            passwordHash: "unchanged-hash",
          },
        })
        assert.equal(
          await prisma.employee.count({ where: { userId: "role-target" } }),
          0,
        )
        await json(
          "/users/role-target/role",
          "PATCH",
          { role: "STAFF" },
          200,
          "superadmin",
        )
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "role-target" },
        })
        assert.equal(employee.fullName, "Role target")
        const promotion = await request(
          "/users/role-target/role",
          "PATCH",
          { role: "SUPERADMIN" },
          "superadmin",
        )
        assert.equal(promotion.status, 409)
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "role-target" },
            })
          ).role,
          "STAFF",
        )
      },
    )
    await t.test(
      "directory search paginates without losing later results",
      async () => {
        await prisma.employee.createMany({
          data: Array.from({ length: 21 }, (_, index) => ({
            employeeId: `PAGE-${index}`,
            fullName: `Pagination Person ${String(index).padStart(2, "0")}`,
          })),
        })
        const first = await json("/employees?search=Pagination&page=1")
        const second = await json("/employees?search=Pagination&page=2")
        assert.equal(first.total, 21)
        assert.equal(first.employees.length, 20)
        assert.equal(second.employees.length, 1)
        assert.ok(
          !first.employees.some(
            (employee) => employee.id === second.employees[0]?.id,
          ),
        )
      },
    )
  },
)
