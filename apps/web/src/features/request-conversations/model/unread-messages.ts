export const unreadMessagesEvent = "nexus:unread-messages"

export type ChatKind = "requests" | "internal"
export type UnreadMessagesUpdate = { kind: ChatKind; count: number }

const revisions: Record<ChatKind, number> = { requests: 0, internal: 0 }

// A slow list response must not restore a count from before a mark-as-read call.
export async function withUnreadCount<T extends { unreadCount?: number }>(
  kind: ChatKind,
  load: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const revision = ++revisions[kind]
  const result = await load()
  if (
    typeof window !== "undefined" &&
    !signal?.aborted &&
    revision === revisions[kind] &&
    typeof result.unreadCount === "number"
  ) {
    window.dispatchEvent(
      new CustomEvent<UnreadMessagesUpdate>(unreadMessagesEvent, {
        detail: { kind, count: result.unreadCount },
      }),
    )
  }
  return result
}
