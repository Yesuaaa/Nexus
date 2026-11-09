import type {
  ConversationSummary,
  RequestMessage,
} from "../api/request-conversations-api"

export function orderConversations<
  T extends Pick<ConversationSummary, "id" | "updatedAt">,
>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
  )
}

export function messagePreview(message: RequestMessage | null) {
  if (!message) return "Start the conversation"
  if (message.deletedAt) return "This message was deleted"
  return message.body || "Start the conversation"
}
