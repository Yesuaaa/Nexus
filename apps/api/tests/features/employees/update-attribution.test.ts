import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Employee PUT attributes profile, synchronization and derived leadership effects atomically",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const tokens = new Map<string, string>()
    async function account(
      id: string,
      role: Role = "STAFF",
      inactive = false,
      retired = false,
    ) {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@update-attribution.test`,
          fullName: "Private Name Sentinel",
          contactNumber: "09123456789",
          position: "Private Job Sentinel",
          passwordHash: "Private Credential Sentinel",
          isActive: !inactive,
          accountDeletedAt: retired ? new Date() : null,
        },
      })
      tokens.set(id, (await issueSession(user)).token)
      return user
    }
    for (const [id, role] of [
      ["admin", "ADMIN"],
      ["root", "SUPERADMIN"],
      ["staff-actor", "STAFF"],
      ["head-actor", "STAFF"],
      ["client", "USER"],
    ] as const)
      await account(id, role)
    await account("inactive", "ADMIN", true)
    await account("retired", "SUPERADMIN", true, true)
    await prisma.department.create({
      data: { name: "Actor Head", headId: "head-actor" },
    })
    async function member(
      id: string,
      departmentId: string,
      position = "Private Job Sentinel",
      teamId: string | null = null,
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
          fullName: "Private Name Sentinel",
          email: `${id}@update-attribution.test`,
          contactNumber: "09123456789",
          position,
          userId: id,
          departmentId,
          teamId,
          startDate: new Date("2026-01-01"),
        },
      })
    }
    async function fixture(prefix: string, candidateTeam = false) {
      const department = await prisma.department.create({
        data: { id: prefix, name: prefix },
      })
      const team = await prisma.team.create({
        data: {
          id: `team-${prefix}`,
          name: prefix,
          departmentId: department.id,
        },
      })
      await member(`${prefix}-original`, prefix, "Department Head")
      await member(
        `${prefix}-deputy`,
        prefix,
        "Private Job Sentinel",
        candidateTeam ? team.id : null,
      )
      await member(`${prefix}-third`, prefix)
      await prisma.department.update({
        where: { id: prefix },
        data: { headId: `${prefix}-original` },
      })
      return { department, team }
    }
    function request(
      id: string,
      body: unknown,
      actor: string | null = "admin",
    ) {
      return fetch(`${base}/employees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(actor
            ? {
                Authorization: `Bearer ${tokens.get(actor)}`,
                "X-Actor-Id": "client",
              }
            : {}),
        },
        body: JSON.stringify(body),
      })
    }
    async function update(id: string, body: unknown, actor = "admin") {
      const response = await request(id, body, actor)
      assert.equal(response.status, 200, await response.clone().text())
      const payload = (await response.json()) as {
        employee: Record<string, unknown>
      }
      assert.equal("user" in payload.employee, false)
      assert.equal("userId" in payload.employee, false)
      return payload
    }
    const events = () =>
      prisma.workforceManagementChange.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      departments: await prisma.department.findMany({ orderBy: { id: "asc" } }),
      teams: await prisma.team.findMany({ orderBy: { id: "asc" } }),
      accounts: await prisma.accountManagementChange.findMany({
        orderBy: { id: "asc" },
      }),
      workforce: await events(),
    })
    async function operationAfter(before: number, actor: string) {
      const rows = (await events()).slice(before)
      assert.ok(rows.length)
      assert.equal(new Set(rows.map((r) => r.operationId)).size, 1)
      assert.ok(
        rows.every(
          (r) =>
            r.actorAccountId === actor &&
            r.actorRoleAtTime === (actor === "root" ? "SUPERADMIN" : "ADMIN") &&
            r.origin === "EMPLOYEE_MANAGEMENT",
        ),
      )
      return rows
    }
    const forged = {
      actorId: "client",
      actorAccountId: "staff-actor",
      actorRoleAtTime: "USER",
      operationId: randomUUID(),
      createdAt: "2000-01-01T00:00:00.000Z",
      changes: { passwordHash: "forged-credential" },
    }

    await t.test(
      "ordinary profile, employment and assignment changes use one trusted operation with no profile values",
      async () => {
        const first = await prisma.department.create({
          data: { name: "First" },
        })
        const second = await prisma.department.create({
          data: { name: "Second" },
        })
        const team = await prisma.team.create({
          data: { name: "Second team", departmentId: second.id },
        })
        await member("ordinary", first.id)
        const before = (await events()).length
        await update(
          "hr-ordinary",
          {
            ...forged,
            fullName: "Changed Private Name",
            email: "changed-private@update-attribution.test",
            contactNumber: "09987654321",
            position: "Changed Private Title",
            employmentType: "PART_TIME",
            startDate: "2026-02-01",
            status: "ON_LEAVE",
            departmentId: second.id,
            teamId: team.id,
          },
          "root",
        )
        const rows = await operationAfter(before, "root")
        assert.ok(
          rows.every(
            (r) =>
              r.operationId !== forged.operationId &&
              r.createdAt.toISOString() !== forged.createdAt,
          ),
        )
        assert.equal(rows.length, 4)
        const profile = rows.find((r) => r.action === "PROFILE_UPDATED")!
        assert.deepEqual(
          new Set(profile.changedFields),
          new Set([
            "fullName",
            "email",
            "contactNumber",
            "position",
            "employmentType",
            "startDate",
          ]),
        )
        assert.deepEqual(profile.changes, {
          employmentType: { before: "FULL_TIME", after: "PART_TIME" },
        })
        assert.deepEqual(
          rows.find((r) => r.action === "STATUS_CHANGED")!.changes,
          { status: { before: "ACTIVE", after: "ON_LEAVE" } },
        )
        assert.deepEqual(
          rows.find(
            (r) =>
              r.subjectType === "EMPLOYEE" && r.action === "ASSIGNMENT_CHANGED",
          )!.changes,
          {
            departmentId: { before: first.id, after: second.id },
            teamId: { before: null, after: team.id },
          },
        )
        assert.deepEqual(
          rows.find((r) => r.subjectType === "DEPARTMENT")!.changes,
          {
            affectedAccountId: "ordinary",
            departmentId: { before: first.id, after: second.id },
            teamId: { before: null, after: team.id },
          },
        )
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: "ordinary" },
        })
        assert.equal(user.isActive, true)
        assert.equal(user.passwordHash, "Private Credential Sentinel")
        assert.equal(
          await prisma.session.count({ where: { userId: user.id } }),
          1,
        )
        const count = (await events()).length
        await update("hr-ordinary", {})
        await update("hr-ordinary", {
          status: "ON_LEAVE",
          employmentType: "PART_TIME",
          position: "Changed Private Title",
          departmentId: second.id,
          teamId: team.id,
        })
        assert.equal((await events()).length, count)
        const unlinked = await prisma.employee.create({
          data: {
            employeeId: "EXP-unlinked",
            fullName: "Unlinked Private Name",
            position: "Unlinked Private Position",
            departmentId: first.id,
          },
        })
        const unlinkedBefore = (await events()).length
        await update(unlinked.id, {
          position: "Changed Private Title",
          employmentType: "CONTRACT",
        })
        const unlinkedRows = await operationAfter(unlinkedBefore, "admin")
        assert.equal(unlinkedRows.length, 1)
        assert.equal(unlinkedRows[0].action, "PROFILE_UPDATED")
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: unlinked.id },
            })
          ).userId,
          null,
        )
      },
    )

    await t.test(
      "default and selected Head handoffs attribute department and replacement membership effects",
      async () => {
        const { team } = await fixture("handoff", true)
        const before = (await events()).length
        await update("hr-handoff-original", {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: "hr-handoff-deputy",
        })
        const rows = await operationAfter(before, "admin")
        const head = rows.find((r) => r.action === "HEAD_CHANGED")!
        assert.deepEqual(head.changes, {
          headId: { before: "handoff-original", after: "handoff-deputy" },
          temporaryHeadOriginalId: { before: null, after: "handoff-original" },
          temporaryHeadAssignedId: { before: null, after: "handoff-deputy" },
        })
        assert.deepEqual(
          rows.find((r) => r.subjectId === "hr-handoff-deputy")!.changes,
          { teamId: { before: team.id, after: null } },
        )
        assert.deepEqual(
          rows.find(
            (r) =>
              r.action === "ASSIGNMENT_CHANGED" &&
              r.subjectType === "DEPARTMENT",
          )!.changes,
          {
            affectedAccountId: "handoff-deputy",
            teamId: { before: team.id, after: null },
          },
        )
        assert.equal(
          rows.some((r) => r.action === "TITLE_CLEARED"),
          false,
        )
        await fixture("automatic")
        await prisma.employee.update({
          where: { id: "hr-automatic-deputy" },
          data: { startDate: new Date("2000-01-01") },
        })
        const autoBefore = (await events()).length
        await update("hr-automatic-original", { status: "ON_LEAVE" }, "root")
        const automatic = await operationAfter(autoBefore, "root")
        assert.equal(
          (
            await prisma.department.findUniqueOrThrow({
              where: { id: "automatic" },
            })
          ).headId,
          "automatic-deputy",
        )
        assert.ok(automatic.some((r) => r.action === "HEAD_CHANGED"))
      },
    )

    await t.test(
      "nested replacement and original restoration retain actual actor and displaced-title corrections",
      async () => {
        await update("hr-handoff-deputy", { position: "Dept Head" })
        let before = (await events()).length
        await update(
          "hr-handoff-deputy",
          { status: "ON_LEAVE", replacementHeadEmployeeId: "hr-handoff-third" },
          "root",
        )
        const nested = await operationAfter(before, "root")
        const title = nested.find((r) => r.action === "TITLE_CLEARED")!
        assert.equal(title.subjectId, "hr-handoff-deputy")
        assert.deepEqual(title.changes, { cause: "FORMER_DEPARTMENT_HEAD" })
        assert.equal(
          nested.some(
            (r) =>
              r.action === "PROFILE_UPDATED" &&
              r.changedFields.includes("position"),
          ),
          false,
        )
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "handoff-original" },
            })
          ).position,
          "Department Head",
        )
        assert.deepEqual(
          nested.find((r) => r.action === "HEAD_CHANGED")!.changes,
          {
            headId: { before: "handoff-deputy", after: "handoff-third" },
            temporaryHeadAssignedId: {
              before: "handoff-deputy",
              after: "handoff-third",
            },
          },
        )
        await update("hr-handoff-third", { position: "Dept Head" })
        before = (await events()).length
        await update("hr-handoff-original", { status: "ACTIVE" })
        const restoration = await operationAfter(before, "admin")
        assert.ok(
          restoration.some(
            (r) =>
              r.action === "TITLE_CLEARED" &&
              r.subjectId === "hr-handoff-third",
          ),
        )
        assert.deepEqual(
          restoration.find((r) => r.action === "HEAD_CHANGED")!.changes,
          {
            headId: { before: "handoff-third", after: "handoff-original" },
            temporaryHeadOriginalId: {
              before: "handoff-original",
              after: null,
            },
            temporaryHeadAssignedId: { before: "handoff-third", after: null },
          },
        )
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: "hr-handoff-third" },
            })
          ).position,
          null,
        )
      },
    )

    await t.test(
      "explicit Department replacement is separately attributed and returning original cannot reclaim it",
      async () => {
        await fixture("explicit")
        await update("hr-explicit-original", {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: "hr-explicit-deputy",
        })
        const count = (await events()).length
        const response = await fetch(`${base}/departments/explicit`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${tokens.get("admin")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ headId: "explicit-third" }),
        })
        assert.equal(response.status, 200)
        const replacementRows = (await events()).slice(count)
        assert.ok(replacementRows.some((row) => row.action === "HEAD_CHANGED"))
        assert.ok(
          replacementRows.every(
            (row) =>
              row.origin === "DEPARTMENT_MANAGEMENT" &&
              row.actorAccountId === "admin",
          ),
        )
        const afterReplacement = (await events()).length
        await update("hr-explicit-original", { status: "ACTIVE" }, "root")
        const rows = await operationAfter(afterReplacement, "root")
        assert.equal(
          rows.some(
            (r) =>
              r.action === "HEAD_CHANGED" ||
              r.action === "TEMPORARY_HEAD_CHANGED",
          ),
          false,
        )
        assert.equal(
          (
            await prisma.department.findUniqueOrThrow({
              where: { id: "explicit" },
            })
          ).headId,
          "explicit-third",
        )
      },
    )

    await t.test(
      "legacy User-only displaced titles and tracking-only returns are attributed without fabricated Employee identities",
      async () => {
        await fixture("legacy-title")
        await update("hr-legacy-title-original", {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: "hr-legacy-title-deputy",
        })
        await update("hr-legacy-title-deputy", { position: "Dept Head" })
        await prisma.employee.delete({
          where: { id: "hr-legacy-title-deputy" },
        })
        const before = (await events()).length
        await update("hr-legacy-title-original", { status: "ACTIVE" })
        const rows = await operationAfter(before, "admin")
        const title = rows.find((r) => r.action === "TITLE_CLEARED")!
        assert.equal(title.subjectType, "DEPARTMENT")
        assert.equal(title.subjectId, "legacy-title")
        assert.deepEqual(title.changes, {
          cause: "FORMER_DEPARTMENT_HEAD",
          affectedAccountId: "legacy-title-deputy",
        })
        assert.equal(
          await prisma.employee.count({
            where: { userId: "legacy-title-deputy" },
          }),
          0,
        )
        await fixture("tracking-only")
        await update("hr-tracking-only-original", {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: "hr-tracking-only-deputy",
        })
        // Existing records may retain a reservation while the current Head has
        // changed independently; Employee return clears tracking without takeover.
        await prisma.department.update({
          where: { id: "tracking-only" },
          data: { headId: "tracking-only-third" },
        })
        const trackingBefore = (await events()).length
        await update("hr-tracking-only-original", { status: "ACTIVE" })
        const tracking = await operationAfter(trackingBefore, "admin")
        assert.deepEqual(
          tracking.find((r) => r.action === "TEMPORARY_HEAD_CHANGED")!.changes,
          {
            temporaryHeadOriginalId: {
              before: "tracking-only-original",
              after: null,
            },
            temporaryHeadAssignedId: {
              before: "tracking-only-deputy",
              after: null,
            },
          },
        )
        assert.equal(
          (
            await prisma.department.findUniqueOrThrow({
              where: { id: "tracking-only" },
            })
          ).headId,
          "tracking-only-third",
        )
      },
    )

    await t.test(
      "team leads step down without login deactivation and synchronization-only repairs are not lost",
      async () => {
        const dept = await prisma.department.create({
          data: { name: "Team led" },
        })
        const team = await prisma.team.create({
          data: { name: "Led", departmentId: dept.id },
        })
        await member("lead-target", dept.id, "Private Job Sentinel", team.id)
        await prisma.team.update({
          where: { id: team.id },
          data: { leadId: "lead-target" },
        })
        let before = (await events()).length
        await update("hr-lead-target", { status: "INACTIVE" })
        const rows = await operationAfter(before, "admin")
        assert.deepEqual(
          rows.find((r) => r.action === "LEAD_CHANGED")!.changes,
          { leadId: { before: "lead-target", after: null } },
        )
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "lead-target" },
            })
          ).isActive,
          true,
        )
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: "hr-lead-target" },
            })
          ).teamId,
          team.id,
        )
        await prisma.user.update({
          where: { id: "lead-target" },
          data: { teamId: null, position: "Different Private Title" },
        })
        before = (await events()).length
        await update("hr-lead-target", {}, "root")
        const repaired = await operationAfter(before, "root")
        assert.ok(
          repaired.some(
            (r) =>
              r.subjectType === "DEPARTMENT" &&
              r.action === "ASSIGNMENT_CHANGED",
          ),
        )
        assert.ok(
          repaired.some(
            (r) =>
              r.subjectId === "hr-lead-target" &&
              r.action === "PROFILE_UPDATED" &&
              r.changedFields.includes("position"),
          ),
        )
        assert.equal(
          repaired.some(
            (r) =>
              r.subjectType === "EMPLOYEE" && r.action === "ASSIGNMENT_CHANGED",
          ),
          false,
        )
      },
    )

    await t.test(
      "denials, invalid transitions and actual transaction failure create no success history",
      async () => {
        const count = (await events()).length
        for (const actor of [
          null,
          "staff-actor",
          "head-actor",
          "client",
          "inactive",
          "retired",
        ])
          assert.equal(
            (
              await request(
                "hr-ordinary",
                { position: "Denied Private Title", ...forged },
                actor,
              )
            ).status,
            actor === null || actor === "inactive" || actor === "retired"
              ? 401
              : 403,
          )
        assert.equal(
          (await request("missing", { status: "ACTIVE" })).status,
          404,
        )
        assert.equal(
          (await request("hr-ordinary", { password: "not allowed" })).status,
          400,
        )
        assert.equal(
          (await request("hr-ordinary", { userId: "root" })).status,
          400,
        )
        assert.equal(
          (await request("hr-ordinary", { status: "UNKNOWN" })).status,
          400,
        )
        assert.equal(
          (await request("hr-handoff-original", { teamId: "team-handoff" }))
            .status,
          400,
        )
        assert.equal(
          (
            await request("hr-ordinary", {
              replacementHeadEmployeeId: "hr-handoff-deputy",
            })
          ).status,
          400,
        )
        assert.equal((await events()).length, count)
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION abort_employee_update() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'serialization failure' USING ERRCODE = '40001'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER abort_employee_update BEFORE UPDATE ON "Employee" FOR EACH ROW EXECUTE FUNCTION abort_employee_update();`,
        )
        try {
          assert.equal(
            (
              await request("hr-ordinary", {
                position: "Aborted Private Title",
              })
            ).status,
            409,
          )
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER abort_employee_update ON "Employee"; DROP FUNCTION abort_employee_update();`,
          )
        }
      },
    )

    await t.test(
      "late history failure rolls back every leadership, title, profile and earlier history effect",
      async () => {
        await fixture("rollback", true)
        await update("hr-rollback-original", {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: "hr-rollback-deputy",
        })
        await update("hr-rollback-deputy", { position: "Dept Head" })
        await fixture("rollback-leave", true)
        const leadDepartment = await prisma.department.create({
          data: { name: "Rollback lead" },
        })
        const leadTeam = await prisma.team.create({
          data: { name: "Rollback led team", departmentId: leadDepartment.id },
        })
        await member(
          "rollback-lead",
          leadDepartment.id,
          "Private Job Sentinel",
          leadTeam.id,
        )
        await prisma.team.update({
          where: { id: leadTeam.id },
          data: { leadId: "rollback-lead" },
        })
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_update_history() RETURNS trigger AS $$ BEGIN IF NEW.action = 'STATUS_CHANGED' THEN RAISE EXCEPTION 'late history unavailable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_update_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW WHEN (NEW.origin = 'EMPLOYEE_MANAGEMENT') EXECUTE FUNCTION reject_update_history();`,
        )
        try {
          assert.equal(
            (
              await request(
                "hr-rollback-original",
                { status: "ACTIVE", fullName: "Rollback Private Name" },
                "root",
              )
            ).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
          assert.equal(
            (
              await request("hr-rollback-leave-original", {
                status: "ON_LEAVE",
                replacementHeadEmployeeId: "hr-rollback-leave-deputy",
              })
            ).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
          assert.equal(
            (await request("hr-rollback-lead", { status: "INACTIVE" })).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER reject_update_history ON "WorkforceManagementChange"; DROP FUNCTION reject_update_history();`,
          )
        }
      },
    )

    await t.test(
      "overlapping no-op-aware updates retain one committed status transition and no sensitive history",
      async () => {
        const count = (await events()).length
        const results = await Promise.all([
          request("hr-ordinary", { status: "ACTIVE" }),
          request("hr-ordinary", { status: "ACTIVE" }, "root"),
        ])
        assert.ok(results.every((r) => r.status === 200 || r.status === 409))
        const rows = (await events()).slice(count)
        assert.equal(
          rows.filter((r) => r.action === "STATUS_CHANGED").length,
          1,
        )
        const serialized = JSON.stringify(await events())
        for (const value of [
          "Private Name Sentinel",
          "Private Job Sentinel",
          "Private Credential Sentinel",
          "Unlinked Private Name",
          "Unlinked Private Position",
          "Changed Private Name",
          "Changed Private Title",
          "Different Private Title",
          "@update-attribution.test",
          "09123456789",
          "09987654321",
          "forged-credential",
          "2026-02-01",
          "Department Head",
          "Dept Head",
          ...tokens.values(),
        ])
          assert.ok(!serialized.includes(value))
        assert.equal(await prisma.accountManagementChange.count(), 0)
        assert.equal(
          await prisma.employee.count({ where: { userId: "root" } }),
          0,
        )
      },
    )
  },
)
