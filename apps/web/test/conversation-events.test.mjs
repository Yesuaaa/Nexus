import assert from "node:assert/strict"
import { test } from "node:test"
import {
  readConversationEvents,
  mergeMessages,
} from "../src/features/request-conversations/model/conversation-events.ts"

test("live events survive split frames, UTF-8 boundaries and CRLF", async () => {
  const bytes = new TextEncoder().encode(
    ": héartbeat\r\nevent: connected\r\ndata: {}\r\n\r\nevent: messages-changed\ndata: {}\n\nevent: access-revoked\ndata: {}\n\n",
  )
  const events = []
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    },
  })
  await readConversationEvents(stream, (event) => events.push(event))
  assert.deepEqual(events, ["connected", "messages-changed", "access-revoked"])
  assert.equal(stream.locked, false)
})

test("failed event processing cancels and unlocks the stream", async () => {
  let cancelled = false
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode("event: messages-changed\ndata: {}\n\n"),
      )
    },
    cancel() {
      cancelled = true
    },
  })
  await assert.rejects(
    () =>
      readConversationEvents(stream, () => {
        throw new Error("unmounted")
      }),
    /unmounted/,
  )
  assert.equal(cancelled, true)
  assert.equal(stream.locked, false)
})

test("message merging deduplicates reconnects and paginated history in chronological order", () => {
  const old = { id: "a", createdAt: "2026-10-30T08:00:00Z", body: "Earlier" }
  const saved = { id: "b", createdAt: "2026-10-30T08:01:00Z", body: "Saved" }
  const latest = { id: "c", createdAt: saved.createdAt, body: "Later" }
  assert.deepEqual(mergeMessages([saved, old], [latest, saved]), [
    old,
    saved,
    latest,
  ])
  assert.deepEqual(
    mergeMessages([saved], [{ ...saved, body: "Canonical copy" }]),
    [{ ...saved, body: "Canonical copy" }],
  )
})
