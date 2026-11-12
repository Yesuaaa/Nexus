import assert from "node:assert/strict"
import { test } from "node:test"
import { hashPassword } from "./features/auth/auth.password.js"
import { startPgliteApp } from "./test/pglite-app.js"

test(
  "API system regression: current routes, settings, workload and error contracts",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = `${origin}/api`
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

    const week = "2026-11-02"
    await t.test("current read routes require authentication", async () => {
      for (const path of [
        "/auth/settings",
        `/workload?week=${week}`,
        "/projects/missing",
      ]) {
        assert.equal((await request(path)).status, 401, path)
      }
      for (const role of roles) {
        assert.equal((await request("/auth/settings", role)).status, 200)
        assert.equal(
          (await request(`/workload?week=${week}`, role)).status,
          403,
        )
      }
    })

    await t.test("new mutations reject anonymous requests", async () => {
      for (const [path, method] of [
        ["/auth/settings", "PATCH"],
        ["/auth/sessions/revoke-all", "POST"],
        ["/auth/sessions/revoke-others", "POST"],
        ["/auth/sessions/missing", "DELETE"],
        ["/workload/capacity", "PUT"],
        ["/workload/assignment", "PUT"],
        ["/workload/assignment/missing", "DELETE"],
        ["/request-conversations/missing/meetings", "POST"],
        ["/request-conversations/missing/meetings/missing", "PATCH"],
        ["/projects/missing/milestones/missing", "PATCH"],
      ])
        assert.equal(
          (await request(path!, undefined, method, {})).status,
          401,
          `${method} ${path}`,
        )
      assert.equal(await prisma.workloadCapacity.count(), 0)
      assert.equal(await prisma.projectStaff.count(), 0)
    })

    await t.test(
      "settings persist per account and reject privilege injection without changing preferences",
      async () => {
        const preferences = {
          timeZone: "Asia/Singapore",
          dateFormat: "YYYY-MM-DD",
          timeFormat: "24h",
          workflowNotifications: false,
        }
        for (const role of roles) {
          const others = await prisma.user.findMany({
            where: { id: { not: role } },
            select: { id: true, settings: true },
            orderBy: { id: "asc" },
          })
          assert.equal(
            (await request("/auth/settings", role, "PATCH", preferences))
              .status,
            200,
          )
          const saved = (await (
            await request("/auth/settings", role)
          ).json()) as { preferences: unknown }
          assert.deepEqual(saved.preferences, preferences)
          for (const invalid of [
            { ...preferences, role: "SUPERADMIN" },
            { ...preferences, timeZone: "Invalid/Zone" },
            { ...preferences, workflowNotifications: "false" },
          ]) {
            assert.equal(
              (await request("/auth/settings", role, "PATCH", invalid)).status,
              400,
            )
          }
          const user = await prisma.user.findUniqueOrThrow({
            where: { id: role },
          })
          assert.equal(user.role, role)
          assert.deepEqual(user.settings, preferences)
          assert.deepEqual(
            await prisma.user.findMany({
              where: { id: { not: role } },
              select: { id: true, settings: true },
              orderBy: { id: "asc" },
            }),
            others,
          )
        }
      },
    )

    const department = await prisma.department.create({
      data: { name: "Design", code: "DES", headId: "STAFF" },
    })
    const otherDepartment = await prisma.department.create({
      data: { name: "Engineering", code: "ENG" },
    })
    const member = await prisma.employee.create({
      data: {
        employeeId: "REG-001",
        fullName: "Design Member",
        department: { connect: { id: department.id } },
        user: {
          create: {
            email: "design-member@example.com",
            role: "STAFF",
            passwordHash,
          },
        },
      },
    })
    const outsider = await prisma.employee.create({
      data: {
        employeeId: "REG-002",
        fullName: "Other Member",
        department: { connect: { id: otherDepartment.id } },
        user: {
          create: {
            email: "other-member@example.com",
            role: "STAFF",
            passwordHash,
          },
        },
      },
    })
    const memberWithoutAccount = await prisma.employee.create({
      data: {
        employeeId: "REG-003",
        fullName: "Member Without Account",
        departmentId: department.id,
      },
    })
    const capacity = {
      employeeId: member.id,
      week,
      scheduledHours: 40,
      timeOffHours: 8,
    }

    await t.test(
      "head capacity writes are scoped, validated, persisted and idempotent",
      async () => {
        for (const role of ["USER", "ADMIN", "SUPERADMIN"] as const) {
          assert.equal(
            (await request("/workload/capacity", role, "PUT", capacity)).status,
            403,
          )
        }
        for (const invalid of [
          { week: "2026-11-03" },
          { week: "2026-02-30" },
          { scheduledHours: -1 },
          { scheduledHours: 169 },
          { scheduledHours: "40" },
          { timeOffHours: 41 },
        ]) {
          const response = await request("/workload/capacity", "STAFF", "PUT", {
            ...capacity,
            ...invalid,
          })
          assert.equal(response.status, 400)
          const payload = (await response.json()) as { error: string }
          assert.ok(payload.error.length > 0)
        }
        assert.equal(await prisma.workloadCapacity.count(), 0)
        for (const employeeId of [outsider.id, memberWithoutAccount.id]) {
          assert.equal(
            (
              await request("/workload/capacity", "STAFF", "PUT", {
                ...capacity,
                employeeId,
              })
            ).status,
            404,
          )
        }
        assert.equal(await prisma.workloadCapacity.count(), 0)
        for (let replay = 0; replay < 2; replay++) {
          assert.equal(
            (await request("/workload/capacity", "STAFF", "PUT", capacity))
              .status,
            200,
          )
        }
        assert.equal(await prisma.workloadCapacity.count(), 1)
        const saved = await prisma.workloadCapacity.findFirstOrThrow()
        assert.equal(saved.updatedById, "STAFF")
        assert.equal(saved.scheduledHours, 40)
        assert.equal(saved.timeOffHours, 8)
        const response = await request(`/workload?week=${week}`, "STAFF")
        assert.equal(response.status, 200)
        const payload = (await response.json()) as {
          staff: {
            id: string
            capacity: { scheduledHours: number; timeOffHours: number } | null
          }[]
        }
        assert.deepEqual(
          payload.staff.map((item) => item.id),
          [member.id],
        )
        assert.equal(payload.staff[0]!.capacity!.timeOffHours, 8)
        const nextWeek = (await (
          await request("/workload?week=2026-11-09", "STAFF")
        ).json()) as typeof payload
        assert.equal(nextWeek.staff[0]!.capacity, null)
      },
    )

    await t.test(
      "removing head assignment immediately revokes workload writes for an existing token",
      async () => {
        const revocationCapacity = { ...capacity, week: "2026-11-16" }
        const saved = await prisma.workloadCapacity.create({
          data: { ...revocationCapacity, updatedById: "STAFF" },
        })
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: null },
        })
        assert.equal(
          (await request(`/workload?week=${week}`, "STAFF")).status,
          403,
        )
        assert.equal(
          (
            await request("/workload/capacity", "STAFF", "PUT", {
              ...revocationCapacity,
              scheduledHours: 20,
            })
          ).status,
          403,
        )
        assert.equal(
          (
            await prisma.workloadCapacity.findUniqueOrThrow({
              where: { id: saved.id },
            })
          ).scheduledHours,
          40,
        )
      },
    )

    await t.test(
      "revoke-all invalidates access and refresh tokens only for the caller",
      async () => {
        const oldSession = sessions.get("USER")!
        const foreignSession = await prisma.session.findFirstOrThrow({
          where: { userId: "STAFF" },
        })
        assert.equal(
          (
            await request(
              `/auth/sessions/${foreignSession.id}`,
              "USER",
              "DELETE",
            )
          ).status,
          404,
        )
        assert.equal(
          (await request("/auth/sessions/revoke-all", "USER", "POST")).status,
          204,
        )
        assert.equal((await request("/auth/me", "USER")).status, 401)
        assert.equal(
          (
            await request("/auth/refresh", undefined, "POST", {
              refreshToken: oldSession.refreshToken,
            })
          ).status,
          401,
        )
        assert.equal((await request("/auth/me", "STAFF")).status, 200)
        assert.equal(
          await prisma.session.count({ where: { userId: "USER" } }),
          0,
        )
      },
    )
  },
)
