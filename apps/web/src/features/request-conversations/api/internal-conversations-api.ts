import { apiRequest } from "@/features/auth/api/auth-api"
import type { RequestMessage } from "./request-conversations-api"
import { withUnreadCount } from "../model/unread-messages"

export type InternalParticipant = {
  id: string
  fullName: string | null
  email: string
  role: "STAFF" | "ADMIN" | "SUPERADMIN"
  position: string | null
  isActive: boolean
  accountDeletedAt: string | null
  imageUrl?: string | null
  department: { id: string; name: string } | null
}

export type InternalConversationSummary = {
  id: string
  updatedAt: string
  participant: InternalParticipant
  lastMessage: RequestMessage | null
  unreadCount: number
}

export type InternalConversationList = {
  conversations: InternalConversationSummary[]
  nextCursor: string | null
  unreadCount: number
}

export type InternalConversationHistory = {
  conversation: InternalParticipant
  canSend: boolean
  messages: RequestMessage[]
  nextCursor: string | null
}

const path = (id: string) =>
  `/api/internal-conversations/${encodeURIComponent(id)}`

export function listInternalContacts(signal?: AbortSignal) {
  return apiRequest<InternalParticipant[]>(
    "/api/internal-conversations/contacts",
    {
      signal,
    },
  )
}

export function listInternalConversations(
  before?: string,
  signal?: AbortSignal,
) {
  const query = before ? `?before=${encodeURIComponent(before)}` : ""
  return withUnreadCount(
    "internal",
    () =>
      apiRequest<InternalConversationList>(
        `/api/internal-conversations${query}`,
        { signal },
      ),
    signal,
  )
}

export function createInternalConversation(recipientId: string) {
  return apiRequest<InternalConversationHistory & { id: string }>(
    "/api/internal-conversations",
    {
      method: "POST",
      body: JSON.stringify({ recipientId }),
    },
  )
}

export function getInternalConversation(
  id: string,
  before?: string,
  signal?: AbortSignal,
) {
  const query = before ? `?before=${encodeURIComponent(before)}` : ""
  return apiRequest<InternalConversationHistory>(`${path(id)}${query}`, {
    signal,
  })
}

export function markInternalConversationRead(id: string) {
  return withUnreadCount("internal", () =>
    apiRequest<{
      ok: true
      unreadCount: number
      conversationUnreadCount: number
    }>(`${path(id)}/read`, { method: "PATCH" }),
  )
}

export async function sendInternalMessage(
  id: string,
  body: string,
  clientMessageId: string,
) {
  const result = await apiRequest<{ message: RequestMessage }>(
    `${path(id)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body, clientMessageId }),
    },
  )
  return result.message
}
