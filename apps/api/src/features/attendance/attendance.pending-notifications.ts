import type { Prisma } from "../../generated/prisma/client.js"

export async function notifyPendingAdjustment(
  tx: Prisma.TransactionClient,
  requestId: string,
) {
  await tx.$executeRaw`
    SELECT attendance_notify_pending_adjustments(ARRAY[${requestId}]::text[], true)
  `
}

export async function notifyPendingAdjustmentsAfterHeadChange(
  tx: Prisma.TransactionClient,
  departmentId: string,
) {
  await tx.$executeRaw`
    SELECT attendance_notify_pending_adjustments(ARRAY(
      SELECT a.id FROM "AttendanceAdjustment" a
      JOIN "Employee" e ON e.id = a."employeeId"
      WHERE a.status = 'PENDING'
        AND e."departmentId" = ${departmentId}
    ), false)
  `
}
