import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import {
  applyMigrations,
  readMigration,
  startPgliteDatabase,
} from "../../support/pglite-app.js"
import { createManagementOperation } from "../../../src/shared/management-history.js"
import { writeAccountManagementChange } from "../../../src/features/users/account-management-history.js"
import { writeWorkforceManagementChange } from "../../../src/features/employees/workforce-management-history.js"

const hardening = "20261116130000_management_history_immutability"

test("management history upgrade preserves append/read and rejects destructive SQL", async (t) => {
  const { db, prisma } = await startPgliteDatabase(t, {
    migrate: (database) =>
      applyMigrations(database, (name) => name !== hardening),
  })
  const actor = await prisma.user.create({
    data: {
      id: "history-actor",
      email: "history-actor@example.test",
      passwordHash: "unused",
      role: "SUPERADMIN",
    },
  })
  const subject = await prisma.user.create({
    data: {
      id: "history-subject",
      email: "history-subject@example.test",
      passwordHash: "unused",
    },
  })
  const team = await prisma.team.create({
    data: {
      id: "history-team",
      name: "History team",
      department: { create: { id: "history-department", name: "History" } },
    },
  })
  const operation = createManagementOperation({
    user: actor,
    sessionId: "fixture-session",
  })
  const append = (tx: Parameters<typeof writeAccountManagementChange>[0]) =>
    Promise.all([
      writeAccountManagementChange(tx, operation, {
        subjectAccountId: subject.id,
        action: "PROFILE_UPDATED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: ["fullName"],
        changes: {},
      }),
      writeWorkforceManagementChange(tx, operation, {
        subjectType: "TEAM",
        subjectId: team.id,
        action: "PROFILE_UPDATED",
        origin: "TEAM_MANAGEMENT",
        changedFields: ["description"],
        changes: {},
      }),
    ])
  await prisma.$transaction(append)
  const snapshot = async () => ({
    account: await prisma.accountManagementChange.findMany({
      orderBy: { id: "asc" },
    }),
    workforce: await prisma.workforceManagementChange.findMany({
      orderBy: { id: "asc" },
    }),
  })
  const before = await snapshot()
  const policies =
    await db.query(`SELECT relname, relrowsecurity, relforcerowsecurity, relacl
    FROM pg_class WHERE oid IN ('public."AccountManagementChange"'::regclass,
    'public."WorkforceManagementChange"'::regclass) ORDER BY relname`)
  await db.exec(await readMigration(hardening))

  await t.test(
    "forward migration preserves existing rows, ACLs and RLS settings",
    async () => {
      assert.deepEqual(await snapshot(), before)
      assert.deepEqual(
        (
          await db.query(`SELECT relname, relrowsecurity, relforcerowsecurity, relacl
      FROM pg_class WHERE oid IN ('public."AccountManagementChange"'::regclass,
      'public."WorkforceManagementChange"'::regclass) ORDER BY relname`)
        ).rows,
        policies.rows,
      )
    },
  )

  await t.test(
    "existing transactional writers still append and retain operation attribution",
    async () => {
      await prisma.$transaction(append)
      const rows = await snapshot()
      for (const records of [rows.account, rows.workforce]) {
        assert.equal(records.length, 2)
        for (const record of records) {
          assert.equal(record.actorAccountId, actor.id)
          assert.equal(record.actorRoleAtTime, "SUPERADMIN")
          assert.equal(record.operationId, operation.operationId)
        }
      }
    },
  )

  await t.test(
    "UPDATE, DELETE, TRUNCATE and conflict updates fail without changing rows",
    async () => {
      const saved = await snapshot()
      for (const table of [
        "AccountManagementChange",
        "WorkforceManagementChange",
      ]) {
        for (const statement of [
          `UPDATE public."${table}" SET "actorAccountId" = 'forged'`,
          `UPDATE public."${table}" SET "actorAccountId" = 'forged' WHERE false`,
          `DELETE FROM public."${table}"`,
          `DELETE FROM public."${table}" WHERE false`,
          `TRUNCATE TABLE public."${table}" CASCADE`,
          `INSERT INTO public."${table}" SELECT * FROM public."${table}" LIMIT 1
          ON CONFLICT (id) DO UPDATE SET "actorAccountId" = EXCLUDED."actorAccountId"`,
        ]) {
          await assert.rejects(
            db.exec(statement),
            (error: unknown) =>
              error instanceof Error &&
              "code" in error &&
              error.code === "23514",
          )
          assert.deepEqual(await snapshot(), saved)
        }
        await db.exec(`INSERT INTO public."${table}" SELECT * FROM public."${table}"
        ON CONFLICT (id) DO NOTHING`)
        assert.deepEqual(await snapshot(), saved)
      }
    },
  )

  await t.test(
    "a forbidden history change rolls back earlier business and history writes",
    async () => {
      const saved = await snapshot()
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: subject.id },
            data: { fullName: "Must roll back" },
          })
          await append(tx)
          await tx.$executeRaw`DELETE FROM "AccountManagementChange"`
        }),
        /Management history is append-only/,
      )
      assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { id: subject.id } }))
          .fullName,
        null,
      )
      assert.deepEqual(await snapshot(), saved)
    },
  )

  await t.test(
    "late history insert failure rolls back business and prior history inserts",
    async () => {
      const saved = await snapshot()
      const duplicateId = saved.account[0].id
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: subject.id },
            data: { fullName: "Must also roll back" },
          })
          await append(tx)
          await tx.accountManagementChange.create({
            data: { ...saved.account[0], id: duplicateId, changes: {} },
          })
        }),
        /Unique constraint/,
      )
      assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { id: subject.id } }))
          .fullName,
        null,
      )
      assert.deepEqual(await snapshot(), saved)
    },
  )

  await t.test(
    "deleting original subjects and actor preserves historical identity and timestamps",
    async () => {
      const saved = await snapshot()
      await prisma.team.delete({ where: { id: team.id } })
      await prisma.user.deleteMany({
        where: { id: { in: [actor.id, subject.id] } },
      })
      assert.deepEqual(await snapshot(), saved)
      // New history may reference unavailable identities; these scalars remain intentional.
      await prisma.accountManagementChange.create({
        data: { ...saved.account[0], id: randomUUID(), changes: {} },
      })
      assert.equal(
        await prisma.accountManagementChange.count(),
        saved.account.length + 1,
      )
    },
  )
})
