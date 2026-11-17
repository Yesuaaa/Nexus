import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  EmployeeStatus,
  Role,
} from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"
import {
  DEPARTMENT_HEAD_TITLE_MESSAGE,
  isDepartmentHeadTitle,
} from "../../../src/features/departments/leadership.policy.js"

test("isDepartmentHeadTitle ignores case and extra whitespace", () => {
  for (const title of [
    "Department Head",
    "Department head",
    "department HEAD",
    "  dept   head ",
    "DEPT HEAD",
  ])
    assert.equal(isDepartmentHeadTitle(title), true, title)
  for (const title of [null, undefined, "", "Head", "Department Heads", "Lead"])
    assert.equal(isDepartmentHeadTitle(title), false, String(title))
})

test(
  "leadership policy: department heads, temporary heads and head titles",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)

    await prisma.department.createMany({
      data: [
        { id: "dept-a", name: "Product" },
        { id: "dept-b", name: "Sales" },
      ],
    })
    async function account(
      id: string,
      {
        role = "STAFF",
        isActive = true,
        trashed = false,
        departmentId = null,
        employee = "ACTIVE",
        position = null,
      }: {
        role?: Role
        isActive?: boolean
        trashed?: boolean
        departmentId?: string | null
        employee?: EmployeeStatus | null
        position?: string | null
      } = {},
    ) {
      return prisma.user.create({
        data: {
          id,
          email: `${id}@leadership.example`,
          fullName: `${id} Person`,
          passwordHash: "test-only-hash",
          role,
          isActive,
          accountDeletedAt: trashed ? new Date() : null,
          departmentId,
          position,
          ...(employee
            ? {
                employee: {
                  create: {
                    id: `emp-${id}`,
                    employeeId: `EXP-${id}`,
                    fullName: `${id} Person`,
                    status: employee,
                    departmentId,
                    position,
                  },
                },
              }
            : {}),
        },
      })
    }

    const superadmin = await account("superadmin", {
      role: "SUPERADMIN",
      employee: null,
    })
    const admin = await account("admin", { role: "ADMIN", employee: null })
    await account("head", { departmentId: "dept-a", position: "Lead" })
    await prisma.department.update({
      where: { id: "dept-a" },
      data: { headId: "head" },
    })
    await account("member", { departmentId: "dept-a" })
    await account("designer", { departmentId: "dept-a" })
    await account("free")
    // One rule each; all would otherwise be acceptable dept-a heads.
    const ineligible = {
      inactive: await account("inactive", {
        isActive: false,
        departmentId: "dept-a",
      }),
      trashed: await account("trashed", {
        trashed: true,
        departmentId: "dept-a",
      }),
      client: await account("client", { role: "USER", employee: null }),
      adminCandidate: await account("admin-candidate", {
        role: "ADMIN",
        departmentId: "dept-a",
      }),
      onLeave: await account("on-leave", {
        employee: "ON_LEAVE",
        departmentId: "dept-a",
      }),
      noEmployee: await account("no-employee", { employee: null }),
      otherDepartment: await account("other-department", {
        departmentId: "dept-b",
      }),
    }

    const tokens = {
      admin: (await issueSession(admin)).token,
      superadmin: (await issueSession(superadmin)).token,
    }
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      actor: keyof typeof tokens = "admin",
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${tokens[actor]}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      return {
        status: response.status,
        payload: (await response.json()) as {
          error?: string
          users?: { id: string }[]
          replacementCandidates?: { id: string }[]
        },
      }
    }
    const headOf = async (id: string) =>
      (await prisma.department.findUniqueOrThrow({ where: { id } })).headId

    await t.test(
      "temporary heads exclude trashed and otherwise ineligible staff",
      async () => {
        const options = await request("/employees/emp-head/status-options")
        assert.equal(options.status, 200, JSON.stringify(options.payload))
        assert.deepEqual(
          options.payload.replacementCandidates?.map(({ id }) => id).sort(),
          ["emp-designer", "emp-member"],
        )
        for (const employeeId of ["emp-trashed", "emp-inactive"]) {
          const rejected = await request("/employees/emp-head", "PUT", {
            status: "ON_LEAVE",
            replacementHeadEmployeeId: employeeId,
          })
          assert.equal(rejected.status, 400, employeeId)
          assert.equal(await headOf("dept-a"), "head")
        }
      },
    )

    await t.test(
      "eligible-heads lists only candidates plus the current head",
      async () => {
        const scoped = await request(
          "/departments/eligible-heads?departmentId=dept-a",
        )
        assert.equal(scoped.status, 200)
        assert.deepEqual(scoped.payload.users?.map(({ id }) => id).sort(), [
          "designer",
          "free",
          "head",
          "member",
        ])
        const unscoped = await request("/departments/eligible-heads")
        const ids = unscoped.payload.users?.map(({ id }) => id) ?? []
        for (const [name, user] of Object.entries(ineligible))
          assert.equal(
            ids.includes(user.id),
            name === "otherDepartment",
            `${name} listed without a department filter`,
          )
        assert.equal(
          (await request("/departments/eligible-heads?departmentId=a%20b"))
            .status,
          400,
        )
        // A department being created can only take unassigned staff.
        const forNew = await request("/departments/eligible-heads?new=true")
        assert.equal(forNew.status, 200)
        assert.deepEqual(
          forNew.payload.users?.map(({ id }) => id),
          ["free"],
        )
        for (const query of ["new=1", "new=true&departmentId=dept-a"])
          assert.equal(
            (await request(`/departments/eligible-heads?${query}`)).status,
            400,
            query,
          )
      },
    )

    await t.test(
      "inactive, trashed, client, admin and other-department users are rejected as head",
      async () => {
        for (const [name, user] of Object.entries(ineligible)) {
          const created = await request("/departments", "POST", {
            name: `New ${name}`,
            headId: user.id,
          })
          assert.equal(created.status, 400, `create: ${name}`)
          const updated = await request("/departments/dept-a", "PUT", {
            headId: user.id,
          })
          assert.equal(updated.status, 400, `update: ${name}`)
          assert.equal(await headOf("dept-a"), "head")
        }
        assert.equal(
          await prisma.department.count({
            where: { name: { startsWith: "New " } },
          }),
          0,
        )

        // A member of another department cannot head a brand-new one either.
        const assigned = await request("/departments", "POST", {
          name: "New with assigned head",
          headId: "member",
        })
        assert.equal(assigned.status, 400)

        const created = await request("/departments", "POST", {
          name: "Operations",
          headId: "free",
        })
        assert.equal(created.status, 201, JSON.stringify(created.payload))
        const free = await prisma.user.findUniqueOrThrow({
          where: { id: "free" },
          include: { employee: true, headOf: true },
        })
        assert.equal(free.headOf?.name, "Operations")
        assert.equal(free.employee?.departmentId, free.headOf?.id)

        const handoff = await request("/departments/dept-a", "PUT", {
          headId: "member",
        })
        assert.equal(handoff.status, 200, JSON.stringify(handoff.payload))
        assert.equal(await headOf("dept-a"), "member")
      },
    )

    await t.test(
      "'Department head' titles are caught in any casing",
      async () => {
        const member = await request(
          "/departments/dept-a/members/emp-designer",
          "PATCH",
          { position: "Department head" },
        )
        assert.equal(member.status, 400)
        assert.equal(member.payload.error, DEPARTMENT_HEAD_TITLE_MESSAGE)

        const employee = await request("/employees/emp-designer", "PUT", {
          position: "  dePARTment   HEAD ",
        })
        assert.equal(employee.status, 400)
        assert.equal(employee.payload.error, DEPARTMENT_HEAD_TITLE_MESSAGE)

        const created = await request(
          "/users",
          "POST",
          {
            email: "new-head-title@leadership.example",
            password: "Str0ng!Passphrase#2026",
            role: "STAFF",
            fullName: "New Person",
            position: "DEPT head",
          },
          "superadmin",
        )
        assert.equal(created.status, 400)
        assert.match(created.payload.error ?? "", /Department Head/)

        // The department's head may hold the title.
        const head = await request(
          "/departments/dept-a/members/emp-member",
          "PATCH",
          { position: "Department head" },
        )
        assert.equal(head.status, 200, JSON.stringify(head.payload))

        // Stale titles in any spelling are cleared when the department loads.
        await prisma.user.update({
          where: { id: "designer" },
          data: { position: "Department head" },
        })
        assert.equal((await request("/departments/dept-a")).status, 200)
        const designer = await prisma.user.findUniqueOrThrow({
          where: { id: "designer" },
          include: { employee: true },
        })
        assert.equal(designer.position, null)
        assert.equal(designer.employee?.position, null)
        const kept = await prisma.user.findUniqueOrThrow({
          where: { id: "member" },
        })
        assert.equal(kept.position, "Department head")
      },
    )
  },
)
