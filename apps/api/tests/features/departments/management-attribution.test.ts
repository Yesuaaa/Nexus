import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Department creation and updates attribute actual effects atomically",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const tokens = new Map<string, string>()
    async function account(id: string, role: Role = "STAFF") {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@department-attribution.test`,
          fullName: "Private Name Sentinel",
          position: "Private Title Sentinel",
          passwordHash: "Private Credential Sentinel",
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
    ] as const)
      await account(id, role)
    async function member(
      id: string,
      departmentId: string | null,
      teamId: string | null = null,
      position = "Department Head",
    ) {
      await account(id)
      await prisma.user.update({
        where: { id },
        data: { departmentId, teamId, position },
      })
      return prisma.employee.create({
        data: {
          id: `hr-${id}`,
          employeeId: `EXP-${id}`,
          userId: id,
          fullName: "Private Name Sentinel",
          position,
          departmentId,
          teamId,
        },
      })
    }
    function request(
      path: string,
      method = "GET",
      body?: unknown,
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
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }
    async function mutate(
      path: string,
      method: string,
      body: unknown,
      actor = "admin",
    ) {
      const response = await request(path, method, body, actor)
      assert.equal(
        response.status,
        method === "POST" ? 201 : 200,
        await response.clone().text(),
      )
      return ((await response.json()) as { department: { id: string } })
        .department.id
    }
    const events = () =>
      prisma.workforceManagementChange.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    async function snapshot() {
      return {
        departments: await prisma.department.findMany({
          orderBy: { id: "asc" },
        }),
        users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
        employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
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
    const forgery = {
      actorAccountId: "client",
      actorRoleAtTime: "USER",
      operationId: "forged-operation",
      createdAt: "2000-01-01T00:00:00Z",
      history: { password: "Forbidden Secret" },
    }

    await t.test(
      "creation without a Head records safe metadata and authenticated Admin",
      async () => {
        const count = (await events()).length
        const id = await mutate("", "POST", {
          name: "  New directory  ",
          code: " new ",
          description: "Private Description Sentinel",
          ...forgery,
        })
        const rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].subjectId, id)
        assert.equal(rows[0].action, "CREATED")
        assert.deepEqual(
          new Set(rows[0].changedFields),
          new Set(["name", "code", "color", "description"]),
        )
        assert.deepEqual(rows[0].changes, {})
        assert.equal(
          (await prisma.department.findUniqueOrThrow({ where: { id } })).code,
          "NEW",
        )
      },
    )

    await t.test(
      "creation with an eligible Head records Employee and User assignment under one operation",
      async () => {
        await member("initial", null)
        const count = (await events()).length
        const id = await mutate(
          "",
          "POST",
          { name: "Initial Head", headId: "initial", ...forgery },
          "root",
        )
        const rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 3)
        const creation = rows.find((row) => row.action === "CREATED")!
        assert.deepEqual(creation.changes, {
          headId: { before: null, after: "initial" },
        })
        for (const type of ["EMPLOYEE", "DEPARTMENT"] as const) {
          const assignment = rows.find(
            (row) =>
              row.action === "ASSIGNMENT_CHANGED" && row.subjectType === type,
          )!
          assert.deepEqual(assignment.changes, {
            departmentId: { before: null, after: id },
            ...(type === "DEPARTMENT" ? { affectedAccountId: "initial" } : {}),
          })
        }
        assert.equal(await prisma.accountManagementChange.count(), 0)
        assert.equal(
          await prisma.employee.count({
            where: { userId: { in: ["root", "admin"] } },
          }),
          0,
        )
      },
    )

    await t.test(
      "metadata normalization and repeated no-op updates emit only actual changes",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Metadata", code: "META" },
        })
        const count = (await events()).length
        await mutate(`/${dept.id}`, "PUT", {
          name: "  Metadata  ",
          code: "meta",
          color: "blue",
        })
        assert.equal((await events()).length, count)
        await mutate(
          `/${dept.id}`,
          "PUT",
          {
            name: "Renamed",
            code: " next ",
            color: "teal",
            description: "Private Description Sentinel",
            ...forgery,
          },
          "root",
        )
        const rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].action, "PROFILE_UPDATED")
        assert.deepEqual(
          new Set(rows[0].changedFields),
          new Set(["name", "code", "color", "description"]),
        )
        assert.deepEqual(rows[0].changes, {})
        await mutate(`/${dept.id}`, "PUT", {
          name: "Renamed",
          code: "NEXT",
          color: "teal",
          description: "Private Description Sentinel",
        })
        assert.equal((await events()).length, count + 1)
      },
    )

    await t.test(
      "assignment and same-Head normalization capture sub-team and stale Employee synchronization",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Assignment" },
        })
        const team = await prisma.team.create({
          data: { name: "Sub-team", departmentId: dept.id },
        })
        await member("assigned", dept.id, team.id, "Private Title Sentinel")
        let count = (await events()).length
        await mutate(`/${dept.id}`, "PUT", { headId: "assigned" })
        let rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 3)
        assert.ok(rows.some((row) => row.action === "HEAD_CHANGED"))
        for (const subjectType of ["EMPLOYEE", "DEPARTMENT"] as const) {
          const assignment = rows.find(
            (row) =>
              row.action === "ASSIGNMENT_CHANGED" &&
              row.subjectType === subjectType,
          )!
          assert.deepEqual(assignment.changes, {
            teamId: { before: team.id, after: null },
            ...(subjectType === "DEPARTMENT"
              ? { affectedAccountId: "assigned" }
              : {}),
          })
        }
        await prisma.user.update({
          where: { id: "assigned" },
          data: { teamId: team.id },
        })
        await prisma.employee.update({
          where: { id: "hr-assigned" },
          data: {
            teamId: team.id,
            departmentId: null,
            position: "Stale Private Title",
          },
        })
        count = (await events()).length
        await mutate(`/${dept.id}`, "PUT", { headId: "assigned" }, "root")
        rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 3)
        assert.ok(!rows.some((row) => row.action === "HEAD_CHANGED"))
        assert.ok(
          rows.some(
            (row) =>
              row.action === "PROFILE_UPDATED" &&
              row.changedFields.includes("position"),
          ),
        )
        const after = await prisma.employee.findUniqueOrThrow({
          where: { id: "hr-assigned" },
        })
        assert.equal(after.departmentId, dept.id)
        assert.equal(after.teamId, null)
        assert.equal(after.position, "Private Title Sentinel")
        count = (await events()).length
        await mutate(`/${dept.id}`, "PUT", { headId: "assigned" })
        assert.equal((await events()).length, count)
        assert.equal(
          (await prisma.team.findUniqueOrThrow({ where: { id: team.id } }))
            .leadId,
          null,
        )
      },
    )

    await t.test(
      "explicit replacement clears temporary reservations and displaced titles; removal stays accurate",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Temporary" },
        })
        for (const id of ["original", "temporary", "replacement"])
          await member(id, dept.id)
        await prisma.department.update({
          where: { id: dept.id },
          data: {
            headId: "temporary",
            temporaryHeadOriginalId: "original",
            temporaryHeadAssignedId: "temporary",
          },
        })
        let count = (await events()).length
        await mutate(`/${dept.id}`, "PUT", { headId: "replacement" }, "root")
        let rows = (await events()).slice(count)
        trusted(rows, "root")
        assert.equal(rows.length, 3)
        assert.deepEqual(
          new Set(
            rows
              .filter((row) => row.action === "TITLE_CLEARED")
              .map((row) => row.subjectId),
          ),
          new Set(["hr-original", "hr-temporary"]),
        )
        assert.deepEqual(
          rows.find((row) => row.action === "HEAD_CHANGED")!.changes,
          {
            headId: { before: "temporary", after: "replacement" },
            temporaryHeadOriginalId: { before: "original", after: null },
            temporaryHeadAssignedId: { before: "temporary", after: null },
          },
        )
        for (const id of ["original", "temporary"]) {
          assert.equal(
            (await prisma.user.findUniqueOrThrow({ where: { id } })).position,
            null,
          )
          assert.equal(
            (await prisma.employee.findUniqueOrThrow({ where: { userId: id } }))
              .position,
            null,
          )
        }
        count = (await events()).length
        await mutate(`/${dept.id}`, "PUT", { headId: null })
        rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 2)
        assert.deepEqual(
          rows.find((row) => row.action === "HEAD_CHANGED")!.changes,
          { headId: { before: "replacement", after: null } },
        )
      },
    )

    await t.test(
      "legacy displaced User gets real Employee creation and one title correction, never an Account creation",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Legacy" },
        })
        await account("legacy")
        await prisma.user.update({
          where: { id: "legacy" },
          data: { departmentId: dept.id, position: "Department Head" },
        })
        await prisma.department.update({
          where: { id: dept.id },
          data: { headId: "legacy" },
        })
        const count = (await events()).length
        await mutate(`/${dept.id}`, "PUT", { headId: null })
        const rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 3)
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "legacy" },
        })
        assert.equal(employee.position, null)
        const creation = rows.find((row) => row.action === "CREATED")!
        assert.equal(creation.subjectId, employee.id)
        assert.deepEqual(creation.changes, {
          userId: { before: null, after: "legacy" },
          departmentId: { before: null, after: dept.id },
          teamId: { before: null, after: null },
          status: { before: null, after: "ACTIVE" },
          employmentType: { before: null, after: "FULL_TIME" },
        })
        assert.deepEqual(
          rows.find((row) => row.action === "TITLE_CLEARED")!.changes,
          { affectedAccountId: "legacy", cause: "FORMER_DEPARTMENT_HEAD" },
        )
        assert.equal(await prisma.accountManagementChange.count(), 0)
      },
    )

    await t.test(
      "late history failure rolls back creation and all replacement effects plus prior history",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Rollback" },
        })
        const team = await prisma.team.create({
          data: { name: "Rollback team", departmentId: dept.id },
        })
        await member("rollback-old", dept.id)
        await member("rollback-new", dept.id, team.id)
        await member("rollback-initial", null)
        await prisma.department.update({
          where: { id: dept.id },
          data: {
            headId: "rollback-old",
            temporaryHeadOriginalId: "rollback-old",
            temporaryHeadAssignedId: "rollback-old",
          },
        })
        await db.exec(
          `CREATE FUNCTION reject_department_history() RETURNS trigger AS $$ BEGIN IF NEW.action IN ('HEAD_CHANGED', 'CREATED') AND NEW."subjectType" = 'DEPARTMENT' THEN RAISE EXCEPTION 'late department history failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_department_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW EXECUTE FUNCTION reject_department_history();`,
        )
        try {
          for (const [path, method, body] of [
            ["", "POST", { name: "No head must roll back" }],
            [
              "",
              "POST",
              { name: "Must roll back", headId: "rollback-initial" },
            ],
            [
              `/${dept.id}`,
              "PUT",
              { name: "Must roll back", headId: "rollback-new" },
            ],
          ] as const) {
            const before = await snapshot()
            const response = await request(path, method, body)
            assert.equal(response.status, 500, await response.text())
            assert.deepEqual(await snapshot(), before)
          }
        } finally {
          await db.exec(
            `DROP TRIGGER reject_department_history ON "WorkforceManagementChange"; DROP FUNCTION reject_department_history();`,
          )
        }
      },
    )

    await t.test(
      "denied, invalid, conflicting and failed mutations create no success history; GETs remain observational",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Protected" },
        })
        const other = await prisma.department.create({
          data: { name: "Other department" },
        })
        await member("other-department", other.id)
        await prisma.department.update({
          where: { id: dept.id },
          data: { headId: "staff" },
        })
        const before = await snapshot()
        for (const actor of [null, "staff", "client"]) {
          for (const [path, method, body] of [
            ["", "POST", { name: "Denied" }],
            [`/${dept.id}`, "PUT", { name: "Denied" }],
          ] as const) {
            const response = await request(path, method, body, actor)
            assert.equal(response.status, actor ? 403 : 401)
          }
        }
        for (const [path, method, body, status] of [
          ["", "POST", { name: "Protected" }, 409],
          [`/${dept.id}`, "PUT", { headId: "root" }, 400],
          [`/${dept.id}`, "PUT", { headId: "other-department" }, 400],
          [`/${dept.id}`, "PUT", { name: "x" }, 400],
          ["/missing", "PUT", { name: "Valid" }, 404],
        ] as const) {
          const response = await request(path, method, body)
          assert.equal(response.status, status, await response.text())
        }
        for (const path of [
          "",
          `/${dept.id}`,
          "/eligible-heads",
          "/employee-options",
        ]) {
          for (let i = 0; i < 2; i++)
            assert.equal((await request(path)).status, 200)
        }
        assert.deepEqual(await snapshot(), before)
        assert.equal(
          (await request(`/${dept.id}`, "GET", undefined, "staff")).status,
          403,
        )
      },
    )

    await t.test(
      "overlapping metadata writes record one actual transition and history contains no private values",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Overlapping" },
        })
        const count = (await events()).length
        const responses = await Promise.all([
          request(`/${dept.id}`, "PUT", { color: "teal" }),
          request(`/${dept.id}`, "PUT", { color: "teal" }, "root"),
        ])
        for (const response of responses)
          assert.equal(response.status, 200, await response.text())
        const rows = (await events()).slice(count)
        assert.equal(rows.length, 1)
        assert.equal(rows[0].action, "PROFILE_UPDATED")
        assert.deepEqual(rows[0].changedFields, ["color"])
        assert.equal(
          (
            await prisma.department.findUniqueOrThrow({
              where: { id: dept.id },
            })
          ).color,
          "teal",
        )
        const serialized = JSON.stringify(await events())
        for (const secret of [
          "Private Name Sentinel",
          "Private Title Sentinel",
          "Stale Private Title",
          "Private Credential Sentinel",
          "Private Description Sentinel",
          "09123456789",
          "@department-attribution.test",
          "Forbidden Secret",
          "passwordHash",
          "accessToken",
        ])
          assert.equal(serialized.includes(secret), false, secret)
      },
    )
  },
)
