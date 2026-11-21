import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import {
  EmployeeStatus,
  EmploymentType,
  PayrollFrequency,
  Role,
} from "../src/generated/prisma/client.js"
import { hashPassword } from "../src/features/auth/auth.password.js"
import { getPrisma } from "../src/lib/db.js"

const runId = process.env.NEXUS_PAYROLL_E2E_RUN_ID
const password = process.env.NEXUS_PAYROLL_E2E_PASSWORD
const mode = process.argv[2]

assert.match(runId ?? "", /^[a-f0-9]{12}$/)
assert.match(password ?? "", /^PayrollC-E2E![a-f0-9]{12}$/)
assert.ok(mode === "seed" || mode === "verify")

const suffix = runId!
const employeeAId = `+PAYC${suffix.toUpperCase()}A`
const employeeBId = `@PAYC${suffix.toUpperCase()}B`
const emails = {
  preparer: `payroll-c-${suffix}-preparer@example.test`,
  approver: `payroll-c-${suffix}-approver@example.test`,
  superadmin: `payroll-c-${suffix}-superadmin@example.test`,
  staffA: `payroll-c-${suffix}-staff-a@example.test`,
  staffB: `payroll-c-${suffix}-staff-b@example.test`,
  user: `payroll-c-${suffix}-user@example.test`,
}

function requirePrisma() {
  const prisma = getPrisma()
  if (!prisma)
    throw new Error("The disposable PostgreSQL DATABASE_URL is required")
  return prisma
}

const prisma = requirePrisma()

async function seed() {
  const [identity] = await prisma.$queryRaw<
    { database: string; role: string; address: string | null }[]
  >`SELECT current_database() AS database, current_user AS role, host(inet_server_addr()) AS address`
  assert.equal(identity?.database, process.env.NEXUS_PAYROLL_E2E_DATABASE)
  assert.equal(identity?.role, process.env.NEXUS_PAYROLL_E2E_DATABASE_USER)
  assert.ok(identity?.address, "The API database connection must use TCP")
  assert.equal(await prisma.user.count(), 0)
  assert.equal(await prisma.payrollConfiguration.count(), 0)

  const passwordHash = await hashPassword(password!)
  const fixture = await prisma.$transaction(async (tx) => {
    const preparer = await tx.user.create({
      data: {
        email: emails.preparer,
        fullName: `Payroll QA Preparer ${suffix}`,
        passwordHash,
        role: Role.ADMIN,
      },
    })
    const approver = await tx.user.create({
      data: {
        email: emails.approver,
        fullName: `Payroll QA Approver ${suffix}`,
        passwordHash,
        role: Role.ADMIN,
      },
    })
    const superadmin = await tx.user.create({
      data: {
        email: emails.superadmin,
        fullName: `Payroll QA Superadmin ${suffix}`,
        passwordHash,
        role: Role.SUPERADMIN,
      },
    })
    const staffA = await tx.user.create({
      data: {
        email: emails.staffA,
        fullName: `=Payroll QA Employee A ${suffix}`,
        passwordHash,
        role: Role.STAFF,
        employee: {
          create: {
            employeeId: `+PAYC${suffix.toUpperCase()}A`,
            fullName: `=Payroll QA Employee A ${suffix}`,
            employmentType: EmploymentType.FULL_TIME,
            status: EmployeeStatus.ACTIVE,
            startDate: new Date("2020-01-01T00:00:00.000Z"),
          },
        },
      },
      include: { employee: true },
    })
    const staffB = await tx.user.create({
      data: {
        email: emails.staffB,
        fullName: `-Payroll QA Employee B ${suffix}`,
        passwordHash,
        role: Role.STAFF,
        employee: {
          create: {
            employeeId: `@PAYC${suffix.toUpperCase()}B`,
            fullName: `-Payroll QA Employee B ${suffix}`,
            employmentType: EmploymentType.FULL_TIME,
            status: EmployeeStatus.ACTIVE,
            startDate: new Date("2020-01-01T00:00:00.000Z"),
          },
        },
      },
      include: { employee: true },
    })
    const user = await tx.user.create({
      data: {
        email: emails.user,
        fullName: `Payroll QA User ${suffix}`,
        passwordHash,
        role: Role.USER,
      },
    })
    const configuration = await tx.payrollConfiguration.create({
      data: {
        frequency: PayrollFrequency.MONTHLY,
        currency: "PHP",
        effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
        createdById: preparer.id,
        changeReason: "Synthetic Checkpoint C test schedule",
      },
    })
    return {
      preparerId: preparer.id,
      approverId: approver.id,
      superadminId: superadmin.id,
      staffAId: staffA.id,
      staffBId: staffB.id,
      userId: user.id,
      employeeAId: staffA.employee!.id,
      employeeBId: staffB.employee!.id,
      configurationId: configuration.id,
    }
  })

  console.log(JSON.stringify({ fixture: "seeded", ...fixture }))
}

function cents(value: { toFixed(digits: number): string } | null) {
  assert.ok(value, "Expected a calculated monetary amount")
  const [whole, fraction] = value.toFixed(2).split(".")
  assert.ok(whole && fraction)
  return BigInt(whole.replaceAll(",", "")) * 100n + BigInt(fraction)
}

async function verify() {
  const database = process.env.NEXUS_PAYROLL_E2E_DATABASE
  const [identity] = await prisma.$queryRaw<
    { database: string; role: string; address: string | null }[]
  >`SELECT current_database() AS database, current_user AS role, host(inet_server_addr()) AS address`
  assert.equal(identity?.database, database)
  assert.equal(identity?.role, process.env.NEXUS_PAYROLL_E2E_DATABASE_USER)

  const preparer = await prisma.user.findUniqueOrThrow({
    where: { email: emails.preparer },
  })
  const approver = await prisma.user.findUniqueOrThrow({
    where: { email: emails.approver },
  })
  const staffA = await prisma.user.findUniqueOrThrow({
    where: { email: emails.staffA },
  })
  const staffB = await prisma.user.findUniqueOrThrow({
    where: { email: emails.staffB },
  })
  const employeeA = await prisma.employee.findUniqueOrThrow({
    where: { employeeId: employeeAId },
  })
  const employeeB = await prisma.employee.findUniqueOrThrow({
    where: { employeeId: employeeBId },
  })
  assert.equal(employeeA.userId, staffA.id)
  assert.equal(employeeB.userId, staffB.id)

  const periodLabel = process.env.NEXUS_PAYROLL_E2E_PERIOD
  assert.match(periodLabel ?? "", /^\d{4}-\d{2}$/)
  const period = await prisma.payrollPeriod.findFirstOrThrow({
    where: { cutoffLabel: periodLabel, createdById: preparer.id },
  })
  const run = await prisma.payrollRun.findUniqueOrThrow({
    where: { periodId: period.id },
  })
  const calculation = await prisma.payrollRunCalculation.findFirstOrThrow({
    where: { runId: run.id, revision: 1 },
    include: {
      items: {
        include: { employee: true, components: true, payslip: true },
        orderBy: { employeeNumberSnapshot: "asc" },
      },
      approvalEvents: true,
    },
  })

  assert.equal(run.status, "APPROVED")
  assert.equal(run.createdById, preparer.id)
  assert.equal(calculation.status, "COMPLETE")
  assert.equal(calculation.calculatedItemCount, 2)
  assert.equal(calculation.reviewItemCount, 0)
  assert.equal(calculation.blockedItemCount, 0)
  assert.equal(calculation.grossTotal.toFixed(2), "43500.00")
  assert.equal(calculation.deductionsTotal.toFixed(2), "1000.00")
  assert.equal(calculation.netTotal.toFixed(2), "42500.00")

  const items = calculation.items
  assert.equal(items.length, 2)
  const itemA = items.find((item) => item.employeeId === employeeA.id)
  const itemB = items.find((item) => item.employeeId === employeeB.id)
  assert.ok(itemA)
  assert.ok(itemB)
  assert.deepEqual(
    [
      itemA.status,
      itemA.grossAmount?.toFixed(2),
      itemA.deductionsAmount?.toFixed(2),
      itemA.netAmount?.toFixed(2),
    ],
    ["CALCULATED", "25500.00", "1000.00", "24500.00"],
  )
  assert.deepEqual(
    [
      itemB.status,
      itemB.grossAmount?.toFixed(2),
      itemB.deductionsAmount?.toFixed(2),
      itemB.netAmount?.toFixed(2),
    ],
    ["CALCULATED", "18000.00", "0.00", "18000.00"],
  )
  assert.equal(
    items.reduce((total, item) => total + cents(item.grossAmount), 0n),
    4_350_000n,
  )
  assert.equal(
    items.reduce((total, item) => total + cents(item.deductionsAmount), 0n),
    100_000n,
  )
  assert.equal(
    items.reduce((total, item) => total + cents(item.netAmount), 0n),
    4_250_000n,
  )

  assert.ok(
    calculation.approvalEvents.some(
      (event) =>
        event.action === "PAYROLL_APPROVED" && event.actorId === approver.id,
    ),
  )
  assert.equal(items.filter((item) => item.payslip?.publishedAt).length, 2)
  for (const item of items) {
    assert.ok(item.payslip)
    assert.equal(item.payslip.publishedBy, approver.id)
    const document = Buffer.from(item.payslip.document).toString("latin1")
    assert.ok(document.startsWith("%PDF-1.4"))
    assert.ok(document.includes("%%EOF"))
    assert.ok(document.length > 500)
  }
  const audits = await prisma.workforceManagementChange.count({
    where: { subjectId: run.id },
  })
  assert.ok(audits >= 3, "Expected run, approval, and payslip audit events")
  const batch = await prisma.payrollDisbursementBatch.findUniqueOrThrow({
    where: { calculationId: calculation.id },
    include: {
      items: {
        include: { payrollItem: true, destination: true, attempt: true },
      },
    },
  })
  assert.equal(batch.items.length, 2)
  const payoutA = batch.items.find(
    (item) => item.payrollItem.employeeId === employeeA.id,
  )
  const payoutB = batch.items.find(
    (item) => item.payrollItem.employeeId === employeeB.id,
  )
  assert.ok(payoutA?.destination)
  assert.ok(payoutA?.attempt)
  assert.ok(payoutB?.destination)
  assert.ok(payoutB?.attempt)
  assert.equal(payoutA.attempt.outcome, "FAILED")
  assert.equal(payoutB.attempt.outcome, "SUCCEEDED")
  assert.equal(payoutA.destination.kind, "TEST_BANK")
  assert.equal(payoutB.destination.kind, "TEST_BANK")

  const verification = {
    fixture: "verified",
    database,
    role: identity?.role,
    runId: run.id,
    calculationId: calculation.id,
    period: period.cutoffLabel,
    status: run.status,
    revision: calculation.revision,
    gross: calculation.grossTotal.toFixed(2),
    deductions: calculation.deductionsTotal.toFixed(2),
    net: calculation.netTotal.toFixed(2),
    approvedBy: calculation.approvalEvents.find(
      (event) => event.action === "PAYROLL_APPROVED",
    )?.actorId,
    publishedPayslips: items.filter((item) => item.payslip?.publishedAt).length,
    auditEvents: audits,
    employeeRows: items.map((item) => ({
      employeeId: item.employeeNumberSnapshot,
      employeeName: item.employeeNameSnapshot,
      gross: item.grossAmount!.toFixed(2),
      deductions: item.deductionsAmount!.toFixed(2),
      net: item.netAmount!.toFixed(2),
    })),
    simulatedDisbursement: {
      batchId: batch.id,
      status: batch.status,
      totalNetCents: batch.items
        .reduce((total, item) => total + cents(item.amount), 0n)
        .toString(),
      items: batch.items.map((item) => ({
        payoutId: item.id,
        employeeId: item.payrollItem.employeeNumberSnapshot,
        amount: item.amount.toFixed(2),
        outcome: item.attempt?.outcome ?? "BLOCKED",
        destinationKind: item.destination?.kind ?? null,
        attemptId: item.attempt?.id ?? null,
        attemptCreatedAt: item.attempt?.createdAt.toISOString() ?? null,
      })),
    },
  }
  const expectedPath = process.env.NEXUS_PAYROLL_E2E_EXPECTED_PATH
  if (expectedPath)
    await writeFile(expectedPath, JSON.stringify(verification, null, 2))
  console.log(JSON.stringify(verification))
}

try {
  if (mode === "seed") await seed()
  else await verify()
} finally {
  await prisma.$disconnect()
}
