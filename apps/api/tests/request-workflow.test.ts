import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { parseAction } from "../src/features/request-workflow/workflow.validation.js"
import { migrationNames, readMigration } from "./support/pglite-app.js"
import { createWorkflowContext } from "./request-workflow/context.js"
import { acceptanceAndRequirements } from "./request-workflow/requirements.js"
import { quotations } from "./request-workflow/quotations.js"
import { activationAndStaffing } from "./request-workflow/activation.js"
import { checkoutAndAuthorization } from "./request-workflow/checkout-and-authorization.js"
import { fixedPriceAndNotifications } from "./request-workflow/fixed-price-and-notifications.js"

test("request information requires nonblank details", () => {
  for (const details of [undefined, "", "   "]) {
    assert.throws(
      () =>
        parseAction({
          actionId: randomUUID(),
          expectedVersion: 1,
          type: "REQUEST_REQUIREMENT",
          title: "Documents",
          mandatory: true,
          details,
        }),
      /Invalid details/,
    )
  }
})

test("requirement attachments accept 1–5 distinct IDs and reject invalid batches", () => {
  const action = {
    actionId: randomUUID(),
    expectedVersion: 1,
    type: "SUBMIT_REQUIREMENT",
    requirementId: "requirement-1",
    submission: "",
  }
  for (let count = 1; count <= 5; count++) {
    const fileIds = Array.from({ length: count }, (_, i) => `file-${i}`)
    assert.deepEqual(parseAction({ ...action, fileIds }).command, {
      type: action.type,
      requirementId: action.requirementId,
      submission: "",
      fileIds,
    })
  }
  for (const fileIds of [
    [],
    Array.from({ length: 6 }, (_, i) => `file-${i}`),
    ["file-1", "file-1"],
    ["file-1", null],
    ["file-1", "invalid/file"],
    "file-1",
    null,
  ])
    assert.throws(() => parseAction({ ...action, fileIds }))
  assert.throws(() =>
    parseAction({ ...action, fileId: "file-1", fileIds: ["file-2"] }),
  )
  assert.throws(() => parseAction(action), /Submit text or a file/)
  assert.doesNotThrow(() => parseAction({ ...action, submission: "Text only" }))
  assert.doesNotThrow(() => parseAction({ ...action, fileId: "legacy-file" }))
})

test("attachment migration preserves existing single-file submissions", async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TABLE "WorkflowFile" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "WorkflowRequirement" ("id" TEXT PRIMARY KEY, "fileId" TEXT);
      INSERT INTO "WorkflowFile" VALUES ('legacy-file');
      INSERT INTO "WorkflowRequirement" VALUES ('with-file', 'legacy-file'), ('text-only', NULL);
    `)
    await db.exec(await readMigration("20261106000000_requirement_attachments"))
    assert.deepEqual(
      (await db.query('SELECT * FROM "_RequirementAttachments"')).rows,
      [{ A: "legacy-file", B: "with-file" }],
    )
    assert.deepEqual(
      (
        await db.query(
          `SELECT relrowsecurity FROM pg_class WHERE relname = '_RequirementAttachments'`,
        )
      ).rows,
      [{ relrowsecurity: true }],
    )
  } finally {
    await db.close()
  }
})

const workflowMigrationName = "20261031010000_request_workflow"

test("quotation acceptance migration releases paid bookings and preserves holds and documents", async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TYPE "RequestWorkflowState" AS ENUM ('AGREEMENT_PAYMENT_PENDING', 'READY_FOR_ACTIVATION', 'ON_HOLD', 'CANCELLED');
      CREATE TABLE "RequestWorkflow" ("requestId" TEXT PRIMARY KEY, "state" "RequestWorkflowState", "previousState" "RequestWorkflowState", "paymentRequired" BOOLEAN, "version" INT DEFAULT 1, "updatedAt" TIMESTAMP);
      CREATE TABLE "WorkflowApproval" ("requestId" TEXT, "approvedById" TEXT, "approvedAt" TIMESTAMP DEFAULT '2026-11-01');
      CREATE TABLE "WorkflowAgreement" ("requestId" TEXT, "status" TEXT, "reviewedById" TEXT, "reviewedAt" TIMESTAMP, "signedFileId" TEXT);
      CREATE TABLE "WorkflowPayment" ("requestId" TEXT, "status" TEXT);
      CREATE TABLE "WorkflowRequirement" ("requestId" TEXT, "mandatory" BOOLEAN, "status" TEXT);
      INSERT INTO "RequestWorkflow" ("requestId", "state", "previousState", "paymentRequired") VALUES
        ('paid', 'AGREEMENT_PAYMENT_PENDING', NULL, true),
        ('unpaid', 'AGREEMENT_PAYMENT_PENDING', NULL, true),
        ('held', 'ON_HOLD', 'AGREEMENT_PAYMENT_PENDING', true),
        ('outstanding', 'AGREEMENT_PAYMENT_PENDING', NULL, true),
        ('cancelled', 'CANCELLED', NULL, true),
        ('unaccepted', 'AGREEMENT_PAYMENT_PENDING', NULL, true),
        ('no-payment', 'AGREEMENT_PAYMENT_PENDING', NULL, false);
      INSERT INTO "WorkflowApproval" ("requestId", "approvedById")
        SELECT "requestId", 'client' FROM "RequestWorkflow" WHERE "requestId" <> 'unaccepted';
      INSERT INTO "WorkflowAgreement" ("requestId", "status", "signedFileId")
        SELECT "requestId", 'PENDING', 'existing-signed-copy' FROM "RequestWorkflow";
      INSERT INTO "WorkflowPayment" SELECT "requestId", CASE WHEN "requestId" = 'unpaid' THEN 'SUBMITTED' ELSE 'VERIFIED' END FROM "RequestWorkflow";
      INSERT INTO "WorkflowRequirement" VALUES ('outstanding', true, 'SUBMITTED');
    `)
    await db.exec(
      await readMigration("20261106010000_quotation_acceptance_agreement"),
    )
    const rows = (
      await db.query<{
        requestId: string
        state: string
        previousState: string | null
        version: number
      }>(
        `SELECT "requestId", "state", "previousState", "version" FROM "RequestWorkflow" ORDER BY "requestId"`,
      )
    ).rows
    assert.deepEqual(rows, [
      {
        requestId: "cancelled",
        state: "CANCELLED",
        previousState: null,
        version: 1,
      },
      {
        requestId: "held",
        state: "ON_HOLD",
        previousState: "READY_FOR_ACTIVATION",
        version: 2,
      },
      {
        requestId: "no-payment",
        state: "READY_FOR_ACTIVATION",
        previousState: null,
        version: 2,
      },
      {
        requestId: "outstanding",
        state: "AGREEMENT_PAYMENT_PENDING",
        previousState: null,
        version: 1,
      },
      {
        requestId: "paid",
        state: "READY_FOR_ACTIVATION",
        previousState: null,
        version: 2,
      },
      {
        requestId: "unaccepted",
        state: "AGREEMENT_PAYMENT_PENDING",
        previousState: null,
        version: 1,
      },
      {
        requestId: "unpaid",
        state: "AGREEMENT_PAYMENT_PENDING",
        previousState: null,
        version: 1,
      },
    ])
    const agreements = (
      await db.query<{
        requestId: string
        status: string
        reviewedById: string | null
        signedFileId: string
      }>(
        `SELECT "requestId", "status", "reviewedById", "signedFileId" FROM "WorkflowAgreement"`,
      )
    ).rows
    for (const agreement of agreements) {
      assert.equal(
        agreement.status,
        agreement.requestId === "unaccepted" ? "PENDING" : "APPROVED",
      )
      assert.equal(
        agreement.reviewedById,
        agreement.requestId === "unaccepted" ? null : "client",
      )
      assert.equal(agreement.signedFileId, "existing-signed-copy")
    }
  } finally {
    await db.close()
  }
})

test("workflow migration preserves accepted history without granting approvals", async () => {
  const db = new PGlite()
  try {
    for (const name of (await migrationNames()).filter(
      (name) => name < workflowMigrationName,
    ))
      await db.exec(await readMigration(name))
    await db.exec(`
      INSERT INTO "User" ("id", "email", "passwordHash", "role", "updatedAt") VALUES
        ('migration-client', 'migration-client@example.com', 'private', 'USER', CURRENT_TIMESTAMP),
        ('migration-head', 'migration-head@example.com', 'private', 'STAFF', CURRENT_TIMESTAMP);
      INSERT INTO "Department" ("id", "name", "headId", "updatedAt") VALUES ('migration-department', 'Migration department', 'migration-head', CURRENT_TIMESTAMP);
      INSERT INTO "Service" ("id", "name", "description", "clientRequirements", "requiresConsultation", "updatedAt") VALUES
        ('migration-service', 'Migration service', 'Service', ARRAY['Brand guidelines', 'Project brief'], true, CURRENT_TIMESTAMP);
      INSERT INTO "ServiceRequest" ("id", "clientId", "serviceId", "title", "status", "acceptedDepartmentId", "acceptedById", "acceptedAt", "updatedAt") VALUES
        ('migration-accepted', 'migration-client', 'migration-service', 'Accepted request', 'UNDER_REVIEW', 'migration-department', 'migration-head', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('migration-pending', 'migration-client', 'migration-service', 'Pending request', 'SUBMITTED', NULL, NULL, NULL, CURRENT_TIMESTAMP);
    `)
    await db.exec(await readMigration(workflowMigrationName))
    const records = await db.query<{
      requestId: string
      state: string
      consultationRequired: boolean
      agreementRequired: boolean
      paymentRequired: boolean
    }>(
      'SELECT "requestId", "state", "consultationRequired", "agreementRequired", "paymentRequired" FROM "RequestWorkflow"',
    )
    assert.deepEqual(records.rows, [
      {
        requestId: "migration-accepted",
        state: "CONSULTATION",
        consultationRequired: true,
        agreementRequired: true,
        paymentRequired: true,
      },
    ])
    const requirements = await db.query<{ status: string; mandatory: boolean }>(
      'SELECT "status", "mandatory" FROM "WorkflowRequirement"',
    )
    assert.equal(requirements.rows.length, 2)
    assert.ok(
      requirements.rows.every(
        (row) => row.status === "REQUESTED" && row.mandatory,
      ),
    )
    const approvals = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM "WorkflowApproval"',
    )
    assert.equal(approvals.rows[0]!.count, 0)
    const rls = await db.query<{ enabled: boolean }>(
      `SELECT relrowsecurity AS enabled FROM pg_class WHERE relname IN ('RequestWorkflow', 'WorkflowFile', 'WorkflowApproval', 'WorkflowEvent', 'ProjectStaff')`,
    )
    assert.equal(rls.rows.length, 5)
    assert.ok(rls.rows.every((row) => row.enabled))
    await assert.rejects(
      db.exec('UPDATE "WorkflowEvent" SET "summary" = \'Changed\''),
      /immutable/,
    )
    await assert.rejects(db.exec('DELETE FROM "WorkflowEvent"'), /immutable/)
  } finally {
    await db.close()
  }
})

test(
  "conversation workflow enforces formal approvals, scoped controls and project gates",
  { timeout: 180_000 },
  async (t) => {
    const context = await createWorkflowContext(t)
    await acceptanceAndRequirements(t, context)
    await quotations(t, context)
    await activationAndStaffing(t, context)
    await checkoutAndAuthorization(t, context)
    await fixedPriceAndNotifications(t, context)
  },
)
