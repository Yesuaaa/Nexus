import { apiRequest } from "@/features/auth/api/auth-api"
import type { InternalConversationHistory } from "./internal-conversations-api"
import type { RequestMessage } from "./request-conversations-api"
import { withUnreadCount } from "../model/unread-messages"

export type ProjectConversationSummary = {
  id: string
  name: string
  archived: boolean
  isGroup: boolean
  participants: { id: string; fullName: string | null }[]
  updatedAt: string
  lastMessage: RequestMessage | null
  unreadCount: number
}
export type ProjectConversationList = {
  conversations: ProjectConversationSummary[]
  nextCursor: string | null
  unreadCount: number
}
const path = (id: string) =>
  `/api/project-conversations/${encodeURIComponent(id)}`

export function listProjectConversations(
  view: "active" | "archived" = "active",
  before?: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ view })
  if (before) query.set("before", before)
  return withUnreadCount(
    "projects",
    () =>
      apiRequest<ProjectConversationList>(
        `/api/project-conversations?${query}`,
        { signal },
      ),
    signal,
  )
}
export function getProjectConversation(
  id: string,
  before?: string,
  signal?: AbortSignal,
) {
  const query = before ? `?before=${encodeURIComponent(before)}` : ""
  return apiRequest<InternalConversationHistory>(`${path(id)}${query}`, {
    signal,
  })
}
export function markProjectConversationRead(id: string) {
  return withUnreadCount("projects", () =>
    apiRequest<{
      ok: true
      unreadCount: number
      conversationUnreadCount: number
    }>(`${path(id)}/read`, { method: "PATCH" }),
  )
}
export async function sendProjectMessage(
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
export const projectConversationTransport = {
  getHistory: getProjectConversation,
  markRead: markProjectConversationRead,
  sendMessage: sendProjectMessage,
}
