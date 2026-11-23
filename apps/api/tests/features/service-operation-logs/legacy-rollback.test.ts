import assert from "node:assert/strict"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { applyMigrations, readMigration } from "../../support/pglite-app.js"

test(
  "branch 266 rollback preserves history and only removes its guards",
  { timeout: 120000 },
  async () => {
    const db = new PGlite()
    try {
      await applyMigrations(
        db,
        (name) => name < "20261117160000_revert_branch266_history_guards",
      )
      await db.exec(
        `INSERT INTO "AccountManagementChange" (id,"actorAccountId","actorRoleAtTime","operationId","subjectAccountId",action,origin,"changedFields",changes) VALUES ('rollback-proof','actor','SUPERADMIN','00000000-0000-4000-8000-000000000001','subject','CREATED','ACCOUNT_MANAGEMENT',ARRAY[]::text[],'{}');`,
      )
      const before = await db.query(`SELECT * FROM "AccountManagementChange"`)
      await db.exec(
        `INSERT INTO "WorkforceManagementChange" (id,"actorAccountId","actorRoleAtTime","operationId","subjectType","subjectId",action,origin,"changedFields",changes) VALUES ('workforce-proof','actor','SUPERADMIN','00000000-0000-4000-8000-000000000001','EMPLOYEE','employee','CREATED','EMPLOYEE_MANAGEMENT',ARRAY[]::text[],'{}');`,
      )
      const workforceBefore = await db.query(
        `SELECT * FROM "WorkforceManagementChange"`,
      )
      await assert.rejects(
        db.exec(
          `UPDATE "AccountManagementChange" SET "actorAccountId"='changed' WHERE false`,
        ),
        /append-only/,
      )
      const sql = await readMigration(
        "20261117160000_revert_branch266_history_guards",
      )
      await db.transaction(async (tx) => {
        await tx.exec(sql)
      })
      assert.deepEqual(
        (await db.query(`SELECT * FROM "AccountManagementChange"`)).rows,
        before.rows,
      )
      assert.deepEqual(
        (await db.query(`SELECT * FROM "WorkforceManagementChange"`)).rows,
        workforceBefore.rows,
      )
      assert.deepEqual(
        (
          await db.query(
            `SELECT tgname FROM pg_trigger WHERE tgname IN ('account_management_history_immutable','workforce_management_history_immutable')`,
          )
        ).rows,
        [],
      )
      assert.deepEqual(
        (
          await db.query(
            `SELECT proname FROM pg_proc WHERE proname='reject_management_history_mutation'`,
          )
        ).rows,
        [],
      )
      await db.exec(
        `UPDATE "AccountManagementChange" SET "actorAccountId"='changed' WHERE false`,
      )
      assert.ok(
        (
          await db.query<{ relation: string | null }>(
            `SELECT to_regclass('public."ServiceOperationLog"') AS relation`,
          )
        ).rows[0].relation,
      )
      // Compensation can also be safely rerun after an operator retry.
      await db.transaction(async (tx) => {
        await tx.exec(sql)
      })
    } finally {
      await db.close()
    }
  },
)
