import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeDepartmentHead } from "../../shared/query/accounts.js"
import { insensitive, paginate } from "../../shared/query/pagination.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { initializeWorkflow } from "../request-workflow/workflow.access.js"
import type { InboxFilters } from "./request-inbox.schema.js"

const requestSelect = {
  id: true,
  referenceNumber: true,
  title: true,
  status: true,
  acceptedDepartmentId: true,
  acceptedAt: true,
  packageName: true,
  expectedTimeline: true,
  preferredSpecialistName: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, name: true } },
  client: { select: { fullName: true, email: true, contactNumber: true } },
} as const satisfies Prisma.ServiceRequestSelect

/** The department `userId` currently heads, or a 403 `ServiceRequestsError`. */
export async function requireDepartmentHead(
  userId: string,
  {
    client = getPrisma()!,
    message = "Only current department heads can access the request inbox",
  }: { client?: Prisma.TransactionClient; message?: string } = {},
) {
  const department = await client.department.findFirst({
    where: activeDepartmentHead(userId),
    select: { id: true, name: true },
  })
  if (!department) throw new ServiceRequestsError(403, message)
  return department
}

function departmentScope(
  userId: string,
  { includeAcceptedElsewhere = false } = {},
): Prisma.ServiceRequestWhereInput {
  return {
    AND: [
      {
        OR: [
          {
            // Linked departments only see a request until one of them accepts it.
            ...(includeAcceptedElsewhere ? {} : { acceptedDepartmentId: null }),
            service: {
              departments: {
                some: activeDepartmentHead(userId),
              },
            },
          },
          { acceptedDepartment: { headId: userId } },
        ],
      },
    ],
  }
}

export async function listInbox(userId: string, filters: InboxFilters) {
  const department = await requireDepartmentHead(userId)
  return getPrisma()!.$transaction(
    async (tx) => {
      // Avoid querying enum labels that aren't present on older databases.
      const labels = await tx.$queryRaw<{ label: string }[]>`
      SELECT e.enumlabel AS label FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'ServiceRequestStatus' AND n.nspname = current_schema()
    `
      const statusByView = {
        pending: "SUBMITTED",
        "under-review": "UNDER_REVIEW",
        "awaiting-information": "AWAITING_CLIENT_INFO",
        "ready-for-quotation": "READY_FOR_QUOTATION",
        closed: "CLOSED",
        cancelled: "CANCELLED",
      } as const
      const statuses =
        filters.view === "all"
          ? Object.values(statusByView)
          : [statusByView[filters.view]]
      const where: Prisma.ServiceRequestWhereInput = {
        ...departmentScope(userId),
        status: {
          in: statuses.filter((status) =>
            labels.some(({ label }) => label === status),
          ),
        },
        ...insensitive<Prisma.ServiceRequestWhereInput>(filters.search, [
          "id",
          "referenceNumber",
          (text) => ({ service: { name: text } }),
          "packageName",
          (text) => ({ client: { fullName: text } }),
          (text) => ({ client: { email: text } }),
        ]),
      }
      const { rows: serviceRequests, ...page } = await paginate(
        filters.page,
        {
          rows: (db, window) =>
            db.serviceRequest.findMany({
              where,
              select: requestSelect,
              ...window,
              orderBy: [
                filters.sortBy === "service"
                  ? { service: { name: filters.sortDir } }
                  : filters.sortBy === "reference"
                    ? {
                        referenceNumber: {
                          sort: filters.sortDir,
                          nulls: "last",
                        },
                      }
                    : filters.sortBy === "client"
                      ? {
                          client: {
                            fullName: { sort: filters.sortDir, nulls: "last" },
                          },
                        }
                      : filters.sortBy === "status"
                        ? { status: filters.sortDir }
                        : { createdAt: filters.sortDir },
                { id: "asc" },
              ],
            }),
          count: (db) => db.serviceRequest.count({ where }),
        },
        { tx },
      )
      return { department, serviceRequests, ...page }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function getInboxRequest(userId: string, id: string) {
  await requireDepartmentHead(userId)
  const request = await getPrisma()!.serviceRequest.findFirst({
    where: { id, ...departmentScope(userId) },
    select: {
      ...requestSelect,
      projectGoals: true,
      projectRequirements: true,
      additionalDetails: true,
    },
  })
  if (!request) throw new ServiceRequestsError(404, "Request not found")
  return request
}

export async function acceptInboxRequest(userId: string, id: string) {
  const department = await requireDepartmentHead(userId)
  return getPrisma()!.$transaction(async (tx) => {
    // A head who lost the race to another linked department gets a 409, not a
    // 404; this lookup returns no request details.
    const where = {
      id,
      ...departmentScope(userId, { includeAcceptedElsewhere: true }),
    }
    const request = await tx.serviceRequest.findFirst({
      where,
      select: { clientId: true, status: true, acceptedDepartmentId: true },
    })
    if (!request) throw new ServiceRequestsError(404, "Request not found")
    if (
      request.acceptedDepartmentId ||
      (request.status !== "SUBMITTED" && request.status !== "UNDER_REVIEW")
    )
      throw new ServiceRequestsError(
        409,
        "This request is no longer awaiting acceptance. Refresh the inbox.",
      )
    // The conditional update allows exactly one head to accept a shared booking.
    // Recheck current head assignment and service routing at the write itself.
    const updated = await tx.serviceRequest.updateMany({
      where: {
        id,
        status: request.status,
        acceptedDepartmentId: null,
        service: {
          departments: {
            some: {
              id: department.id,
              ...activeDepartmentHead(userId),
            },
          },
        },
      },
      data: {
        status: "UNDER_REVIEW",
        acceptedDepartmentId: department.id,
        acceptedById: userId,
        acceptedAt: new Date(),
      },
    })
    if (updated.count !== 1)
      throw new ServiceRequestsError(
        409,
        "This request changed. Refresh the inbox and try again.",
      )
    const conversation = await tx.requestConversation.upsert({
      where: {
        clientId_departmentId: {
          clientId: request.clientId,
          departmentId: department.id,
        },
      },
      create: { clientId: request.clientId, departmentId: department.id },
      update: { updatedAt: new Date() },
      select: { id: true },
    })
    await tx.requestConversationDeletion.deleteMany({
      where: { conversationId: conversation.id },
    })
    await tx.serviceRequest.update({
      where: { id },
      data: { conversationId: conversation.id },
    })
    await initializeWorkflow(tx, id, userId)
    return tx.serviceRequest.findUniqueOrThrow({
      where: { id },
      select: requestSelect,
    })
  })
}
