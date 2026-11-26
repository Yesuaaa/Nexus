import type { Prisma } from "../../generated/prisma/client.js"
import { auditCode } from "./audit-context.js"
import { writeServiceLog } from "./log-writer.js"

const events = {
  CANCELLED: "REQUEST_CANCELLED",
  CONCLUDED: "REQUEST_CONCLUDED",
} as const

/**
 * Moves a request to a final status and logs it with the request's own label
 * and previous status. Does nothing when the request already has that status.
 */
export async function finishLoggedRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  actorId: string,
  status: keyof typeof events,
) {
  const request = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      status: true,
      referenceNumber: true,
      service: { select: { name: true } },
    },
  })
  if (request.status === status) return
  await tx.serviceRequest.update({
    where: { id: requestId },
    data: { status },
  })
  await writeServiceLog(
    tx,
    events[status],
    requestId,
    requestId,
    actorId,
    undefined,
    {
      targetLabel: `${request.service.name} (${request.referenceNumber ?? requestId})`,
      changes: [
        {
          field: "Status",
          before: auditCode(request.status),
          after: auditCode(status),
        },
      ],
    },
  )
}
