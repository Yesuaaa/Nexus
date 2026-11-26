import { getPrisma } from "../../lib/db.js"
import { lockRows } from "../../shared/db/locks.js"
import { fail } from "../../shared/http-error.js"
import { isRecordId } from "../../shared/validation.js"
import { writeServiceLog } from "../service-operation-logs/log-writer.js"

export async function getBillingSettings() {
  const db = getPrisma()!
  const [configuration, methods] = await db.$transaction(
    [
      db.billingConfiguration.findUniqueOrThrow({ where: { id: "global" } }),
      db.billingPaymentMethod.findMany({ orderBy: { label: "asc" } }),
    ],
    { isolationLevel: "RepeatableRead" },
  )
  return { configuration, methods }
}
export async function updateBillingSettings(
  actorId: string,
  input: Record<string, unknown>,
) {
  if (
    typeof input.defaultTerms !== "string" ||
    input.defaultTerms.trim().length > 2000 ||
    !Number.isInteger(input.defaultDueDays) ||
    (input.defaultDueDays as number) < 0 ||
    (input.defaultDueDays as number) > 365 ||
    typeof input.invoicePrefix !== "string" ||
    !/^[A-Z0-9]{1,20}$/.test(input.invoicePrefix) ||
    !Number.isSafeInteger(input.version) ||
    (input.version as number) < 0
  )
    fail(400, "Invalid billing configuration")
  const data = {
    defaultTerms: input.defaultTerms.trim(),
    defaultDueDays: input.defaultDueDays as number,
    invoicePrefix: input.invoicePrefix,
  }
  return getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "BillingConfiguration", "global")
    const current = await tx.billingConfiguration.findUniqueOrThrow({
      where: { id: "global" },
    })
    if (current.version !== input.version)
      fail(409, "Billing settings changed; refresh and retry")
    const configuration = await tx.billingConfiguration.update({
      where: { id: "global" },
      data: { ...data, version: { increment: 1 } },
    })
    await writeServiceLog(
      tx,
      "BILLING_SETTINGS_UPDATED",
      "global",
      undefined,
      actorId,
      undefined,
      {
        targetLabel: "Billing configuration",
        changes: [
          {
            field: "Invoice prefix",
            before: current.invoicePrefix,
            after: configuration.invoicePrefix,
          },
          {
            field: "Due days",
            before: current.defaultDueDays,
            after: configuration.defaultDueDays,
          },
          {
            field: "Terms changed",
            before: false,
            after: current.defaultTerms !== configuration.defaultTerms,
          },
        ],
      },
    )
    return configuration
  })
}
export async function createPaymentMethod(actorId: string, label: unknown) {
  if (typeof label !== "string" || !label.trim() || label.trim().length > 100)
    fail(400, "Invalid payment method label")
  return getPrisma()!.$transaction(async (tx) => {
    const method = await tx.billingPaymentMethod.create({
      data: { label: label.trim() },
    })
    await writeServiceLog(
      tx,
      "PAYMENT_METHOD_CREATED",
      method.id,
      undefined,
      actorId,
      undefined,
      { targetLabel: method.label },
    )
    return method
  })
}
export async function deletePaymentMethod(actorId: string, id: string) {
  if (!isRecordId(id)) fail(400, "Invalid payment method")
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "BillingPaymentMethod", id)
    const method = await tx.billingPaymentMethod.findUnique({ where: { id } })
    if (!method) fail(404, "Payment method not found")
    if (await tx.invoicePayment.count({ where: { methodLabel: method.label } }))
      fail(409, "Payment methods already used by payments cannot be removed")
    await tx.billingPaymentMethod.delete({ where: { id } })
    await writeServiceLog(
      tx,
      "PAYMENT_METHOD_DELETED",
      id,
      undefined,
      actorId,
      undefined,
      { targetLabel: method.label },
    )
  })
}
