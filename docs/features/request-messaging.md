# Request messaging

Developed: 2026-10-30

Accepting a service request records its accepting department, original accepting account, and acceptance time in the same transaction as its move to **Under review**. Its client and the accepting department's current active `STAFF` head can then exchange plain-text messages on the dedicated **Messages** page (`/messages`), opened from the message icon in the top bar. **Active** lists their ongoing accepted requests with the latest message preview. **Archived** (`/messages?view=archived`) automatically contains closed and cancelled service conversations with read-only history. Selecting a request opens its conversation at `/messages?request=<requestId>`, adding `&view=archived` for archived threads. A closed or cancelled booking deep link automatically opens the archive. On mobile, **All conversations** returns to the current list.

Both participants can **Delete for me** from an archived thread or its list row after confirming. Deletion is stored per account in `ServiceRequestConversationDeletion` and persists across refreshes and sessions. It removes only that participant's archived chat; the service request, messages, workflow records and the other participant's history remain. A replacement department head has their own deletion preference. Active conversations cannot be deleted; if a service becomes active again, its chat becomes available again. Archived chats do not contribute to the active inbox's unread total. Polling refreshes all loaded pages so archived and deleted rows cannot linger in an earlier inbox snapshot.

The inbox groups accepted service threads under the **department head's name** for clients, and under the **client's name** for department heads. Person rows show the name, service count, department when applicable and unread badge. Expand a person to choose a service thread; message previews appear only on individual threads alongside their booking reference and unread badge. Group badges add the unread counts of their loaded threads, and **Load more conversations** adds older bookings to the appropriate existing group. Repeat bookings remain separate threads. The active thread's group opens automatically when following a booking link. Selecting an avatar in the collapsed inbox expands the list to show that person's service threads.

Staff, Admin and Superadmin accounts also have an icon-only people toggle for **Internal chats**. The internal list includes a **Client chats** return link, also accessible in the collapsed conversation rail and on mobile. It exposes active staff and administrator contacts, creates one private direct thread per pair, and lets either participant send plain-text messages. Internal threads use `InternalConversation`, `InternalConversationParticipant` and `InternalMessage`; clients never see the internal contact list or endpoints. Internal read state is per participant, and inactive or deleted accounts cannot receive new messages.

Client groups use the accepting department's ID internally so replacing its head updates the displayed name while retaining the same service threads. Head inboxes group by client ID, keeping accounts with identical names separate. Messages, quotations, approvals, payments and workflow states remain attached to each individual request.

Conversation details remain available when there are no current booked services, including after the last booking closes or is cancelled. The panel keeps participant, department and chat information, shows **No current booked services**, and omits service-specific details until a current booking is available. Existing messages and the message draft remain in the shared conversation.

The **Service Requests** and **Request Inbox** details panels provide an **Open messages** link to the corresponding conversation; messages and the composer are no longer embedded in those panels. Existing Booked Services deep links retain that action for compatibility. Acceptance keeps its details panel open so the head can review the request before following that link. Clients, staff and administrator accounts can see the top-bar message icon; service request threads remain limited to clients and current staff department heads, while internal threads are limited to staff and administrator accounts.

Other clients, ordinary staff, heads of other linked departments, Admins and Superadmins cannot read or send **service request** messages. When a department changes heads, including a temporary handoff, the replacement gets the conversation and the former head loses access. Catalog routing changes do not remove the accepting department's conversation. Closing or cancelling a request preserves history and prevents further messages. Messages are also paused while the department has no active staff head.

Previously accepted requests have no reliable accepting department recorded. Their fields remain null during migration. A currently routed head can explicitly **Start conversation** in their Under review details to claim the request. Competing claims permit exactly one winner; the migration never guesses ownership.

## Realtime delivery and security

PostgreSQL triggers publish a private Supabase Broadcast on `request-conversation:<requestId>` after message insertion or an acceptance/status change. Broadcasts contain only an empty invalidation payload. Message text remains in `ServiceRequestMessage` and is returned through authenticated Nexus API requests. Broadcast events participate in the message transaction; retrying an already saved message does not publish a duplicate event.

The API subscribes with its existing server-only Supabase secret. One Supabase client per process shares one channel among all connected viewers of a conversation. Channels are removed when their last viewer disconnects. Browser clients use a same-origin streaming `fetch` with their existing sessionStorage Bearer token. No Supabase key, extra browser token, Supabase Auth session, cookie, or public channel is introduced.

The API verifies current participation for history, writes and stream establishment. It also rechecks the session and participants before each live notification and on 15-second heartbeats. Streams rotate after 55 seconds so reconnection uses the existing access-token refresh mechanism. Both initial connection and reconnection reload persisted history to recover missed notifications. The frontend merges messages by ID, preserves drafts on send failure, and reuses a message UUID for retries. History uses stable `(createdAt, id)` cursors, 50 messages per page. Text is limited to 4000 characters and rendered as text, never HTML.

Direct `anon`/`authenticated` access to the message table is revoked and RLS is enabled without browser policies. The API's PostgreSQL connection must have its existing owner/service privileges. Supabase Broadcast uses the server's privileged connection; browser subscriptions to `realtime.messages` are unnecessary. Any project-wide public broadcast policies should not be used to expose conversation content.

This follows Supabase's [database Broadcast](https://supabase.com/docs/guides/realtime/broadcast) and [private channel authorization](https://supabase.com/docs/guides/realtime/authorization) model. The API relays invalidations to retain Nexus's existing authentication and same-origin network rules.

## Setup

1. Set `SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` in `apps/api/.env`, using the same Supabase project as `DATABASE_URL`. The existing Storage credentials work here too; `SUPABASE_SERVICE_ROLE_KEY` remains a supported fallback. Never prefix these keys with `NEXT_PUBLIC_`.
2. Deploy the pending migrations, including `20261031000000_request_conversations`, `20261101000000_archived_conversations` and `20261101010000_internal_conversations`:

   ```sh
   pnpm --filter @nexus/api exec prisma migrate deploy
   ```

3. Ensure Supabase Realtime is enabled and `realtime.send(jsonb,text,text,boolean)` exists in that project. The migration creates the triggers; adding the message table to a Postgres Changes publication is unnecessary for Broadcast.
4. Restart the API and web application. Any additional reverse proxy must allow streaming responses without buffering `/api/request-conversations/:id/events`. The endpoint sets `X-Accel-Buffering: no` and `Cache-Control: no-store, no-transform`.
5. Accept a test booking as its head. Follow **Open messages**, then open the same conversation from the client's **Messages** page in a second session and exchange messages in both directions. Disconnect/reconnect one browser and verify that saved replies appear. Repeat with an unrelated account to verify access is denied.

Ordinary PostgreSQL and PGlite can apply the same migration without Supabase schemas; triggers skip broadcasts there. History and sending remain available during a Realtime transport outage. The conversation shows **Reconnecting…**, retries with backoff and offers **Refresh messages**. A missing or disabled database Broadcast function requires fixing the Supabase setup to restore immediate updates.

## API

- `GET /api/request-conversations?view=active|archived&before=<requestId>` lists accepted conversations belonging to the current client or active department head, newest activity first. The default view is `active`; `archived` returns closed and cancelled requests excluding that account's deleted conversations. Results use 30-item cursor pagination, include request `status`, `nextCursor`, per-thread unread counts and the active inbox's global `unreadCount`. Requests awaiting acceptance are excluded; unrelated accounts receive an empty list.
- `GET /api/request-conversations/:id?before=<messageId>` returns safe participant metadata, `archived`, `canSend`, chronological messages and `nextCursor`. The owning client can view the waiting state before acceptance. Unknown requests, deleted archived conversations and unauthorized participants return `404`.
- `DELETE /api/request-conversations/:id` deletes a closed or cancelled conversation for the current participant only. It is idempotent; active or unaccepted conversations return `409`, unauthorized requests return `404`. Booking activity timestamps remain unchanged.
- `POST /api/request-conversations/:id/messages` accepts `{ body, clientMessageId }`. The server derives the sender and conversation. Repeating a UUID with identical text returns the saved message; reusing it with different text returns `409`.
- `GET /api/request-conversations/:id/events` streams `connected`, `messages-changed`, `heartbeat`, `reconnecting` and `access-revoked` SSE events. No message text or credentials are included in events or URLs.
- `GET /api/internal-conversations/contacts` lists active staff, Admin and Superadmin contacts for an authenticated internal account.
- `GET /api/internal-conversations?before=<conversationId>` lists that account's direct internal threads with per-thread and total unread counts. `POST /api/internal-conversations` accepts `{ recipientId }` and reuses the existing pair thread when one already exists.
- `GET /api/internal-conversations/:id?before=<messageId>` returns the other participant, `canSend`, chronological messages and `nextCursor`. `PATCH /api/internal-conversations/:id/read` updates that participant's read marker.
- `POST /api/internal-conversations/:id/messages` accepts `{ body, clientMessageId }` and derives the sender and participants server-side. Internal message triggers publish the same empty private invalidation payload on `internal-conversation:<id>`.

## Verification

Offline PGlite tests apply the complete migration chain, emulate `realtime.send` to inspect private trigger payloads, and cover acceptance, historical claims, participant isolation, forged sender input, duplicate sends, cursor pagination, closed requests, head handoffs, account/role changes, logout, live notification fanout and reconnect history. Browser tests exercise both participants, incoming streamed notifications, mobile layout, failed-send retry, history loading and reconnect behavior. Grouped inbox coverage includes service thread switching, repeat bookings, unread totals, pagination, head replacements, distinct clients with identical names and collapsed-rail navigation. Hosted Supabase delivery must be smoke-tested after deployment with the configured project; automated tests do not access the live database.
