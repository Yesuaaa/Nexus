import assert from "node:assert/strict"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import {
  AccountManagementAction as AccountAction,
  AccountManagementOrigin as AccountOrigin,
  WorkforceManagementAction as WorkforceAction,
  WorkforceManagementOrigin as WorkforceOrigin,
  WorkforceManagementSubject as Subject,
  Role,
} from "../../../src/generated/prisma/client.js"
import {
  createManagementOperation,
  type ManagementOperation,
} from "../../../src/shared/management-history.js"
import {
  writeAccountManagementChange,
  type AccountManagementChangeInput,
} from "../../../src/features/users/account-management-history.js"
import {
  writeWorkforceManagementChange,
  type WorkforceManagementChangeInput,
} from "../../../src/features/employees/workforce-management-history.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import {
  applyMigrations,
  readMigration,
  startPgliteApp,
} from "../../support/pglite-app.js"

const migration = "20261115030000_management_attribution"

test(
  "management history migration applies to a fresh offline schema without foreign keys",
  { timeout: 120_000 },
  async (t) => {
    const db = new PGlite()
    t.after(() => db.close())
    await applyMigrations(db)
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('AccountManagementChange', 'WorkforceManagementChange') ORDER BY table_name`,
    )
    assert.deepEqual(
      tables.rows.map((r) => r.table_name),
      ["AccountManagementChange", "WorkforceManagementChange"],
    )
    const constraints = await db.query(
      `SELECT conname FROM pg_constraint WHERE contype = 'f' AND conrelid IN ('"AccountManagementChange"'::regclass, '"WorkforceManagementChange"'::regclass)`,
    )
    assert.equal(constraints.rows.length, 0)
    const indexes = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('AccountManagementChange', 'WorkforceManagementChange')`,
    )
    assert.equal(indexes.rows.length, 8) // Six lookup indexes plus two primary keys.
  },
)

test(
  "management history writers are bounded, atomic and deletion-independent",
  { timeout: 120_000 },
  async (t) => {
    let preservedTables = 0
    const { prisma, db, base } = await startPgliteApp(t, {
      migrate: async (database) => {
        await applyMigrations(database, (name) => name < migration)
        await database.exec(`
        INSERT INTO "User" (id, email, "passwordHash", role, "updatedAt") VALUES
          ('actor', 'actor@example.test', 'credential-sentinel', 'SUPERADMIN', CURRENT_TIMESTAMP),
          ('subject', 'subject@example.test', 'subject-credential-sentinel', 'STAFF', CURRENT_TIMESTAMP);
        INSERT INTO "Department" (id, name, "headId", "updatedAt") VALUES ('department', 'Original department', 'subject', CURRENT_TIMESTAMP);
        INSERT INTO "Team" (id, name, "departmentId", "updatedAt") VALUES ('team', 'Original team', 'department', CURRENT_TIMESTAMP);
        INSERT INTO "Employee" (id, "employeeId", "fullName", "userId", "departmentId", "teamId", "updatedAt") VALUES ('employee', 'EMP-001', 'Personal name sentinel', 'subject', 'department', 'team', CURRENT_TIMESTAMP);
      `)
        const tables = await database.query<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
        )
        const snapshots = new Map<string, unknown>()
        async function snapshot(name: string) {
          return (
            await database.query(
              `SELECT to_jsonb(t) AS row FROM "${name.replaceAll('"', '""')}" t ORDER BY to_jsonb(t)::text`,
            )
          ).rows
        }
        for (const { tablename } of tables.rows)
          snapshots.set(tablename, await snapshot(tablename))
        await database.exec(await readMigration(migration))
        for (const [name, before] of snapshots)
          assert.deepEqual(
            await snapshot(name),
            before,
            `migration changed ${name}`,
          )
        preservedTables = snapshots.size
      },
    })
    assert.ok(preservedTables > 20)
    assert.equal(await prisma.accountManagementChange.count(), 0)
    assert.equal(await prisma.workforceManagementChange.count(), 0)
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: "actor" },
    })
    const session = await issueSession(actor)
    const persistedSession = await prisma.session.findFirstOrThrow({
      where: { userId: actor.id },
    })
    const auth = { user: actor, sessionId: persistedSession.id }
    const operation = createManagementOperation(auth)
    const account: AccountManagementChangeInput = {
      action: AccountAction.ROLE_CHANGED,
      origin: AccountOrigin.ACCOUNT_MANAGEMENT,
      subjectAccountId: "subject",
      changedFields: ["role"],
      changes: { role: { before: Role.USER, after: Role.STAFF } },
    }
    const workforce: WorkforceManagementChangeInput = {
      action: WorkforceAction.ASSIGNMENT_CHANGED,
      origin: WorkforceOrigin.DEPARTMENT_MANAGEMENT,
      subjectType: Subject.EMPLOYEE,
      subjectId: "employee",
      changedFields: ["teamId"],
      changes: { teamId: { before: null, after: "team" } },
    }
    await t.test(
      "factory snapshots authenticated administrators and generates immutable independent operations",
      () => {
        assert.equal(operation.actorAccountId, actor.id)
        assert.equal(operation.actorRoleAtTime, "SUPERADMIN")
        assert.match(operation.operationId, /^[0-9a-f-]{36}$/)
        assert.notEqual(
          createManagementOperation(auth).operationId,
          operation.operationId,
        )
        assert.ok(Object.isFrozen(operation))
        assert.throws(() =>
          Object.assign(operation, { actorAccountId: "forged" }),
        )
        assert.deepEqual(Object.keys(operation).sort(), [
          "actorAccountId",
          "actorRoleAtTime",
          "operationId",
        ])
        for (const role of [Role.STAFF, Role.USER])
          assert.throws(() =>
            createManagementOperation({ ...auth, user: { ...actor, role } }),
          )
        assert.throws(() =>
          createManagementOperation({
            ...auth,
            user: { ...actor, isActive: false },
          }),
        )
        assert.throws(() =>
          createManagementOperation({
            ...auth,
            user: { ...actor, accountDeletedAt: new Date() },
          }),
        )
        assert.throws(() =>
          createManagementOperation({ ...auth, sessionId: "" }),
        )
        assert.equal(
          createManagementOperation({
            ...auth,
            user: { ...actor, role: Role.ADMIN },
          }).actorRoleAtTime,
          Role.ADMIN,
        )
      },
    )
    await t.test(
      "both writers commit trusted metadata and database timestamps in one caller transaction",
      async () => {
        const before = Date.now() - 1000
        const rows = await prisma.$transaction(async (tx) => [
          await writeAccountManagementChange(tx, operation, account),
          await writeWorkforceManagementChange(tx, operation, workforce),
        ])
        for (const row of rows) {
          assert.equal(row.actorAccountId, "actor")
          assert.equal(row.actorRoleAtTime, "SUPERADMIN")
          assert.equal(row.operationId, operation.operationId)
          assert.ok(
            row.createdAt.getTime() >= before &&
              row.createdAt.getTime() <= Date.now() + 1000,
          )
          assert.ok(row.id)
        }
        assert.deepEqual(rows[0].changes, account.changes)
        assert.deepEqual(rows[1].changes, workforce.changes)
      },
    )
    await t.test(
      "rollbacks undo business writes and both histories, including history insertion failures",
      async () => {
        const counts = [
          await prisma.accountManagementChange.count(),
          await prisma.workforceManagementChange.count(),
        ]
        await assert.rejects(
          prisma.$transaction(async (tx) => {
            await tx.department.update({
              where: { id: "department" },
              data: { name: "Rolled back" },
            })
            await writeAccountManagementChange(tx, operation, account)
            await writeWorkforceManagementChange(tx, operation, workforce)
            throw new Error("abort")
          }),
          /abort/,
        )
        await db.exec(
          `CREATE FUNCTION reject_history_insert() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'history unavailable'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW EXECUTE FUNCTION reject_history_insert();`,
        )
        try {
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.department.update({
                where: { id: "department" },
                data: { name: "Must roll back too" },
              })
              await writeAccountManagementChange(tx, operation, account)
              await writeWorkforceManagementChange(tx, operation, workforce)
            }),
            /history unavailable/,
          )
        } finally {
          await db.exec(
            `DROP TRIGGER reject_history ON "WorkforceManagementChange"; DROP FUNCTION reject_history_insert();`,
          )
        }
        assert.equal(
          (
            await prisma.department.findUniqueOrThrow({
              where: { id: "department" },
            })
          ).name,
          "Original department",
        )
        assert.deepEqual(
          [
            await prisma.accountManagementChange.count(),
            await prisma.workforceManagementChange.count(),
          ],
          counts,
        )
      },
    )
    await t.test(
      "closed action catalogs accept each supported action and its bounded subject payload",
      async () => {
        const at = "2026-11-15T03:00:00.000Z"
        const accounts: AccountManagementChangeInput[] = [
          {
            ...account,
            action: "CREATED",
            origin: "EMPLOYEE_MANAGEMENT",
            changedFields: ["role", "isActive"],
            changes: {
              role: { before: null, after: "STAFF" },
              isActive: { before: null, after: true },
            },
          },
          {
            ...account,
            action: "PROFILE_UPDATED",
            origin: "CLIENT_MANAGEMENT",
            changedFields: ["email"],
            changes: {},
          },
          account,
          {
            ...account,
            action: "STATUS_CHANGED",
            changedFields: ["isActive"],
            changes: {
              isActive: { before: true, after: false },
              sessionsRevoked: true,
            },
          },
          {
            ...account,
            action: "PASSWORD_RESET",
            changedFields: [],
            changes: { sessionsRevoked: true },
          },
          {
            ...account,
            action: "ARCHIVED",
            changedFields: ["accountDeletedAt"],
            changes: {
              accountDeletedAt: { before: null, after: at },
              sessionsRevoked: true,
            },
          },
          {
            ...account,
            action: "RESTORED",
            changedFields: ["accountDeletedAt"],
            changes: {
              accountDeletedAt: { before: at, after: null },
              sessionsRevoked: true,
            },
          },
          { ...account, action: "DELETED", changedFields: [], changes: {} },
        ]
        const workforces: WorkforceManagementChangeInput[] = [
          {
            ...workforce,
            action: "CREATED",
            subjectType: "DEPARTMENT",
            subjectId: "department",
            changedFields: ["name", "headId"],
            changes: { headId: { before: null, after: "subject" } },
          },
          {
            ...workforce,
            action: "PROFILE_UPDATED",
            changedFields: ["employmentType"],
            changes: {
              employmentType: { before: "FULL_TIME", after: "PART_TIME" },
            },
          },
          {
            ...workforce,
            action: "STATUS_CHANGED",
            subjectType: "EMPLOYEE",
            changedFields: ["status"],
            changes: { status: { before: "ACTIVE", after: "ON_LEAVE" } },
          },
          workforce,
          {
            ...workforce,
            action: "HEAD_CHANGED",
            subjectType: "DEPARTMENT",
            subjectId: "department",
            changedFields: ["headId"],
            changes: { headId: { before: "subject", after: null } },
          },
          {
            ...workforce,
            action: "TEMPORARY_HEAD_CHANGED",
            subjectType: "DEPARTMENT",
            subjectId: "department",
            changedFields: [
              "temporaryHeadOriginalId",
              "temporaryHeadAssignedId",
            ],
            changes: {
              temporaryHeadOriginalId: { before: null, after: "subject" },
              temporaryHeadAssignedId: { before: null, after: "subject" },
            },
          },
          {
            ...workforce,
            action: "LEAD_CHANGED",
            subjectType: "TEAM",
            subjectId: "team",
            changedFields: ["leadId"],
            changes: { leadId: { before: null, after: "subject" } },
          },
          {
            ...workforce,
            action: "TITLE_CLEARED",
            subjectType: "EMPLOYEE",
            changedFields: ["position"],
            changes: { cause: "FORMER_DEPARTMENT_HEAD" },
          },
          {
            ...workforce,
            action: "DELETED",
            subjectType: "TEAM",
            subjectId: "team",
            changedFields: [],
            changes: {},
          },
        ]
        await prisma.$transaction(async (tx) => {
          for (const input of accounts)
            await writeAccountManagementChange(tx, operation, input)
          for (const input of workforces)
            await writeWorkforceManagementChange(tx, operation, input)
        })
        assert.deepEqual(
          [
            ...new Set(
              (await prisma.accountManagementChange.findMany()).map(
                (row) => row.action,
              ),
            ),
          ].sort(),
          Object.values(AccountAction).sort(),
        )
        assert.deepEqual(
          [
            ...new Set(
              (await prisma.workforceManagementChange.findMany()).map(
                (row) => row.action,
              ),
            ),
          ].sort(),
          Object.values(WorkforceAction).sort(),
        )
      },
    )
    await t.test(
      "untrusted contexts, unknown keys, personal values and malformed transitions are rejected",
      async () => {
        const counts = [
          await prisma.accountManagementChange.count(),
          await prisma.workforceManagementChange.count(),
        ]
        await assert.rejects(
          prisma.$transaction((tx) =>
            writeAccountManagementChange(
              tx,
              { ...operation } as ManagementOperation,
              account,
            ),
          ),
          /created by the backend/,
        )
        const rejectedAccount: unknown[] = [
          ...[
            "actorAccountId",
            "actorRoleAtTime",
            "operationId",
            "createdAt",
            "password",
            "passwordHash",
            "token",
            "request",
          ].map((key) => ({ ...account, [key]: "private-sentinel" })),
          { ...account, action: "UNKNOWN" },
          { ...account, origin: "UNKNOWN" },
          { ...account, origin: AccountOrigin.CLIENT_MANAGEMENT },
          { ...account, changedFields: ["role", "role"] },
          { ...account, changedFields: ["passwordHash"] },
          {
            ...account,
            changedFields: ["fullName"],
            changes: { fullName: "Personal name sentinel" },
          },
          {
            ...account,
            changes: {
              role: {
                before: "USER",
                after: "SUPERADMIN",
                passwordHash: "secret",
              },
            },
          },
          {
            ...account,
            changes: { role: { before: "USER", after: "Not a role" } },
          },
          { ...account, changes: {} },
          { ...account, changedFields: [], changes: account.changes },
          { ...account, subjectAccountId: "secret@example.test" },
          { ...account, subjectAccountId: "x".repeat(81) },
          {
            ...account,
            changes: {
              role: { before: "USER", after: { password: "secret" } },
            },
          },
          {
            ...account,
            changes: {
              role: { before: "USER", after: "STAFF", toJSON: "secret" },
            },
          },
          {
            ...account,
            changes: {
              role: { before: "USER", after: "STAFF" },
              [Symbol("hidden")]: "secret",
            },
          },
          {
            ...account,
            action: "CREATED",
            changedFields: ["role", "isActive"],
            changes: {
              role: { before: "STAFF", after: "USER" },
              isActive: { before: null, after: true },
            },
          },
          {
            ...account,
            action: "PASSWORD_RESET",
            changedFields: [],
            changes: { sessionsRevoked: false },
          },
          {
            ...account,
            action: "ARCHIVED",
            changedFields: ["accountDeletedAt"],
            changes: {
              accountDeletedAt: {
                before: null,
                after: "2026-02-30T00:00:00.000Z",
              },
              sessionsRevoked: true,
            },
          },
        ]
        let accessorReads = 0
        rejectedAccount.push(
          {
            ...account,
            action: "STATUS_CHANGED",
            changedFields: [],
            changes: { sessionsRevoked: false },
          },
          {
            ...account,
            action: "PROFILE_UPDATED",
            origin: "CLIENT_MANAGEMENT",
            changedFields: ["fullName"],
            changes: { fullName: "Personal name sentinel" },
          },
          Object.assign(Object.create({ hidden: "private-sentinel" }), account),
          Object.defineProperty({ ...account }, "changes", {
            enumerable: true,
            get() {
              accessorReads++
              return account.changes
            },
          }),
          { ...account, changedFields: new Array(1) },
          {
            ...account,
            changedFields: Object.defineProperty(["role"], "0", {
              enumerable: true,
              get() {
                accessorReads++
                return "role"
              },
            }),
          },
        )
        const rejectedWorkforce: unknown[] = [
          {
            ...workforce,
            action: "TEMPORARY_HEAD_CHANGED",
            subjectType: "DEPARTMENT",
            changedFields: [],
            changes: {},
          },
          {
            ...workforce,
            action: "PROFILE_UPDATED",
            changedFields: ["email"],
            changes: { email: "private@example.test" },
          },
          { ...workforce, action: "UNKNOWN" },
          { ...workforce, origin: "UNKNOWN" },
          { ...workforce, subjectType: "USER" },
          {
            ...workforce,
            changes: {
              teamId: {
                before: null,
                after: "team",
                email: "private@example.test",
              },
            },
          },
          ...[
            "fullName",
            "email",
            "contactNumber",
            "position",
            "profileBio",
            "passwordHash",
            "accessToken",
          ].map((key) => ({
            ...workforce,
            changes: { [key]: "private-sentinel" },
          })),
          {
            ...workforce,
            action: "STATUS_CHANGED",
            subjectType: "DEPARTMENT",
            changedFields: ["status"],
            changes: { status: { before: "ACTIVE", after: "INACTIVE" } },
          },
          {
            ...workforce,
            action: "HEAD_CHANGED",
            changedFields: ["headId"],
            changes: { headId: { before: null, after: "subject" } },
          },
          {
            ...workforce,
            changes: { teamId: { before: null, after: "x".repeat(81) } },
          },
          { ...workforce, changedFields: ["userId"], changes: {} },
          {
            ...workforce,
            action: "TITLE_CLEARED",
            changedFields: ["position"],
            changes: { cause: "arbitrary text" },
          },
          {
            ...workforce,
            action: "STATUS_CHANGED",
            changedFields: ["status"],
            changes: { status: { before: "ACTIVE", after: "UNKNOWN" } },
          },
          { ...workforce, action: "DELETED", changedFields: [], changes: {} },
        ]
        for (const input of rejectedAccount)
          await assert.rejects(
            prisma.$transaction((tx) =>
              writeAccountManagementChange(
                tx,
                operation,
                input as AccountManagementChangeInput,
              ),
            ),
          )
        for (const input of rejectedWorkforce)
          await assert.rejects(
            prisma.$transaction((tx) =>
              writeWorkforceManagementChange(
                tx,
                operation,
                input as WorkforceManagementChangeInput,
              ),
            ),
          )
        assert.equal(
          accessorReads,
          0,
          "validation must reject accessors without reading them",
        )
        assert.deepEqual(
          [
            await prisma.accountManagementChange.count(),
            await prisma.workforceManagementChange.count(),
          ],
          counts,
        )
      },
    )
    await t.test(
      "profile edits retain field names only and password resets retain completion only",
      async () => {
        await prisma.$transaction(async (tx) => {
          await writeAccountManagementChange(tx, operation, {
            ...account,
            action: "PROFILE_UPDATED",
            origin: "CLIENT_MANAGEMENT",
            changedFields: ["fullName", "email", "contactNumber"],
            changes: {},
          })
          await writeAccountManagementChange(tx, operation, {
            ...account,
            action: "PASSWORD_RESET",
            changedFields: [],
            changes: { sessionsRevoked: true },
          })
          await writeWorkforceManagementChange(tx, operation, {
            ...workforce,
            action: "PROFILE_UPDATED",
            changedFields: [
              "fullName",
              "email",
              "contactNumber",
              "position",
              "startDate",
            ],
            changes: {},
          })
        })
        const stored = JSON.stringify([
          await prisma.accountManagementChange.findMany(),
          await prisma.workforceManagementChange.findMany(),
        ])
        for (const secret of [
          "credential-sentinel",
          "Personal name sentinel",
          "actor@example.test",
          "subject@example.test",
          session.token,
          session.refreshToken,
        ])
          assert.ok(!stored.includes(secret))
      },
    )
    await t.test(
      "Department updates reuse bounded history and preserve permission scopes",
      async () => {
        const existingIds = new Set(
          (
            await prisma.workforceManagementChange.findMany({
              select: { id: true },
            })
          ).map((row) => row.id),
        )
        const counts = [
          await prisma.accountManagementChange.count(),
          await prisma.workforceManagementChange.count(),
        ]
        const headers = {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        }
        const response = await fetch(`${base}/departments/department`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ name: "Existing authorized update" }),
        })
        assert.equal(response.status, 200, await response.text())
        const staff = await prisma.user.findUniqueOrThrow({
          where: { id: "subject" },
        })
        const staffSession = await issueSession(staff)
        const denied = await fetch(`${base}/departments/department`, {
          method: "PUT",
          headers: {
            ...headers,
            Authorization: `Bearer ${staffSession.token}`,
          },
          body: JSON.stringify({ name: "Denied" }),
        })
        assert.equal(denied.status, 403)
        assert.deepEqual(
          [
            await prisma.accountManagementChange.count(),
            await prisma.workforceManagementChange.count(),
          ],
          [counts[0], counts[1] + 1],
        )
        const changes = (
          await prisma.workforceManagementChange.findMany({
            where: { origin: "DEPARTMENT_MANAGEMENT" },
          })
        ).filter((row) => !existingIds.has(row.id))
        assert.equal(changes.length, 1)
        assert.equal(changes[0].actorAccountId, "actor")
        assert.equal(changes[0].subjectId, "department")
        assert.equal(changes[0].action, "PROFILE_UPDATED")
        assert.deepEqual(changes[0].changedFields, ["name"])
        assert.deepEqual(changes[0].changes, {})
      },
    )
    await t.test(
      "deleting actor and subjects preserves identity snapshots and original SetNull/cascade behavior",
      async () => {
        await prisma.user.delete({ where: { id: "actor" } })
        await prisma.user.delete({ where: { id: "subject" } })
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { id: "employee" },
            })
          ).userId,
          null,
        )
        await prisma.department.delete({ where: { id: "department" } })
        assert.equal(await prisma.team.count(), 0)
        await prisma.employee.delete({ where: { id: "employee" } })
        assert.ok(await prisma.accountManagementChange.count())
        assert.ok(await prisma.workforceManagementChange.count())
        for (const row of await prisma.accountManagementChange.findMany()) {
          assert.equal(row.actorAccountId, "actor")
          assert.equal(row.subjectAccountId, "subject")
        }
        for (const row of await prisma.workforceManagementChange.findMany()) {
          assert.equal(row.actorAccountId, "actor")
          assert.ok(["employee", "department", "team"].includes(row.subjectId))
        }
      },
    )
  },
)
