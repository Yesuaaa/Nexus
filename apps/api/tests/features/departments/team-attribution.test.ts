import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Team mutations attribute actual leadership, membership and synchronization effects atomically",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const tokens = new Map<string, string>()
    async function account(id: string, role: Role = "STAFF") {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@team-attribution.test`,
          passwordHash: "Private Credential Sentinel",
          fullName: "Private Name Sentinel",
          position: "Private Job Sentinel",
          contactNumber: "09123456789",
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
    await prisma.team.create({
      data: { id: "other-team", name: "Other team", departmentId: "two" },
    })
    async function member(
      id: string,
      teamId: string | null = null,
      employee = true,
      departmentId: string | null = "one",
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
            fullName: "Private Name Sentinel",
            position: "Private Job Sentinel",
          },
        })
    }
    await member("head")
    await prisma.department.update({
      where: { id: "one" },
      data: { headId: "head" },
    })
    await member("unrelated", "other-team", true, "two")
    async function fixture(id: string, legacy = false) {
      const team = await prisma.team.create({
        data: { id, name: id, departmentId: "one" },
      })
      await member(`${id}-lead`, id, !legacy)
      await prisma.team.update({
        where: { id },
        data: { leadId: `${id}-lead` },
      })
      return team
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
      assert.equal(
        response.status,
        method === "POST" ? 201 : 200,
        await response.clone().text(),
      )
      return (await response.json()) as {
        team: { id: string; memberCount: number }
        message?: string
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
        assert.equal(row.origin, "TEAM_MANAGEMENT")
        assert.notEqual(row.operationId, "forged-operation")
        assert.notEqual(row.createdAt.toISOString(), "2000-01-01T00:00:00.000Z")
      }
    }

    await t.test(
      "creation without Lead/members records safe Team identity and authenticated Admin",
      async () => {
        const count = (await events()).length
        const payload = await mutate("/one/teams", "POST", {
          name: "  Empty created  ",
          description: "Private Description Sentinel",
        })
        const rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].action, "CREATED")
        assert.equal(rows[0].subjectType, "TEAM")
        assert.equal(rows[0].subjectId, payload.team.id)
        assert.deepEqual(rows[0].changes, {
          departmentId: { before: null, after: "one" },
        })
        assert.equal(payload.team.memberCount, 0)
      },
    )

    await t.test(
      "creation with initial Lead and overlapping member identity emits no duplicate effects",
      async () => {
        await member("create-lead")
        await member("create-member")
        const count = (await events()).length
        const payload = await mutate(
          "/one/teams",
          "POST",
          {
            name: "Lead and members",
            leadId: "create-lead",
            memberIds: ["hr-create-lead", "hr-create-member"],
          },
          "root",
        )
        const rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 5)
        assert.equal(payload.team.memberCount, 2)
        assert.deepEqual(
          rows.find((row) => row.action === "CREATED")!.changes,
          {
            departmentId: { before: null, after: "one" },
            leadId: { before: null, after: "create-lead" },
          },
        )
        for (const id of ["create-lead", "create-member"]) {
          const assignments = rows.filter((row) => row.subjectId === `hr-${id}`)
          assert.equal(assignments.length, 1)
          assert.deepEqual(assignments[0].changes, {
            teamId: { before: null, after: payload.team.id },
          })
        }
        assert.equal(
          rows.some((row) => row.action === "LEAD_CHANGED"),
          false,
        )
      },
    )

    await t.test(
      "metadata, no-op and metadata-only old Lead synchronization capture actual persisted differences",
      async () => {
        await fixture("metadata")
        let count = (await events()).length
        await mutate("/one/teams/metadata", "PUT", {
          name: " Renamed ",
          description: "Private Description Sentinel",
        })
        let rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].action, "PROFILE_UPDATED")
        assert.deepEqual(
          new Set(rows[0].changedFields),
          new Set(["name", "description"]),
        )
        assert.deepEqual(rows[0].changes, {})
        count = (await events()).length
        await mutate("/one/teams/metadata", "PUT", {
          name: "Renamed",
          description: "Private Description Sentinel",
        })
        await mutate("/one/teams/metadata", "PUT")
        assert.equal((await events()).length, count)
        await prisma.employee.update({
          where: { id: "hr-metadata-lead" },
          data: { position: "Stale Private Job" },
        })
        await mutate("/one/teams/metadata", "PUT", {}, "root")
        rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].subjectId, "hr-metadata-lead")
        assert.deepEqual(rows[0].changedFields, ["position"])
        await prisma.employee.delete({ where: { id: "hr-metadata-lead" } })
        count = (await events()).length
        await mutate("/one/teams/metadata", "PUT")
        rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].action, "CREATED")
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "metadata-lead" },
        })
        assert.equal(rows[0].subjectId, employee.id)
        assert.deepEqual((rows[0].changes as { teamId: unknown }).teamId, {
          before: null,
          after: "metadata",
        })
      },
    )

    await t.test(
      "Lead replacement, removal and overlapping updates use transaction-local before-state without removing old members",
      async () => {
        await fixture("lead-change")
        await member("replacement")
        let count = (await events()).length
        await mutate(
          "/one/teams/lead-change",
          "PUT",
          { leadId: "replacement" },
          "root",
        )
        let rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 3)
        assert.deepEqual(
          rows.find((row) => row.action === "LEAD_CHANGED")!.changes,
          { leadId: { before: "lead-change-lead", after: "replacement" } },
        )
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "lead-change-lead" },
            })
          ).teamId,
          "lead-change",
        )
        count = (await events()).length
        await mutate("/one/teams/lead-change", "PUT", { leadId: null })
        rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.deepEqual(rows[0].changes, {
          leadId: { before: "replacement", after: null },
        })
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { userId: "replacement" },
            })
          ).teamId,
          "lead-change",
        )
        for (const id of ["concurrent-a", "concurrent-b"]) await member(id)
        count = (await events()).length
        const responses = await Promise.all([
          request("/one/teams/lead-change", "PUT", { leadId: "concurrent-a" }),
          request(
            "/one/teams/lead-change",
            "PUT",
            { leadId: "concurrent-b" },
            "root",
          ),
        ])
        for (const response of responses)
          assert.equal(response.status, 200, await response.text())
        rows = (await events()).slice(count)
        const leads = rows.filter((row) => row.action === "LEAD_CHANGED")
        assert.equal(leads.length, 2)
        const transitions = leads.map(
          (row) =>
            row.changes as { leadId: { before: string | null; after: string } },
        )
        const first = transitions.find((row) => row.leadId.before === null)!
        const second = transitions.find(
          (row) => row.leadId.before === first.leadId.after,
        )!
        assert.ok(second)
        assert.equal(
          (
            await prisma.team.findUniqueOrThrow({
              where: { id: "lead-change" },
            })
          ).leadId,
          second.leadId.after,
        )
        assert.equal(new Set(rows.map((row) => row.operationId)).size, 2)
      },
    )

    await t.test(
      "empty and populated deletion capture real membership, legacy birth and cleanup without deleting accounts",
      async () => {
        await prisma.team.create({
          data: {
            id: "empty-delete",
            name: "Empty delete",
            departmentId: "one",
          },
        })
        let count = (await events()).length
        assert.equal(
          (await mutate("/one/teams/empty-delete", "DELETE")).message,
          "Team deleted successfully",
        )
        let rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.deepEqual(rows[0].changes, {
          departmentId: { before: "one", after: null },
        })
        await fixture("populated-delete")
        await member("legacy-delete", "populated-delete", false)
        await member("cross-sync", "populated-delete")
        await prisma.employee.update({
          where: { id: "hr-cross-sync" },
          data: {
            departmentId: "two",
            teamId: "other-team",
            position: "Stale Private Job",
          },
        })
        await member("employee-only", "other-team", true, "two")
        await prisma.employee.update({
          where: { id: "hr-employee-only" },
          data: { teamId: "populated-delete" },
        })
        await prisma.employee.create({
          data: {
            id: "unlinked",
            employeeId: "EXP-unlinked",
            fullName: "Private Name Sentinel",
            departmentId: "one",
            teamId: "populated-delete",
            status: "INACTIVE",
          },
        })
        await account("legacy-super", "SUPERADMIN")
        await prisma.user.update({
          where: { id: "legacy-super" },
          data: { departmentId: "one", teamId: "populated-delete" },
        })
        await account("client-team-only", "USER")
        await prisma.user.update({
          where: { id: "client-team-only" },
          data: { teamId: "populated-delete" },
        })
        const before = await snapshot()
        count = before.history.length
        await mutate("/one/teams/populated-delete", "DELETE", {}, "root")
        rows = (await events()).slice(count)
        trusted(rows, "root")
        const deletion = rows.find((row) => row.action === "DELETED")!
        assert.equal(rows.filter((row) => row.action === "DELETED").length, 1)
        assert.deepEqual(deletion.changes, {
          departmentId: { before: "one", after: null },
          leadId: { before: "populated-delete-lead", after: null },
        })
        assert.equal(
          await prisma.team.findUnique({ where: { id: "populated-delete" } }),
          null,
        )
        const after = await snapshot()
        assert.equal(after.users.length, before.users.length)
        assert.equal(after.employees.length, before.employees.length + 1)
        assert.deepEqual(after.departments, before.departments)
        assert.equal(rows.filter((row) => row.action === "CREATED").length, 1)
        assert.equal(
          rows.filter((row) => row.action === "PROFILE_UPDATED").length,
          1,
        )
        assert.deepEqual(
          rows.find(
            (row) =>
              row.subjectId === "hr-cross-sync" &&
              row.action === "ASSIGNMENT_CHANGED",
          )!.changes,
          {
            departmentId: { before: "two", after: "one" },
            teamId: { before: "other-team", after: null },
          },
        )
        assert.deepEqual(
          rows.find((row) => row.subjectId === "unlinked")!.changes,
          { teamId: { before: "populated-delete", after: null } },
        )
        assert.deepEqual(
          rows.find((row) => row.subjectId === "hr-employee-only")!.changes,
          { teamId: { before: "populated-delete", after: null } },
        )
        assert.deepEqual(
          after.users.find((row) => row.id === "employee-only"),
          before.users.find((row) => row.id === "employee-only"),
        )
        assert.equal(
          rows.some(
            (row) =>
              (row.changes as { affectedAccountId?: string })
                .affectedAccountId === "employee-only",
          ),
          false,
        )
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: "unlinked" },
            })
          ).status,
          "INACTIVE",
        )
        for (const previous of before.users) {
          const current = after.users.find((row) => row.id === previous.id)!
          assert.equal(current.position, previous.position)
          assert.equal(current.isActive, previous.isActive)
          assert.equal(current.role, previous.role)
        }
        assert.equal(
          await prisma.employee.count({
            where: {
              userId: {
                in: ["root", "admin", "legacy-super", "client-team-only"],
              },
            },
          }),
          0,
        )
        for (const [key, id] of [
          ["users", "unrelated"],
          ["employees", "hr-unrelated"],
          ["teams", "other-team"],
        ] as const)
          assert.deepEqual(
            after[key].find((row) => row.id === id),
            before[key].find((row) => row.id === id),
          )
      },
    )

    await t.test(
      "authorization, Head/Lead eligibility, invalid members and scoped conflicts preserve state and history",
      async () => {
        await fixture("protected")
        await member("no-employee", null, false)
        await member("inactive-target")
        await prisma.employee.update({
          where: { id: "hr-inactive-target" },
          data: { status: "INACTIVE" },
        })
        const before = await snapshot()
        for (const actor of [
          null,
          "staff",
          "head",
          "client",
          "inactive",
          "retired",
        ])
          for (const [path, method, body] of [
            ["/one/teams", "POST", { name: "Denied" }],
            ["/one/teams/protected", "PUT", { name: "Denied" }],
            ["/one/teams/protected", "DELETE", {}],
          ] as const) {
            const response = await request(path, method, body, actor)
            assert.equal(
              response.status,
              actor && !["inactive", "retired"].includes(actor) ? 403 : 401,
              await response.text(),
            )
          }
        for (const [path, method, body, statuses] of [
          ["/missing/teams", "POST", { name: "Valid" }, [404]],
          ["/two/teams/protected", "PUT", {}, [404]],
          ["/two/teams/protected", "DELETE", {}, [404]],
          ["/one/teams", "POST", { name: "x" }, [400]],
          [
            "/one/teams",
            "POST",
            { name: "Duplicate member", memberIds: ["hr-head", "hr-head"] },
            [400],
          ],
          [
            "/one/teams",
            "POST",
            { name: "Head member", memberIds: ["hr-head"] },
            [400],
          ],
          [
            "/one/teams",
            "POST",
            { name: "Invalid member", memberIds: ["hr-inactive-target"] },
            [400],
          ],
          [
            "/one/teams",
            "POST",
            { name: "Protected Lead member", memberIds: ["hr-protected-lead"] },
            [409],
          ],
          ["/one/teams", "POST", { name: "Not Staff", leadId: "root" }, [400]],
          [
            "/one/teams",
            "POST",
            { name: "No Employee", leadId: "no-employee" },
            [400],
          ],
          [
            "/one/teams",
            "POST",
            { name: "Inactive Lead", leadId: "inactive-target" },
            [400],
          ],
          ["/one/teams", "POST", { name: "Head Lead", leadId: "head" }, [400]],
          ["/one/teams", "POST", { name: "protected" }, [409]],
          ["/one/teams/protected", "PUT", { name: "x" }, [400]],
          ["/one/teams/protected", "PUT", { leadId: "create-lead" }, [409]],
        ] as const) {
          const response = await request(path, method, body)
          assert.ok(
            (statuses as readonly number[]).includes(response.status),
            `${path}: ${response.status} ${await response.text()}`,
          )
        }
        assert.deepEqual(await snapshot(), before)
      },
    )

    await t.test(
      "late Team history failures roll back creation, replacement, legacy birth, deletion and earlier history",
      async () => {
        await member("rollback-create-lead")
        await member("rollback-create-member")
        await fixture("rollback-update", true)
        await member("rollback-new-lead")
        await fixture("rollback-delete")
        await member("rollback-delete-legacy", "rollback-delete", false)
        await db.exec(
          `CREATE FUNCTION reject_team_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'late Team history failure'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_team_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW WHEN (NEW.origin = 'TEAM_MANAGEMENT' AND NEW."subjectType" = 'TEAM') EXECUTE FUNCTION reject_team_history();`,
        )
        try {
          for (const [path, method, body] of [
            [
              "/one/teams",
              "POST",
              {
                name: "Must rollback",
                leadId: "rollback-create-lead",
                memberIds: ["hr-rollback-create-member"],
              },
            ],
            [
              "/one/teams/rollback-update",
              "PUT",
              { name: "Must rollback", leadId: "rollback-new-lead" },
            ],
            [
              "/one/teams/rollback-update",
              "PUT",
              { name: "Must rollback metadata" },
            ],
            ["/one/teams/rollback-delete", "DELETE", {}],
          ] as const) {
            const before = await snapshot()
            const response = await request(path, method, body)
            assert.equal(response.status, 500, await response.text())
            assert.deepEqual(await snapshot(), before)
          }
        } finally {
          await db.exec(
            `DROP TRIGGER reject_team_history ON "WorkforceManagementChange"; DROP FUNCTION reject_team_history();`,
          )
        }
      },
    )

    await t.test(
      "controlled transaction conflicts produce no success history and GET remains observational",
      async () => {
        await member("conflict-member")
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_team_conflict() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'controlled Team conflict' USING ERRCODE = '40001'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_team_conflict BEFORE UPDATE ON "Employee" FOR EACH ROW WHEN (OLD.id = 'hr-conflict-member') EXECUTE FUNCTION reject_team_conflict();`,
        )
        try {
          const response = await request("/one/teams", "POST", {
            name: "Conflict team",
            memberIds: ["hr-conflict-member"],
          })
          assert.equal(response.status, 409, await response.text())
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER reject_team_conflict ON "Employee"; DROP FUNCTION reject_team_conflict();`,
          )
        }
        for (let i = 0; i < 2; i++)
          for (const path of ["/one", "/two", ""])
            assert.equal((await request(path, "GET")).status, 200)
        assert.equal((await request("/one", "GET", {}, "staff")).status, 403)
        assert.deepEqual(await snapshot(), before)
      },
    )

    await t.test(
      "history excludes sensitive values and survives deletion of subjects and administrators",
      async () => {
        assert.equal(await prisma.accountManagementChange.count(), 0)
        const history = await events()
        assert.ok(
          history.some(
            (row) =>
              row.action === "DELETED" && row.subjectId === "populated-delete",
          ),
        )
        const serialized = JSON.stringify(history)
        for (const secret of [
          "Private Name Sentinel",
          "Private Job Sentinel",
          "Stale Private Job",
          "Private Credential Sentinel",
          "Private Description Sentinel",
          "09123456789",
          "@team-attribution.test",
          "Forbidden Secret",
          "passwordHash",
          "accessToken",
        ])
          assert.equal(serialized.includes(secret), false, secret)
        await prisma.user.deleteMany({
          where: { id: { in: ["admin", "root"] } },
        })
        assert.deepEqual(await events(), history)
      },
    )
  },
)
