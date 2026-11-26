# PG-020 Adversarial and Abuse-Case Assessment

Design only, 2026-11-26. These are source-backed test hypotheses, not confirmed vulnerabilities. No automated tests or attacks were executed for this assessment. The authoritative unique-case inventory is [PG-020_TEST_CASE_SPECIFICATION.md](PG-020_TEST_CASE_SPECIFICATION.md); every proposed test ID below occurs there.

## Scope, protected assets, actors, and trust boundaries

PG-020 is the Client Dashboard at `/dashboard`. The page body is static. Security-relevant behavior comes from the current-account gate, Client-only shell and navigation, workflow-notification summary feed and read markers, and shared conversation unread counts.

Protected assets are session/account identity, recipient-scoped notification summaries and read state, internal workflow events, notification preferences, and unread metadata. This page does not own message bodies, billing or project mutations, uploads, or external-service operations.

Relevant actors are an anonymous visitor; active USER/Client; another USER/Client; STAFF (including a Department Head); ADMIN; SUPERADMIN; and an expired, revoked, inactive, or retired account. Trust boundaries are browser `sessionStorage` and same-origin `/api` calls; the Next.js API rewrite; Express authentication and route handlers; authenticated user IDs in Prisma predicates; notification projection; and downstream page/API authorization.

## Source-backed defenses

- `PortalLayout` waits for the current-account lookup, withholds the shell on initial lookup failure, sends unauthenticated sessions to login, and routes internal roles to `/module`.
- `/api/auth/me` requires a valid current session, active non-retired account, and `profile:read`, then returns the public user projection.
- Request-workflow routes use `requireAuth`; recipient identity is taken from `req.auth`, not a caller-supplied user ID.
- Client notification visibility requires a request owned by the authenticated USER/Client and an event with `internal: false`.
- The feed uses explicit Prisma selection, deterministic `createdAt`/ID descending order, a 40-row cap, and a separately scoped unread count in a RepeatableRead transaction.
- Single and bulk read writes retain recipient/resource predicates; an inaccessible single-read ID returns 404. The bulk update is limited to scoped unread rows.
- Notification destinations are same-origin paths with encoded entity/request identifiers. Destination APIs still enforce their own access rules.
- Request-conversation listing requires authentication and uses the authenticated ID in its visibility scope. Project-conversation listing requires authentication, permits USER/STAFF, and scopes USER projects to the active Client owner; project message visibility applies the client-visible predicate.
- The Dashboard exposes no endpoint accepting a caller-supplied role, permission, recipient, or ownership field.

## Abuse-case register

Each record is a hypothesis for bounded synthetic verification. `Status` describes the assessment state, not runtime test results.

### PG-020-ABUSE-001 — Anonymous access to account or notification data

- **Related feature:** PG-020-F001-A001, PG-020-F001-A007.
- **Threat actor:** Anonymous visitor.
- **Target asset:** Account identity and protected notification summaries.
- **Entry point:** Direct `/dashboard`, `GET /api/auth/me`, and `GET /api/request-workflows/notifications`.
- **Preconditions:** No bearer token; isolated synthetic request only.
- **Manipulation:** Request the protected route and API endpoints without credentials.
- **Expected invariant:** The browser redirects to login and APIs return 401 without protected data.
- **Existing defense:** `useAccount` checks the session token; API handlers use session authentication and `requireAuth`.
- **Existing coverage:** Dashboard anonymous/expired-session browser regression and API anonymous role-matrix assertion.
- **Coverage gap:** These assertions were not executed in this Phase 2.1 task.
- **Impact:** Unauthorized disclosure of account or notice data.
- **Likelihood:** Low for a normal client, but direct unauthenticated requests are straightforward.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A001-T005, PG-020-F001-A007-T004.
- **Environment:** Mocked Playwright and isolated API/PGlite.
- **Status:** Hypothesis; source defense and existing assertions identified; runtime unverified.
- **Evidence:** `apps/web/src/features/auth/hooks/use-account.ts:13-61`; `apps/api/src/features/auth/auth.middleware.ts:23-69`; `apps/api/src/features/request-workflow/workflow.controller.ts:15-25`; `apps/web/e2e/auth/regression.spec.ts`.

### PG-020-ABUSE-002 — Expired session leaves the Client shell visible

- **Related feature:** PG-020-F001-A001.
- **Threat actor:** Client with an expired or revoked token.
- **Target asset:** Current account and portal content.
- **Entry point:** Direct `/dashboard` after token expiration or revocation.
- **Preconditions:** Synthetic expired token and controlled `/api/auth/me` 401 response.
- **Manipulation:** Reuse the stale session to load the page.
- **Expected invariant:** The token is cleared, the user is routed to login, and authenticated shell content is not rendered.
- **Existing defense:** Current-account lookup handles 401 by clearing stored tokens and redirecting.
- **Existing coverage:** Existing expired-session browser assertion; generic session middleware tests also cover invalidated sessions.
- **Coverage gap:** No live session or production system is involved in this design.
- **Impact:** Stale access to protected account content.
- **Likelihood:** Low; expiration is expected and handled in the account hook.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A001-T005.
- **Environment:** Mocked Playwright with synthetic session.
- **Status:** Hypothesis; existing assertion identified; runtime unverified.
- **Evidence:** `apps/web/src/features/auth/hooks/use-account.ts:26-47`; `apps/web/e2e/auth/regression.spec.ts`; `apps/api/src/features/auth/auth.middleware.ts:40-61`.

### PG-020-ABUSE-003 — Internal role reaches Client-only Dashboard controls

- **Related feature:** PG-020-F001-A001, PG-020-F001-A005.
- **Threat actor:** STAFF, Department Head, ADMIN, or SUPERADMIN.
- **Target asset:** Client-only dashboard content and account navigation.
- **Entry point:** Direct `/dashboard` and shared topbar.
- **Preconditions:** Authenticated synthetic internal-role account.
- **Manipulation:** Navigate to the Client route and inspect rendered controls.
- **Expected invariant:** The internal role is redirected to `/module`; the Client Dashboard body is not rendered as an authorized page.
- **Existing defense:** `PortalLayout` applies role routing; `DashboardPage` returns null for non-USER accounts.
- **Existing coverage:** Four-role Dashboard browser loop and route policy unit tests.
- **Coverage gap:** No role/session runtime test was executed here.
- **Impact:** Exposure of an inappropriate client-facing interface.
- **Likelihood:** Low given the explicit role gate.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A001-T001, PG-020-F001-A001-T002, PG-020-F001-A005-T001.
- **Environment:** Route-policy unit test and mocked Playwright.
- **Status:** Hypothesis; existing assertions identified; runtime unverified.
- **Evidence:** `apps/web/src/components/layout/portal-layout.tsx:23-32`; `apps/web/src/features/dashboard/pages/dashboard-page.tsx:8-10`; `apps/web/e2e/dashboard/dashboard.spec.ts:11-47`.

### PG-020-ABUSE-004 — Account lookup failure exposes stale or partial shell

- **Related feature:** PG-020-F001-A001.
- **Threat actor:** Authenticated USER/Client experiencing an unavailable account service.
- **Target asset:** Session-derived shell and account controls.
- **Entry point:** `/api/auth/me` during `/dashboard` initialization.
- **Preconditions:** Synthetic session; delayed or bounded 503 response.
- **Manipulation:** Hold or fail the account lookup while the route renders.
- **Expected invariant:** No stale or partial Client shell appears; loading or safe error feedback appears.
- **Existing defense:** `PortalLayout` gates the shell on the account query and shows an alert on initial non-401 failure.
- **Existing coverage:** Existing delayed lookup and 503 browser declarations.
- **Coverage gap:** The reports add exact page-heading assertions separately; they are not necessary to establish this failure-state invariant.
- **Impact:** Confusing or stale account presentation; potential disclosure if stale identity were rendered.
- **Likelihood:** Low; limited to lookup failure paths.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A001-T003, PG-020-F001-A001-T004.
- **Environment:** Mocked Playwright with controlled response.
- **Status:** Hypothesis; existing assertions identified; runtime unverified.
- **Evidence:** `apps/web/src/components/layout/portal-layout.tsx:50-63`; `apps/web/e2e/dashboard/dashboard.spec.ts:50-91`.

### PG-020-ABUSE-005 — USER accesses internal workspace context through navigation

- **Related feature:** PG-020-F001-A003.
- **Threat actor:** Authenticated USER/Client.
- **Target asset:** Internal workspace navigation entries and module context.
- **Entry point:** `/module`, persisted workspace selection, or Client sidebar.
- **Preconditions:** Synthetic USER account and optional remembered module identifier.
- **Manipulation:** Request `/module` or evaluate a remembered internal workspace selection.
- **Expected invariant:** USER sees only Client routes; internal module context is not selected and `/module` resolves to the Client Dashboard.
- **Existing defense:** Route policy filters navigation by account permissions and role; workspace selection is role-scoped.
- **Existing coverage:** Workspace module/selection unit assertions and shared navigation browser checks.
- **Coverage gap:** Existing browser widths do not visit every destination page; those destinations have separate PG coverage.
- **Impact:** Confusing navigation or attempted access to an internal workspace.
- **Likelihood:** Low; route policy and workspace selector both gate context.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A003-T001, PG-020-F001-A003-T002, PG-020-F001-A003-T003.
- **Environment:** Unit and mocked Playwright.
- **Status:** Hypothesis; existing assertions identified; runtime unverified.
- **Evidence:** `apps/web/src/features/workspaces/model/route-policy.ts:472-490`; `apps/web/src/features/workspaces/model/workspace-selection.ts:17-23`; `apps/web/e2e/workspace-selector.spec.ts:178-219`.

### PG-020-ABUSE-006 — Client reads or marks another Client’s notification

- **Related feature:** PG-020-F001-A007, PG-020-F001-A009.
- **Threat actor:** Client A attempting to access Client B’s notification.
- **Target asset:** B’s private notice summary and read state.
- **Entry point:** Notification `GET` or `PATCH /api/request-workflows/notifications/:id/read`.
- **Preconditions:** Two synthetic clients and one notice per recipient in PGlite.
- **Manipulation:** Request the feed as A and submit B’s known notice ID to the single-read route.
- **Expected invariant:** B’s notice is absent from A’s feed; A’s request to mark it read returns 404 and does not mutate B’s row.
- **Existing defense:** Feed and update predicates bind `userId` to the authenticated user and apply resource visibility scope.
- **Existing coverage:** PGlite endpoint assertions cover scoped listing and foreign/invisible-ID 404 behavior.
- **Coverage gap:** The browser/Next rewrite boundary is separately designed as an integration case.
- **Impact:** Cross-client disclosure or tampering with read state.
- **Likelihood:** Low; requires an identifier, but direct API manipulation is possible.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A007-T001, PG-020-F001-A009-T001, PG-020-F001-A008-T003.
- **Environment:** API/PGlite plus isolated browser/Express/PGlite integration.
- **Status:** Hypothesis; source controls and existing API assertions identified; runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:84-94, 181-190`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:204-327`.

### PG-020-ABUSE-007 — Internal workflow event appears in a Client notification feed

- **Related feature:** PG-020-F001-A007.
- **Threat actor:** USER/Client requesting the notification feed.
- **Target asset:** Internal workflow summary or staffing note.
- **Entry point:** `GET /api/request-workflows/notifications` and Dashboard same-origin proxy.
- **Preconditions:** Synthetic owned request with public and internal workflow events.
- **Manipulation:** Load the feed through the real Dashboard path and inspect returned/rendered notices.
- **Expected invariant:** Only eligible non-internal notices appear; private internal summary text is absent.
- **Existing defense:** The USER visibility branch requires `event.internal: false`; response projection uses event summary only for eligible rows.
- **Existing coverage:** API/PGlite tests verify internal events are excluded from the Client result set.
- **Coverage gap:** No test currently crosses the real Dashboard, Next rewrite, Express, and PGlite boundary for this assertion.
- **Impact:** Disclosure of internal workflow information.
- **Likelihood:** Low based on the explicit predicate; real proxy behavior is not yet verified.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A007-T001, PG-020-F001-A008-T003.
- **Environment:** API/PGlite existing coverage plus isolated Browser/Express/PGlite integration.
- **Status:** Hypothesis; integration boundary remains design-only; no vulnerability confirmed.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:84-94, 129-179`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:172-202, 223-255`; `apps/web/next.config.ts:62-71`.

### PG-020-ABUSE-008 — Notification response exposes unnecessary recipient or event fields

- **Related feature:** PG-020-F001-A007.
- **Threat actor:** Authenticated USER/Client inspecting their API response.
- **Target asset:** Recipient IDs, event IDs, actor identity, internal flag, and unrelated account metadata.
- **Entry point:** Notification `GET` JSON response.
- **Preconditions:** Synthetic event and notification with sentinel values on non-projected fields.
- **Manipulation:** Inspect response keys and nested values in an isolated API test.
- **Expected invariant:** Only the endpoint’s intentional public fields and derived summary/type/entity ID are returned.
- **Existing defense:** Prisma uses explicit notification and event `select` fields; the API does not select actor or password data.
- **Existing coverage:** Existing tests inspect feed behavior but do not assert the exact response-key allowlist.
- **Coverage gap:** Exact key/value privacy assertion is additive to the existing PGlite declaration.
- **Impact:** Unnecessary disclosure of internal identifiers or metadata.
- **Likelihood:** Low given explicit selection.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A007-T003.
- **Environment:** API/PGlite with synthetic sentinel values.
- **Status:** Hypothesis; source projection identified; runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:146-173`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:241-255`.

### PG-020-ABUSE-009 — Extreme list input or volume produces unbounded feed work

- **Related feature:** PG-020-F001-A007.
- **Threat actor:** Authenticated USER/Client.
- **Target asset:** API/database availability and unread total correctness.
- **Entry point:** Notification feed `GET`.
- **Preconditions:** Bounded synthetic set of 47 visible notices plus read, internal, and foreign controls.
- **Manipulation:** Request the fixed feed repeatedly with no arbitrary pagination or unbounded test load.
- **Expected invariant:** Response list is capped at 40, sorted deterministically, and unread count includes only all visible unread rows.
- **Existing defense:** Query has `take: 40`, deterministic ordering, scoped count, and RepeatableRead transaction.
- **Existing coverage:** PGlite assertions cover 47 records, tie ordering, the 40-item window, count, and foreign/internal rows.
- **Coverage gap:** No extreme-volume or denial-of-service probe is proposed or needed for this page.
- **Impact:** Excess query work or misleading unread total.
- **Likelihood:** Low because response limit is explicit.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A007-T002.
- **Environment:** API/PGlite with bounded synthetic rows.
- **Status:** Hypothesis; bounded defenses and assertions identified; runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:145-163`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:204-255`.

### PG-020-ABUSE-010 — Notification endpoint authentication or role scope is bypassed

- **Related feature:** PG-020-F001-A001, PG-020-F001-A007.
- **Threat actor:** Anonymous visitor or authenticated role outside the target resource scope.
- **Target asset:** Role-scoped notification summaries and account fields.
- **Entry point:** Direct API request, bypassing hidden UI controls.
- **Preconditions:** Synthetic unauthenticated and fixed-role API clients.
- **Manipulation:** Call the GET endpoint without a token and as USER, STAFF, ADMIN, and SUPERADMIN; inspect response projection.
- **Expected invariant:** Anonymous access is denied; authenticated responses remain scoped for their role and omit password hashes.
- **Existing defense:** Controller applies `requireAuth`; the service builds recipient/resource predicates from the authenticated ID and viewer role.
- **Existing coverage:** API/PGlite backend regression includes anonymous and four-role GET assertions and a no-password-hash check.
- **Coverage gap:** The role matrix does not prove every role’s distinct resource projection.
- **Impact:** Unauthorized access across role/resource boundaries.
- **Likelihood:** Low; middleware and viewer-specific query scope are present.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A007-T004, PG-020-F001-A008-T003.
- **Environment:** API/PGlite plus isolated browser/Express/PGlite integration.
- **Status:** Hypothesis; existing role assertions identified; runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.controller.ts:15-25`; `apps/api/src/features/request-workflow/workflow.notifications.ts:21-126`; `apps/api/tests/backend-regression.test.ts:112-130`.

### PG-020-ABUSE-011 — Guessed foreign or invisible notification ID mutates read state

- **Related feature:** PG-020-F001-A009.
- **Threat actor:** Client A with a guessed or leaked notification ID.
- **Target asset:** Another recipient’s or internal notification read state.
- **Entry point:** `PATCH /api/request-workflows/notifications/:id/read`.
- **Preconditions:** Synthetic foreign and internal notice IDs.
- **Manipulation:** Submit each ID while authenticated as the wrong recipient.
- **Expected invariant:** Endpoint returns 404 and neither row changes.
- **Existing defense:** Update predicate includes authenticated user ID, notification ID, and visibility scope; zero updates map to 404.
- **Existing coverage:** PGlite test asserts 404 for a foreign recipient and internal/invisible ID and confirms the feed is unchanged.
- **Coverage gap:** No known gap for the scoped API invariant; runtime unverified here.
- **Impact:** Unauthorized alteration of another user’s status.
- **Likelihood:** Low.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A009-T001.
- **Environment:** API/PGlite with two synthetic Clients.
- **Status:** Hypothesis; existing assertion identified; runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:181-190`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:269-280`.

### PG-020-ABUSE-012 — Replaying a single-read operation changes state unexpectedly

- **Related feature:** PG-020-F001-A009.
- **Threat actor:** Notification recipient or client retrying a request after a lost response.
- **Target asset:** Own notification read state and unread count.
- **Entry point:** Repeated single-read PATCH or repeated UI activation.
- **Preconditions:** One own unread synthetic notice.
- **Manipulation:** Mark the notice read twice and fetch the feed after each request.
- **Expected invariant:** The notice remains read, unread count does not increase, and replay causes no duplicate state change. No first-read timestamp guarantee is assumed without a contract.
- **Existing defense:** `updateMany` scopes the notice and writes `readAt`; a read notice remains scoped but already read.
- **Existing coverage:** Current PGlite test covers the initial read transition, not a second replay.
- **Coverage gap:** Add a replay assertion and stable unread-count check.
- **Impact:** Incorrect unread totals or repeated side effects.
- **Likelihood:** Medium because retries and repeated clicks can occur.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A009-T003.
- **Environment:** API/PGlite synthetic row; mocked browser may verify one-click UI behavior separately.
- **Status:** Hypothesis; replay not currently asserted; no defect confirmed.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:181-190`; `apps/web/src/features/workflow-notifications/components/workflow-notifications.tsx:70-82`.

### PG-020-ABUSE-013 — Mark-all operation affects hidden, foreign, or already-read rows

- **Related feature:** PG-020-F001-A010.
- **Threat actor:** Authenticated notification recipient.
- **Target asset:** Own and other recipients’ notification read state.
- **Entry point:** `PATCH /api/request-workflows/notifications/read-all` and Dashboard menu action.
- **Preconditions:** More than 40 own notices plus hidden/internal, foreign, and prior-read records.
- **Manipulation:** Activate mark-all once and replay it.
- **Expected invariant:** Only scoped unread rows are marked; foreign, hidden, and previously-read rows are unchanged.
- **Existing defense:** Bulk update predicates include authenticated recipient, resource visibility, and `readAt: null`.
- **Existing coverage:** PGlite snapshots cover greater-than-limit rows, hidden/foreign records, prior readAt, and repeated call; UI busy/error behavior is not covered.
- **Coverage gap:** Add browser assertions for busy, success, empty, and failure feedback; API invariant already has direct assertions.
- **Impact:** Unauthorized or unintended state changes and incorrect unread indicators.
- **Likelihood:** Low based on the explicit update predicate.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A010-T001, PG-020-F001-A010-T002.
- **Environment:** API/PGlite and mocked browser.
- **Status:** Hypothesis; API assertions identified; UI behavior runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:192-199`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:204-327`; `apps/web/src/features/workflow-notifications/components/workflow-notifications.tsx:84-104, 130-137`.

### PG-020-ABUSE-014 — Replayed bulk read overwrites earlier read timestamps

- **Related feature:** PG-020-F001-A010.
- **Threat actor:** Authenticated notification recipient repeating a successful operation.
- **Target asset:** Existing read timestamps.
- **Entry point:** Repeated `PATCH .../read-all`.
- **Preconditions:** Synthetic dataset with one previously-read record and unread records.
- **Manipulation:** Run the bounded mark-all operation twice and compare persisted snapshots.
- **Expected invariant:** Previously-read timestamps and the final persisted state remain stable on replay.
- **Existing defense:** The update filters `readAt: null`, so previously-read rows are excluded.
- **Existing coverage:** PGlite test verifies the prior timestamp and identical database snapshot after the second call.
- **Coverage gap:** No source-backed gap for this persistence assertion; runtime unverified here.
- **Impact:** Loss of read-history accuracy.
- **Likelihood:** Low.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A010-T001.
- **Environment:** API/PGlite with synthetic records.
- **Status:** Hypothesis; existing assertion identified; runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:192-199`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:315-327`.

### PG-020-ABUSE-015 — Notification preference hides or deletes the wrong records

- **Related feature:** PG-020-F001-A011.
- **Threat actor:** USER whose stored workflow-notification preference is disabled or restored.
- **Target asset:** Preference-controlled feed and persisted notice rows.
- **Entry point:** Notification feed GET after settings state changes.
- **Preconditions:** Synthetic USER with an eligible notification and `workflowNotifications` preference toggled in isolated data.
- **Manipulation:** Read while disabled, restore preference, then read again.
- **Expected invariant:** Disabled preference returns an empty list/count without deleting records; restoration exposes the same eligible feed.
- **Existing defense:** Service reads the setting and returns an empty response before querying the visible feed; it performs no deletion.
- **Existing coverage:** PGlite assertion compares empty response and restored response.
- **Coverage gap:** No Dashboard-specific settings mutation exists; this page only consumes the stored preference.
- **Impact:** Loss of notice visibility or unintended deletion.
- **Likelihood:** Low.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A011-T001.
- **Environment:** API/PGlite synthetic user.
- **Status:** Hypothesis; existing assertion identified; runtime unverified.
- **Evidence:** `apps/api/src/features/request-workflow/workflow.notifications.ts:129-144`; `apps/api/tests/request-workflow/fixed-price-and-notifications.ts:256-267`.

### PG-020-ABUSE-016 — Request identifier manipulates a notification destination

- **Related feature:** PG-020-F001-A008.
- **Threat actor:** Authenticated USER receiving a synthetic notification identifier with reserved URL characters.
- **Target asset:** Same-origin navigation and destination query parameters.
- **Entry point:** Selecting a normal request-workflow notification.
- **Preconditions:** Controlled mocked notification with request ID containing `/`, `&`, or `?`.
- **Manipulation:** Select the notice and inspect the resulting link/href.
- **Expected invariant:** Identifier is encoded as one parameter value; the link remains on the intended same-origin `/messages` route.
- **Existing defense:** Client builds a fixed local path and calls `encodeURIComponent` for request IDs.
- **Existing coverage:** Existing project-link test checks a safe project ID; normal request-ID encoding is not asserted.
- **Coverage gap:** Add a mocked browser case with reserved characters.
- **Impact:** Route confusion or query parameter substitution.
- **Likelihood:** Low; identifiers are generated internally but are encoded by source.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A008-T002.
- **Environment:** Mocked Playwright; no server or persistence boundary.
- **Status:** Hypothesis; source defense identified; runtime unverified.
- **Evidence:** `apps/web/src/features/workflow-notifications/components/workflow-notifications.tsx:140-163`.

### PG-020-ABUSE-017 — Notification link bypasses destination authorization

- **Related feature:** PG-020-F001-A008.
- **Threat actor:** Authenticated USER selecting a project or request notification.
- **Target asset:** Project or service-request resources.
- **Entry point:** Dashboard notification destination link and downstream page/API.
- **Preconditions:** Synthetic visible event with a known entity/request ID.
- **Manipulation:** Follow a project lifecycle or normal request notification link; separately request the destination as a non-owner in its own approved regression.
- **Expected invariant:** Dashboard constructs only the source-defined local destination, while the destination endpoint independently enforces ownership/role scope.
- **Existing defense:** Notification paths are selected by known event type and encoded IDs; downstream APIs own authorization.
- **Existing coverage:** Project link assertion exists; destination resource access has separate page/API coverage.
- **Coverage gap:** PG-020 does not duplicate destination API tests; those results must remain in their own page records.
- **Impact:** Unauthorized project/request disclosure if a destination endpoint lacks its own guard.
- **Likelihood:** Low for the Dashboard link itself; destination correctness is established by separate test records.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A008-T001, PG-020-F001-A008-T002.
- **Environment:** Mocked Playwright plus existing isolated destination API/browser tests.
- **Status:** Hypothesis; no Dashboard authorization bypass is claimed.
- **Evidence:** `apps/web/src/features/workflow-notifications/components/workflow-notifications.tsx:140-163`; destination route/controller tests remain in their authoritative PG records.

### PG-020-ABUSE-018 — Notification refresh failure or overlap leaves stale or unavailable UI

- **Related feature:** PG-020-F001-A006, PG-020-F001-A011.
- **Threat actor:** Authenticated USER using the portal while notification requests fail or refresh repeatedly.
- **Target asset:** Current notification state and page responsiveness.
- **Entry point:** Menu open retry and visible 30-second refresh.
- **Preconditions:** Synthetic pending/failing GET and fake clock; page remains isolated.
- **Manipulation:** Fail one request and reopen; separately hold a refresh across timer ticks and then unmount.
- **Expected invariant:** Error is visible and retry can recover; timer-driven refresh uses its in-flight guard; unmount aborts its request and prevents that aborted result from updating state.
- **Existing defense:** `watchVisibleRefresh` runs only while visible; refresh closure guards an in-flight timer request; AbortController protects effect cleanup.
- **Existing coverage:** Error/reopen/recovery browser test exists; periodic timer and cleanup assertions do not.
- **Coverage gap:** Add deterministic fake-clock coverage for refresh scheduling and cleanup; do not infer a global lock across user-triggered and timer-triggered requests.
- **Impact:** Stale notification state or unnecessary duplicate timer requests.
- **Likelihood:** Medium for transient service failure; low for timer overlap due guard.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A006-T001, PG-020-F001-A011-T002.
- **Environment:** Mocked Playwright with controlled responses and fake time.
- **Status:** Hypothesis; existing retry control identified; timer behavior not runtime verified.
- **Evidence:** `apps/web/src/features/workflow-notifications/components/workflow-notifications.tsx:33-79, 137-176`; `apps/web/e2e/dashboard/dashboard.spec.ts:177-184`.

### PG-020-ABUSE-019 — Large unread count is misleading or inaccessible

- **Related feature:** PG-020-F001-A006.
- **Threat actor:** USER receiving more than 99 unread notifications.
- **Target asset:** Accurate notification count and accessible control name.
- **Entry point:** Notification trigger badge.
- **Preconditions:** Mocked response with a bounded notification list and `unreadCount: 105`.
- **Manipulation:** Inspect visible badge text and accessible button name.
- **Expected invariant:** Visual count may cap at `99+`, while the accessible name preserves the full count.
- **Existing defense:** Badge is `aria-hidden`; trigger label includes the full server count.
- **Existing coverage:** Dashboard checks trigger presence, but not a count above 99 or its accessible name.
- **Coverage gap:** Add one mocked browser declaration.
- **Impact:** Users with assistive technology receive an incorrect or incomplete count.
- **Likelihood:** Low to medium depending on notification volume.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A006-T002.
- **Environment:** Mocked Playwright with synthetic count.
- **Status:** Hypothesis; source behavior identified; runtime unverified.
- **Evidence:** `apps/web/src/features/workflow-notifications/components/workflow-notifications.tsx:105-123`.

### PG-020-ABUSE-020 — Internal workspace links leak into responsive Client navigation

- **Related feature:** PG-020-F001-A003, PG-020-F001-A004.
- **Threat actor:** USER/Client navigating at desktop, tablet, or mobile widths.
- **Target asset:** Role-appropriate navigation and current route identity.
- **Entry point:** Sidebar and mobile navigation drawer.
- **Preconditions:** Synthetic USER session at 390px and wide viewport; default and remembered sidebar preference.
- **Manipulation:** Open/navigate through the drawer and inspect role-specific links and drawer state.
- **Expected invariant:** Only Client links appear, no workspace selector is shown, and drawer state tracks open/closed interaction.
- **Existing defense:** Sidebar builds links from role-aware navigation policy; drawer uses explicit state and accessible attributes.
- **Existing coverage:** Four-role route test and shared responsive workspace/navigation tests cover links and widths.
- **Coverage gap:** Escape and overlay-close assertions are additive; this is not a claim that links currently leak.
- **Impact:** Confusing or role-inappropriate navigation.
- **Likelihood:** Low.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A001-T002, PG-020-F001-A004-T001.
- **Environment:** Mocked Playwright at narrow and wide widths.
- **Status:** Hypothesis; existing role/navigation assertions identified; runtime unverified.
- **Evidence:** `apps/web/src/components/layout/sidebar.tsx:682-705, 721-785`; `apps/web/src/components/layout/app-layout.tsx:61-95`; `apps/web/e2e/workspace-selector.spec.ts:178-219`.

### PG-020-ABUSE-021 — Keyboard or overlay interaction strands the mobile drawer

- **Related feature:** PG-020-F001-A004.
- **Threat actor:** USER operating the navigation without a pointer or closing via overlay.
- **Target asset:** Route access and synchronized navigation state.
- **Entry point:** Mobile sidebar trigger, Escape key, overlay, and client link selection.
- **Preconditions:** USER at 390px with drawer initially closed.
- **Manipulation:** Open the drawer, press Escape; reopen and activate the overlay; reopen and select a client route.
- **Expected invariant:** Each supported close action closes the drawer and updates `aria-expanded`; link selection retains route identity.
- **Existing defense:** AppLayout handles Escape, overlay click, and link selection with shared drawer state.
- **Existing coverage:** Existing browser test verifies link selection closes the drawer; Escape and overlay state assertions are additive.
- **Coverage gap:** Add those keyboard/outside-close assertions; no focus-restoration product contract is inferred.
- **Impact:** Keyboard or narrow-screen users may be unable to use navigation efficiently.
- **Likelihood:** Low.
- **Risk priority:** Low.
- **Proposed test ID:** PG-020-F001-A004-T001.
- **Environment:** Mocked Playwright at 390px.
- **Status:** Hypothesis; source handlers identified; no defect confirmed.
- **Evidence:** `apps/web/src/components/layout/app-layout.tsx:61-95`; `apps/web/src/components/layout/sidebar.tsx:734-785`; `apps/web/e2e/dashboard/dashboard.spec.ts:93-114`.

### PG-020-ABUSE-022 — Inactive or retired account retains notification access

- **Related feature:** PG-020-F001-A001, PG-020-F001-A007.
- **Threat actor:** User whose account became inactive, retired, or session-revoked after token issuance.
- **Target asset:** Current account and notification feed.
- **Entry point:** A later `/api/auth/me` or notification API request using the old bearer token.
- **Preconditions:** Isolated synthetic API fixture changes account/session state between requests.
- **Manipulation:** Reuse the prior token after disabling/retiring the account or revoking its session.
- **Expected invariant:** Session middleware checks current account/session state and rejects the request before protected data is returned.
- **Existing defense:** Authentication middleware checks current session, account active/retired status, and token/session identity.
- **Existing coverage:** Generic JWT-session PGlite tests cover inactive, retired, and current-session cases; Dashboard browser test covers expired-session 401.
- **Coverage gap:** Existing middleware coverage is shared and indirect for this exact notification endpoint.
- **Impact:** Continued access after account deactivation or revocation.
- **Likelihood:** Low; depends on account state change and token reuse.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A001-T005, PG-020-F001-A007-T004.
- **Environment:** Isolated API/PGlite and mocked browser; synthetic user/session only.
- **Status:** Hypothesis; shared control tests identified; endpoint-specific runtime not verified here.
- **Evidence:** `apps/api/src/features/auth/auth.middleware.ts:40-69`; `apps/api/tests/jwt-session.test.ts:154-209`; `apps/web/e2e/auth/regression.spec.ts`.

### PG-020-ABUSE-023 — Messages unread requests include another Client's conversation data

- **Related feature:** PG-020-F001-A005.
- **Threat actor:** Client A issuing the Dashboard Messages count requests.
- **Target asset:** Client B's request/project conversation summaries, last-message metadata, or unread total.
- **Entry point:** `GET /api/request-conversations` and `GET /api/project-conversations?view=active`, invoked by the shared Dashboard topbar.
- **Preconditions:** Two synthetic USER clients, each with request/project records and unread message fixtures; include a non-client-visible project message.
- **Manipulation:** Request both list endpoints as Client A and compare returned row IDs, visible last messages, and unread totals with Client B's fixtures.
- **Expected invariant:** Only Client A's scoped conversations and client-visible message counts are returned; Client B's records do not affect A's badge.
- **Existing defense:** Request conversations use `visibleScope(userId)`; project conversations require USER/STAFF and use active Client ownership plus `visibleMessages(userId)` for last-message selection and unread counting.
- **Existing coverage:** PGlite request/project conversation suites cover authenticated access, current membership, and foreign detail/read denial.
- **Coverage gap:** No combined two-Client list/count assertion was identified for both endpoints, which the Dashboard topbar calls together.
- **Impact:** Cross-client conversation metadata or unread activity could be disclosed if a list scope regressed.
- **Likelihood:** Low given the source predicates; regression impact would be meaningful.
- **Risk priority:** Medium.
- **Proposed test ID:** PG-020-F001-A005-T003.
- **Environment:** API/PGlite with two synthetic USER clients and request/project records.
- **Status:** Hypothesis; source controls and related API tests identified; no defect confirmed and no test run here.
- **Evidence:** `apps/web/src/features/request-conversations/components/messages-link.tsx:20-112`; `apps/api/src/features/request-conversations/request-conversations.service.ts:39-62, 184-216, 220-321`; `apps/api/src/features/project-conversations/project-conversations.controller.ts:17-37`; `apps/api/src/features/project-conversations/project-conversations.service.ts:30-50, 121-152`.

## Traceability and disposition totals

The 23 hypotheses link to the 29-case authoritative specification. Disposition counts classify the existing assertion gap for each hypothesis; they do not multiply the unique case total. Several hypotheses intentionally share one case.

| Hypothesis disposition                      | Count | IDs                                                                                                        |
| ------------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------- |
| Existing assertions represent the invariant |    14 | PG-020-ABUSE-001–006, PG-020-ABUSE-009–011, PG-020-ABUSE-013–015, PG-020-ABUSE-017, PG-020-ABUSE-022       |
| New case required                           |     6 | PG-020-ABUSE-007, PG-020-ABUSE-012, PG-020-ABUSE-016, PG-020-ABUSE-018, PG-020-ABUSE-019, PG-020-ABUSE-023 |
| Additive assertion required                 |     3 | PG-020-ABUSE-008, PG-020-ABUSE-020, PG-020-ABUSE-021                                                       |
| Contract clarification required             |     0 | None identified from the current page source                                                               |

Every abuse ID is referenced from the atomic inventory and from its proposed case row(s); every case row lists its related abuse IDs where applicable. No hypothesis is marked passed, verified, or a confirmed vulnerability. PG-020 does not perform penetration testing or certify system security. The Phase 1 card/data API description versus current static Dashboard source remains a documented scope discrepancy, not an inferred exploit.

## Phase 2.2 execution evidence

The design hypotheses remain preserved above. Runtime classifications below apply only to executed synthetic boundaries. No penetration-test certification is claimed.

| Abuse ID         | Linked case IDs                                                     | Executed assertion boundary                                                               | Status / limitation                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-020-ABUSE-001 | PG-020-F001-A001-T005, PG-020-F001-A007-T004                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-002 | PG-020-F001-A001-T005                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-003 | PG-020-F001-A001-T001, PG-020-F001-A001-T002, PG-020-F001-A005-T001 | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-004 | PG-020-F001-A001-T003, PG-020-F001-A001-T004                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-005 | PG-020-F001-A003-T001, PG-020-F001-A003-T002, PG-020-F001-A003-T003 | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within mapped unit/UI assertions: USER receives no internal workspace; `/module` resolves to Dashboard and Switch Workspace is absent at 1440px and 390px. Protected API authorization remains separate. |
| PG-020-ABUSE-006 | PG-020-F001-A007-T001, PG-020-F001-A009-T001, PG-020-F001-A008-T003 | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-007 | PG-020-F001-A007-T001, PG-020-F001-A008-T003                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-008 | PG-020-F001-A007-T003                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-009 | PG-020-F001-A007-T002                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-010 | PG-020-F001-A007-T004, PG-020-F001-A008-T003                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-011 | PG-020-F001-A009-T001                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-012 | PG-020-F001-A009-T003                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-013 | PG-020-F001-A010-T001, PG-020-F001-A010-T002                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-014 | PG-020-F001-A010-T001                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-015 | PG-020-F001-A011-T001                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-016 | PG-020-F001-A008-T002                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-017 | PG-020-F001-A008-T001, PG-020-F001-A008-T002                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-018 | PG-020-F001-A006-T001, PG-020-F001-A011-T002                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | PARTIAL: retry, timer in-flight guard, and stop after unmount are asserted; actual request abortion and late-response suppression are not directly observed. No network-abort claim.                                      |
| PG-020-ABUSE-019 | PG-020-F001-A006-T002                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-020 | PG-020-F001-A001-T002, PG-020-F001-A004-T001                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-021 | PG-020-F001-A004-T001                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-022 | PG-020-F001-A001-T005, PG-020-F001-A007-T004                        | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |
| PG-020-ABUSE-023 | PG-020-F001-A005-T003                                               | See complete case matrix and exact command selections in PG-020_TEST_EXECUTION_RESULTS.md | VERIFIED CONTROL within executed mapped assertions; destination API authorization and broader attacks outside this page remain separate                                                                                   |

## Verification recovery reconciliation (2026-11-26)

- The 23 hypotheses remain mapped to the same 29 approved case IDs; the recovery added no case and did not change the case inventory.
- **22/23 hypotheses are VERIFIED CONTROL within their mapped executed assertions.** ABUSE-005 is now verified by passing USER workspace-model assertions and desktop/mobile navigation assertions. The test confirms the public root request is handled as anonymous, then verifies direct Dashboard entry, USER `/module` routing to `/dashboard`, and absence of an internal workspace selector. It does not claim direct internal API authorization from this page test.
- **ABUSE-018 remains PARTIAL.** The approved A011-T002 result requires both timer in-flight protection and cancellation of a pending request on unmount, with no late result applied. The executed assertions prove the timer guard and no further scheduled reads after unmount, but do not observe `AbortSignal.aborted`, a browser `requestfailed` abort, or the post-resolution UI. `useAsyncResource` source calls `controller.abort()` in cleanup, but source presence is not runtime evidence. No unapproved assertion or test was added to manufacture a verified status.
- No other hypothesis status changed. No PG-020 application or security defect is confirmed, and the 22 bounded controls do not constitute penetration-test certification.
