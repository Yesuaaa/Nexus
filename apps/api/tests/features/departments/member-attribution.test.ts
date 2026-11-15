import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Department member mutations attribute actual Employee and User effects atomically",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const tokens = new Map<string, string>()
    async function account(id: string, role: Role = "STAFF") {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@member-attribution.test`,
          fullName: "Private Name Sentinel",
          position: "Private Job Sentinel",
          contactNumber: "09123456789",
          passwordHash: "Private Credential Sentinel",
        },
      })
      tokens.set(id, (await issueSession(user)).token)
      return user
    }
    for (const [id, role] of [
      ["admin", "ADMIN"],
      ["root", "SUPERADMIN"],
      ["staff", "STAFF"],
      ["client", "USER"],
      ["inactive", "ADMIN"],
      ["retired", "SUPERADMIN"],
    ] as const)
      await account(id, role)
    await prisma.user.update({
      where: { id: "inactive" },
      data: { isActive: false },
    })
    await prisma.user.update({
      where: { id: "retired" },
      data: { isActive: false, accountDeletedAt: new Date() },
    })
    for (const id of ["one", "two"])
      await prisma.department.create({ data: { id, name: id } })
    for (const [id, departmentId] of [
      ["alpha", "one"],
      ["beta", "one"],
      ["other-team", "two"],
    ])
      await prisma.team.create({ data: { id, name: id, departmentId } })
    async function member(
      id: string,
      departmentId: string | null = null,
      teamId: string | null = null,
      employee = true,
    ) {
      await account(id)
      await prisma.user.update({
        where: { id },
        data: { departmentId, teamId },
      })
      if (employee)
        await prisma.employee.create({
          data: {
            id: `hr-${id}`,
            employeeId: `EXP-${id}`,
            userId: id,
            departmentId,
            teamId,
            position: "Private Job Sentinel",
            fullName: "Private Name Sentinel",
          },
        })
    }
    await member("head", "one")
    await prisma.department.update({
      where: { id: "one" },
      data: { headId: "head" },
    })
    await prisma.user.update({
      where: { id: "head" },
      data: { position: "Department Head" },
    })
    await prisma.employee.update({
      where: { id: "hr-head" },
      data: { position: "Department Head" },
    })
    await member("unrelated", "two", "other-team")
    const forgery = {
      actorAccountId: "client",
      actorRoleAtTime: "USER",
      operationId: "forged-operation",
      createdAt: "2000-01-01T00:00:00Z",
      history: { password: "Forbidden Secret" },
    }
    function request(
      path: string,
      method: string,
      body: object = {},
      actor: string | null = "admin",
    ) {
      return fetch(`${base}/departments${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(actor
            ? {
                Authorization: `Bearer ${tokens.get(actor)}`,
                "X-Actor-Id": "client",
              }
            : {}),
        },
        body:
          method === "GET"
            ? undefined
            : JSON.stringify({ ...body, ...forgery }),
      })
    }
    async function mutate(
      path: string,
      method: string,
      body = {},
      actor = "admin",
    ) {
      const response = await request(path, method, body, actor)
      assert.equal(response.status, 200, await response.clone().text())
      return (await response.json()) as Record<string, unknown>
    }
    const events = () =>
      prisma.workforceManagementChange.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    async function snapshot() {
      return {
        users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
        employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
        departments: await prisma.department.findMany({
          orderBy: { id: "asc" },
        }),
        teams: await prisma.team.findMany({ orderBy: { id: "asc" } }),
        history: await events(),
      }
    }
    function trusted(rows: Awaited<ReturnType<typeof events>>, actor: string) {
      assert.ok(rows.length)
      assert.equal(new Set(rows.map((row) => row.operationId)).size, 1)
      for (const row of rows) {
        assert.equal(row.actorAccountId, actor)
        assert.equal(
          row.actorRoleAtTime,
          actor === "root" ? "SUPERADMIN" : "ADMIN",
        )
        assert.equal(row.origin, "DEPARTMENT_MANAGEMENT")
        assert.notEqual(row.operationId, "forged-operation")
        assert.notEqual(row.createdAt.toISOString(), "2000-01-01T00:00:00.000Z")
      }
    }

    await t.test(
      "single/multiple Employee assignment coalesces duplicate identity forms and ignores no-ops",
      async () => {
        await member("first")
        await member("second")
        let count = (await events()).length
        const first = await mutate("/one/members", "POST", {
          employeeIds: ["hr-first"],
        })
        assert.equal(first.message, "Members assigned successfully")
        let rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 2)
        assert.deepEqual(
          rows.find((row) => row.subjectType === "EMPLOYEE")!.changes,
          { departmentId: { before: null, after: "one" } },
        )
        count = (await events()).length
        await mutate(
          "/one/members",
          "POST",
          {
            employeeIds: ["hr-first", "hr-second", "hr-second"],
            userIds: ["second", "second"],
          },
          "root",
        )
        rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 2)
        assert.equal(
          rows.filter((row) => row.subjectType === "EMPLOYEE").length,
          1,
        )
        count = (await events()).length
        await mutate("/one/members", "POST", {
          employeeIds: ["hr-first", "hr-second"],
          userIds: ["first", "second"],
        })
        assert.equal((await events()).length, count)
      },
    )

    await t.test(
      "legacy assignment records actual Employee birth at its final assignments and existing Employee synchronization",
      async () => {
        await member("legacy-new", null, null, false)
        await member("legacy-existing")
        await prisma.employee.update({
          where: { id: "hr-legacy-existing" },
          data: { position: "Stale Private Job" },
        })
        const count = (await events()).length
        await mutate(
          "/one/members",
          "POST",
          { userIds: ["legacy-new", "legacy-existing"] },
          "root",
        )
        const rows = (await events()).slice(count)
        trusted(rows, "root")
        const created = rows.filter((row) => row.action === "CREATED")
        assert.equal(created.length, 1)
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "legacy-new" },
        })
        assert.equal(created[0].subjectId, employee.id)
        assert.deepEqual(created[0].changes, {
          userId: { before: null, after: "legacy-new" },
          departmentId: { before: null, after: "one" },
          teamId: { before: null, after: null },
          status: { before: null, after: "ACTIVE" },
          employmentType: { before: null, after: "FULL_TIME" },
        })
        assert.ok(
          !rows.some(
            (row) =>
              row.action === "ASSIGNMENT_CHANGED" &&
              row.subjectId === employee.id,
          ),
        )
        assert.equal(
          rows.filter((row) => row.action === "PROFILE_UPDATED").length,
          1,
        )
        assert.deepEqual(
          rows.find((row) => row.action === "PROFILE_UPDATED")!.changedFields,
          ["position"],
        )
        assert.equal(await prisma.accountManagementChange.count(), 0)
      },
    )

    await t.test(
      "Employee PATCH records position/team changes and mirror-only synchronization once",
      async () => {
        await member("edit", "one", "alpha")
        let count = (await events()).length
        const payload = await mutate("/one/members/hr-edit", "PATCH", {
          position: "  New Private Job  ",
          teamId: "beta",
        })
        assert.ok(payload.employee)
        let rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 3)
        assert.deepEqual(
          rows.find((row) => row.action === "PROFILE_UPDATED")!.changes,
          {},
        )
        assert.deepEqual(
          rows.find((row) => row.action === "PROFILE_UPDATED")!.changedFields,
          ["position"],
        )
        count = (await events()).length
        await mutate("/one/members/hr-edit", "PATCH", {
          position: "New Private Job",
          teamId: "beta",
        })
        assert.equal((await events()).length, count)
        await prisma.user.update({
          where: { id: "edit" },
          data: { position: "Stale Private Job" },
        })
        await mutate("/one/members/hr-edit", "PATCH", {}, "root")
        rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 1)
        assert.deepEqual(rows[0].changedFields, ["position"])
        assert.equal(rows[0].action, "PROFILE_UPDATED")
      },
    )

    await t.test(
      "legacy PATCH captures real birth, mirror-only profile changes and User-only position without fabricating Employee",
      async () => {
        await member("edit-legacy", "one", null, false)
        let count = (await events()).length
        const payload = await mutate(
          "/one/members/edit-legacy",
          "PATCH",
          { position: "New Private Job", teamId: "alpha" },
          "root",
        )
        assert.ok(payload.user)
        let rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 2)
        assert.equal(rows.filter((row) => row.action === "CREATED").length, 1)
        assert.deepEqual(
          (
            rows.find((row) => row.action === "CREATED")!.changes as {
              teamId: unknown
            }
          ).teamId,
          { before: null, after: "alpha" },
        )
        await prisma.employee.update({
          where: { userId: "edit-legacy" },
          data: { position: "Another Private Job" },
        })
        count = (await events()).length
        await mutate("/one/members/edit-legacy", "PATCH", {
          position: "Another Private Job",
        })
        rows = (await events()).slice(count)
        assert.equal(rows.length, 1)
        assert.equal(rows[0].action, "PROFILE_UPDATED")
        assert.deepEqual(rows[0].changedFields, ["position"])
        await account("legacy-super", "SUPERADMIN")
        await prisma.user.update({
          where: { id: "legacy-super" },
          data: { departmentId: "one" },
        })
        count = (await events()).length
        await mutate(
          "/one/members/legacy-super",
          "PATCH",
          { position: "New Private Job" },
          "root",
        )
        rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].subjectType, "DEPARTMENT")
        assert.deepEqual(rows[0].changedFields, ["position"])
        assert.deepEqual(rows[0].changes, { affectedAccountId: "legacy-super" })
        assert.equal(
          await prisma.employee.count({ where: { userId: "legacy-super" } }),
          0,
        )
      },
    )

    await t.test(
      "Employee and legacy removals preserve accounts, capture assignment clearing and real Employee creation only",
      async () => {
        await member("remove-backed", "one", "alpha")
        await member("remove-legacy", "one", "beta", false)
        await member("remove-via-user", "one", "alpha")
        for (const [id, actor, birth] of [
          ["hr-remove-backed", "admin", false],
          ["remove-via-user", "root", false],
          ["remove-legacy", "root", true],
        ] as const) {
          const count = (await events()).length
          const response = await mutate(
            `/one/members/${id}`,
            "DELETE",
            {},
            actor,
          )
          assert.equal(response.message, "Employee removed from department")
          const rows = (await events()).slice(count)
          trusted(rows, actor)
          assert.equal(rows.length, 2)
          assert.equal(
            rows.some((row) => row.action === "CREATED"),
            birth,
          )
          const event = rows.find((row) => row.subjectType === "EMPLOYEE")!
          const employee = await prisma.employee.findUniqueOrThrow({
            where: { id: event.subjectId },
          })
          assert.equal(employee.departmentId, null)
          assert.equal(employee.teamId, null)
          assert.ok(employee.userId)
          assert.equal(
            (
              await prisma.user.findUniqueOrThrow({
                where: { id: employee.userId },
              })
            ).isActive,
            true,
          )
        }
        assert.equal(await prisma.accountManagementChange.count(), 0)
      },
    )

    await t.test(
      "unlinked Employees can be edited and removed without fabricated User or Account events",
      async () => {
        await prisma.employee.create({
          data: {
            id: "unlinked",
            employeeId: "EXP-unlinked",
            fullName: "Private Name Sentinel",
            position: "Private Job Sentinel",
            departmentId: "one",
            teamId: "beta",
          },
        })
        let count = (await events()).length
        await mutate(
          "/one/members/unlinked",
          "PATCH",
          { position: "New Private Job", teamId: null },
          "root",
        )
        let rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 2)
        assert.ok(
          rows.every(
            (row) =>
              row.subjectType === "EMPLOYEE" && row.subjectId === "unlinked",
          ),
        )
        count = (await events()).length
        await mutate("/one/members/unlinked", "PATCH")
        assert.equal((await events()).length, count)
        await mutate("/one/members/unlinked", "DELETE")
        rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.deepEqual(rows[0].changes, {
          departmentId: { before: "one", after: null },
        })
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: "unlinked" },
            })
          ).userId,
          null,
        )
      },
    )

    await t.test(
      "protected Heads, Team Leads, invalid scopes and ineligible assignments remain denied with no history",
      async () => {
        await member("lead", "one", "alpha")
        await prisma.team.update({
          where: { id: "alpha" },
          data: { leadId: "lead" },
        })
        await member("outside", "two")
        await member("ineligible")
        await prisma.employee.update({
          where: { id: "hr-ineligible" },
          data: { status: "INACTIVE" },
        })
        const before = await snapshot()
        for (const [path, method, body, status] of [
          ["/one/members/hr-head", "DELETE", {}, 400],
          ["/one/members/head", "DELETE", {}, 400],
          ["/one/members/hr-head", "PATCH", { teamId: "beta" }, 400],
          ["/one/members/head", "PATCH", { teamId: "beta" }, 400],
          ["/one/members/hr-lead", "DELETE", {}, 409],
          ["/one/members/hr-lead", "PATCH", { teamId: "beta" }, 409],
          [
            "/one/members/hr-edit",
            "PATCH",
            { position: "Department Head" },
            400,
          ],
          ["/one/members/hr-edit", "PATCH", { teamId: "other-team" }, 400],
          ["/one/members", "POST", { employeeIds: ["hr-outside"] }, 400],
          ["/one/members", "POST", { userIds: ["outside"] }, 400],
          ["/one/members", "POST", { employeeIds: ["hr-ineligible"] }, 400],
          ["/one/members", "POST", { userIds: ["root"] }, 400],
          ["/one/members", "POST", {}, 400],
          ["/missing/members", "POST", { userIds: ["staff"] }, 404],
          [
            "/one/members/hr-outside",
            "PATCH",
            { position: "Valid title" },
            404,
          ],
          ["/one/members/missing", "DELETE", {}, 404],
        ] as const) {
          const response = await request(path, method, body)
          assert.equal(response.status, status, await response.text())
        }
        assert.deepEqual(await snapshot(), before)
      },
    )

    await t.test(
      "all three endpoints deny Staff, Heads, Clients, unauthenticated, inactive and retired actors",
      async () => {
        const before = await snapshot()
        for (const actor of [
          null,
          "staff",
          "head",
          "client",
          "inactive",
          "retired",
        ]) {
          for (const [path, method, body] of [
            ["/one/members", "POST", { userIds: ["staff"] }],
            ["/one/members/hr-edit", "PATCH", { position: "Denied title" }],
            ["/one/members/hr-edit", "DELETE", {}],
          ] as const) {
            const response = await request(path, method, body, actor)
            assert.equal(
              response.status,
              actor && !["inactive", "retired"].includes(actor) ? 403 : 401,
              await response.text(),
            )
          }
        }
        assert.deepEqual(await snapshot(), before)
      },
    )

    await t.test(
      "late history failure rolls back every member path, legacy creation, synchronization and earlier history",
      async () => {
        await member("rollback-assign")
        await member("rollback-assign-legacy", null, null, false)
        await member("rollback-update", "one", "alpha")
        await member("rollback-update-legacy", "one", null, false)
        await member("rollback-remove", "one", "beta")
        await member("rollback-remove-legacy", "one", "alpha", false)
        await db.exec(
          `CREATE FUNCTION reject_member_history() RETURNS trigger AS $$ BEGIN IF NEW."subjectType" = 'DEPARTMENT' THEN RAISE EXCEPTION 'late member history failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_member_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW WHEN (NEW.origin = 'DEPARTMENT_MANAGEMENT') EXECUTE FUNCTION reject_member_history();`,
        )
        try {
          for (const [path, method, body] of [
            [
              "/one/members",
              "POST",
              {
                employeeIds: ["hr-rollback-assign"],
                userIds: ["rollback-assign-legacy"],
              },
            ],
            [
              "/one/members/hr-rollback-update",
              "PATCH",
              { teamId: "beta", position: "New Private Job" },
            ],
            [
              "/one/members/rollback-update-legacy",
              "PATCH",
              { teamId: "alpha", position: "New Private Job" },
            ],
            ["/one/members/hr-rollback-remove", "DELETE", {}],
            ["/one/members/rollback-remove-legacy", "DELETE", {}],
          ] as const) {
            const before = await snapshot()
            const response = await request(path, method, body)
            assert.equal(response.status, 500, await response.text())
            assert.deepEqual(await snapshot(), before)
          }
        } finally {
          await db.exec(
            `DROP TRIGGER reject_member_history ON "WorkforceManagementChange"; DROP FUNCTION reject_member_history();`,
          )
        }
      },
    )

    await t.test(
      "transaction conflict creates no success history; overlapping no-ops, unrelated records and GET privacy stay intact",
      async () => {
        await member("conflict", "one")
        let before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_member_conflict() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'controlled member conflict' USING ERRCODE = '40001'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_member_conflict BEFORE UPDATE ON "Employee" FOR EACH ROW WHEN (OLD.id = 'hr-conflict') EXECUTE FUNCTION reject_member_conflict();`,
        )
        try {
          const response = await request("/one/members/hr-conflict", "PATCH", {
            position: "New Private Job",
          })
          assert.equal(response.status, 409, await response.text())
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER reject_member_conflict ON "Employee"; DROP FUNCTION reject_member_conflict();`,
          )
        }
        await member("overlap")
        const count = (await events()).length
        const responses = await Promise.all([
          request("/one/members", "POST", { employeeIds: ["hr-overlap"] }),
          request(
            "/one/members",
            "POST",
            { employeeIds: ["hr-overlap"] },
            "root",
          ),
        ])
        for (const response of responses)
          assert.equal(response.status, 200, await response.text())
        assert.equal((await events()).length, count + 2)
        const unrelatedBefore = before.users.find(
          (row) => row.id === "unrelated",
        )
        assert.deepEqual(
          await prisma.user.findUnique({ where: { id: "unrelated" } }),
          unrelatedBefore,
        )
        const after = await snapshot()
        assert.deepEqual(
          after.employees.find((row) => row.id === "hr-unrelated"),
          before.employees.find((row) => row.id === "hr-unrelated"),
        )
        assert.deepEqual(after.departments, before.departments)
        assert.deepEqual(after.teams, before.teams)
        before = await snapshot()
        for (let i = 0; i < 2; i++)
          for (const path of ["/one", "/two"])
            assert.equal((await request(path, "GET")).status, 200)
        assert.equal((await request("/one", "GET", {}, "staff")).status, 403)
        assert.deepEqual(await snapshot(), before)
        assert.equal(
          await prisma.employee.count({
            where: { userId: { in: ["root", "admin", "legacy-super"] } },
          }),
          0,
        )
        const serialized = JSON.stringify(await events())
        for (const secret of [
          "Private Name Sentinel",
          "Private Job Sentinel",
          "New Private Job",
          "Another Private Job",
          "Stale Private Job",
          "Private Credential Sentinel",
          "09123456789",
          "@member-attribution.test",
          "Forbidden Secret",
          "passwordHash",
          "accessToken",
        ])
          assert.equal(serialized.includes(secret), false, secret)
      },
    )
  },
)
