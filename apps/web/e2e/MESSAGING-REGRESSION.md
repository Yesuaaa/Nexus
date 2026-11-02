# Messaging regression workflow

Use this checklist for changes to Messages, request acceptance, internal chats,
or conversation workflow actions. Run the browser suite against a production
build. Test both desktop (1440 px) and mobile (390 px) where specified.

## 1. Prepare

- Automated browser tests supply their own mock accounts and records. They do
  not require real credentials or change the live database.
- For a deployed smoke test, use a designated test environment with two clients,
  two department heads, an ordinary Staff account, an Admin and a Superadmin.
  Keep each account in a separate browser profile/context.
- Prepare a submitted request, an accepted request, two requests for the same
  client/head pair, a closed request, and a cancelled request. Include an
  unrelated client and a head from another department for isolation checks.
- Use non-sensitive sample text and attachment files. Record the commit,
  environment, browser, viewport and test account roles in the run record.

## 2. Run the automated gates

From the repository root:

```sh
# Focused messaging browser regression; builds/starts web automatically.
pnpm --filter @nexus/web test:e2e:messages --workers=2

# Real HTTP, authorization, persistence and migration checks using offline PGlite.
pnpm --filter @nexus/api test

# Required repository quality gates after edits.
pnpm format
pnpm lint
pnpm typecheck
```

For interactive inspection:

```sh
pnpm --filter @nexus/web test:e2e:messages --ui
```

Keep port 5273 free for Playwright. If using `NEXUS_E2E_BASE_URL`, provide an
already running, freshly built production server. Development mode can repeat
effects and invalidate request-count assertions. Do not run two Playwright
processes against the same output folder simultaneously.

## 3. Execute the functional workflow

Run in order: access → acceptance → conversation selection → send/receive →
recovery → workflow actions → archive → internal chats → deployment smoke.

“Browser” means deterministic Playwright coverage with mocked APIs; “API” means
the offline backend suite. “Manual” cases require the deployed test environment.
Passing a browser mock does not establish server authorization or hosted delivery.

### Access, navigation and request threads

| ID     | Steps                                                                                                                                        | Expected result                                                                                                                                  | Coverage                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| MSG-01 | Sign in as client, head, ordinary Staff, Admin and Superadmin; open the top-bar Messages link.                                               | Messages opens separately from booking details. Internal roles can open internal chat. Service threads are limited to their actual participants. | Browser: `request-conversations.spec.ts`; API |
| MSG-02 | Open a submitted request as its client; accept it as its routed head; follow Open request workspace.                                         | Sending is unavailable before acceptance. Acceptance opens a private client/head thread and does not approve a quotation or activate a project.  | Browser: conversation/inbox specs; API        |
| MSG-03 | Open the same request ID as an unrelated client, ordinary Staff, other head, Admin and Superadmin using direct history/send/stream requests. | No private history is disclosed; service conversation endpoints reject nonparticipants. Knowing a URL grants no access.                          | API; manual deployed smoke                    |
| MSG-04 | Expand a person with multiple services, switch between threads and load more conversations.                                                  | Each request keeps separate messages, reference and workflow; threads merge into the correct person group without duplicates.                    | Browser: conversation spec                    |
| MSG-05 | Use clients with identical names; replace a department head.                                                                                 | Client IDs keep groups distinct; replacement head inherits the department's threads while former head loses access.                              | Browser + API                                 |
| MSG-06 | At 390 px, open a thread and use All conversations; expand the collapsed conversation rail.                                                  | Correct list/view returns; selection remains identifiable; no horizontal page overflow.                                                          | Browser: conversation spec                    |

### Messages and recovery

| ID     | Steps                                                                                                     | Expected result                                                                                                                                                 | Coverage                                                               |
| ------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| MSG-07 | Send messages in both directions from separate client/head sessions.                                      | Sender and recipient see exactly one message, in chronological order, and the correct thread preview updates.                                                   | Browser + API                                                          |
| MSG-08 | Send multiline text and HTML/script-looking text; attempt empty/whitespace and oversized content.         | Text is rendered literally; no script executes. Empty/oversized messages are rejected and the server derives sender identity.                                   | Browser + API                                                          |
| MSG-09 | Simulate a response failure after the message was saved; retry unchanged text.                            | Draft remains until success; retry uses the same UUID and creates no duplicate message.                                                                         | Browser + API                                                          |
| MSG-10 | Disconnect realtime, receive messages while disconnected, reconnect and load earlier history.             | Reconnecting state appears; persisted messages recover without duplication; history pagination uses the correct conversation.                                   | Browser + API; hosted transport manual                                 |
| MSG-11 | As Staff, edit an owned message; fail the first save, retry, then cancel and confirm deletion.            | Failed edit preserves the draft. Both participants see the edit/deleted placeholder; cancellation makes no deletion request; deleted message actions disappear. | Browser: conversation spec                                             |
| MSG-12 | Try editing/deleting another participant's message and a message as a client; inspect deletion retention. | Controls follow role/ownership; unauthorized API writes fail; soft deletion retains the expected metadata until retention expiry.                               | Manual API check; do not infer server enforcement from hidden controls |
| MSG-13 | While a conversation is open, reassign the head, deactivate an account or sign out.                       | Access is revoked; further protected reads/writes fail; private history is cleared when the client handles revocation.                                          | Browser request-stream revocation + API                                |
| MSG-14 | Read a thread with unread replies and revisit the list.                                                   | Thread and grouped unread counts decrease correctly; unrelated service unread counts remain intact.                                                             | Browser: grouped conversation cases; API                               |

### Actions attached to a request

| ID     | Steps                                                                                         | Expected result                                                                                                                                                       | Coverage                                   |
| ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| MSG-15 | Review a valid quotation, acknowledge and accept; try an expired quotation.                   | Valid approval is an explicit structured action; expired quotation has no approval control; chat text alone does not approve it.                                      | Browser: `request-workflow.spec.ts`; API   |
| MSG-16 | Request a consultation reschedule; fail then retry.                                           | Reason/date remain; identical retry uses the same action ID/version; original confirmed schedule stays until department response.                                     | Browser: workflow spec; API                |
| MSG-17 | Select payment evidence, preview, remove, reselect and fail/retry upload.                     | Removal sends nothing; failed upload sends no payment action; retry reuses upload ID; success submits the returned file ID and displays awaiting-verification status. | Browser: workflow spec; API                |
| MSG-18 | Open approval notification as assigned Admin/Superadmin; approve quotation or verify payment. | Correct request opens; only assigned authorized actors act; activation requirements remain enforced.                                                                  | Browser: `workflow-approvals.spec.ts`; API |
| MSG-19 | Open an activated project's workspace from its thread; toggle assigned milestones.            | Link targets the correct project; project and conversation handoff remain consistent.                                                                                 | Browser: `project-workspace.spec.ts`; API  |

### Archives

| ID     | Steps                                                                                   | Expected result                                                                                                            | Coverage      |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------- |
| MSG-20 | Close/cancel a request, refresh the active list and open its deep link.                 | Thread moves to Archived; history remains readable, sending is unavailable and active unread totals exclude it.            | Browser + API |
| MSG-21 | Delete an archived thread for one participant: cancel, simulate failure, retry, reload. | Cancellation/failure preserves it; success hides it only for that account; booking and other participant's history remain. | Browser + API |
| MSG-22 | Load multiple inbox pages, then archive/delete a previously loaded thread and refresh.  | Stale rows do not reappear; active threads cannot be deleted through the archive operation.                                | Browser + API |

### Internal chats

| ID     | Steps                                                                                           | Expected result                                                                                                                              | Coverage                                                    |
| ------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| INT-01 | As Staff, Admin and Superadmin, start a chat with an active colleague on desktop/mobile.        | Correct recipient ID is submitted; thread opens; returning to the list shows one thread and no duplicate Start a chat contact.               | Browser: `internal-conversations.spec.ts`; API              |
| INT-02 | Fail creation, then retry from the contact list.                                                | Error appears, no absent-thread navigation occurs, and retry opens the thread.                                                               | Browser: internal spec                                      |
| INT-03 | Send blank and multiline/script-looking messages; fail after persistence and retry.             | Blank send is disabled; content is literal; draft survives failure; unchanged retry uses one UUID and yields one persisted/rendered message. | Browser: internal spec                                      |
| INT-04 | Receive a reply while a thread is open; allow the 15-second refresh.                            | Reply appears and read marker clears the unread count. Internal web chat currently polls; do not expect instant browser SSE updates.         | Browser: internal spec                                      |
| INT-05 | Make the recipient unavailable while the thread is open, then refresh.                          | Existing history stays readable and composer disappears; no new message request is sent.                                                     | Browser: internal spec; API authorization smoke             |
| INT-06 | As a client or unrelated internal account, request internal contacts/history/messages directly. | Client cannot use internal endpoints; unrelated accounts cannot read or write another pair's thread.                                         | API; manual deployed smoke                                  |
| INT-07 | Load older internal history, then wait through polling; switch threads with an unsent draft.    | Older loaded history stays available as intended; messages/drafts never cross thread boundaries.                                             | Manual exploratory; dedicated browser coverage still needed |

## 4. Deployment-only smoke checks

1. Use separate browser contexts for the actual client and department head.
   Accept the designated test request, exchange messages, then disconnect and
   reconnect one context. Verify delivery against the real Supabase configuration.
2. Inspect the request stream: authenticated same-origin fetch, no bearer token
   in URLs, no message body in invalidation events, and no browser Supabase secret.
3. Reassign the test department head and confirm the old open session loses
   access while the replacement can open the correct history.
4. Verify internal reply delivery within its polling interval, including after
   switching back from a hidden tab. Check inactive-recipient behavior.
5. Delete an archived conversation for one test account; sign in again and verify
   it remains hidden for that account and visible to the other participant.

## Known limits and release decision

- Inbox decline/delete buttons currently call backend routes that are not
  implemented. Failed delete recovery is covered; do not mark successful
  decline or booking deletion as passed. This is separate from working
  archived-chat **Delete for me**. The restored native decline confirmation
  also needs a dialog stacking/accessibility follow-up while the booking drawer
  is open.
- Hosted Supabase delivery, real deployment session revocation and retention
  expiry need the deployment checks above. Mocks and offline PGlite do not prove
  those infrastructure behaviors.
- Record each manual case as Pass, Fail, Blocked or Not run. Any privacy leak,
  duplicate mutation, wrong-thread message or lost saved message blocks release.
  Track other defects explicitly; do not label unrun cases as passed.

Run record:

| Commit/environment | Case ID | Role/viewport | Result | Evidence or defect |
| ------------------ | ------- | ------------- | ------ | ------------------ |
|                    |         |               |        |                    |
