# Request messaging

Developed: 2026-10-30

Accepting a service request records its accepting department, original accepting account, and acceptance time in the same transaction as its move to **Under review**. Its client and the accepting department's current active `STAFF` head can then exchange plain-text messages on the dedicated **Messages** page (`/messages`), opened from the message icon in the top bar. The page lists their accepted requests, including closed conversations with retained history, with the latest message preview. Selecting a request opens its conversation at `/messages?request=<requestId>`. On mobile, **All conversations** returns to the list.

The **Service Requests** and **Request Inbox** details panels provide an **Open messages** link to the corresponding conversation; messages and the composer are no longer embedded in those panels. Existing Booked Services deep links retain that action for compatibility. Acceptance keeps its details panel open so the head can review the request before following that link. Only clients and current staff department heads see the top-bar message icon or can open the page.

Other clients, ordinary staff, heads of other linked departments, Admins and Superadmins cannot read or send messages. When a department changes heads, including a temporary handoff, the replacement gets the conversation and the former head loses access. Catalog routing changes do not remove the accepting department's conversation. Closing or cancelling a request preserves history and prevents further messages. Messages are also paused while the department has no active staff head.

Previously accepted requests have no reliable accepting department recorded. Their fields remain null during migration. A currently routed head can explicitly **Start conversation** in their Under review details to claim the request. Competing claims permit exactly one winner; the migration never guesses ownership.

## Realtime delivery and security

PostgreSQL triggers publish a private Supabase Broadcast on `request-conversation:<requestId>` after message insertion or an acceptance/status change. Broadcasts contain only an empty invalidation payload. Message text remains in `ServiceRequestMessage` and is returned through authenticated Nexus API requests. Broadcast events participate in the message transaction; retrying an already saved message does not publish a duplicate event.

The API subscribes with its existing server-only Supabase secret. One Supabase client per process shares one channel among all connected viewers of a conversation. Channels are removed when their last viewer disconnects. Browser clients use a same-origin streaming `fetch` with their existing sessionStorage Bearer token. No Supabase key, extra browser token, Supabase Auth session, cookie, or public channel is introduced.

The API verifies current participation for history, writes and stream establishment. It also rechecks the session and participants before each live notification and on 15-second heartbeats. Streams rotate after 55 seconds so reconnection uses the existing access-token refresh mechanism. Both initial connection and reconnection reload persisted history to recover missed notifications. The frontend merges messages by ID, preserves drafts on send failure, and reuses a message UUID for retries. History uses stable `(createdAt, id)` cursors, 50 messages per page. Text is limited to 4000 characters and rendered as text, never HTML.

Direct `anon`/`authenticated` access to the message table is revoked and RLS is enabled without browser policies. The API's PostgreSQL connection must have its existing owner/service privileges. Supabase Broadcast uses the server's privileged connection; browser subscriptions to `realtime.messages` are unnecessary. Any project-wide public broadcast policies should not be used to expose conversation content.

This follows Supabase's [database Broadcast](https://supabase.com/docs/guides/realtime/broadcast) and [private channel authorization](https://supabase.com/docs/guides/realtime/authorization) model. The API relays invalidations to retain Nexus's existing authentication and same-origin network rules.

## Setup

1. Set `SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` in `apps/api/.env`, using the same Supabase project as `DATABASE_URL`. The existing Storage credentials work here too; `SUPABASE_SERVICE_ROLE_KEY` remains a supported fallback. Never prefix these keys with `NEXT_PUBLIC_`.
2. Deploy the pending migrations, including `20261031000000_request_conversations`:

   ```sh
   pnpm --filter @nexus/api exec prisma migrate deploy
   ```

3. Ensure Supabase Realtime is enabled and `realtime.send(jsonb,text,text,boolean)` exists in that project. The migration creates the triggers; adding the message table to a Postgres Changes publication is unnecessary for Broadcast.
4. Restart the API and web application. Any additional reverse proxy must allow streaming responses without buffering `/api/request-conversations/:id/events`. The endpoint sets `X-Accel-Buffering: no` and `Cache-Control: no-store, no-transform`.
5. Accept a test booking as its head. Follow **Open messages**, then open the same conversation from the client's **Messages** page in a second session and exchange messages in both directions. Disconnect/reconnect one browser and verify that saved replies appear. Repeat with an unrelated account to verify access is denied.

Ordinary PostgreSQL and PGlite can apply the same migration without Supabase schemas; triggers skip broadcasts there. History and sending remain available during a Realtime transport outage. The conversation shows **Reconnecting…**, retries with backoff and offers **Refresh messages**. A missing or disabled database Broadcast function requires fixing the Supabase setup to restore immediate updates.

## API

- `GET /api/request-conversations?before=<requestId>` lists only accepted conversations belonging to the current client or active department head, newest activity first, with safe request metadata and the latest message. Results use 30-item cursor pagination and include `nextCursor`. Requests awaiting acceptance are excluded; unrelated accounts receive an empty list.
- `GET /api/request-conversations/:id?before=<messageId>` returns safe participant metadata, `canSend`, chronological messages and `nextCursor`. The owning client can view the waiting state before acceptance. Unknown requests and unauthorized participants both return `404`.
- `POST /api/request-conversations/:id/messages` accepts `{ body, clientMessageId }`. The server derives the sender and conversation. Repeating a UUID with identical text returns the saved message; reusing it with different text returns `409`.
- `GET /api/request-conversations/:id/events` streams `connected`, `messages-changed`, `heartbeat`, `reconnecting` and `access-revoked` SSE events. No message text or credentials are included in events or URLs.

## Verification

Offline PGlite tests apply the complete migration chain, emulate `realtime.send` to inspect private trigger payloads, and cover acceptance, historical claims, participant isolation, forged sender input, duplicate sends, cursor pagination, closed requests, head handoffs, account/role changes, logout, live notification fanout and reconnect history. Browser tests exercise both participants, incoming streamed notifications, mobile layout, failed-send retry, history loading and reconnect behavior. Hosted Supabase delivery must be smoke-tested after deployment with the configured project; automated tests do not access the live database.
