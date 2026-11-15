import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "department directory access does not grant HR or assignment access",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function account(label: string, role: Role) {
      const user = await prisma.user.create({
        data: {
          fullName: label,
          email: `${label}@privacy.test`,
          role,
          contactNumber: "09123456789",
          passwordHash: "PRIVATE-HASH",
        },
      })
      const { token } = await issueSession(user)
      return { user, headers: { Authorization: `Bearer ${token}` } }
    }
    const sa = await account("Superadmin", "SUPERADMIN")
    const admin = await account("Admin", "ADMIN")
    const staff = await account("Staff", "STAFF")
    const unassigned = await account("Unassigned", "STAFF")
    const headA = await account("HeadA", "STAFF")
    const headB = await account("HeadB", "STAFF")
    const client = await account("Client", "USER")
    const departments: { id: string }[] = []
    for (const [index, head] of [headA, headB].entries()) {
      const department = await prisma.department.create({
        data: {
          name: `Department ${index}`,
          code: `D${index}`,
          headId: head.user.id,
          description: "PRIVATE-MANAGEMENT-DESCRIPTION",
        },
      })
      departments.push(department)
      await prisma.user.update({
        where: { id: head.user.id },
        data: { departmentId: department.id },
      })
      const member = await account(`Member${index}`, "STAFF")
      await prisma.user.update({
        where: { id: member.user.id },
        data: { departmentId: department.id },
      })
      await prisma.employee.create({
        data: {
          employeeId: `MEMBER-${index}`,
          fullName: `Member ${index}`,
          userId: member.user.id,
          departmentId: department.id,
          email: `PRIVATE-MEMBER-${index}@privacy.test`,
          contactNumber: "09987654321",
          status: "ON_LEAVE",
        },
      })
    }
    await prisma.user.update({
      where: { id: staff.user.id },
      data: { departmentId: departments[0].id },
    })
    const directoryOnly = [staff, unassigned, headA, headB]
    const get = (path: string, actor = staff) =>
      fetch(`${base}${path}`, { headers: actor.headers })

    await t.test(
      "Staff and Heads receive an exact minimal cross-department directory",
      async () => {
        for (const actor of directoryOnly) {
          const response = await get(
            "/departments?include=members&role=SUPERADMIN",
            actor,
          )
          assert.equal(response.status, 200)
          const payload = (await response.json()) as {
            departments: Record<string, unknown>[]
          }
          assert.deepEqual(Object.keys(payload), ["departments"])
          assert.equal(payload.departments.length, 2)
          assert.deepEqual(
            payload.departments.map((row) => row.id).sort(),
            departments.map((row) => row.id).sort(),
          )
          for (const row of payload.departments) {
            assert.deepEqual(
              Object.keys(row).sort(),
              ["id", "name", "code", "color", "head"].sort(),
            )
            assert.deepEqual(
              Object.keys(row.head as object).sort(),
              ["id", "fullName"].sort(),
            )
          }
          const text = JSON.stringify(payload)
          for (const value of [
            "privacy.test",
            "PRIVATE-",
            "09987654321",
            "ON_LEAVE",
            "accountDeletedAt",
            "isActive",
          ])
            assert.ok(!text.includes(value), value)
        }
        const empty = await prisma.department.create({
          data: { name: "No Head" },
        })
        const payload = (await (await get("/departments")).json()) as {
          departments: { id: string; head: unknown }[]
        }
        assert.equal(
          payload.departments.find((row) => row.id === empty.id)?.head,
          null,
        )
      },
    )

    await t.test(
      "direct detail and candidate requests cannot circumvent HR authorization",
      async () => {
        for (const actor of directoryOnly) {
          for (const department of departments) {
            const response = await get(
              `/departments/${department.id}?include=members&userId=${sa.user.id}`,
              actor,
            )
            assert.equal(response.status, 403)
            assert.deepEqual(Object.keys((await response.json()) as object), [
              "error",
            ])
          }
          for (const path of [
            "/departments/employee-options",
            `/departments/employee-options?search=Unassigned&page=1&departmentId=${departments[0].id}`,
            "/departments/eligible-heads",
            "/employees",
            "/departments/missing",
          ])
            assert.equal((await get(path, actor)).status, 403, path)
        }
      },
    )

    await t.test(
      "Admin and Superadmin retain organization-wide management response contracts",
      async () => {
        for (const actor of [admin, sa]) {
          const list = await get("/departments", actor)
          assert.equal(list.status, 200)
          const payload = (await list.json()) as {
            departments: {
              id: string
              memberCount: number
              head: { email: string } | null
            }[]
          }
          assert.equal(
            payload.departments.find((row) => row.id === departments[1].id)
              ?.memberCount,
            1,
          )
          assert.equal(
            payload.departments.find((row) => row.id === departments[1].id)
              ?.head?.email,
            headB.user.email,
          )
          for (const department of departments) {
            const response = await get(`/departments/${department.id}`, actor)
            assert.equal(response.status, 200)
            const text = await response.text()
            assert.ok(text.includes("PRIVATE-MEMBER-"))
            assert.ok(text.includes("09987654321"))
            assert.ok(text.includes("ON_LEAVE"))
            assert.ok(!text.includes("PRIVATE-HASH"))
            assert.ok(!text.includes("temporaryHeadOriginalId"))
            const { department: detail } = JSON.parse(text) as {
              department: Record<string, unknown>
            }
            assert.deepEqual(
              Object.keys(detail).sort(),
              [
                "id",
                "name",
                "color",
                "code",
                "description",
                "headId",
                "head",
                "createdAt",
                "updatedAt",
                "members",
                "memberCount",
                "teamCount",
                "teams",
              ].sort(),
            )
          }
          const options = await get(
            "/departments/employee-options?search=Unassigned",
            actor,
          )
          assert.equal(options.status, 200)
          const payloadOptions = (await options.json()) as {
            employees: { id: string }[]
          }
          assert.deepEqual(
            payloadOptions.employees.map((row) => row.id),
            [unassigned.user.id],
          )
          assert.equal(
            (await get("/departments/eligible-heads?new=true", actor)).status,
            200,
          )
        }
        assert.equal(
          await prisma.employee.count({ where: { userId: sa.user.id } }),
          0,
        )
        assert.equal(
          await prisma.department.count({ where: { headId: sa.user.id } }),
          0,
        )
      },
    )

    await t.test(
      "Head staffing and shared request coordination retain their existing department scope",
      async () => {
        for (const [index, head] of [headA, headB].entries()) {
          const response = await get(
            `/workload?week=2026-11-16&departmentId=${departments[1 - index].id}`,
            head,
          )
          assert.equal(response.status, 200)
          const payload = (await response.json()) as {
            department: { id: string }
            staff: { fullName: string }[]
          }
          assert.equal(payload.department.id, departments[index].id)
          assert.deepEqual(
            payload.staff.map((row) => row.fullName),
            [`Member ${index}`],
          )
        }
        const service = await prisma.service.create({
          data: {
            name: "Shared service",
            description: "Shared routing",
            departments: { connect: departments.map(({ id }) => ({ id })) },
          },
        })
        const request = await prisma.serviceRequest.create({
          data: {
            serviceId: service.id,
            clientId: client.user.id,
            title: "Shared request",
          },
        })
        for (const head of [headA, headB])
          assert.equal(
            (await get(`/request-inbox/${request.id}`, head)).status,
            200,
          )
        assert.equal(
          (await get(`/request-inbox/${request.id}`, staff)).status,
          403,
        )
        assert.equal(
          (await get("/workload?week=2026-11-16", staff)).status,
          403,
        )
      },
    )

    await t.test(
      "department assignment and team mutation permissions are unchanged",
      async () => {
        for (const actor of directoryOnly) {
          for (const [path, method] of [
            ["/departments", "POST"],
            [`/departments/${departments[1].id}`, "PUT"],
            [`/departments/${departments[1].id}/members`, "POST"],
            [`/departments/${departments[1].id}/teams`, "POST"],
          ]) {
            const response = await fetch(`${base}${path}`, {
              method,
              headers: { ...actor.headers, "Content-Type": "application/json" },
              body: "{}",
            })
            assert.equal(response.status, 403)
          }
        }
      },
    )

    await t.test(
      "Client, anonymous, inactive and retired accounts cannot read the directory",
      async () => {
        for (const path of [
          "/departments",
          `/departments/${departments[1].id}`,
          "/departments/employee-options",
        ]) {
          assert.equal((await fetch(`${base}${path}`)).status, 401)
          assert.equal((await get(path, client)).status, 403)
          for (const state of [
            { isActive: false },
            { isActive: true, accountDeletedAt: new Date() },
          ]) {
            await prisma.user.update({
              where: { id: unassigned.user.id },
              data: state,
            })
            assert.equal((await get(path, unassigned)).status, 401)
          }
          await prisma.user.update({
            where: { id: unassigned.user.id },
            data: { isActive: true, accountDeletedAt: null },
          })
        }
      },
    )

    await t.test(
      "same-session role revocation removes sensitive fields and detail access",
      async () => {
        await prisma.user.update({
          where: { id: admin.user.id },
          data: { role: "STAFF" },
        })
        assert.equal(
          (await get(`/departments/${departments[1].id}`, admin)).status,
          403,
        )
        assert.equal(
          (await get("/departments/employee-options", admin)).status,
          403,
        )
        const text = await (await get("/departments", admin)).text()
        assert.ok(!text.includes("privacy.test"))
        assert.ok(!text.includes("memberCount"))
      },
    )
  },
)
