import { apiRequest } from "@/features/auth/api/auth-api"

export type BusinessConversationKind = "service" | "project"
type Person = { id: string; fullName: string | null }
export type AdministrativeConversation = {
  id: string
  kind: BusinessConversationKind
  name: string
  status: "ACTIVE" | "ARCHIVED"
  businessStatus: string | null
  client: Person
  department: { id: string; name: string; head: Person | null } | null
  createdAt: string
  updatedAt: string
  startDate: string | null
  lastMessageAt: string | null
  linkedRecordCount: number
  capabilities: {
    inspectMetadata: boolean
    readMessages: false
    downloadFiles: false
    participate: false
    markRead: false
  }
}
type Pagination = { total: number; page: number; pageSize: number }
export type ConversationMetadataDetails = Pagination & {
  conversation: AdministrativeConversation
  linkedRecords: {
    id: string
    title: string
    referenceNumber: string | null
    status: string
    serviceName: string
    createdAt: string
    updatedAt: string
    project: { id: string; name: string; status: string } | null
  }[]
}

export function listAdministrativeConversations(
  filters: {
    kind: BusinessConversationKind
    search: string
    departmentId: string
    page: number
  },
  signal: AbortSignal,
) {
  return apiRequest<
    Pagination & {
      conversations: AdministrativeConversation[]
      departments: { id: string; name: string }[]
    }
  >(
    `/api/administrative-conversations?${new URLSearchParams({ ...filters, page: String(filters.page) })}`,
    { signal },
  )
}

export function getAdministrativeConversation(
  kind: BusinessConversationKind,
  id: string,
  page: number,
  signal: AbortSignal,
) {
  return apiRequest<ConversationMetadataDetails>(
    `/api/administrative-conversations/${kind}/${encodeURIComponent(id)}?page=${page}`,
    { signal },
  )
}
