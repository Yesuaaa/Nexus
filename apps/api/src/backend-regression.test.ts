import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"
import { hashPassword } from "./features/auth/auth.password.js"

test(
  "backend regression: real HTTP, authentication, authorization and persistence",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const db = new PGlite()
    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    const cleanup: {
      prisma?: ReturnType<typeof getPrisma>
      server?: ReturnType<ReturnType<typeof createApp>["listen"]>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await socket.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    await db.waitReady
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const password = "RegressionPassword123!"
    const passwordHash = await hashPassword(password)
    const roles = ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const
    type Role = (typeof roles)[number]
    type Session = {
      token: string
      refreshToken: string
      user: { id: string; role: Role }
    }
    const sessions = new Map<Role, Session>()
    for (const role of roles) {
      await prisma.user.create({
        data: {
          id: role,
          email: `${role.toLowerCase()}@example.com`,
          role,
          fullName: "Regression Person",
          passwordHash,
        },
      })
    }
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    async function request(
      path: string,
      role?: Role,
      method = "GET",
      body?: unknown,
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(role
            ? { authorization: `Bearer ${sessions.get(role)!.token}` }
            : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      assert.equal(response.headers.get("cache-control"), "no-store")
      assert.equal(response.headers.get("x-content-type-options"), "nosniff")
      assert.equal(response.headers.get("x-powered-by"), null)
      assert.equal(response.headers.get("set-cookie"), null)
      return response
    }
    async function login(role: Role) {
      const response = await request("/auth/login", undefined, "POST", {
        email: `${role.toLowerCase()}@example.com`,
        password,
      })
      assert.equal(response.status, 200)
      const session = (await response.json()) as Session
      assert.equal(session.user.role, role)
      assert.equal(session.token.split(".").length, 3)
      assert.equal("passwordHash" in session.user, false)
      sessions.set(role, session)
      return session
    }
    for (const role of roles) await login(role)

    await t.test(
      "health and database readiness use the isolated database",
      async () => {
        for (const path of ["/health", "/db-check"]) {
          const response = await request(path)
          assert.equal(response.status, 200)
          assert.deepEqual(await response.json(), { status: "ok" })
        }
      },
    )

    const reads: [string, readonly Role[]][] = [
      ["/auth/me", roles],
      ["/users", ["SUPERADMIN"]],
      ["/departments", ["SUPERADMIN", "ADMIN", "STAFF"]],
      ["/employees", ["ADMIN"]],
      ["/clients", ["ADMIN"]],
      ["/services", ["ADMIN"]],
      ["/services/pricing-templates", ["ADMIN"]],
      ["/services/available", roles],
    ]
    for (const [path, allowed] of reads) {
      await t.test(
        `${path} enforces all four roles and anonymous access`,
        async () => {
          assert.equal((await request(path)).status, 401)
          for (const role of roles) {
            const response = await request(path, role)
            assert.equal(
              response.status,
              allowed.includes(role) ? 200 : 403,
              `${role} ${path}`,
            )
            const payload = JSON.stringify(await response.json())
            assert.equal(payload.includes(passwordHash), false)
            assert.equal(payload.includes('"passwordHash"'), false)
          }
        },
      )
    }

    await t.test(
      "department, team, employee and service provisioning stay linked",
      async () => {
        const created = await request("/departments", "ADMIN", "POST", {
          name: "Regression Department",
          code: "REG",
          color: "teal",
        })
        assert.equal(created.status, 201)
        const { department } = (await created.json()) as {
          department: { id: string }
        }
        const teamResponse = await request(
          `/departments/${department.id}/teams`,
          "ADMIN",
          "POST",
          { name: "Regression Team" },
        )
        assert.equal(teamResponse.status, 201)
        const team = await prisma.team.findFirstOrThrow({
          where: { departmentId: department.id },
        })
        const employeeInput = {
          employeeId: "EXP-REG-001",
          fullName: "Regression Employee",
          email: "employee@example.com",
          contactNumber: "09123456789",
          position: "Designer",
          employmentType: "CONTRACT",
          startDate: "2026-01-15T00:00:00.000Z",
          status: "ACTIVE",
          password,
          departmentId: department.id,
          teamId: team.id,
        }
        const employeeResponse = await request(
          "/employees",
          "ADMIN",
          "POST",
          employeeInput,
        )
        assert.equal(employeeResponse.status, 201)
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { employeeId: "EXP-REG-001" },
        })
        const user = await prisma.user.findUniqueOrThrow({
          where: { email: employeeInput.email },
        })
        assert.equal(employee.userId, user.id)
        assert.equal(user.role, "STAFF")
        assert.equal(user.departmentId, department.id)
        assert.equal(user.teamId, team.id)
        const usersBefore = await prisma.user.count()
        assert.equal(
          (
            await request("/employees", "ADMIN", "POST", {
              ...employeeInput,
              email: "duplicate@example.com",
            })
          ).status,
          409,
        )
        assert.equal(await prisma.user.count(), usersBefore)
        assert.equal(
          await prisma.user.findUnique({
            where: { email: "duplicate@example.com" },
          }),
          null,
        )
        const serviceResponse = await request("/services", "ADMIN", "POST", {
          name: "Provisioned service",
          description: "Linked department service",
          departmentIds: [department.id],
          isActive: true,
        })
        assert.equal(serviceResponse.status, 201)
        const { service: linked } = (await serviceResponse.json()) as {
          service: { id: string }
        }
        const specialists = await request(
          `/services/${linked.id}/specialists`,
          "USER",
        )
        assert.equal(specialists.status, 200)
        assert.ok(
          JSON.stringify(await specialists.json()).includes(employee.id),
        )
        assert.equal(
          (await request(`/services/${linked.id}`, "ADMIN", "DELETE")).status,
          409,
        )
        assert.equal(
          (
            await request(`/services/${linked.id}/status`, "ADMIN", "PATCH", {
              isActive: false,
            })
          ).status,
          200,
        )
        assert.equal(
          (await request(`/services/${linked.id}`, "ADMIN", "DELETE")).status,
          200,
        )
        assert.equal(
          await prisma.service.findUnique({ where: { id: linked.id } }),
          null,
        )
        assert.equal(
          (
            await request(
              `/employees/${employee.id}/account`,
              "ADMIN",
              "DELETE",
            )
          ).status,
          409,
        )
        assert.equal(
          (
            await request(
              `/employees/${employee.id}/account/status`,
              "ADMIN",
              "PATCH",
              { isActive: false },
            )
          ).status,
          204,
        )
        assert.equal(
          (
            await request(
              `/employees/${employee.id}/account`,
              "ADMIN",
              "DELETE",
            )
          ).status,
          204,
        )
        assert.equal(
          await prisma.employee.count({ where: { id: employee.id } }),
          1,
        )
        const retired = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        })
        assert.equal(retired.isActive, false)
        assert.ok(retired.accountDeletedAt)
      },
    )

    const service = await prisma.service.create({
      data: { name: "Regression service", description: "Regression fixture" },
    })
    const inactive = await prisma.service.create({
      data: {
        name: "Hidden service",
        description: "Inactive fixture",
        isActive: false,
      },
    })
    const draft = () => ({
      serviceId: service.id,
      packageId: null,
      preferredSpecialistId: null,
      submissionKey: randomUUID(),
      goals: "Launch a website",
      requirements: "Accessible pages",
      expectedTimeline: "Next month",
      additionalDetails: "",
    })
    await t.test(
      "catalog excludes inactive services and specialist reads require authentication",
      async () => {
        const response = await request("/services/available", "USER")
        const body = (await response.json()) as { services: { id: string }[] }
        assert.deepEqual(
          body.services.map((item) => item.id),
          [service.id],
        )
        assert.equal(
          (await request(`/services/${service.id}/specialists`)).status,
          401,
        )
        const specialists = await request(
          `/services/${service.id}/specialists`,
          "USER",
        )
        assert.equal(specialists.status, 200)
        assert.deepEqual(await specialists.json(), { specialists: [] })
      },
    )
    await t.test(
      "only clients submit; identity and prices come from the server",
      async () => {
        const input = draft()
        assert.equal(
          (await request("/service-requests", undefined, "POST", input)).status,
          401,
        )
        for (const role of ["SUPERADMIN", "ADMIN", "STAFF"] as const)
          assert.equal(
            (await request("/service-requests", role, "POST", input)).status,
            403,
          )
        const response = await request("/service-requests", "USER", "POST", {
          ...input,
          clientId: "ADMIN",
          status: "COMPLETED",
          quotedPrice: 1,
        })
        assert.equal(response.status, 201)
        const receipt = (await response.json()) as {
          serviceRequest: { id: string; status: string }
        }
        assert.deepEqual(Object.keys(receipt.serviceRequest).sort(), [
          "createdAt",
          "id",
          "status",
        ])
        const persisted = await prisma.serviceRequest.findUniqueOrThrow({
          where: { id: receipt.serviceRequest.id },
        })
        assert.equal(persisted.clientId, "USER")
        assert.equal(persisted.status, "PENDING")
        assert.equal(persisted.projectRequirements, input.requirements)
        assert.equal(persisted.quotedPrice, null)
        const replay = await request("/service-requests", "USER", "POST", input)
        assert.equal(replay.status, 201)
        assert.deepEqual(await replay.json(), receipt)
        assert.equal(
          (
            await request("/service-requests", "USER", "POST", {
              ...input,
              goals: "Changed goals",
            })
          ).status,
          409,
        )
        assert.equal(await prisma.serviceRequest.count(), 1)
        const related = await request("/clients/USER/service-requests", "ADMIN")
        assert.equal(related.status, 200)
        assert.ok(
          JSON.stringify(await related.json()).includes(
            receipt.serviceRequest.id,
          ),
        )
      },
    )
    await t.test(
      "invalid, stale and mismatched selections create no records",
      async () => {
        const count = await prisma.serviceRequest.count()
        for (const [changes, status] of [
          [{ goals: "" }, 400],
          [{ submissionKey: "invalid" }, 400],
          [{ requirements: "x".repeat(5001) }, 400],
          [{ serviceId: inactive.id }, 409],
          [{ packageId: "foreign-package" }, 409],
          [{ preferredSpecialistId: "unavailable-employee" }, 409],
        ] as const) {
          assert.equal(
            (
              await request("/service-requests", "USER", "POST", {
                ...draft(),
                ...changes,
              })
            ).status,
            status,
          )
        }
        assert.equal(await prisma.serviceRequest.count(), count)
      },
    )
    await t.test(
      "self role/status changes and non-Superadmin password resets are forbidden",
      async () => {
        assert.equal(
          (
            await request("/users/SUPERADMIN/role", "SUPERADMIN", "PATCH", {
              role: "USER",
            })
          ).status,
          403,
        )
        assert.equal(
          (
            await request("/users/SUPERADMIN/status", "SUPERADMIN", "PATCH", {
              isActive: false,
            })
          ).status,
          403,
        )
        for (const role of ["ADMIN", "STAFF", "USER"] as const)
          assert.equal(
            (
              await request("/users/USER/password", role, "POST", {
                newPassword: "NewPassword123!",
              })
            ).status,
            403,
          )
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: "SUPERADMIN" },
        })
        assert.equal(user.role, "SUPERADMIN")
        assert.equal(user.isActive, true)
      },
    )
    await t.test(
      "role and status changes apply to already-issued tokens",
      async () => {
        assert.equal(
          (
            await request("/users/STAFF/role", "SUPERADMIN", "PATCH", {
              role: "USER",
            })
          ).status,
          200,
        )
        assert.equal((await request("/departments", "STAFF")).status, 403)
        assert.equal(
          (
            await request("/users/STAFF/status", "SUPERADMIN", "PATCH", {
              isActive: false,
            })
          ).status,
          200,
        )
        assert.equal((await request("/auth/me", "STAFF")).status, 401)
        assert.equal(
          (
            await request("/auth/login", undefined, "POST", {
              email: "staff@example.com",
              password,
            })
          ).status,
          401,
        )
      },
    )
    await t.test(
      "refresh rotates credentials and logout revokes both tokens",
      async () => {
        const old = sessions.get("USER")!
        const response = await request("/auth/refresh", undefined, "POST", {
          refreshToken: old.refreshToken,
        })
        assert.equal(response.status, 200)
        const rotated = (await response.json()) as Session
        assert.notEqual(rotated.refreshToken, old.refreshToken)
        sessions.set("USER", rotated)
        assert.equal((await request("/auth/me", "USER")).status, 200)
        assert.equal(
          (await request("/auth/logout", "USER", "POST")).status,
          204,
        )
        assert.equal((await request("/auth/me", "USER")).status, 401)
        assert.equal(
          (
            await request("/auth/refresh", undefined, "POST", {
              refreshToken: rotated.refreshToken,
            })
          ).status,
          401,
        )
      },
    )
    await t.test(
      "password reset persists a hash and revokes existing sessions",
      async () => {
        const previous = sessions.get("ADMIN")!
        const newPassword = "ResetRegression123!"
        assert.equal(
          (
            await request("/users/ADMIN/password", "SUPERADMIN", "POST", {
              newPassword,
            })
          ).status,
          204,
        )
        assert.equal((await request("/auth/me", "ADMIN")).status, 401)
        assert.equal(
          (
            await request("/auth/refresh", undefined, "POST", {
              refreshToken: previous.refreshToken,
            })
          ).status,
          401,
        )
        assert.equal(
          (
            await request("/auth/login", undefined, "POST", {
              email: "admin@example.com",
              password,
            })
          ).status,
          401,
        )
        assert.equal(
          (
            await request("/auth/login", undefined, "POST", {
              email: "admin@example.com",
              password: newPassword,
            })
          ).status,
          200,
        )
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: "ADMIN" },
        })
        assert.notEqual(user.passwordHash, passwordHash)
        assert.notEqual(user.passwordHash, newPassword)
      },
    )
  },
)
