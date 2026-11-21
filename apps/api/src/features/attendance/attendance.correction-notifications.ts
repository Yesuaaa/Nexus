import type { Prisma } from "../../generated/prisma/client.js"

export async function notifyPendingCorrection(
  tx: Prisma.TransactionClient,
  requestId: string,
) {
  await tx.$executeRaw`
    SELECT attendance_notify_pending_corrections(ARRAY[${requestId}]::text[], true)
  `
}

export async function notifyPendingCorrectionsAfterHeadChange(
  tx: Prisma.TransactionClient,
  departmentId: string,
) {
  await tx.$executeRaw`
    SELECT attendance_notify_pending_corrections(ARRAY(
      SELECT a.id FROM "AttendanceAdjustment" a
      JOIN "Employee" e ON e.id = a."employeeId"
      WHERE a.status = 'PENDING' AND a.type = 'CORRECTION'
        AND e."departmentId" = ${departmentId}
    ), false)
  `
}
