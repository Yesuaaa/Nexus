import { apiRequest, apiStreamRequest } from "@/features/auth/api/auth-api"

export type RequestMessage = {
  id: string
  body: string | null
  clientMessageId: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  purgeAt: string | null
  sender: { id: string; fullName: string | null }
}

export type ConversationSummary = {
  id: string
  title: string
  referenceNumber: string | null
  updatedAt: string
  service: { name: string }
  client: { id: string; fullName: string | null }
  acceptedDepartment: { id: string; name: string } | null
  lastMessage: RequestMessage | null
  unreadCount?: number
}

export type ConversationList = {
  conversations: ConversationSummary[]
  nextCursor: string | null
  unreadCount?: number
}

export function listConversations(before?: string, signal?: AbortSignal) {
  return apiRequest<ConversationList>(
    `/api/request-conversations${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    { signal },
  )
}

export function markConversationRead(id: string) {
  return apiRequest<{
    ok: true
    unreadCount: number
    conversationUnreadCount: number
  }>(`/api/request-conversations/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  })
}

export type ConversationHistory = {
  conversation: {
    department: { id: string; name: string }
    head: { id: string; fullName: string | null } | null
    client?: {
      id: string
      fullName: string | null
      email: string
      contactNumber: string | null
    }
  } | null
  canSend: boolean
  messages: RequestMessage[]
  nextCursor: string | null
}

const path = (id: string) =>
  `/api/request-conversations/${encodeURIComponent(id)}`

export function getConversation(
  id: string,
  before?: string,
  signal?: AbortSignal,
): Promise<ConversationHistory> {
  return apiRequest(
    `${path(id)}${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    { signal },
  )
}

export async function sendMessage(
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

export async function editMessage(id: string, messageId: string, body: string) {
  const result = await apiRequest<{ message: RequestMessage }>(
    `${path(id)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ body }),
    },
  )
  return result.message
}

export async function deleteMessage(id: string, messageId: string) {
  const result = await apiRequest<{ message: RequestMessage }>(
    `${path(id)}/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE" },
  )
  return result.message
}

export function openConversationEvents(id: string, signal: AbortSignal) {
  return apiStreamRequest(`${path(id)}/events`, {
    signal,
    headers: { Accept: "text/event-stream" },
  })
}
