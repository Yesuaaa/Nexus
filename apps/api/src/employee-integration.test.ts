import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { setServiceImageStorageForTests } from "./features/services/service-image-storage.js"
import { getPrisma } from "./lib/db.js"

type Payload = {
  employee: { id: string; hasAccount?: boolean }
  employees: { id: string }[]
  users: { email: string }[]
  total: number
  pageSize?: number
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
    const storedServiceImages = new Set<string>()
    let uploadedImageSequence = 0
    setServiceImageStorageForTests({
      async upload() {
        uploadedImageSequence += 1
        const path = `services/test-${uploadedImageSequence}.png`
        storedServiceImages.add(path)
        return path
      },
      async remove(path) {
        storedServiceImages.delete(path)
      },
      publicUrl(path) {
        return `https://storage.test/${path}`
      },
    })
    const database = new PGlite()
    const cleanup: {
      socket?: PGLiteSocketServer
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}
    t.after(async () => {
      setServiceImageStorageForTests(undefined)
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
      const result = (
        response.status === 204 ? {} : await response.json()
      ) as Payload
      assert.equal(response.status, status, JSON.stringify(result))
      return result
    }
    let employeeId = ""
    await t.test(
      "service reads and writes enforce permissions for every role",
      async () => {
        const protectedRoutes = [
          ["GET", "/services"],
          ["GET", "/services/pricing-templates"],
          ["GET", "/services/missing"],
          ["POST", "/services"],
          ["PUT", "/services/missing"],
          ["PATCH", "/services/missing/status"],
          ["DELETE", "/services/missing"],
        ] as const
        for (const [method, path] of protectedRoutes) {
          for (const actor of ["superadmin", "staff", "user"]) {
            assert.equal(
              (await request(path, method, undefined, actor)).status,
              403,
              `${actor}: ${method} ${path}`,
            )
          }
          assert.equal(
            (await request(path, method, undefined, "anonymous")).status,
            401,
          )
        }
        for (const actor of ["admin", "superadmin", "staff", "user"]) {
          assert.equal(
            (await request("/services/available", "GET", undefined, actor))
              .status,
            200,
          )
        }
        assert.equal(
          (await request("/services/available", "GET", undefined, "anonymous"))
            .status,
          401,
        )
      },
    )
    await t.test(
      "service lifecycle validates department links and prevents deleting active services",
      async (subtest) => {
        const input = {
          name: "Security regression service",
          description: "Offline integration fixture",
          departmentIds: ["product", "operations"],
          isActive: true,
          imageDataUrl: `data:image/png;base64,${Buffer.from("service-image").toString("base64")}`,
          imageAltText: "Security service illustration",
          removeImage: false,
          pricingTemplate: {
            name: "Security regression pricing",
            pricingModel: "STARTING",
            currency: "PHP",
            amount: 5000,
            billingInterval: null,
            isPublic: true,
          },
          packages: [
            {
              name: "Starter",
              description: "Starter security package",
              includedFeatures: ["Initial assessment"],
              pricingModel: "FIXED",
              currency: "PHP",
              amount: 7500,
              billingInterval: null,
              isPricingPublic: true,
              isActive: true,
              displayOrder: 1,
              isRecommended: true,
            },
          ],
        }
        assert.equal(
          (
            await request("/services", "POST", {
              ...input,
              departmentIds: ["missing"],
            })
          ).status,
          400,
        )
        const response = await request("/services", "POST", input)
        assert.equal(response.status, 201)
        const { service } = (await response.json()) as {
          service: {
            id: string
            imageUrl: string | null
            pricingTemplate: { id: string; pricingModel: string } | null
            packages: { id: string; name: string }[]
            departments: { id: string }[]
          }
        }
        subtest.after(async () => {
          await prisma.service.deleteMany({ where: { id: service.id } })
        })
        assert.deepEqual(
          service.departments.map((department) => department.id).sort(),
          ["operations", "product"],
        )
        assert.equal(
          service.imageUrl,
          "https://storage.test/services/test-1.png",
        )
        assert.equal(storedServiceImages.has("services/test-1.png"), true)
        const storedService = await prisma.service.findUniqueOrThrow({
          where: { id: service.id },
          select: { imagePath: true },
        })
        assert.equal(storedService.imagePath, "services/test-1.png")
        assert.equal(service.pricingTemplate?.pricingModel, "STARTING")
        assert.deepEqual(
          service.packages.map((item) => item.name),
          ["Starter"],
        )
        assert.ok(service.pricingTemplate)
        const createdPackage = service.packages[0]
        assert.ok(createdPackage)
        assert.equal((await request("/services", "POST", input)).status, 409)
        const replacement = await request(`/services/${service.id}`, "PUT", {
          ...input,
          imageDataUrl: `data:image/webp;base64,${Buffer.from("replacement-image").toString("base64")}`,
          pricingTemplate: null,
          pricingTemplateId: service.pricingTemplate.id,
          packages: input.packages.map((servicePackage) => ({
            ...servicePackage,
            id: createdPackage.id,
          })),
        })
        assert.equal(replacement.status, 200)
        const replacementService = (await replacement.json()) as {
          service: { imageUrl: string | null }
        }
        assert.equal(
          replacementService.service.imageUrl,
          "https://storage.test/services/test-3.png",
        )
        assert.equal(storedServiceImages.has("services/test-1.png"), false)
        assert.equal(storedServiceImages.has("services/test-3.png"), true)
        assert.equal(
          (await request(`/services/${service.id}`, "DELETE")).status,
          409,
        )
        assert.equal(
          (
            await request(`/services/${service.id}/status`, "PATCH", {
              isActive: "false",
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request(`/services/${service.id}/status`, "PATCH", {
              isActive: false,
            })
          ).status,
          200,
        )
        const available = (await (
          await request("/services/available", "GET", undefined, "user")
        ).json()) as { services: { id: string }[] }
        assert.equal(
          available.services.some((item) => item.id === service.id),
          false,
        )
        assert.equal(
          (await request(`/services/${service.id}`, "DELETE")).status,
          200,
        )
        assert.equal(storedServiceImages.has("services/test-3.png"), false)
        assert.equal(
          (await request(`/services/${service.id}`, "GET")).status,
          404,
        )
      },
    )
    await t.test(
      "department mutations reject Staff and User even when directly requested",
      async () => {
        for (const actor of ["staff", "user"]) {
          for (const [method, path] of [
            ["POST", "/departments"],
            ["PUT", "/departments/product"],
            ["DELETE", "/departments/product"],
            ["POST", "/departments/product/members"],
            ["PATCH", "/departments/product/members/missing"],
            ["DELETE", "/departments/product/members/missing"],
            ["POST", "/departments/product/teams"],
            ["PUT", "/departments/product/teams/product-team"],
            ["DELETE", "/departments/product/teams/product-team"],
          ]) {
            assert.equal(
              (await request(path, method, undefined, actor)).status,
              403,
              `${actor}: ${method} ${path}`,
            )
          }
        }
      },
    )
    await t.test(
      "inactive Staff accounts cannot be assigned through legacy user IDs",
      async (subtest) => {
        await prisma.user.create({
          data: {
            id: "inactive-staff",
            email: "inactive-staff@example.com",
            fullName: "Inactive Staff",
            passwordHash: "unused-test-hash",
            role: "STAFF",
            isActive: false,
          },
        })
        subtest.after(async () => {
          await prisma.user.delete({ where: { id: "inactive-staff" } })
        })
        const before = await prisma.employee.count()
        assert.equal(
          (
            await request("/departments/operations/members", "POST", {
              userIds: ["inactive-staff"],
            })
          ).status,
          400,
        )
        assert.equal(await prisma.employee.count(), before)
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "inactive-staff" },
            })
          ).departmentId,
          null,
        )
      },
    )
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
            employeeId: "EXP-9001",
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
            employeeId: "EXP-9001",
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
            employeeId: "EXP-9003",
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
        assert.equal(assignment.status, 400)
        assert.equal(
          await prisma.employee.count({ where: { userId: "user" } }),
          0,
        )
        await prisma.user.create({
          data: {
            id: "operations-staff",
            email: "operations-staff@example.com",
            fullName: "Operations Staff",
            passwordHash: "unused-test-hash",
            role: "STAFF",
          },
        })
        await json("/departments/operations/members", "POST", {
          userIds: ["operations-staff"],
        })
        const linkedEmployee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "operations-staff" },
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
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "operations-staff" },
            })
          ).teamId,
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
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "operations-staff" },
            })
          ).teamId,
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
          400,
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
      "employee profiles and login accounts have separate lifecycles",
      async () => {
        const employee = await prisma.employee.create({
          data: {
            employeeId: "EXP-LOGIN",
            fullName: "Login Person",
            email: "login.person@example.com",
            contactNumber: "09123456789",
            position: "Designer",
            departmentId: "product",
          },
        })
        const path = `/employees/${employee.id}`
        await json(path, "PUT", { fullName: "Updated Person" }, 200)
        await json(path, "PUT", { password: "ValidPassword1!" }, 400)
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: employee.id },
            })
          ).userId,
          null,
        )
        for (const actor of ["staff", "user", "superadmin"]) {
          assert.equal(
            (
              await request(
                `${path}/account`,
                "POST",
                { password: "ValidPassword1!" },
                actor,
              )
            ).status,
            403,
          )
          assert.equal(
            (
              await request(
                `${path}/account/status`,
                "PATCH",
                { isActive: true },
                actor,
              )
            ).status,
            403,
          )
          assert.equal(
            (await request(`${path}/account`, "DELETE", undefined, actor))
              .status,
            403,
          )
        }
        await json(`${path}/account`, "POST", { password: "short" }, 400)
        await json(
          `${path}/account`,
          "POST",
          { password: "ValidPassword1!" },
          201,
        )
        const account = await prisma.user.findUniqueOrThrow({
          where: { email: employee.email! },
        })
        assert.equal(account.role, "STAFF")
        await json(
          `${path}/account`,
          "POST",
          { password: "OtherPassword1!" },
          409,
        )
        await json(path, "PUT", { position: "Senior Designer" }, 200)
        assert.equal(
          (await prisma.user.findUniqueOrThrow({ where: { id: account.id } }))
            .passwordHash,
          account.passwordHash,
        )
        await prisma.session.create({
          data: {
            userId: account.id,
            tokenHash: "employee-login-test",
            expiresAt: new Date(Date.now() + 60000),
          },
        })
        await json(`${path}/account/status`, "PATCH", { isActive: false }, 204)
        assert.equal(
          await prisma.session.count({ where: { userId: account.id } }),
          0,
        )
        await json(`${path}/account/status`, "PATCH", { isActive: true }, 204)
        const reactivated = await prisma.user.findUniqueOrThrow({
          where: { id: account.id },
        })
        assert.equal(reactivated.isActive, true)
        assert.equal(reactivated.passwordHash, account.passwordHash)
        await json(`${path}/account/status`, "PATCH", { isActive: "true" }, 400)
        await json(`${path}/account`, "DELETE", undefined, 204)
        assert.equal(
          await prisma.user.findUnique({ where: { id: account.id } }),
          null,
        )
        const retained = await prisma.employee.findUniqueOrThrow({
          where: { id: employee.id },
        })
        assert.equal(retained.userId, null)
        assert.equal(retained.departmentId, employee.departmentId)
        await json(path, "PUT", { fullName: "Profile Without Login" }, 200)
        await json(
          `${path}/account`,
          "POST",
          { password: "ValidPassword1!" },
          201,
        )
        const recreated = await prisma.user.findUniqueOrThrow({
          where: { email: employee.email! },
        })
        assert.notEqual(recreated.id, account.id)
      },
    )
    await t.test(
      "directory follows visible Admin and Staff accounts and joins HR details",
      async () => {
        const staffAccount = await prisma.user.create({
          data: {
            email: "directory.staff@example.com",
            fullName: "Directory Staff",
            contactNumber: "09123456789",
            role: "STAFF",
            passwordHash: "private-hash",
          },
        })
        const adminAccount = await prisma.user.create({
          data: {
            email: "directory.admin@example.com",
            fullName: "Directory Admin",
            role: "ADMIN",
            passwordHash: "private-hash",
            isActive: false,
          },
        })
        const retired = await prisma.user.create({
          data: {
            email: "directory.deleted@example.com",
            fullName: "Directory Deleted",
            role: "STAFF",
            passwordHash: "private-hash",
            accountDeletedAt: new Date(),
          },
        })
        await prisma.employee.createMany({
          data: [
            {
              employeeId: "EXP-DIR-ORPHAN",
              fullName: "Directory Orphan",
              email: staffAccount.email,
            },
            {
              employeeId: "EXP-DIR-DELETED",
              fullName: "Directory Retired HR",
              userId: retired.id,
            },
          ],
        })
        for (const role of ["USER", "SUPERADMIN"] as const)
          await prisma.user.create({
            data: {
              email: `directory.${role.toLowerCase()}@example.com`,
              fullName: `Directory ${role}`,
              role,
              passwordHash: "private-hash",
            },
          })
        const list = await json("/employees?search=directory")
        assert.equal(list.total, 2)
        const rows = list.employees as unknown as {
          id: string
          accountId: string
          hasEmployeeRecord: boolean
          employeeId: string
          employmentType: string | null
          status: string | null
          fullName: string
          accountIsActive: boolean
        }[]
        const missing = rows.find((row) => row.accountId === staffAccount.id)!
        assert.equal(missing.hasEmployeeRecord, false)
        assert.equal(missing.employeeId, "")
        assert.equal(missing.employmentType, null)
        assert.equal(missing.status, null)
        assert.equal(
          rows.find((row) => row.accountId === adminAccount.id)
            ?.accountIsActive,
          false,
        )
        assert.equal(JSON.stringify(list).includes("private-hash"), false)
        await json(
          `/employees/${encodeURIComponent(missing.id)}`,
          "GET",
          undefined,
          200,
        )
        await json(
          `/employees/${encodeURIComponent(missing.id)}/account/status`,
          "PATCH",
          { isActive: false },
          204,
        )
        await json(
          `/employees/${encodeURIComponent(missing.id)}/account/status`,
          "PATCH",
          { isActive: true },
          204,
        )
        const profile = {
          employeeId: "EXP-DIRECTORY",
          fullName: "Directory Updated",
          email: staffAccount.email,
          contactNumber: "09123456789",
          position: "Designer",
          employmentType: "FULL_TIME",
          departmentId: "product",
          teamId: null,
          startDate: "2026-01-15",
        }
        for (const actor of ["staff", "user", "superadmin"])
          assert.equal(
            (
              await request(
                `/employees/accounts/${staffAccount.id}/profile`,
                "POST",
                profile,
                actor,
              )
            ).status,
            403,
          )
        const saved = await json(
          `/employees/accounts/${staffAccount.id}/profile`,
          "POST",
          profile,
          201,
        )
        assert.notEqual(saved.employee.id, missing.id)
        await json(
          `/employees/accounts/${staffAccount.id}/profile`,
          "POST",
          profile,
          409,
        )
        const refreshed = await json(
          "/employees?search=EXP-DIRECTORY&departmentId=product&employmentType=FULL_TIME&status=ACTIVE",
        )
        assert.equal(refreshed.total, 1)
        assert.equal(refreshed.employees[0]!.id, saved.employee.id)
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: staffAccount.id },
            })
          ).fullName,
          profile.fullName,
        )
        await json(
          `/employees/account:${adminAccount.id}/account`,
          "DELETE",
          undefined,
          403,
        )
        await json(
          `/employees/account:${staffAccount.id}/account`,
          "DELETE",
          undefined,
          204,
        )
        assert.equal((await json("/employees?search=EXP-DIRECTORY")).total, 0)
        assert.equal(
          await prisma.employee.count({ where: { id: saved.employee.id } }),
          1,
        )
      },
    )
    await t.test(
      "directory search paginates without losing later results",
      async () => {
        for (let index = 0; index < 13; index++) {
          await prisma.user.create({
            data: {
              email: `pagination${index}@example.com`,
              fullName: `Pagination Person ${String(index).padStart(2, "0")}`,
              role: "STAFF",
              passwordHash: "test-only-hash",
              employee: {
                create: {
                  employeeId: `EXP-PAGE-${index}`,
                  fullName: `HR Name ${index}`,
                },
              },
            },
          })
        }
        const first = await json("/employees?search=Pagination&page=1")
        const second = await json("/employees?search=Pagination&page=2")
        assert.equal(first.total, 13)
        assert.equal(first.pageSize, 10)
        assert.equal(first.employees.length, 10)
        assert.equal(second.employees.length, 3)
        assert.ok(
          !first.employees.some(
            (employee) => employee.id === second.employees[0]?.id,
          ),
        )
      },
    )
  },
)
