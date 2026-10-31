# Staff Message Editing and Deletion

## Intent

Let staff correct their own conversation messages and remove their text while keeping the shared conversation readable. Improve the spacing above the internal-only section label shown in the workflow context panel.

## Goals

- Staff can edit their own sent messages or mark them for permanent removal after the retention period.
- Edits are marked as edited. Deleting immediately removes the original text and displays “This message was deleted” with a countdown until the placeholder is permanently removed.
- Clients see the updated message state, but do not receive staff edit/delete controls. System events and client-authored messages remain unchanged.
- Existing conversation authorization and realtime refresh behavior apply to edits and deletions.
- The internal-only label has comfortable space above it and a clear gap before its disclosure rows.

## Non-goals

- Editing or deleting client messages, system events, or another staff member’s messages.
- Maintaining a revision history or restoring deleted text.

## Approaches

- **Delayed hard deletion (chosen):** redact the stored body immediately, retain the row as a placeholder until its purge date, and then permanently delete the row. This preserves ordering and makes the permanent-removal date visible.
- **Immediate hard deletion:** remove the row at once. This leaves a gap in the conversation and complicates message cursor continuity.

Delayed hard deletion is selected: the original text is removed immediately, while the placeholder remains until its 30-day retention period expires.

## Implementation outline

- Add edit/deletion timestamps and a purge date to `ServiceRequestMessage`; allow the body to be null only for deleted rows.
- Add authenticated edit and delete endpoints with participant, active department-head, message ownership, and request-state checks. Publish the existing `messages-changed` realtime event after successful changes.
- Extend database realtime invalidation to fire on message edits, redaction, and eventual purge so open participants refresh immediately.
- In staff chat, expose a compact per-message action menu for the active staff member’s own messages. Editing uses inline text entry with Save and Cancel; deletion redacts the message and leaves the placeholder. Display the edited marker and deletion countdown for both participants.
- Show the deletion placeholder in the conversation list when it is the latest message.
- Add an API cleanup task that runs at startup and hourly, permanently removing messages whose purge dates have passed. No scheduler currently exists in the API.
- Add top padding to the internal-only section and a small gap between its label and disclosure rows.
- Preserve current message send, grouping, pagination, and system-event behavior.

## Constraints and calls

- Conversation messages are shared between staff and clients and currently store immutable text with sender and creation time.
- Staff access is scoped to the accepted department head; edit/delete requests must re-check that access and verify the sender owns the target message.
- Retention period: 30 days from deletion. The placeholder countdown is derived from the stored purge date.
- Implementation and design note remain uncommitted, per repository preferences.
