import type {
  ConversationSummary,
  RequestMessage,
} from "../api/request-conversations-api"

export type ConversationGroup = {
  id: string
  name: string
  imageUrl: string | null
  departmentName: string | null
  conversations: ConversationSummary[]
  unreadCount: number
}

export function orderConversations(rows: ConversationSummary[]) {
  return [...rows].sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
  )
}

export function groupConversations(
  rows: ConversationSummary[],
  isClient: boolean,
): ConversationGroup[] {
  const groups = new Map<string, ConversationGroup>()
  for (const row of orderConversations(rows)) {
    // Department ownership survives a head handoff; names are display labels.
    const id = isClient
      ? row.acceptedDepartment
        ? `department:${row.acceptedDepartment.id}`
        : `request:${row.id}`
      : `client:${row.client.id}`
    let group = groups.get(id)
    if (!group) {
      group = {
        id,
        name: isClient
          ? row.acceptedDepartment?.head?.fullName?.trim() || "Department head"
          : row.client.fullName?.trim() || "Client",
        imageUrl: isClient
          ? row.acceptedDepartment?.head?.imageUrl || null
          : row.client.imageUrl || null,
        departmentName: isClient
          ? (row.acceptedDepartment?.name ?? null)
          : null,
        conversations: [],
        unreadCount: 0,
      }
      groups.set(id, group)
    }
    group.conversations.push(row)
    group.unreadCount += row.unreadCount ?? 0
  }
  return [...groups.values()]
}

export function messagePreview(message: RequestMessage | null) {
  if (!message) return "Start the conversation"
  if (message.deletedAt) return "This message was deleted"
  return message.body || "Start the conversation"
}
