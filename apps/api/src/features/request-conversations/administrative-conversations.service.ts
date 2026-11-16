import type { Prisma } from "../../generated/prisma/client.js"
import { readTransaction } from "../../lib/database-read.js"
import { fail } from "../../shared/http-error.js"
import {
  insensitive,
  paginate,
  PAGE_SIZE,
} from "../../shared/query/pagination.js"
import { archivedStatuses as archivedProjectStatuses } from "../project-conversations/project-conversations.service.js"

export type BusinessConversationKind = "service" | "project"
export type ConversationFilters = {
  kind: BusinessConversationKind
  search: string
  departmentId: string
  page: number
}

const person = { id: true, fullName: true } as const
const department = {
  id: true,
  name: true,
  head: { select: person },
} as const
const capabilities = {
  inspectMetadata: true,
  readMessages: false,
  downloadFiles: false,
  participate: false,
  markRead: false,
} as const

// Never reuse participant DTOs: they include message bodies, previews and read state.
const serviceSelection = {
  id: true,
  client: { select: person },
  department: { select: department },
  createdAt: true,
  updatedAt: true,
  _count: { select: { bookings: true } },
  messages: {
    where: { deletedAt: null },
    select: { createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
  },
} satisfies Prisma.RequestConversationSelect

const referenceSelection = {
  id: true,
  title: true,
  referenceNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { name: true } },
  project: { select: { id: true, name: true, status: true } },
} satisfies Prisma.ServiceRequestSelect

const projectSelection = {
  id: true,
  name: true,
  status: true,
  startDate: true,
  createdAt: true,
  updatedAt: true,
  client: { select: person },
  request: {
    select: {
      ...referenceSelection,
      acceptedDepartment: { select: department },
    },
  },
  messages: {
    // Staff-only deliverable activity is outside this metadata view.
    where: { clientVisible: true },
    select: { createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
  },
} satisfies Prisma.ProjectSelect

function serviceSummary(
  row: Prisma.RequestConversationGetPayload<{
    select: typeof serviceSelection
  }>,
) {
  return {
    id: row.id,
    kind: "service" as const,
    name: `${row.client.fullName || "Client"} · ${row.department.name}`,
    // Shared client–department threads currently remain active independently of bookings.
    status: "ACTIVE" as const,
    businessStatus: null,
    client: row.client,
    department: row.department,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startDate: null,
    lastMessageAt: row.messages[0]?.createdAt ?? null,
    linkedRecordCount: row._count.bookings,
    capabilities,
  }
}

function projectSummary(
  row: Prisma.ProjectGetPayload<{ select: typeof projectSelection }>,
) {
  return {
    id: row.id,
    kind: "project" as const,
    name: row.name,
    status: (archivedProjectStatuses as readonly string[]).includes(row.status)
      ? ("ARCHIVED" as const)
      : ("ACTIVE" as const),
    businessStatus: row.status,
    client: row.client,
    department: row.request?.acceptedDepartment ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startDate: row.startDate,
    lastMessageAt: row.messages[0]?.createdAt ?? null,
    linkedRecordCount: row.request ? 1 : 0,
    capabilities,
  }
}

function reference(
  row: Prisma.ServiceRequestGetPayload<{ select: typeof referenceSelection }>,
) {
  // Explicit projection also strips extra fields present on a project relation.
  return {
    id: row.id,
    title: row.title,
    referenceNumber: row.referenceNumber,
    status: row.status,
    serviceName: row.service.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    project: row.project,
  }
}

export function listAdministrativeConversations(filters: ConversationFilters) {
  return readTransaction(async (tx) => {
    const { search, departmentId, page, kind } = filters
    const departments = await tx.department.findMany({
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    })
    if (kind === "service") {
      const where: Prisma.RequestConversationWhereInput = {
        ...(departmentId ? { departmentId } : {}),
        ...insensitive<Prisma.RequestConversationWhereInput>(search, [
          (text) => ({ client: { fullName: text } }),
          (text) => ({ department: { name: text } }),
          (text) => ({ bookings: { some: { title: text } } }),
          (text) => ({ bookings: { some: { referenceNumber: text } } }),
        ]),
      }
      const { rows, ...pagination } = await paginate(
        page,
        {
          rows: (db, window) =>
            db.requestConversation.findMany({
              where,
              select: serviceSelection,
              ...window,
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            }),
          count: (db) => db.requestConversation.count({ where }),
        },
        { tx },
      )
      return {
        conversations: rows.map(serviceSummary),
        departments,
        ...pagination,
      }
    }
    const where: Prisma.ProjectWhereInput = {
      startDate: { not: null },
      ...(departmentId
        ? { request: { acceptedDepartmentId: departmentId } }
        : {}),
      ...insensitive<Prisma.ProjectWhereInput>(search, [
        "name",
        (text) => ({ client: { fullName: text } }),
        (text) => ({ request: { referenceNumber: text } }),
        (text) => ({ request: { acceptedDepartment: { name: text } } }),
      ]),
    }
    const { rows, ...pagination } = await paginate(
      page,
      {
        rows: (db, window) =>
          db.project.findMany({
            where,
            select: projectSelection,
            ...window,
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          }),
        count: (db) => db.project.count({ where }),
      },
      { tx },
    )
    return {
      conversations: rows.map(projectSummary),
      departments,
      ...pagination,
    }
  })
}

export function getAdministrativeConversation(
  kind: BusinessConversationKind,
  id: string,
  page: number,
) {
  return readTransaction(async (tx) => {
    if (kind === "service") {
      const row = await tx.requestConversation.findUnique({
        where: { id },
        select: serviceSelection,
      })
      if (!row) fail(404, "Business conversation not found")
      const { rows, ...pagination } = await paginate(
        page,
        {
          rows: (db, window) =>
            db.serviceRequest.findMany({
              where: { conversationId: id },
              select: referenceSelection,
              ...window,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            }),
          count: (db) =>
            db.serviceRequest.count({ where: { conversationId: id } }),
        },
        { tx },
      )
      return {
        conversation: serviceSummary(row),
        linkedRecords: rows.map(reference),
        ...pagination,
      }
    }
    const row = await tx.project.findFirst({
      where: { id, startDate: { not: null } },
      select: projectSelection,
    })
    if (!row) fail(404, "Business conversation not found")
    const references = row.request ? [reference(row.request)] : []
    return {
      conversation: projectSummary(row),
      linkedRecords: page === 1 ? references : [],
      total: references.length,
      page,
      pageSize: PAGE_SIZE,
    }
  })
}
