// SSE events may be split across arbitrary UTF-8/network chunk boundaries.
export async function readConversationEvents(
  stream: ReadableStream<Uint8Array>,
  onEvent: (name: string) => void,
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        "\n",
      )
      let end: number
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const event = frame
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim()
        if (event) onEvent(event)
      }
      if (buffer.length > 8192) throw new Error("Invalid conversation event")
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function mergeMessages<T extends { id: string; createdAt: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const rows = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) rows.set(message.id, message)
  return [...rows.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )
}
