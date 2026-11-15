import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { createManagementOperation } from "../../../src/shared/management-history.js"
import {
  writeWorkforceManagementChange,
  type WorkforceManagementChangeInput,
} from "../../../src/features/employees/workforce-management-history.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Department DELETE attributes actual cascades without deleting people",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const tokens = new Map<string, string>()
    async function account(id: string, role: Role = "STAFF") {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@deletion-attribution.test`,
          fullName: "Private Name Sentinel",
          position: "Private Title Sentinel",
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
    async function person(
      id: string,
      departmentId: string | null,
      teamId: string | null = null,
      employee = true,
      position = "Private Title Sentinel",
    ) {
      await account(id)
      await prisma.user.update({
        where: { id },
        data: { departmentId, teamId, position },
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
            position,
            status: "ON_LEAVE",
            employmentType: "PART_TIME",
          },
        })
    }
    async function populated(prefix: string) {
      const department = await prisma.department.create({
        data: {
          id: prefix,
          name: prefix,
          description: "Private Description Sentinel",
        },
      })
      const team = await prisma.team.create({
        data: { id: `team-${prefix}`, name: prefix, departmentId: prefix },
      })
      const emptyTeam = await prisma.team.create({
        data: { id: `empty-${prefix}`, name: "Empty", departmentId: prefix },
      })
      await person(`${prefix}-head`, prefix, null, true, "Department Head")
      await person(`${prefix}-original`, prefix, null, true, "Department Head")
      await person(`${prefix}-lead`, prefix, team.id, true, "Team Lead")
      await person(`${prefix}-legacy`, prefix, team.id, false)
      await prisma.department.update({
        where: { id: prefix },
        data: {
          headId: `${prefix}-head`,
          temporaryHeadOriginalId: `${prefix}-original`,
          temporaryHeadAssignedId: `${prefix}-head`,
        },
      })
      await prisma.team.update({
        where: { id: team.id },
        data: { leadId: `${prefix}-lead` },
      })
      await prisma.employee.create({
        data: {
          id: `unlinked-${prefix}`,
          employeeId: `EXP-unlinked-${prefix}`,
          fullName: "Private Name Sentinel",
          departmentId: prefix,
          teamId: team.id,
          status: "INACTIVE",
        },
      })
      return { department, team, emptyTeam }
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
        teams: await prisma.team.findMany({ orderBy: { id: "asc" } }),
        users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
        employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
        history: await events(),
        accounts: await prisma.accountManagementChange.findMany({
          orderBy: { id: "asc" },
        }),
      }
    }
    const forgery = {
      actorAccountId: "client",
      actorRoleAtTime: "USER",
      operationId: "forged-operation",
      createdAt: "2000-01-01T00:00:00Z",
      changes: { password: "Forbidden Secret" },
    }
    function request(
      id: string,
      actor: string | null = "admin",
      method = "DELETE",
    ) {
      return fetch(`${base}/departments/${id}`, {
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
        body: method === "GET" ? undefined : JSON.stringify(forgery),
      })
    }
    async function remove(id: string, actor = "admin") {
      const response = await request(id, actor)
      assert.equal(response.status, 200, await response.clone().text())
      assert.deepEqual(await response.json(), {
        message: "Department deleted successfully",
      })
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
      "empty deletion records authenticated Admin and no fabricated relationship effects",
      async () => {
        await prisma.department.create({
          data: { id: "empty", name: "Empty department" },
        })
        const count = (await events()).length
        await remove("empty")
        const rows = (await events()).slice(count)
        trusted(rows, "admin")
        assert.equal(rows.length, 1)
        assert.equal(rows[0].subjectType, "DEPARTMENT")
        assert.equal(rows[0].subjectId, "empty")
        assert.equal(rows[0].action, "DELETED")
        assert.deepEqual(rows[0].changes, {})
        assert.deepEqual(rows[0].changedFields, [])
        assert.equal(
          await prisma.department.findUnique({ where: { id: "empty" } }),
          null,
        )
        assert.equal((await request("empty")).status, 404)
        assert.equal((await events()).length, count + 1)
      },
    )

    await t.test(
      "populated deletion records Heads, Teams, memberships, synchronization and actual legacy Employee creation",
      async () => {
        const { team, emptyTeam } = await populated("populated")
        const outside = await prisma.department.create({
          data: { id: "outside", name: "Unrelated department" },
        })
        const outsideTeam = await prisma.team.create({
          data: {
            id: "outside-team",
            name: "Unrelated team",
            departmentId: outside.id,
          },
        })
        await person("unrelated", outside.id, outsideTeam.id)
        await person("team-only", outside.id, team.id)
        await person("user-team-only", null, team.id, false)
        await person("cross-sync", "populated", outsideTeam.id)
        await prisma.employee.update({
          where: { id: "hr-cross-sync" },
          data: { departmentId: outside.id, position: "Stale Private Title" },
        })
        await prisma.employee.create({
          data: {
            id: "unlinked-team-only",
            employeeId: "EXP-unlinked-team-only",
            fullName: "Private Name Sentinel",
            departmentId: outside.id,
            teamId: team.id,
          },
        })
        const before = await snapshot()
        const count = before.history.length
        await remove("populated", "root")
        const rows = (await events()).slice(count)
        trusted(rows, "root")
        const deleted = rows.filter((row) => row.action === "DELETED")
        assert.equal(deleted.length, 3)
        assert.deepEqual(
          deleted.find((row) => row.subjectType === "DEPARTMENT")!.changes,
          {
            headId: { before: "populated-head", after: null },
            temporaryHeadOriginalId: {
              before: "populated-original",
              after: null,
            },
            temporaryHeadAssignedId: { before: "populated-head", after: null },
          },
        )
        assert.deepEqual(
          deleted.find((row) => row.subjectId === team.id)!.changes,
          {
            departmentId: { before: "populated", after: null },
            leadId: { before: "populated-lead", after: null },
          },
        )
        assert.deepEqual(
          deleted.find((row) => row.subjectId === emptyTeam.id)!.changes,
          { departmentId: { before: "populated", after: null } },
        )
        assert.equal(
          await prisma.team.count({ where: { departmentId: "populated" } }),
          0,
        )
        assert.equal(
          await prisma.department.findUnique({ where: { id: "populated" } }),
          null,
        )
        const after = await snapshot()
        assert.equal(after.users.length, before.users.length)
        assert.equal(after.employees.length, before.employees.length + 1)
        assert.equal(await prisma.accountManagementChange.count(), 0)
        for (const previous of before.employees.filter(
          (row) =>
            row.departmentId === "populated" ||
            row.teamId === team.id ||
            row.userId === "cross-sync",
        )) {
          const current = after.employees.find((row) => row.id === previous.id)!
          assert.equal(current.status, previous.status)
          assert.equal(current.employmentType, previous.employmentType)
          assert.equal(current.userId, previous.userId)
          const assignment = rows.find(
            (row) =>
              row.action === "ASSIGNMENT_CHANGED" &&
              row.subjectType === "EMPLOYEE" &&
              row.subjectId === previous.id,
          )!
          assert.ok(assignment, previous.id)
          const changes = assignment.changes as Record<
            string,
            { before: string | null; after: string | null }
          >
          for (const key of ["departmentId", "teamId"] as const) {
            if (previous[key] !== current[key])
              assert.deepEqual(changes[key], {
                before: previous[key],
                after: current[key],
              })
            else assert.equal(key in changes, false)
          }
        }
        for (const previous of before.users.filter(
          (row) => row.departmentId === "populated" || row.teamId === team.id,
        )) {
          const current = after.users.find((row) => row.id === previous.id)!
          const assignment = rows.find(
            (row) =>
              row.subjectType === "DEPARTMENT" &&
              row.action === "ASSIGNMENT_CHANGED" &&
              (row.changes as { affectedAccountId?: string })
                .affectedAccountId === previous.id,
          )!
          assert.ok(assignment, previous.id)
          assert.equal(current.position, previous.position)
          assert.equal(current.isActive, previous.isActive)
          assert.equal(current.role, previous.role)
          const changes = assignment.changes as Record<string, unknown>
          for (const key of ["departmentId", "teamId"] as const) {
            if (previous[key] !== current[key])
              assert.deepEqual(changes[key], {
                before: previous[key],
                after: current[key],
              })
            else assert.equal(key in changes, false)
          }
        }
        assert.equal(
          rows.filter((row) => row.action === "PROFILE_UPDATED").length,
          1,
        )
        assert.deepEqual(
          rows.find((row) => row.action === "PROFILE_UPDATED")!.changedFields,
          ["position"],
        )
        assert.ok(
          !rows.some(
            (row) =>
              row.action === "TITLE_CLEARED" ||
              row.action === "HEAD_CHANGED" ||
              row.action === "LEAD_CHANGED",
          ),
        )
        const legacy = after.employees.find(
          (row) => row.userId === "populated-legacy",
        )!
        assert.equal(legacy.departmentId, null)
        assert.equal(legacy.teamId, null)
        assert.equal(rows.filter((row) => row.action === "CREATED").length, 1)
        assert.equal(
          rows.find((row) => row.action === "CREATED")!.subjectId,
          legacy.id,
        )
        assert.equal(
          await prisma.employee.count({
            where: { userId: { in: ["root", "admin", "user-team-only"] } },
          }),
          0,
        )
        for (const [key, id] of [
          ["departments", outside.id],
          ["teams", outsideTeam.id],
          ["users", "unrelated"],
          ["employees", "hr-unrelated"],
        ] as const)
          assert.deepEqual(
            after[key].find((row) => row.id === id),
            before[key].find((row) => row.id === id),
          )
      },
    )

    await t.test(
      "late history failure rolls back cascading deletion, assignments, legacy birth and earlier history",
      async () => {
        await populated("rollback")
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_department_delete_history() RETURNS trigger AS $$ BEGIN IF NEW.action = 'DELETED' AND NEW."subjectType" = 'DEPARTMENT' THEN RAISE EXCEPTION 'late deletion history failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_department_delete_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW EXECUTE FUNCTION reject_department_delete_history();`,
        )
        try {
          const response = await request("rollback")
          assert.equal(response.status, 500, await response.text())
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER reject_department_delete_history ON "WorkforceManagementChange"; DROP FUNCTION reject_department_delete_history();`,
          )
        }
      },
    )

    await t.test(
      "unauthorized, inactive, retired and missing targets produce no success history; GETs stay observational",
      async () => {
        await prisma.department.create({
          data: { id: "protected", name: "Protected", headId: "staff" },
        })
        const before = await snapshot()
        for (const actor of [null, "staff", "client", "inactive", "retired"]) {
          const response = await request("protected", actor)
          assert.equal(
            response.status,
            actor === "staff" || actor === "client" ? 403 : 401,
            await response.text(),
          )
        }
        assert.equal((await request("missing")).status, 404)
        for (const actor of ["admin", "root"]) {
          for (let i = 0; i < 2; i++) {
            assert.equal((await request("protected", actor, "GET")).status, 200)
            assert.equal(
              (
                await fetch(`${base}/departments`, {
                  headers: { Authorization: `Bearer ${tokens.get(actor)}` },
                })
              ).status,
              200,
            )
          }
        }
        assert.equal((await request("protected", "staff", "GET")).status, 403)
        assert.deepEqual(await snapshot(), before)
      },
    )

    await t.test(
      "service, request, conversation and indirect Project restrictions retain existing conflicts",
      async () => {
        const service = await prisma.service.create({
          data: {
            name: "Linked service",
            description: "Private Description Sentinel",
          },
        })
        for (const id of [
          "service-linked",
          "request-linked",
          "conversation-linked",
          "project-linked",
        ])
          await prisma.department.create({ data: { id, name: id } })
        await prisma.service.update({
          where: { id: service.id },
          data: { departments: { connect: { id: "service-linked" } } },
        })
        for (const id of ["request-linked", "project-linked"]) {
          const request = await prisma.serviceRequest.create({
            data: {
              clientId: "client",
              serviceId: service.id,
              title: "Private Request Sentinel",
              acceptedDepartmentId: id,
            },
          })
          if (id === "project-linked")
            await prisma.project.create({
              data: {
                clientId: "client",
                name: "Private Project Sentinel",
                requestId: request.id,
              },
            })
        }
        await prisma.requestConversation.create({
          data: { clientId: "client", departmentId: "conversation-linked" },
        })
        const before = await snapshot()
        for (const id of [
          "service-linked",
          "request-linked",
          "conversation-linked",
          "project-linked",
        ]) {
          const response = await request(id)
          assert.equal(response.status, 409)
          assert.deepEqual(await response.json(), {
            error:
              id === "service-linked"
                ? "Reassign or remove this department's services before deleting the department"
                : "This department has client request history and can't be deleted",
          })
        }
        assert.deepEqual(await snapshot(), before)
        assert.equal(await prisma.project.count(), 1)
        assert.equal(await prisma.serviceRequest.count(), 2)
        assert.equal(await prisma.requestConversation.count(), 1)
        assert.equal(await prisma.service.count(), 1)
      },
    )

    await t.test(
      "deletion payload allowlists reject reassignment, empty transitions, personal values and cross-subject fields",
      async () => {
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: "root" },
        })
        const session = await prisma.session.findFirstOrThrow({
          where: { userId: user.id },
        })
        const operation = createManagementOperation({
          user,
          sessionId: session.id,
        })
        const count = (await events()).length
        const valid: WorkforceManagementChangeInput = {
          origin: "DEPARTMENT_MANAGEMENT",
          action: "DELETED",
          subjectType: "TEAM",
          subjectId: "bounded-subject",
          changedFields: ["leadId"],
          changes: { leadId: { before: "old-lead", after: null } },
        }
        for (const input of [
          {
            ...valid,
            changes: { leadId: { before: "old-lead", after: "new-lead" } },
          },
          { ...valid, changes: { leadId: { before: null, after: null } } },
          {
            ...valid,
            changes: { leadId: { before: "private@email.test", after: null } },
          },
          {
            ...valid,
            changedFields: ["headId"],
            changes: { headId: { before: "head", after: null } },
          },
          {
            ...valid,
            subjectType: "DEPARTMENT",
            changes: { leadId: { before: "lead", after: null } },
          },
          {
            ...valid,
            changedFields: ["fullName"],
            changes: { fullName: "Private Name Sentinel" },
          },
          {
            ...valid,
            changes: { ...valid.changes, password: "Forbidden Secret" },
          },
        ]) {
          await assert.rejects(
            prisma.$transaction((tx) =>
              writeWorkforceManagementChange(
                tx,
                operation,
                input as WorkforceManagementChangeInput,
              ),
            ),
            /history|History/,
          )
        }
        assert.equal((await events()).length, count)
      },
    )

    await t.test(
      "overlapping deletion has one successful history operation and snapshots survive actor deletion",
      async () => {
        await populated("overlap")
        const count = (await events()).length
        const responses = await Promise.all([
          request("overlap"),
          request("overlap", "root"),
        ])
        assert.equal(
          responses.filter((response) => response.status === 200).length,
          1,
        )
        assert.ok(
          responses.every((response) =>
            [200, 404, 409].includes(response.status),
          ),
        )
        const rows = (await events()).slice(count)
        assert.equal(
          rows.filter(
            (row) =>
              row.action === "DELETED" && row.subjectType === "DEPARTMENT",
          ).length,
          1,
        )
        assert.equal(new Set(rows.map((row) => row.operationId)).size, 1)
        const serialized = JSON.stringify(await events())
        for (const secret of [
          "Private Name Sentinel",
          "Private Title Sentinel",
          "Stale Private Title",
          "Private Credential Sentinel",
          "Private Description Sentinel",
          "09123456789",
          "@deletion-attribution.test",
          "Forbidden Secret",
          "passwordHash",
          "accessToken",
        ])
          assert.equal(serialized.includes(secret), false, secret)
        const history = await events()
        await prisma.user.deleteMany({
          where: { id: { in: ["admin", "root"] } },
        })
        assert.deepEqual(await events(), history)
        assert.equal(
          history.some(
            (row) =>
              row.subjectId === "empty" && row.actorAccountId === "admin",
          ),
          true,
        )
        assert.equal(
          history.some(
            (row) =>
              row.subjectId === "populated" && row.actorAccountId === "root",
          ),
          true,
        )
      },
    )
  },
)
