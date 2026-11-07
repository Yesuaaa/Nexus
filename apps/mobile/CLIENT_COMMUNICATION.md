# Client chat and notifications

The shared Compose client uses the existing authenticated Ktor client for conversations,
workflow notifications, request workflow actions, and activated project workspaces.
The backend conversation implementation and Prisma models are aligned with the existing
shared client/department conversation schema. Conversation IDs identify chats; booking
IDs identify individual request workflows. The connected database is not migrated by
this mobile setup.

- The header opens Notifications, Messages, and Profile in that order.
- The Messages screen follows the supplied design without Active/Archived filter buttons.
  Conversation requests use backend cursors and unread counts.
- Chat loads earlier history, marks conversations read, and reconciles loaded history
  on SSE invalidations and foreground recovery. Streams use `/events`, stop in the
  background, and reconnect with bounded exponential backoff.
- Optimistic messages retain their UUID across failed-send retries. Confirmed history
  replaces pending messages by client ID. Pending state lives in the conversation
  ViewModel; it is not a persistent offline outbox across process death.
- Chat availability follows the shared backend's `canSend` permission. Client edit/delete controls are omitted
  because the existing API permits only staff to edit/delete messages.
- Notifications refresh on foreground and periodically while the app is resumed.
  Opening a notification rechecks request access and marks it read before navigation.
- Request details show the persisted workflow state, next action, client requirements,
  consultations, published quotations, agreement/payment status, files, and events.
  Actions carry UUID action IDs and expected versions. Conflicts refresh without
  replaying the action. Ambiguous failures can confirm the exact previous action.
- File uploads validate name, size, MIME type and extension, report progress, and reuse
  an upload ID when retried. Downloads use authenticated requests. Android uses the
  system document picker and FileProvider; iOS uses native document import/export.
- Activated projects are reached through request details and expose milestone progress
  without client mutation controls. Internal workflow fields are excluded from models.

## Verification

From the repository root:

```powershell
pnpm format
pnpm lint
pnpm typecheck
```

From `apps/mobile`:

```powershell
.\gradlew.bat :shared:testAndroidHostTest :androidApp:assembleDebug :androidApp:lintDebug
.\gradlew.bat :shared:connectedAndroidDeviceTest
```

The second command requires a running Android emulator or device. iOS compilation and
native document handling must be verified on macOS with Xcode.
