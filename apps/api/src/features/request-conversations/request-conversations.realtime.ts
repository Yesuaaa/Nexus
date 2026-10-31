import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

export interface ConversationRealtime {
  subscribe(
    requestId: string,
    onChange: () => void,
    onStatus: (connected: boolean) => void,
  ): Promise<() => Promise<void>>
}

type Listener = { onChange: () => void; onStatus: (connected: boolean) => void }
type Room = {
  channel: RealtimeChannel
  listeners: Set<Listener>
  ready: Promise<void>
  connected: boolean
  closing?: Promise<void>
}

// One Supabase connection per API process, with one channel per open conversation.
// Only the server uses the privileged key. Browsers receive authenticated SSE.
export function createConversationRealtime(): ConversationRealtime {
  let client: SupabaseClient | undefined
  const rooms = new Map<string, Room>()
  const manager: ConversationRealtime = {
    async subscribe(requestId, onChange, onStatus) {
      if (!client) {
        const url = process.env.SUPABASE_URL?.trim()
        const key =
          process.env.SUPABASE_SECRET_KEY?.trim() ||
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        if (!url || !key)
          throw new ServiceRequestsError(
            503,
            "Live messaging is temporarily unavailable. You can refresh to check for messages.",
          )
        client = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        })
      }
      let room = rooms.get(requestId)
      if (room?.closing) {
        await room.closing
        return manager.subscribe(requestId, onChange, onStatus)
      }
      if (!room) {
        const channel = client.channel(`request-conversation:${requestId}`, {
          config: { private: true },
        })
        let resolveReady: () => void
        let rejectReady: (reason: Error) => void
        const ready = new Promise<void>((resolve, reject) => {
          resolveReady = resolve
          rejectReady = reject
        })
        room = { channel, listeners: new Set(), ready, connected: false }
        rooms.set(requestId, room)
        const current = room
        const timeout = setTimeout(
          () =>
            rejectReady(
              new ServiceRequestsError(
                503,
                "Live messaging could not connect. Try again.",
              ),
            ),
          8000,
        )
        channel
          .on("broadcast", { event: "messages-changed" }, () => {
            for (const listener of current.listeners) listener.onChange()
          })
          .subscribe((status) => {
            current.connected = status === "SUBSCRIBED"
            for (const listener of current.listeners)
              listener.onStatus(current.connected)
            if (current.connected) {
              clearTimeout(timeout)
              resolveReady()
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              clearTimeout(timeout)
              rejectReady(
                new ServiceRequestsError(
                  503,
                  "Live messaging disconnected. Try again.",
                ),
              )
            }
          })
      }
      const listener = { onChange, onStatus }
      room.listeners.add(listener)
      const current = room
      const release = async () => {
        current.listeners.delete(listener)
        if (!current.listeners.size && rooms.get(requestId) === current) {
          current.closing ??= (async () => {
            try {
              await client!.removeChannel(current.channel)
            } finally {
              if (rooms.get(requestId) === current) rooms.delete(requestId)
            }
          })()
          await current.closing
        }
      }
      try {
        await current.ready
        if (!current.connected)
          throw new ServiceRequestsError(
            503,
            "Live messaging disconnected. Try again.",
          )
        onStatus(current.connected)
        return release
      } catch (error) {
        await release()
        throw error
      }
    },
  }
  return manager
}

export const conversationRealtime = createConversationRealtime()
