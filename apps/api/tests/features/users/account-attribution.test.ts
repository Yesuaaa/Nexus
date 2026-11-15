import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import {
  Role,
  type AccountManagementAction,
} from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import {
  hashPassword,
  verifyPassword,
} from "../../../src/features/auth/auth.password.js"
import { startPgliteApp } from "../../support/pglite-app.js"
import { usersRepository } from "../../../src/features/users/users.repository.js"
import { syncEmployeeForUser } from "../../../src/features/employees/employees.service.js"
import { createManagementOperation } from "../../../src/shared/management-history.js"

test(
  "all Account Management mutations attribute the authenticated actor atomically",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const password = "OriginalPrivate123!"
    const passwordHash = await hashPassword(password)
    const tokens = new Map<string, string>()
    async function account(
      id: string,
      role: Role = "USER",
      inactive = false,
      archived = false,
    ) {
      const user = await prisma.user.create({
        data: {
          id,
          email: `${id}@attribution.test`,
          fullName: "Personal Name Sentinel",
          contactNumber: "09123456789",
          role,
          passwordHash,
          isActive: !inactive,
          accountDeletedAt: archived
            ? new Date("2026-11-15T01:00:00.000Z")
            : null,
        },
      })
      const session = await issueSession(user)
      tokens.set(id, session.token)
      return user
    }
    for (const [id, role] of [
      ["actor-a", "SUPERADMIN"],
      ["actor-b", "SUPERADMIN"],
      ["admin", "ADMIN"],
      ["staff", "STAFF"],
      ["client", "USER"],
    ] as const)
      await account(id, role)
    await account("inactive", "SUPERADMIN", true)
    await account("retired", "SUPERADMIN", true, true)
    function request(
      path: string,
      method: string,
      body?: unknown,
      actor: string | null = "actor-a",
    ) {
      return fetch(`${base}/users${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(actor ? { Authorization: `Bearer ${tokens.get(actor)}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    const counts = async () => [
      await prisma.accountManagementChange.count(),
      await prisma.workforceManagementChange.count(),
    ]
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      departments: await prisma.department.findMany({ orderBy: { id: "asc" } }),
      teams: await prisma.team.findMany({ orderBy: { id: "asc" } }),
      sessions: await prisma.session.findMany({ orderBy: { id: "asc" } }),
      refresh: await prisma.refreshToken.findMany({ orderBy: { id: "asc" } }),
      counts: await counts(),
    })

    await t.test(
      "seven endpoints retain actual distinct actors, safe changes, session revocation and deletion history",
      async () => {
        const forged = {
          actorAccountId: "staff",
          actorRoleAtTime: "STAFF",
          operationId: randomUUID(),
          createdAt: "2000-01-01T00:00:00.000Z",
        }
        const created = await request("", "POST", {
          ...forged,
          email: "created@attribution.test",
          fullName: "Created Personal Sentinel",
          contactNumber: "09123456789",
          password,
          role: "USER",
          isActive: false, // Account creation keeps the existing active default.
        })
        assert.equal(created.status, 201, await created.clone().text())
        const body = (await created.json()) as { user: { id: string } }
        const id = body.user.id
        async function history(action: AccountManagementAction, actor: string) {
          const rows = await prisma.accountManagementChange.findMany({
            where: { subjectAccountId: id, action },
            orderBy: { createdAt: "desc" },
          })
          assert.ok(rows.length, `missing ${action} history`)
          const row = rows[0]
          assert.equal(row.actorAccountId, actor)
          assert.equal(row.actorRoleAtTime, "SUPERADMIN")
          assert.equal(row.origin, "ACCOUNT_MANAGEMENT")
          assert.notEqual(row.operationId, forged.operationId)
          assert.notEqual(row.createdAt.toISOString(), forged.createdAt)
          return row
        }
        assert.deepEqual((await history("CREATED", "actor-a")).changes, {
          role: { before: null, after: "USER" },
          isActive: { before: null, after: true },
        })
        assert.equal(
          (
            await request(
              `/${id}/role`,
              "PATCH",
              { ...forged, role: "STAFF" },
              "actor-b",
            )
          ).status,
          200,
        )
        const role = await history("ROLE_CHANGED", "actor-b")
        assert.deepEqual(role.changes, {
          role: { before: "USER", after: "STAFF" },
        })
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { userId: id },
        })
        assert.equal(
          (
            await prisma.workforceManagementChange.findFirstOrThrow({
              where: { subjectId: employee.id },
            })
          ).operationId,
          role.operationId,
        )
        const targetSession = await issueSession(
          await prisma.user.findUniqueOrThrow({ where: { id } }),
        )
        assert.equal(
          (
            await request(`/${id}/status`, "PATCH", {
              ...forged,
              isActive: false,
            })
          ).status,
          200,
        )
        assert.deepEqual((await history("STATUS_CHANGED", "actor-a")).changes, {
          isActive: { before: true, after: false },
          sessionsRevoked: true,
        })
        assert.equal(await prisma.session.count({ where: { userId: id } }), 0)
        assert.equal(
          (
            await fetch(`${base}/auth/me`, {
              headers: { Authorization: `Bearer ${targetSession.token}` },
            })
          ).status,
          401,
        )
        const resetPassword = "ResetPrivate456!"
        assert.equal(
          (
            await request(
              `/${id}/password`,
              "POST",
              { ...forged, newPassword: resetPassword },
              "actor-b",
            )
          ).status,
          204,
        )
        assert.deepEqual((await history("PASSWORD_RESET", "actor-b")).changes, {
          sessionsRevoked: true,
        })
        assert.ok(
          await verifyPassword(
            resetPassword,
            (await prisma.user.findUniqueOrThrow({ where: { id } }))
              .passwordHash,
          ),
        )
        assert.equal((await request(`/${id}`, "DELETE")).status, 200)
        const archived = await history("ARCHIVED", "actor-a")
        const at = (
          await prisma.user.findUniqueOrThrow({ where: { id } })
        ).accountDeletedAt!.toISOString()
        assert.deepEqual(archived.changes, {
          accountDeletedAt: { before: null, after: at },
          sessionsRevoked: true,
        })
        assert.equal(
          (await request(`/${id}/restore`, "POST", forged, "actor-b")).status,
          200,
        )
        assert.deepEqual((await history("RESTORED", "actor-b")).changes, {
          accountDeletedAt: { before: at, after: null },
          sessionsRevoked: true,
        })
        assert.equal(
          (await prisma.user.findUniqueOrThrow({ where: { id } })).isActive,
          false,
        )
        assert.equal((await request(`/${id}`, "DELETE")).status, 200)
        assert.equal(
          (await request(`/${id}/permanent`, "DELETE", forged, "actor-b"))
            .status,
          200,
        )
        const deleted = await history("DELETED", "actor-b")
        assert.equal(await prisma.user.findUnique({ where: { id } }), null)
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: employee.id },
            })
          ).userId,
          null,
        )
        const unlinked =
          await prisma.workforceManagementChange.findFirstOrThrow({
            where: { operationId: deleted.operationId, subjectId: employee.id },
          })
        assert.deepEqual(unlinked.changes, {
          userId: { before: id, after: null },
        })
        const stored = JSON.stringify([
          await prisma.accountManagementChange.findMany(),
          await prisma.workforceManagementChange.findMany(),
        ])
        for (const secret of [
          password,
          passwordHash,
          resetPassword,
          targetSession.token,
          "Created Personal Sentinel",
          "09123456789",
          "created@attribution.test",
        ])
          assert.ok(
            !stored.includes(secret),
            `stored private data: ${secret.slice(0, 5)}`,
          )
      },
    )

    await t.test(
      "synchronization and no-op requests record only material workforce effects",
      async () => {
        const first = await prisma.department.create({
          data: { name: "Previous" },
        })
        const next = await prisma.department.create({ data: { name: "Next" } })
        const team = await prisma.team.create({
          data: { name: "Next team", departmentId: next.id },
        })
        const createdLogin = await request("", "POST", {
          email: "unlinked-admin@attribution.test",
          fullName: "Unlinked Administrator",
          password,
          role: "SUPERADMIN",
          departmentId: next.id,
          teamId: team.id,
        })
        assert.equal(createdLogin.status, 201)
        const createdId = (
          (await createdLogin.json()) as { user: { id: string } }
        ).user.id
        assert.equal(
          await prisma.employee.count({ where: { userId: createdId } }),
          0,
        )
        const creationEvent =
          await prisma.accountManagementChange.findFirstOrThrow({
            where: { subjectAccountId: createdId },
          })
        const membership =
          await prisma.workforceManagementChange.findFirstOrThrow({
            where: { operationId: creationEvent.operationId },
          })
        assert.deepEqual(membership.changes, {
          affectedAccountId: createdId,
          departmentId: { before: null, after: next.id },
          teamId: { before: null, after: team.id },
        })
        await account("normalize")
        await prisma.user.update({
          where: { id: "normalize" },
          data: { teamId: team.id, position: "Private Job Sentinel" },
        })
        const employee = await prisma.employee.create({
          data: {
            employeeId: "SYNC-001",
            fullName: "Private HR Sentinel",
            position: "Old Private Job Sentinel",
            userId: "normalize",
            departmentId: first.id,
          },
        })
        assert.equal(
          (await request("/normalize/role", "PATCH", { role: "STAFF" })).status,
          200,
        )
        const event = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: "normalize" },
        })
        const effects = await prisma.workforceManagementChange.findMany({
          where: { operationId: event.operationId },
        })
        assert.ok(
          effects.some(
            (row) =>
              row.subjectId === employee.id &&
              row.action === "ASSIGNMENT_CHANGED",
          ),
        )
        assert.ok(
          effects.some(
            (row) =>
              row.subjectId === employee.id &&
              row.action === "PROFILE_UPDATED" &&
              row.changedFields.includes("position"),
          ),
        )
        assert.ok(
          effects.some(
            (row) =>
              row.subjectId === next.id && row.action === "ASSIGNMENT_CHANGED",
          ),
        )
        assert.ok(!JSON.stringify(effects).includes("Private"))
        const before = await counts()
        assert.equal(
          (await request("/normalize/role", "PATCH", { role: "STAFF" })).status,
          200,
        )
        assert.equal(
          (await request("/normalize/status", "PATCH", { isActive: true }))
            .status,
          200,
        )
        assert.deepEqual(await counts(), before)
        await prisma.employee.update({
          where: { id: employee.id },
          data: { teamId: null },
        })
        assert.equal(
          (
            await request(
              "/normalize/role",
              "PATCH",
              { role: "STAFF" },
              "actor-b",
            )
          ).status,
          200,
        )
        assert.equal(await prisma.accountManagementChange.count(), before[0])
        assert.equal(
          await prisma.workforceManagementChange.count(),
          before[1] + 1,
        )
        assert.equal(
          (await request("/normalize/status", "PATCH", { isActive: false }))
            .status,
          200,
        )
        const beforeDisable = await counts()
        assert.equal(
          (await request("/normalize/status", "PATCH", { isActive: false }))
            .status,
          200,
        )
        const repeated = await prisma.accountManagementChange.findMany({
          where: { subjectAccountId: "normalize", action: "STATUS_CHANGED" },
          orderBy: { createdAt: "desc" },
        })
        assert.deepEqual(repeated[0].changedFields, [])
        assert.deepEqual(repeated[0].changes, { sessionsRevoked: true })
        assert.equal(
          await prisma.accountManagementChange.count(),
          beforeDisable[0] + 1,
        )
      },
    )

    await t.test(
      "authorization, validation and invalid lifecycle operations leave no success history",
      async () => {
        const before = await counts()
        for (const actor of [
          null,
          "admin",
          "staff",
          "client",
          "inactive",
          "retired",
        ]) {
          const expected =
            actor === null || actor === "inactive" || actor === "retired"
              ? 401
              : 403
          for (const [path, method, body] of [
            [
              "",
              "POST",
              {
                email: "denied@attribution.test",
                fullName: "Denied User",
                password,
                role: "USER",
              },
            ],
            ["/client/role", "PATCH", { role: "STAFF" }],
            ["/client/status", "PATCH", { isActive: false }],
            ["/client/password", "POST", { newPassword: password }],
            ["/client", "DELETE", undefined],
            ["/client/restore", "POST", undefined],
            ["/client/permanent", "DELETE", undefined],
          ] as const)
            assert.equal(
              (await request(path, method, body, actor)).status,
              expected,
            )
        }
        for (const [path, method, body] of [
          ["/actor-a/role", "PATCH", { role: "USER" }],
          ["/actor-a/status", "PATCH", { isActive: false }],
          ["/actor-a/password", "POST", { newPassword: password }],
          ["/actor-a", "DELETE", undefined],
          ["/actor-a/restore", "POST", undefined],
          ["/actor-a/permanent", "DELETE", undefined],
        ] as const)
          assert.equal((await request(path, method, body)).status, 403)
        assert.equal((await request("/client", "DELETE")).status, 409)
        assert.equal((await request("/client/permanent", "DELETE")).status, 409)
        assert.equal((await request("/client/restore", "POST")).status, 409)
        assert.equal(
          (await request("/client/role", "PATCH", { role: "UNKNOWN" })).status,
          400,
        )
        assert.equal(
          (await request("/client/password", "POST", { newPassword: "weak" }))
            .status,
          400,
        )
        assert.equal(
          (
            await request("", "POST", {
              email: "client@attribution.test",
              fullName: "Duplicate User",
              password,
              role: "USER",
            })
          ).status,
          409,
        )
        assert.equal(
          (await request("/missing/status", "PATCH", { isActive: false }))
            .status,
          404,
        )
        assert.deepEqual(await counts(), before)
      },
    )

    await t.test(
      "history failures roll back every endpoint, sessions and derived records",
      async () => {
        await account("rollback-role")
        await account("rollback-status")
        await account("rollback-password")
        await account("rollback-archive", "USER", true)
        await account("rollback-restore", "USER", true, true)
        await account("rollback-delete", "STAFF", true, true)
        const employee = await prisma.employee.create({
          data: {
            employeeId: "DEL-001",
            fullName: "Rollback Employee",
            userId: "rollback-delete",
          },
        })
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_account_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'history unavailable'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_account_history BEFORE INSERT ON "AccountManagementChange" FOR EACH ROW EXECUTE FUNCTION reject_account_history();`,
        )
        try {
          for (const [path, method, body] of [
            [
              "",
              "POST",
              {
                email: "rollback-create@attribution.test",
                fullName: "Rollback Create",
                password,
                role: "STAFF",
              },
            ],
            ["/rollback-role/role", "PATCH", { role: "STAFF" }],
            ["/rollback-status/status", "PATCH", { isActive: false }],
            [
              "/rollback-password/password",
              "POST",
              { newPassword: "DifferentPrivate456!" },
            ],
            ["/rollback-archive", "DELETE", undefined],
            ["/rollback-restore/restore", "POST", undefined],
            ["/rollback-delete/permanent", "DELETE", undefined],
          ] as const) {
            assert.equal((await request(path, method, body)).status, 500, path)
            assert.deepEqual(await snapshot(), before, `partial commit ${path}`)
          }
        } finally {
          await db.exec(
            `DROP TRIGGER reject_account_history ON "AccountManagementChange"; DROP FUNCTION reject_account_history();`,
          )
        }
        await db.exec(
          `CREATE FUNCTION reject_workforce_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'workforce history unavailable'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_workforce_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW EXECUTE FUNCTION reject_workforce_history();`,
        )
        try {
          assert.equal(
            (await request("/rollback-role/role", "PATCH", { role: "STAFF" }))
              .status,
            500,
          )
          assert.equal(
            (await request("/rollback-delete/permanent", "DELETE")).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
          assert.equal(
            (
              await prisma.employee.findUniqueOrThrow({
                where: { id: employee.id },
              })
            ).userId,
            "rollback-delete",
          )
        } finally {
          await db.exec(
            `DROP TRIGGER reject_workforce_history ON "WorkforceManagementChange"; DROP FUNCTION reject_workforce_history();`,
          )
        }
      },
    )

    await t.test(
      "permanent deletion captures actual head, temporary-head and lead FK effects",
      async () => {
        await account("leadership-delete", "STAFF", true, true)
        const current = await prisma.department.create({
          data: { name: "Current head", headId: "leadership-delete" },
        })
        const original = await prisma.department.create({
          data: {
            name: "Reserved head",
            temporaryHeadOriginalId: "leadership-delete",
          },
        })
        const assigned = await prisma.department.create({
          data: {
            name: "Temporary head",
            temporaryHeadAssignedId: "leadership-delete",
          },
        })
        const team = await prisma.team.create({
          data: {
            name: "Led team",
            departmentId: current.id,
            leadId: "leadership-delete",
          },
        })
        await prisma.user.update({
          where: { id: "leadership-delete" },
          data: { departmentId: current.id, teamId: team.id },
        })
        assert.equal(
          (await request("/leadership-delete/permanent", "DELETE")).status,
          200,
        )
        const event = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: "leadership-delete", action: "DELETED" },
        })
        const effects = await prisma.workforceManagementChange.findMany({
          where: { operationId: event.operationId },
        })
        assert.equal(effects.length, 5)
        const effect = (id: string, action?: string) =>
          effects.find(
            (row) => row.subjectId === id && (!action || row.action === action),
          )!
        assert.deepEqual(effect(current.id, "HEAD_CHANGED").changes, {
          headId: { before: "leadership-delete", after: null },
        })
        assert.deepEqual(effect(original.id).changes, {
          temporaryHeadOriginalId: { before: "leadership-delete", after: null },
        })
        assert.deepEqual(effect(original.id).changedFields, [
          "temporaryHeadOriginalId",
        ])
        assert.deepEqual(effect(assigned.id).changes, {
          temporaryHeadAssignedId: { before: "leadership-delete", after: null },
        })
        assert.deepEqual(effect(team.id).changes, {
          leadId: { before: "leadership-delete", after: null },
        })
        assert.deepEqual(effect(current.id, "ASSIGNMENT_CHANGED").changes, {
          affectedAccountId: "leadership-delete",
          departmentId: { before: current.id, after: null },
          teamId: { before: team.id, after: null },
        })
        await account("blocked-delete", "USER", true, true)
        await prisma.attendanceAudit.create({
          data: {
            actorId: "blocked-delete",
            entityType: "AttendancePolicy",
            entityId: "retained",
            action: "UPDATE",
            reason: "Existing linked history",
            actionId: randomUUID(),
          },
        })
        const before = await counts()
        assert.equal(
          (await request("/blocked-delete/permanent", "DELETE")).status,
          409,
        )
        assert.deepEqual(await counts(), before)
      },
    )

    await t.test(
      "stale guards and overlapping requests never commit false transitions",
      async () => {
        const operation = createManagementOperation({
          user: await prisma.user.findUniqueOrThrow({
            where: { id: "actor-a" },
          }),
          sessionId: (
            await prisma.session.findFirstOrThrow({
              where: { userId: "actor-a" },
            })
          ).id,
        })
        const before = await counts()
        assert.equal(
          await usersRepository.updateStatus(
            "client",
            "STAFF",
            true,
            false,
            operation,
          ),
          null,
        )
        assert.equal(
          await usersRepository.changePasswordAndRevokeSessions(
            "client",
            "stale-expected-hash",
            "must-not-be-stored",
            operation,
          ),
          false,
        )
        assert.equal(
          await usersRepository.softDeleteInactiveUser(
            "client",
            "USER",
            operation,
          ),
          false,
        )
        assert.equal(
          await usersRepository.restoreUser(
            "client",
            "USER",
            new Date(0),
            operation,
          ),
          null,
        )
        assert.equal(
          await usersRepository.permanentlyDeleteUser(
            "client",
            "USER",
            operation,
          ),
          false,
        )
        await assert.rejects(
          usersRepository.changeUserRoleWithSync(
            "client",
            "STAFF",
            "USER",
            syncEmployeeForUser,
            operation,
          ),
          /Role changed/,
        )
        assert.deepEqual(await counts(), before)
        const responses = await Promise.all([
          request("/client/role", "PATCH", { role: "STAFF" }),
          request("/client/role", "PATCH", { role: "STAFF" }, "actor-b"),
        ])
        assert.ok(responses.some((response) => response.status === 200))
        assert.ok(
          responses.every(
            (response) => response.status === 200 || response.status === 409,
          ),
        )
        const roles = await prisma.accountManagementChange.findMany({
          where: { subjectAccountId: "client", action: "ROLE_CHANGED" },
        })
        assert.equal(roles.length, 1)
        assert.deepEqual(roles[0].changes, {
          role: { before: "USER", after: "STAFF" },
        })
        assert.equal(
          await prisma.employee.count({ where: { userId: "client" } }),
          1,
        )
      },
    )

    await t.test(
      "deleting a former administrator retains their account and workforce attribution",
      async () => {
        const accountIds = (
          await prisma.accountManagementChange.findMany({
            where: { actorAccountId: "actor-a" },
          })
        )
          .map((row) => row.id)
          .sort()
        const workforceIds = (
          await prisma.workforceManagementChange.findMany({
            where: { actorAccountId: "actor-a" },
          })
        )
          .map((row) => row.id)
          .sort()
        assert.ok(accountIds.length && workforceIds.length)
        assert.equal(
          (
            await request(
              "/actor-a/status",
              "PATCH",
              { isActive: false },
              "actor-b",
            )
          ).status,
          200,
        )
        assert.equal(
          (await request("/actor-a", "DELETE", undefined, "actor-b")).status,
          200,
        )
        assert.equal(
          (await request("/actor-a/permanent", "DELETE", undefined, "actor-b"))
            .status,
          200,
        )
        assert.deepEqual(
          (
            await prisma.accountManagementChange.findMany({
              where: { actorAccountId: "actor-a" },
            })
          )
            .map((row) => row.id)
            .sort(),
          accountIds,
        )
        assert.deepEqual(
          (
            await prisma.workforceManagementChange.findMany({
              where: { actorAccountId: "actor-a" },
            })
          )
            .map((row) => row.id)
            .sort(),
          workforceIds,
        )
      },
    )
  },
)
