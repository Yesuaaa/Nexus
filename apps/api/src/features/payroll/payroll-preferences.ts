import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { createManagementOperation } from "../../shared/management-history.js"
import type { AuthContext } from "../auth/auth.middleware.js"
import { writeWorkforceManagementChange } from "../employees/workforce-management-history.js"

const id = "payroll-preferences"
const defaults = {
  revision: 0,
  showCompanyLogo: true,
  showEmployeeId: true,
  requirePublicationConfirmation: true,
  requireSimulationConfirmation: false,
}
const preferenceKeys = [
  "showCompanyLogo",
  "showEmployeeId",
  "requirePublicationConfirmation",
  "requireSimulationConfirmation",
] as const

export async function readPayrollPreferences(
  db: Prisma.TransactionClient = getPrisma()!,
) {
  return (
    (await db.payrollPreferences.findUnique({
      where: { id },
      select: {
        revision: true,
        showCompanyLogo: true,
        showEmployeeId: true,
        requirePublicationConfirmation: true,
        requireSimulationConfirmation: true,
      },
    })) ?? defaults
  )
}

export async function updatePayrollPreferences(
  auth: AuthContext,
  body: unknown,
) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(400, "Invalid payroll preferences")
  const input = body as Record<string, unknown>
  if (
    Object.keys(input).length !== preferenceKeys.length + 1 ||
    typeof input.revision !== "number" ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    preferenceKeys.some((key) => typeof input[key] !== "boolean")
  )
    fail(400, "Invalid payroll preferences")
  const revision = input.revision
  const next = {
    showCompanyLogo: input.showCompanyLogo as boolean,
    showEmployeeId: input.showEmployeeId as boolean,
    requirePublicationConfirmation:
      input.requirePublicationConfirmation as boolean,
    requireSimulationConfirmation:
      input.requireSimulationConfirmation as boolean,
  }
  return getPrisma()!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(848230, 1)`
    const current = await readPayrollPreferences(tx)
    if (current.revision !== revision)
      fail(409, "Payroll preferences changed. Reload before saving.")
    const changedFields = preferenceKeys.filter(
      (key) => current[key] !== next[key],
    )
    if (!changedFields.length) return current
    const values = { ...next, revision: current.revision + 1 }
    await tx.payrollPreferences.upsert({
      where: { id },
      create: { id, ...values },
      update: values,
    })
    await writeWorkforceManagementChange(tx, createManagementOperation(auth), {
      action: "PAYROLL_PREFERENCES_UPDATED",
      origin: "PAYROLL_MANAGEMENT",
      subjectType: "PAYROLL_CONFIGURATION",
      subjectId: id,
      changedFields,
      changes: Object.fromEntries(
        changedFields.map((key) => [
          key,
          { before: current[key], after: next[key] },
        ]),
      ),
    })
    return values
  })
}
