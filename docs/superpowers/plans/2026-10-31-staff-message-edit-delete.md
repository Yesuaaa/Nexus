# Staff Message Editing and Deletion Implementation Plan

> **For agentic workers:** Implement inline from this plan and the approved spec. Do not commit.

**Goal:** Let staff edit their own conversation messages and redact then permanently purge deleted messages after 30 days, while improving the internal-only section spacing.

**Architecture:** Extend the shared conversation message model and authenticated API with owner-checked edit/delete operations. Store a purge timestamp and remove expired tombstones from an hourly API maintenance task. Render staff-only message controls in the existing conversation column; clients receive the edited state and deletion placeholder through normal history refresh.

**Tech Stack:** Prisma/PostgreSQL, Express, React/Next.js, Tailwind, existing DropdownMenu and conversation realtime stream.

**Spec:** `docs/superpowers/specs/2026-10-31-staff-message-edit-delete-design.md`

## Global Constraints

- Only the active staff message author can edit or delete their own non-deleted messages.
- Deletion redacts message text immediately, retains a tombstone for 30 days, then permanently removes the row.
- The placeholder reads “This message was deleted” and shows the days remaining to permanent removal.
- Clients see the edited marker and deleted-message state but do not receive staff controls.
- Preserve message ordering, pagination, send idempotency, existing authorization, and `messages-changed` notifications.
- Leave all work uncommitted.

## Review Focus

- An unauthorized user, non-author, or inactive former department head cannot edit or delete a message.
- Deleted text is not returned through conversation history or inbox previews.
- A deleted message cannot be edited or deleted again; expired tombstones are physically removed.
- Editing does not alter message creation time or pagination order.
- The visible countdown derives from `purgeAt` and remains accurate as days pass.

---

### Task 1: Persist message state and add owner-checked API operations

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261031150000_staff_message_edit_delete/migration.sql`
- Modify: `apps/api/src/features/request-conversations/request-conversations.service.ts`
- Modify: `apps/api/src/features/request-conversations/request-conversations.controller.ts`

**Interfaces:**

- `PATCH /:id/messages/:messageId` accepts `{ body: string }` and returns `{ message }`.
- `DELETE /:id/messages/:messageId` returns `{ message }` with `body: null`, `deletedAt`, and `purgeAt`.
- Add `editedAt DateTime?`, `deletedAt DateTime?`, `purgeAt DateTime?`; make `body` nullable and index `(requestId, purgeAt)` for tombstones.
- Export `editConversationMessage(userId, requestId, messageId, body)` and `deleteConversationMessage(userId, requestId, messageId)`.

- [ ] Add the nullable body and lifecycle timestamps plus the purge index in Prisma and SQL, preserving existing message bodies and timestamps.
- [ ] Extend the database change notification trigger to cover message updates and deletes, so open conversations refresh after edits, redaction, and purge.
- [ ] Add request/message parameter validation and trimmed 1–4000 character body validation to the controller.
- [ ] Implement transactional active-head/participant/owner checks, reject deleted messages, update parent request activity, and publish `messages-changed` after each successful mutation.
- [ ] Return only the existing message selection plus the new lifecycle fields; never return the redacted text.

### Task 2: Permanently purge expired message tombstones

**Files:**

- Modify: `apps/api/src/features/request-conversations/request-conversations.service.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**

- Export `purgeExpiredConversationMessages(now?: Date): Promise<number>`; it deletes only rows with non-null `purgeAt <= now`.

- [ ] Add the purge function with a bounded, index-supported delete query.
- [ ] Run it once at API startup and hourly afterward; report cleanup failures without stopping the API, and unref the timer so it does not block shutdown.

### Task 3: Add staff message actions and shared deleted/edited states

**Files:**

- Modify: `apps/web/src/features/request-conversations/api/request-conversations-api.ts`
- Modify: `apps/web/src/features/request-conversations/components/request-conversation.tsx`
- Modify: `apps/web/src/features/request-conversations/pages/messages-page.tsx`

**Interfaces:**

- `RequestMessage.body` becomes `string | null` and gains nullable `editedAt`, `deletedAt`, and `purgeAt` fields.
- Add `editMessage(id, messageId, body)` and `deleteMessage(id, messageId)` API helpers.

- [ ] Add Edit/Delete controls only to non-deleted messages authored by the active staff member, using a compact accessible menu.
- [ ] Edit inline with Save/Cancel; preserve multiline text and show an “edited” marker after saving.
- [ ] Delete with a confirmation step, update the message to a placeholder, and show “Permanently deleted in N days” from `purgeAt` for both participants.
- [ ] Show the deleted placeholder in the conversation-list preview when the most recent message is a tombstone.
- [ ] Ensure deleted or edited messages update immediately in the open conversation and are consistent after realtime refresh/reload.

### Task 4: Add spacing to the internal-only section label

**Files:**

- Modify: `apps/web/src/features/request-workflow/components/workflow-context-panel.tsx`

- [ ] Add comfortable top padding to the internal-only bordered group and a small gap between its label and the disclosure rows, matching the current panel style.
